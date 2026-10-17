/**
 * 밈 포맷 수집·정형화 도구 백엔드 — Cloudflare Pages · Advanced mode
 *
 * 모든 API를 이 파일 하나에 담고, API가 아닌 요청은 env.ASSETS 로 넘겨 정적 파일을 그대로 보여줍니다.
 * 유튜브 쿼터와 Claude 요금이 드는 도구라서 전부 로그인해야 씁니다 (ADMIN_PASSWORD 가 없으면 아무도 못 씀).
 *
 *   POST   /api/collect                   유튜브 검색 + 추적 중인 영상 조회수 기록 (GitHub Actions 가 하루 2번)
 *   GET    /api/videos                    전체 영상 + 증가 속도 (최근 스냅샷 두 개 비교)
 *   GET    /api/rank.csv                  증가 속도 순위를 CSV 로 받기
 *   POST   /api/videos  { url, title, memo }  틱톡·인스타 등 링크 직접 등록 (같은 링크면 새 메모로 바꿈)
 *   GET    /api/videos/:id                영상 하나 + 스냅샷 + 포맷 카드 + 대본들
 *   PUT    /api/videos/:id  { memo }      메모 저장
 *   DELETE /api/videos/:id                영상 지우기 (스냅샷·카드·대본도)
 *   POST   /api/videos/:id/card           포맷 카드 만들기 (Claude)
 *   POST   /api/videos/:id/adapt          포맷 카드를 업체용 대본으로 (Claude), 대본은 저장
 *   GET/PUT /api/settings                 검색어·업체 정보
 *   POST   /api/login  { password } · POST /api/logout · GET /api/session
 *
 * 필요한 설정 (배포 워크플로가 자동으로 연결합니다):
 *   D1 database  → DB
 *   Secret       → ADMIN_PASSWORD, YOUTUBE_API_KEY, ANTHROPIC_API_KEY
 *   선택         → CLAUDE_MODEL (기본 claude-sonnet-5-5), SESSION_SECRET
 */

const COOKIE_NAME = 'meme_session';
const SESSION_TTL = 60 * 60 * 24 * 30; // 30일
const DEFAULT_MODEL = 'claude-sonnet-5-5';
const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const ANTHROPIC_API = 'https://api.anthropic.com';
// 같은 영상의 두 스냅샷이 이보다 가까우면 속도를 계산하지 않음 (잠깐 사이 두 번 돌린 경우)
const MIN_HOURS = 1;

const DEFAULT_SETTINGS = {
  youtube: {
    queries: ['밈', '챌린지', '쇼츠 유행', '이사', '청소 전후'],
    region: 'KR',
    days: 3,
    maxResultsPerQuery: 25,
    maxDurationSec: 180,
    trackDays: 7,
  },
  business: {
    name: '일산수거이사',
    service: '이사, 폐기물 수거, 집 정리',
    area: '일산·고양',
    contact_line: '사진 보내주시면 당일 견적',
    tone: '친근하고 담백하게, 과장 없이',
  },
};

const encoder = new TextEncoder();
const str = (v, max) => String(v ?? '').trim().slice(0, max);
const now = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
let schemaReady = false;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (!pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    try {
      if (!env.DB) return json({ error: '데이터베이스(DB)가 연결되지 않았습니다.' }, 503);
      await ensureSchema(env);
      return await route(request, env, pathname.slice(5).split('/').map(decodeURIComponent));
    } catch (err) {
      console.error(err);
      return json({ error: err.userMessage || '서버 오류가 났습니다. 잠시 뒤 다시 해 주세요.' }, err.status || 500);
    }
  },
};

