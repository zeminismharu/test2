import './style.css';
import { idle, dislike, calm, confirm, done } from './screens/kiosk.js';
import { beat } from './screens/beat.js';
import { shake } from './screens/shake.js';
import { throwStage } from './screens/throw.js';
import { fry } from './screens/fry.js';
import { crush } from './screens/crush.js';
import { result } from './screens/result.js';
import { mascotHTML } from './ui/placeholders.js';
import { escapeHTML } from './ui/dom.js';
import { preloadAssets } from './game/draw.js';
import { coatingLabel, FRY_LABEL } from './game/labels.js';
import { fetchCalmPhoto } from './photo.js';
import { unlockAudio } from './audio.js';

// 화면 순서 (주문서가 이 순서대로 채워진다)
const SCREENS = { idle, dislike, calm, confirm, done, beat, shake, throw: throwStage, fry, crush, result };
const ORDER = Object.keys(SCREENS);
const TOTAL_STEPS = 3;
const ASSETS = ['logo', 'logo-alt', 'raw-chicken', 'bag', 'fryer', 'chicken-ball', 'mascot', 'mascot-sleep', 'mascot-throw'];

// 게임 전체가 같이 쓰는 상태. 싫은 사진은 objectURL 로 브라우저 안에만 둔다.
const state = freshState();

function freshState() {
  return {
    dislikeImage: null, // 싫은 사진 objectURL, null 이면 그냥 생닭
    calmWord: '', // 속 재료
    photoRequest: null, // Pexels 검색 Promise (2/3 에서 미리 시작)
    photoImage: null, // 속 사진 <img> Promise
    orderNo: null,
    hits: null, // 때린 횟수
    beatenCanvas: null, // 맞은 생닭 그림
    coating: null, // 튀김옷 0~1
    throwFails: null,
    fryState: null, // raw / golden / burnt
    crushPercent: null,
    crushedCanvas: null, // 뿌시고 난 모습 (결과 카드용)
    calmPercent: null, // 의미 없는 랜덤 %
  };
}

const el = {
  app: document.getElementById('app'),
  stepbar: document.getElementById('stepbar'),
  guide: document.getElementById('guide'),
  guideLine: document.getElementById('guide-line'),
  stage: document.getElementById('stage'),
  actions: document.getElementById('actions'),
  receipt: document.getElementById('side-receipt'),
  mascot: document.getElementById('side-mascot'),
  bubble: document.getElementById('side-bubble'),
};

let screenAbort = null;

function go(id, { reset = false } = {}) {
  if (reset) {
    if (state.dislikeImage) URL.revokeObjectURL(state.dislikeImage);
    Object.assign(state, freshState());
  }
  const screen = SCREENS[id];
  screenAbort?.abort();
  screenAbort = new AbortController();

  el.app.dataset.screen = id;
  el.stage.className = 'stage';
  el.stage.replaceChildren();
  el.guide.textContent = screen.guide;
  setLine(screen.line);
  renderStepbar(screen.step);
  updateReceipt();
  el.mascot.innerHTML = mascotHTML({ sleeping: screen.mascot === 'sleeping' });

  screen.render({
    stage: el.stage,
    actions: el.actions,
    state,
    go,
    setLine,
    updateReceipt,
    signal: screenAbort.signal,
  });
}

// 마스코트의 무심한 대사 — 컴퓨터는 오른쪽 말풍선, 폰은 안내 문구 아래 작은 글씨
function setLine(text) {
  el.bubble.textContent = text;
  el.guideLine.textContent = text;
}

function renderStepbar(step) {
  if (!step) {
    el.stepbar.innerHTML = '';
    return;
  }
  el.stepbar.innerHTML = Array.from({ length: TOTAL_STEPS }, (_, i) => {
    const n = i + 1;
    const cls = n < step ? 'is-done' : n === step ? 'is-current' : '';
    return `<li class="${cls}">${n}</li>`;
  }).join('') + `<li class="stepbar-count">${step}/${TOTAL_STEPS}</li>`;
}

// 왼쪽 주문서 — 단계마다 한 줄씩 채워진다
function updateReceipt() {
  const now = ORDER.indexOf(el.app.dataset.screen);
  const reached = (id) => now >= ORDER.indexOf(id);
  const rows = [];
  if (reached('dislike')) rows.push(['차분한 순살치킨', '1']);
  if (reached('calm')) rows.push(['싫은 것', state.dislikeImage ? '사진 1장' : '그냥 생닭']);
  if (reached('confirm')) rows.push(['속', escapeHTML(state.calmWord)]);
  if (reached('beat') && state.hits != null) rows.push(['때린 횟수', `${state.hits}대`]);
  if (reached('shake') && state.coating != null) rows.push(['튀김옷', coatingLabel(state.coating)]);
  if (reached('throw') && state.throwFails != null) rows.push(['던지기 실패', `${state.throwFails}회`]);
  if (reached('fry') && state.fryState) rows.push(['튀김 상태', FRY_LABEL[state.fryState]]);
  if (reached('crush') && state.crushPercent != null) rows.push(['뿌신 정도', `${state.crushPercent}%`]);
  const paid = reached('done');

  el.receipt.innerHTML = `
    <p class="receipt-title">주문서</p>
    ${state.orderNo && paid ? `<p class="receipt-order">주문번호 <strong>${state.orderNo}</strong></p>` : ''}
    ${rows.length ? `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '<p class="receipt-empty">아직 주문 없음</p>'}
    ${reached('confirm') ? `<div class="receipt-total"><span>결제 금액</span><strong>0원</strong></div>` : ''}
    ${paid ? '<p class="receipt-stamp">결제 완료</p>' : ''}`;
}

// 개발용 바로가기: ?skip=crush&fry=burnt&q=바다
// 설문을 건너뛰고 원하는 단계부터 시작한다. (2단계부터 "설문 → 뿌시기"를 계속 시험하기 위함)
function startFromQuery() {
  const params = new URLSearchParams(location.search);
  const skip = params.get('skip');
  if (!skip || !SCREENS[skip]) return false;
  state.calmWord = params.get('q') || '고양이';
  state.photoRequest = fetchCalmPhoto(state.calmWord);
  state.orderNo = '777';
  state.hits = 0;
  state.coating = 0.5;
  state.throwFails = 0;
  state.fryState = params.get('fry') || 'golden';
  state.crushPercent = 0;
  // 소리는 첫 터치 이후에만 나므로 아무 데나 한 번 누르면 켜진다
  window.addEventListener('pointerdown', unlockAudio, { once: true });
  go(skip);
  return true;
}

preloadAssets(ASSETS).then(() => {
  if (!startFromQuery()) go('idle');
});
