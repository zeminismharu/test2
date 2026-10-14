// GET /api/photo?q=고양이
// Pexels 에서 "차분한 수식어 + 입력"으로 사진을 찾아 한 장 돌려준다.
// API 키는 Cloudflare 환경 변수 PEXELS_API_KEY 에만 있고 브라우저로는 나가지 않는다.
import { hasBannedWord } from '../../shared/banned-words.js';

const MODIFIERS = ['잠자는', '평화로운', '포근한', '햇살 아래', '느긋한'];
const DEFAULT_QUERY = '잠자는 강아지';
const MAX_QUERY_LENGTH = 30;
const CACHE_SECONDS = 60 * 60 * 24; // 같은 검색어는 하루 동안 Pexels 를 다시 부르지 않음

export async function onRequestGet({ request, env, waitUntil }) {
  const input = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, MAX_QUERY_LENGTH);

  if (!input) return json({ error: 'empty_query' }, 400);
  if (hasBannedWord(input)) return json({ error: 'banned' }, 400);
  if (!env.PEXELS_API_KEY) return json({ error: 'missing_api_key' }, 500);

  const modifier = MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
  // 대비책: ① 수식어+입력 → ② 입력만 → ③ 기본 사진
  const attempts = [
    { query: `${modifier} ${input}`, level: 'modifier' },
    { query: input, level: 'input' },
    { query: DEFAULT_QUERY, level: 'default' },
  ];

  try {
    for (const { query, level } of attempts) {
      const photos = await searchPexels(query, env.PEXELS_API_KEY, waitUntil);
      if (photos.length > 0) {
        const photo = photos[Math.floor(Math.random() * photos.length)];
        return json({ query, level, photo: toPhoto(photo) });
      }
    }
    return json({ error: 'no_results' }, 404);
  } catch (err) {
    return json({ error: 'pexels_failed', detail: String(err.message || err) }, 502);
  }
}

async function searchPexels(query, apiKey, waitUntil) {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('locale', 'ko-KR');
  url.searchParams.set('per_page', '15');

  // 캐시 키에는 API 키를 넣지 않는다. 결과 목록을 캐시해 두고 그 안에서 랜덤으로 고른다.
  const cache = caches.default;
  const cacheKey = new Request(url.toString());
  const cached = await cache.match(cacheKey);
  if (cached) return (await cached.json()).photos || [];

  const res = await fetch(url, { headers: { Authorization: apiKey } });
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const data = await res.json();

  const toCache = new Response(JSON.stringify({ photos: data.photos || [] }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` },
  });
  waitUntil(cache.put(cacheKey, toCache));
  return data.photos || [];
}

function toPhoto(p) {
  return {
    id: p.id,
    width: p.width,
    height: p.height,
    alt: p.alt || '',
    color: p.avg_color,
    src: p.src.large, // 화면용
    srcLarge: p.src.large2x, // 결과 카드 저장용
    photographer: p.photographer,
    photographerUrl: p.photographer_url,
    pexelsUrl: p.url,
  };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