async function route(request, env, parts) {
  const m = request.method;
  const [head, id, sub] = parts;

  if (head === 'session' && !id) return m === 'GET' ? json({ loggedIn: await isLoggedIn(request, env), ready: !!env.ADMIN_PASSWORD, claude: !!env.ANTHROPIC_API_KEY }) : methodNotAllowed();
  if (head === 'login' && !id) return m === 'POST' ? login(request, env) : methodNotAllowed();
  if (head === 'logout' && !id) return m === 'POST' ? logout() : methodNotAllowed();

  const denied = await requireLogin(request, env);
  if (denied) return denied;

  if (head === 'collect' && !id) return m === 'POST' ? collect(env) : methodNotAllowed();
  if (head === 'rank.csv' && !id) return m === 'GET' ? rankCsv(env) : methodNotAllowed();
  if (head === 'settings' && !id) {
    if (m === 'GET') return json(await getSettings(env));
    if (m === 'PUT') return putSettings(request, env);
    return methodNotAllowed();
  }
  if (head === 'videos') {
    if (!id) {
      if (m === 'GET') return json({ videos: await listVideos(env) });
      if (m === 'POST') return addManual(request, env);
      return methodNotAllowed();
    }
    if (!sub) {
      if (m === 'GET') return getVideo(env, id);
      if (m === 'PUT') return putMemo(request, env, id);
      if (m === 'DELETE') return deleteVideo(env, id);
      return methodNotAllowed();
    }
    if (sub === 'card') return m === 'POST' ? makeCard(env, id) : methodNotAllowed();
    if (sub === 'adapt') return m === 'POST' ? adapt(env, id) : methodNotAllowed();
  }
  return notFound();
}

/* ─────────────── 저장소 ─────────────── */

async function ensureSchema(env) {
  if (schemaReady) return;
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS videos (
      id TEXT PRIMARY KEY,            -- 'yt:영상ID' 또는 'manual:해시'
      platform TEXT NOT NULL,         -- youtube / tiktok / instagram / other
      url TEXT NOT NULL,
      title TEXT, channel TEXT, published_at TEXT, duration_sec INTEGER,
      memo TEXT,                      -- 사람이 보고 적은 설명
      added_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS snapshots (
      video_id TEXT NOT NULL, taken_at TEXT NOT NULL,
      views INTEGER, likes INTEGER, comments INTEGER,
      PRIMARY KEY (video_id, taken_at))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS cards (
      video_id TEXT PRIMARY KEY, card_json TEXT NOT NULL, created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL,
      script_json TEXT NOT NULL, created_at TEXT NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
  ]);
  schemaReady = true;
}

async function getSettings(env) {
  const row = await env.DB.prepare(`SELECT value FROM settings WHERE key = 'config'`).first();
  const saved = row ? safeParse(row.value, {}) : {};
  return {
    youtube: { ...DEFAULT_SETTINGS.youtube, ...saved.youtube },
    business: { ...DEFAULT_SETTINGS.business, ...saved.business },
  };
}

