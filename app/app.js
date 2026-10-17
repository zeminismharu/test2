// 밈 포맷 화면 — 순위 · 전체 · 등록 · 설정, 영상을 누르면 바텀시트(메모 → 포맷 카드 → 대본)
'use strict';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n) => (n == null ? '-' : Number(n).toLocaleString('ko-KR'));
const day = (iso) => (iso ? new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');
const PLATFORM = { youtube: '유튜브', tiktok: '틱톡', instagram: '인스타', other: '기타' };

let videos = [];
let filter = 'all';

async function api(path, opts = {}) {
  const r = await fetch('/api/' + path, {
    ...opts,
    headers: opts.body ? { 'content-type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== 'login') showLogin();
  if (!r.ok) throw new Error(data.error || `오류 ${r.status}`);
  return data;
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.hidden = true), 3200);
}

async function busy(btn, label, fn) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try {
    return await fn();
  } catch (e) {
    toast(e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = old;
  }
}

/* ── 로그인 ── */

function showLogin(note) {
  $('#login').hidden = false;
  $('#app').hidden = $('#tabbar').hidden = $('#logoutBtn').hidden = true;
  if (note) $('#loginNote').textContent = note;
}

async function start() {
  const s = await api('session').catch(() => ({}));
  if (!s.ready) return showLogin('아직 비밀번호(ADMIN_PASSWORD)가 설정되지 않았습니다. README 의 "처음 한 번"을 따라 넣고 다시 배포해 주세요.');
  if (!s.loggedIn) return showLogin();
  $('#login').hidden = true;
  $('#app').hidden = $('#tabbar').hidden = $('#logoutBtn').hidden = false;
  await load();
}

$('#loginForm').onsubmit = async (e) => {
  e.preventDefault();
  try {
    await api('login', { method: 'POST', body: { password: $('#password').value } });
    $('#password').value = '';
    await start();
  } catch (err) {
    toast(err.message);
  }
};

$('#logoutBtn').onclick = async () => {
  await api('logout', { method: 'POST' }).catch(() => {});
  showLogin();
};

/* ── 탭 ── */

function showView(name) {
  for (const b of document.querySelectorAll('#tabbar button')) b.classList.toggle('on', b.dataset.view === name);
  for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== 'view-' + name;
  if (name === 'settings') loadSettings();
  window.scrollTo(0, 0);
}
for (const b of document.querySelectorAll('#tabbar button')) b.onclick = () => showView(b.dataset.view);

/* ── 목록 ── */

async function load() {
  ({ videos } = await api('videos'));
  renderRank();
  renderAll();
}

function itemHtml(v, num) {
  const speed = v.viewsPerHour != null
    ? `<div class="speed">시간당 ${fmt(v.viewsPerHour)}회${v.growthPct != null ? `<small>+${v.growthPct}%</small>` : ''}</div>`
    : '';
  const badges = `<span class="badge">${PLATFORM[v.platform] || v.platform}</span>${v.memo ? '<span class="badge">메모</span>' : ''}${v.hasCard ? '<span class="badge blue">카드</span>' : ''}`;
  return `<li><button class="item" type="button" data-id="${esc(v.id)}">
    ${num != null ? `<span class="num">${num}</span>` : ''}
    <div class="main"><div class="title">${esc(v.title || v.url)}</div>
    <div class="meta">${badges} ${esc(v.channel || '')} ${v.views != null ? '· 조회 ' + fmt(v.views) : ''}</div></div>
    ${speed}</button></li>`;
}

function renderRank() {
  const rows = videos.filter((v) => v.viewsPerHour != null).sort((a, b) => b.viewsPerHour - a.viewsPerHour).slice(0, 50);
  const last = videos.map((v) => v.lastAt).filter(Boolean).sort().pop();
  $('#rankNote').textContent = last ? `시간당 조회수가 빨리 느는 순서 · 마지막 수집 ${day(last)}` : '아직 수집한 적이 없습니다.';
  $('#rankList').innerHTML = rows.length
    ? rows.map((v, i) => itemHtml(v, i + 1)).join('')
    : '<li class="empty">순위를 내려면 몇 시간 간격으로 두 번 이상 수집해야 합니다.<br>하루 2번(오전 9시대·오후 9시대) 자동으로 수집합니다.</li>';
}

function renderAll() {
  const counts = { all: videos.length };
  for (const v of videos) counts[v.platform] = (counts[v.platform] || 0) + 1;
  const keys = ['all', ...Object.keys(PLATFORM).filter((k) => counts[k])];
  $('#filterChips').innerHTML = keys
    .map((k) => `<button type="button" data-k="${k}" class="${k === filter ? 'on' : ''}">${k === 'all' ? '전체' : PLATFORM[k]} ${counts[k]}</button>`)
    .join('') + `<button type="button" data-k="memo" class="${filter === 'memo' ? 'on' : ''}">메모 있는 것</button>`;
  const rows = videos
    .filter((v) => filter === 'all' || (filter === 'memo' ? v.memo : v.platform === filter))
    .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
  $('#allList').innerHTML = rows.length ? rows.map((v) => itemHtml(v)).join('') : '<li class="empty">아직 없습니다.</li>';
}

$('#filterChips').onclick = (e) => {
  const k = e.target.closest('button')?.dataset.k;
  if (!k) return;
  filter = k;
  renderAll();
};

for (const list of ['#rankList', '#allList']) {
  $(list).onclick = (e) => {
    const id = e.target.closest('.item')?.dataset.id;
    if (id) openVideo(id);
  };
}

$('#collectBtn').onclick = (e) =>
  busy(e.currentTarget, '수집 중…', async () => {
    const r = await api('collect', { method: 'POST' });
    toast(`검색으로 찾은 영상 ${r.found}개, 조회수 기록 ${r.saved}개`);
    await load();
  });

/* ── 직접 등록 ── */

$('#addForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const btn = f.querySelector('button');
  await busy(btn, '등록 중…', async () => {
    const { id } = await api('videos', { method: 'POST', body: { url: f.url.value, title: f.title.value, memo: f.memo.value } });
    f.reset();
    await load();
    toast('등록했습니다.');
    openVideo(id);
  });
};

/* ── 설정 ── */

async function loadSettings() {
  const s = await api('settings');
  const f = $('#settingsForm');
  f.queries.value = s.youtube.queries.join('\n');
  for (const k of ['days', 'maxResultsPerQuery', 'maxDurationSec', 'trackDays', 'region']) f[k].value = s.youtube[k];
  for (const k of Object.keys(s.business)) if (f[k]) f[k].value = s.business[k];
  updateQuota();
}

function updateQuota() {
  const n = $('#settingsForm').queries.value.split('\n').filter((q) => q.trim()).length;
  $('#quotaNote').textContent = `유튜브 쿼터: 검색 1번에 100단위. 하루 2번 수집이면 약 ${fmt(n * 200)}단위 / 하루 10,000단위`;
}
$('#settingsForm').queries.oninput = updateQuota;

$('#settingsForm').onsubmit = async (e) => {
  e.preventDefault();
  const f = e.currentTarget;
  const body = {
    youtube: {
      queries: f.queries.value.split('\n').map((q) => q.trim()).filter(Boolean),
      ...Object.fromEntries(['days', 'maxResultsPerQuery', 'maxDurationSec', 'trackDays', 'region'].map((k) => [k, f[k].value])),
    },
    business: Object.fromEntries(['name', 'service', 'area', 'contact_line', 'tone'].map((k) => [k, f[k].value])),
  };
  await busy(f.querySelector('button[type=submit]'), '저장 중…', async () => {
    await api('settings', { method: 'PUT', body });
    await loadSettings();
    toast('저장했습니다.');
  });
};

/* ── 영상 상세 (바텀시트) ── */

function closeSheet() {
  $('#sheet').hidden = $('#sheetBg').hidden = true;
}
$('#sheetClose').onclick = () => closeSheet();
$('#sheetBg').onclick = () => closeSheet();
document.addEventListener('keydown', (e) => e.key === 'Escape' && closeSheet());

function cardHtml(c) {
  if (!c) return '<p class="sub">아직 포맷 카드가 없습니다. 메모를 구체적으로 적은 뒤 만들면 더 정확합니다.</p>';
  const line = (label, v) => (v ? `<p><b>${label}</b> ${esc(v)}</p>` : '');
  return `<div class="card-box">
    <p><b>${esc(c.format_name || '(이름 없음)')}</b> <span class="badge">확신 ${esc(c.confidence || '-')}</span></p>
    ${line('훅', c.hook)}
    ${c.structure?.length ? `<b>구성</b><ol>${c.structure.map((s) => `<li>${esc(s.sec)}초 · ${esc(s.what)}</li>`).join('')}</ol>` : ''}
    ${line('자막 패턴', c.caption_pattern)}${line('소리', c.audio_type)}${line('반전', c.twist)}
    ${line('잘 되는 이유', c.why_it_works)}${line('우리 업종에', c.fit_for_local_service)}
    <p class="muted">${day(c.createdAt)} 만듦</p></div>`;
}

function scriptHtml(s) {
  return `<div class="card-box">
    <p><b>${esc(s.title)}</b></p>
    <p><b>첫 자막</b> ${esc(s.hook_caption)}</p>
    <ol>${(s.shots || []).map((x) => `<li>${esc(x.sec)}초 · ${esc(x.shot)}<br><span class="muted">자막: ${esc(x.caption)}</span></li>`).join('')}</ol>
    <p><b>마지막 자막</b> ${esc(s.ending_caption)}</p>
    <p><b>촬영 주의</b> ${esc(s.shooting_notes)}</p>
    <p class="muted">${day(s.createdAt)} 만듦</p></div>`;
}

async function openVideo(id) {
  let d;
  try {
    d = await api('videos/' + encodeURIComponent(id));
  } catch (e) {
    return toast(e.message);
  }
  const v = d.video;
  const snaps = d.snapshots;
  $('#sheetBody').innerHTML = `
    <h2>${esc(v.title || '(제목 없음)')}</h2>
    <p><a href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">영상 열기 ↗</a></p>
    <dl class="kv">
      <dt>플랫폼</dt><dd>${PLATFORM[v.platform] || esc(v.platform)}</dd>
      ${v.channel ? `<dt>채널</dt><dd>${esc(v.channel)}</dd>` : ''}
      ${v.duration_sec != null ? `<dt>길이</dt><dd>${v.duration_sec}초</dd>` : ''}
      ${v.published_at ? `<dt>올라온 때</dt><dd>${day(v.published_at)}</dd>` : ''}
      <dt>조회수 기록</dt><dd>${snaps.length ? snaps.slice(-4).map((s) => `${day(s.taken_at)} ${fmt(s.views)}`).join('<br>') : '없음 (직접 등록한 영상은 자동으로 모으지 않음)'}</dd>
      <dt>ID</dt><dd>${esc(v.id)}</dd>
    </dl>
    <h3>메모</h3>
    <textarea id="memoText" rows="5" placeholder="첫 장면, 자막, 반전, 음원을 구체적으로">${esc(v.memo || '')}</textarea>
    <div class="row" style="margin-top:8px"><button class="btn" id="memoSave" type="button">메모 저장</button></div>
    <h3>포맷 카드</h3>
    <div id="cardArea">${cardHtml(d.card)}</div>
    <button class="btn primary" id="cardBtn" type="button">${d.card ? '카드 다시 만들기' : '포맷 카드 만들기'}</button>
    <h3>우리 업체 대본</h3>
    <div id="scriptArea">${d.scripts.map(scriptHtml).join('') || '<p class="sub">카드를 만든 뒤 대본으로 바꿀 수 있습니다.</p>'}</div>
    <button class="btn primary" id="adaptBtn" type="button" ${d.card ? '' : 'disabled'}>대본 만들기</button>
    <h3>&nbsp;</h3>
    <button class="btn danger" id="delBtn" type="button">이 영상 지우기</button>`;
  $('#sheet').hidden = $('#sheetBg').hidden = false;
  $('#sheet').scrollTop = 0;

  const saveMemo = () => api('videos/' + encodeURIComponent(id), { method: 'PUT', body: { memo: $('#memoText').value } });
  $('#memoSave').onclick = (e) => busy(e.currentTarget, '저장 중…', async () => {
    await saveMemo();
    toast('메모를 저장했습니다.');
    load();
  });
  $('#cardBtn').onclick = (e) => busy(e.currentTarget, 'Claude 가 정리하는 중…', async () => {
    await saveMemo(); // 고친 메모로 카드를 만들도록 먼저 저장
    const { card } = await api(`videos/${encodeURIComponent(id)}/card`, { method: 'POST' });
    $('#cardArea').innerHTML = cardHtml(card);
    $('#adaptBtn').disabled = false;
    load();
  });
  $('#adaptBtn').onclick = (e) => busy(e.currentTarget, 'Claude 가 쓰는 중…', async () => {
    const { script } = await api(`videos/${encodeURIComponent(id)}/adapt`, { method: 'POST' });
    const area = $('#scriptArea');
    if (!area.querySelector('.card-box')) area.innerHTML = '';
    area.insertAdjacentHTML('afterbegin', scriptHtml(script));
  });
  $('#delBtn').onclick = async () => {
    if (!confirm('이 영상과 조회수 기록·카드·대본을 모두 지울까요?')) return;
    await api('videos/' + encodeURIComponent(id), { method: 'DELETE' }).catch((e) => toast(e.message));
    closeSheet();
    load();
  };
}

start();