async function putSettings(request, env) {
  const body = await readJson(request);
  if (!body) return json({ error: '내용이 비어 있습니다.' }, 400);
  const cur = await getSettings(env);
  const yt = body.youtube || {};
  const num = (v, d, lo, hi) => Math.min(hi, Math.max(lo, Math.round(Number(v)) || d));
  const queries = Array.isArray(yt.queries) ? yt.queries.map((q) => str(q, 60)).filter(Boolean).slice(0, 10) : cur.youtube.queries;
  const next = {
    youtube: {
      queries,
      region: str(yt.region ?? cur.youtube.region, 2).toUpperCase() || 'KR',
      days: num(yt.days, cur.youtube.days, 1, 30),
      maxResultsPerQuery: num(yt.maxResultsPerQuery, cur.youtube.maxResultsPerQuery, 1, 50),
      maxDurationSec: num(yt.maxDurationSec, cur.youtube.maxDurationSec, 10, 600),
      trackDays: num(yt.trackDays, cur.youtube.trackDays, 1, 30),
    },
    business: Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS.business).map((k) => [k, str(body.business?.[k] ?? cur.business[k], 300)]),
    ),
  };
  await env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('config', ?)`).bind(JSON.stringify(next)).run();
  return json(next);
}

function upsertVideo(env, v) {
  // 새 영상이면 추가하고, 이미 있으면 비어 있는 칸만 채운다 (메모는 여기서 건드리지 않음)
  return env.DB.prepare(
    `INSERT INTO videos (id, platform, url, title, channel, published_at, duration_sec, memo, added_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title        = COALESCE(videos.title, excluded.title),
       channel      = COALESCE(videos.channel, excluded.channel),
       published_at = COALESCE(videos.published_at, excluded.published_at),
       duration_sec = COALESCE(videos.duration_sec, excluded.duration_sec)`,
  ).bind(v.id, v.platform, v.url, v.title ?? null, v.channel ?? null, v.published_at ?? null, v.duration_sec ?? null, v.memo ?? null, now());
}

/* ─────────────── 유튜브 수집 ─────────────── */
// 쿼터(기본 하루 10,000 단위): search 는 호출당 100, videos 는 호출당 1.
// 검색어 5개를 하루 2번 돌리면 search 만 1,000 단위 정도라 여유가 있습니다.

async function youtube(env, endpoint, params) {
  const qs = new URLSearchParams({ ...params, key: env.YOUTUBE_API_KEY });
  const r = await fetch(`${env.YOUTUBE_API_BASE || YOUTUBE_API}/${endpoint}?${qs}`);
  if (!r.ok) throw userError(`유튜브 API 오류 ${r.status}: ${(await r.text()).slice(0, 300)}`, 502);
  return r.json();
}

function parseDuration(iso) {
  // 'PT1M5S' 같은 ISO 8601 길이를 초로. 'P0D'(생방송 중)처럼 못 읽으면 null
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return null;
  const [h, mi, s] = m.slice(1).map((x) => Number(x || 0));
  return h * 3600 + mi * 60 + s;
}

async function collect(env) {
  if (!env.YOUTUBE_API_KEY) return json({ error: 'YOUTUBE_API_KEY 비밀값이 없습니다.' }, 503);
  const { youtube: cfg } = await getSettings(env);
  const after = new Date(Date.now() - cfg.days * 864e5).toISOString().replace(/\.\d+Z$/, 'Z');

  const newIds = new Set();
  for (const q of cfg.queries) {
    // videoDuration=short 는 4분 미만. 쇼츠(3분 이하)는 아래에서 길이로 한 번 더 거름
    const data = await youtube(env, 'search', {
      part: 'id', q, type: 'video', videoDuration: 'short', order: 'viewCount',
      publishedAfter: after, regionCode: cfg.region, relevanceLanguage: 'ko', maxResults: cfg.maxResultsPerQuery,
    });
    for (const it of data.items || []) if (it.id?.videoId) newIds.add(it.id.videoId);
  }

  const cutoff = new Date(Date.now() - cfg.trackDays * 864e5).toISOString();
  const { results: tracked } = await env.DB.prepare(`SELECT id FROM videos WHERE platform = 'youtube' AND added_at >= ?`).bind(cutoff).all();
  const all = [...new Set([...newIds, ...tracked.map((r) => r.id.slice(3))])];

  const takenAt = now();
  const stmts = [];
  for (let i = 0; i < all.length; i += 50) {
    const data = await youtube(env, 'videos', { part: 'snippet,statistics,contentDetails', id: all.slice(i, i + 50).join(',') });
    for (const it of data.items || []) {
      const dur = parseDuration(it.contentDetails?.duration);
      if (dur == null || dur > cfg.maxDurationSec) continue;
      const sn = it.snippet || {};
      const st = it.statistics || {};
      const id = `yt:${it.id}`;
      stmts.push(upsertVideo(env, {
        id, platform: 'youtube', url: `https://www.youtube.com/shorts/${it.id}`,
        title: sn.title, channel: sn.channelTitle, published_at: sn.publishedAt, duration_sec: dur,
      }));
      stmts.push(env.DB.prepare(`INSERT OR REPLACE INTO snapshots VALUES (?, ?, ?, ?, ?)`).bind(
        id, takenAt, Number(st.viewCount || 0),
        st.likeCount != null ? Number(st.likeCount) : null,
        st.commentCount != null ? Number(st.commentCount) : null,
      ));
    }
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ found: newIds.size, saved: stmts.length / 2, takenAt });
}

/* ─────────────── 목록 · 순위 ─────────────── */
// 조회수 '총량'이 아니라 '증가 속도(시간당 조회수)'로 지금 뜨는 영상을 고릅니다.
// 영상마다 가장 최근 스냅샷 두 개를 비교하고, 하나뿐이면 계산하지 않습니다.

async function listVideos(env) {
  const { results } = await env.DB.prepare(
    `WITH s AS (
       SELECT video_id, taken_at, views,
              ROW_NUMBER() OVER (PARTITION BY video_id ORDER BY taken_at DESC) AS n
       FROM snapshots)
     SELECT v.*, a.views AS views, a.taken_at AS last_at, b.views AS prev_views, b.taken_at AS prev_at,
            (SELECT COUNT(*) FROM snapshots x WHERE x.video_id = v.id) AS snaps,
            EXISTS (SELECT 1 FROM cards c WHERE c.video_id = v.id) AS has_card
     FROM videos v
     LEFT JOIN s a ON a.video_id = v.id AND a.n = 1
     LEFT JOIN s b ON b.video_id = v.id AND b.n = 2`,
  ).all();

  return results.map((r) => {
    let perHour = null;
    let growthPct = null;
    if (r.prev_at) {
      const hours = (Date.parse(r.last_at) - Date.parse(r.prev_at)) / 36e5;
      if (hours >= MIN_HOURS) {
        const gain = r.views - r.prev_views;
        perHour = Math.round(gain / hours);
        growthPct = r.prev_views ? Math.round((gain / r.prev_views) * 1000) / 10 : null;
      }
    }
    return {
      id: r.id, platform: r.platform, url: r.url, title: r.title, channel: r.channel,
      publishedAt: r.published_at, durationSec: r.duration_sec, memo: r.memo, addedAt: r.added_at,
      views: r.views, lastAt: r.last_at, snaps: r.snaps, hasCard: !!r.has_card,
      viewsPerHour: perHour, growthPct,
    };
  });
}

function ranked(videos) {
  return videos.filter((v) => v.viewsPerHour != null).sort((a, b) => b.viewsPerHour - a.viewsPerHour);
}

async function rankCsv(env) {
  const rows = ranked(await listVideos(env));
  const cell = (v) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [['순위', '시간당 조회수', '증가율(%)', '조회수', '제목', '채널', '링크', 'ID', '메모'].join(',')];
  rows.forEach((r, i) => lines.push([i + 1, r.viewsPerHour, r.growthPct, r.views, r.title, r.channel, r.url, r.id, r.memo].map(cell).join(',')));
  // 엑셀에서 한글이 깨지지 않도록 BOM 을 붙입니다
  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="meme-rank-${now().slice(0, 10)}.csv"`,
      'cache-control': 'no-store',
    },
  });
}

/* ─────────────── 영상 하나 ─────────────── */

function detectPlatform(url) {
  if (/tiktok\.com/i.test(url)) return 'tiktok';
  if (/instagram\.com/i.test(url)) return 'instagram';
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  return 'other';
}

async function manualId(url) {
  const hash = await crypto.subtle.digest('SHA-1', encoder.encode(url));
  return 'manual:' + [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 10);
}

async function addManual(request, env) {
  const body = await readJson(request);
  const url = str(body?.url, 1000);
  if (!/^https?:\/\//i.test(url)) return json({ error: '영상 링크(https://…)를 넣어 주세요.' }, 400);
  const id = await manualId(url);
  const memo = str(body?.memo, 5000) || null;
  await env.DB.batch([
    upsertVideo(env, { id, platform: detectPlatform(url), url, title: str(body?.title, 300) || null, memo }),
    // 같은 링크를 다시 넣으면서 메모를 적었다면 새 메모로 바꿉니다
    ...(memo ? [env.DB.prepare(`UPDATE videos SET memo = ? WHERE id = ?`).bind(memo, id)] : []),
  ]);
  return json({ id });
}

async function getVideo(env, id) {
  const v = await env.DB.prepare(`SELECT * FROM videos WHERE id = ?`).bind(id).first();
  if (!v) return notFound();
  const [{ results: snaps }, card, { results: scripts }] = await Promise.all([
    env.DB.prepare(`SELECT taken_at, views, likes, comments FROM snapshots WHERE video_id = ? ORDER BY taken_at`).bind(id).all(),
    env.DB.prepare(`SELECT card_json, created_at FROM cards WHERE video_id = ?`).bind(id).first(),
    env.DB.prepare(`SELECT id, script_json, created_at FROM scripts WHERE video_id = ? ORDER BY id DESC`).bind(id).all(),
  ]);
  return json({
    video: v,
    snapshots: snaps,
    card: card ? { ...safeParse(card.card_json, {}), createdAt: card.created_at } : null,
    scripts: scripts.map((s) => ({ id: s.id, createdAt: s.created_at, ...safeParse(s.script_json, {}) })),
  });
}

async function putMemo(request, env, id) {
  const body = await readJson(request);
  const memo = str(body?.memo, 5000) || null;
  const res = await env.DB.prepare(`UPDATE videos SET memo = ? WHERE id = ?`).bind(memo, id).run();
  if (!res.meta.changes) return notFound();
  return json({ ok: true });
}

async function deleteVideo(env, id) {
  await env.DB.batch(['snapshots', 'cards', 'scripts'].map((t) => env.DB.prepare(`DELETE FROM ${t} WHERE video_id = ?`).bind(id))
    .concat(env.DB.prepare(`DELETE FROM videos WHERE id = ?`).bind(id)));
  return json({ ok: true });
}

/* ─────────────── 포맷 카드 · 대본 (Claude) ─────────────── */
// Claude 는 영상을 직접 보지 않습니다. 제목과 사람이 적은 메모만 보고 형식을 추론하므로,
// 메모를 구체적으로 적을수록(첫 장면, 자막, 반전, 음원) 카드 품질이 올라갑니다.

const CARD_SYSTEM =
  "너는 숏폼 밈의 '형식'을 분석해 재사용 가능한 템플릿으로 정리하는 편집자다. " +
  '원본 영상, 대사, 음원을 복제하지 말고 구조와 패턴만 추출한다. ' +
  '정보가 부족한 칸은 추측하지 말고 null 로 두고 confidence 를 low 로 한다.';

const nullable = (description) => ({ anyOf: [{ type: 'string' }, { type: 'null' }], description });
const obj = (properties) => ({ type: 'object', properties, required: Object.keys(properties), additionalProperties: false });

const CARD_SCHEMA = obj({
  format_name: nullable('이 밈 형식의 짧은 이름'),
  hook: nullable('첫 1~2초에 무엇을 하는지 (구조로 설명)'),
  structure: { type: 'array', description: '시간대별 장면', items: obj({ sec: { type: 'string', description: '예: 0-2' }, what: { type: 'string', description: '장면 설명' } }) },
  caption_pattern: nullable('자막 문장 패턴, 바꿔 넣을 자리는 {대상}처럼 표시'),
  audio_type: nullable('유행 음원 / 내레이션 / 무음+효과음 등'),
  twist: nullable('반전이나 웃음 포인트'),
  why_it_works: nullable('잘 되는 이유 1~2문장'),
  fit_for_local_service: nullable('현장 서비스 업종에 쓰기 좋은 정도 high/mid/low 와 이유'),
  confidence: { type: 'string', enum: ['high', 'mid', 'low'] },
});

const ADAPT_SYSTEM =
  '너는 동네 현장 서비스 업체의 숏폼 대본 작가다. 주어진 포맷 카드의 형식만 빌리고, ' +
  '내용은 업체의 실제 서비스로 채운다. 과장 광고, 허위 가격, 타인의 음원이나 영상 사용 지시는 넣지 않는다.';

const SCRIPT_SCHEMA = obj({
  title: { type: 'string', description: '내부 관리용 제목' },
  hook_caption: { type: 'string', description: '첫 2초 자막' },
  shots: { type: 'array', items: obj({ sec: { type: 'string', description: '예: 0-2' }, shot: { type: 'string', description: '찍을 장면' }, caption: { type: 'string', description: '자막' } }) },
  ending_caption: { type: 'string', description: '마지막 행동 유도 자막' },
  shooting_notes: { type: 'string', description: '현장에서 찍을 때 주의할 점 (개인정보 노출 주의 포함)' },
});

async function askJson(env, system, prompt, schema) {
  if (!env.ANTHROPIC_API_KEY) throw userError('ANTHROPIC_API_KEY 비밀값이 없습니다.', 503);
  const r = await fetch(`${env.ANTHROPIC_BASE_URL || ANTHROPIC_API}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      // 안전 분류기가 거절하면 서버가 알아서 다른 모델로 다시 돌립니다
      'anthropic-beta': 'server-side-fallback-2026-07-01',
    },
    body: JSON.stringify({
      model: env.CLAUDE_MODEL || DEFAULT_MODEL,
      max_tokens: 16000,
      system,
      messages: [{ role: 'user', content: prompt }],
      // 답을 이 JSON 모양으로만 받습니다 (예전처럼 JSON 이 깨져서 멈추는 일 방지)
      output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      fallbacks: 'default',
    }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = data?.error?.message || `HTTP ${r.status}`;
    throw userError(r.status === 429 ? 'Claude 사용 한도에 걸렸습니다. 잠시 뒤 다시 해 주세요.' : `Claude API 오류: ${msg}`, r.status === 429 ? 429 : 502);
  }
  if (data.stop_reason === 'refusal') throw userError('Claude 가 이 요청을 거절했습니다. 메모 내용을 바꿔 다시 해 보세요.', 422);
  if (data.stop_reason === 'max_tokens') throw userError('답이 너무 길어 중간에 끊겼습니다. 다시 해 주세요.', 502);
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  const out = safeParse(text, null);
  if (!out) throw userError('Claude 답을 읽지 못했습니다. 다시 해 주세요.', 502);
  return out;
}

async function makeCard(env, id) {
  const v = await env.DB.prepare(`SELECT * FROM videos WHERE id = ?`).bind(id).first();
  if (!v) return notFound();
  const prompt =
    `플랫폼: ${v.platform}\n제목: ${v.title || '(없음)'}\n` +
    `길이: ${v.duration_sec ?? '모름'}초\n` +
    `사람이 보고 적은 메모: ${v.memo || '(없음)'}\n\n` +
    '위 숏폼의 형식을 정리해.';
  const card = await askJson(env, CARD_SYSTEM, prompt, CARD_SCHEMA);
  const createdAt = now();
  await env.DB.prepare(`INSERT OR REPLACE INTO cards VALUES (?, ?, ?)`).bind(id, JSON.stringify(card), createdAt).run();
  return json({ card: { ...card, createdAt } });
}

async function adapt(env, id) {
  const row = await env.DB.prepare(`SELECT card_json FROM cards WHERE video_id = ?`).bind(id).first();
  if (!row) return json({ error: '포맷 카드가 없습니다. 먼저 카드를 만들어 주세요.' }, 400);
  const { business } = await getSettings(env);
  const prompt =
    `포맷 카드:\n${row.card_json}\n\n` +
    `업체 정보:\n${JSON.stringify(business)}\n\n` +
    '이 형식을 빌려 15~30초 세로 숏폼 대본을 써줘.';
  const script = await askJson(env, ADAPT_SYSTEM, prompt, SCRIPT_SCHEMA);
  const createdAt = now();
  const res = await env.DB.prepare(`INSERT INTO scripts (video_id, script_json, created_at) VALUES (?, ?, ?)`).bind(id, JSON.stringify(script), createdAt).run();
  return json({ script: { id: res.meta.last_row_id, createdAt, ...script } });
}

/* ─────────────── 로그인 ─────────────── */

async function sessionKey(env) {
  const secret = env.SESSION_SECRET || `meme:${env.ADMIN_PASSWORD}`;
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(env, payload) {
  return b64url(await crypto.subtle.sign('HMAC', await sessionKey(env), encoder.encode(payload)));
}

async function isLoggedIn(request, env) {
  if (!env.ADMIN_PASSWORD) return false; // 비밀번호가 없으면 아무도 못 씀 (API 요금 보호)
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!match) return false;
  const [exp, sig] = match[1].split('.');
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  return timingSafeEqual(sig, await sign(env, exp));
}

async function requireLogin(request, env) {
  if (await isLoggedIn(request, env)) return null;
  return json({ error: '로그인이 필요합니다.' }, 401);
}

async function login(request, env) {
  if (!env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD 비밀값이 아직 없습니다. 배포 설정을 확인해 주세요.' }, 503);
  const body = await readJson(request);
  const given = String(body?.password ?? '');
  // 길이가 달라도 비교 시간이 같도록 해시끼리 비교합니다.
  const [a, b] = await Promise.all([given, env.ADMIN_PASSWORD].map((s) => crypto.subtle.digest('SHA-256', encoder.encode(s))));
  if (!timingSafeEqual(b64url(a), b64url(b))) {
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: '비밀번호가 맞지 않습니다.' }, 401);
  }
  const exp = String(Math.floor(Date.now() / 1000) + SESSION_TTL);
  const value = `${exp}.${await sign(env, exp)}`;
  return json({ ok: true }, 200, {
    'set-cookie': `${COOKIE_NAME}=${value}; Path=/; Max-Age=${SESSION_TTL}; HttpOnly; Secure; SameSite=Strict`,
  });
}

function logout() {
  return json({ ok: true }, 200, { 'set-cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* ─────────────── 도우미 ─────────────── */

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}

async function readJson(request) {
  try {
    const v = await request.json();
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
}

function safeParse(s, fallback) {
  try {
    return JSON.parse(s) ?? fallback;
  } catch {
    return fallback;
  }
}

function userError(message, status) {
  return Object.assign(new Error(message), { userMessage: message, status });
}

const notFound = () => json({ error: '찾을 수 없습니다.' }, 404);
const methodNotAllowed = () => json({ error: '허용되지 않는 요청입니다.' }, 405);
