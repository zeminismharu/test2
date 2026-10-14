import './style.css';
import { idle, dislike, calm, confirm, done } from './screens/kiosk.js';
import { next } from './screens/next-placeholder.js';
import { mascotSVG } from './ui/placeholders.js';
import { escapeHTML } from './ui/dom.js';

const SCREENS = { idle, dislike, calm, confirm, done, next };
const ORDER = Object.keys(SCREENS);
const TOTAL_STEPS = 3;

// 게임 전체가 같이 쓰는 상태. 싫은 사진은 objectURL 로 브라우저 안에만 둔다.
const state = freshState();

function freshState() {
  return {
    dislikeImage: null, // 싫은 사진 objectURL, null 이면 그냥 생닭
    calmWord: '', // 속 재료
    photoRequest: null, // Pexels 검색 Promise (2/3 에서 미리 시작)
    orderNo: null,
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
  el.guide.textContent = screen.guide;
  setLine(screen.line);
  renderStepbar(screen.step);
  renderReceipt();
  el.mascot.innerHTML = mascotSVG({ sleeping: screen.mascot === 'sleeping' });

  screen.render({
    stage: el.stage,
    actions: el.actions,
    state,
    go,
    setLine,
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
function renderReceipt() {
  const now = ORDER.indexOf(el.app.dataset.screen);
  const reached = (id) => now >= ORDER.indexOf(id);
  const rows = [];
  if (reached('dislike')) rows.push(['차분한 순살치킨', '1']);
  if (reached('calm')) rows.push(['싫은 것', state.dislikeImage ? '사진 1장' : '그냥 생닭']);
  if (reached('confirm')) rows.push(['속', escapeHTML(state.calmWord)]);
  const paid = reached('done');

  el.receipt.innerHTML = `
    <p class="receipt-title">주문서</p>
    ${state.orderNo && paid ? `<p class="receipt-order">주문번호 <strong>${state.orderNo}</strong></p>` : ''}
    ${rows.length ? `<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>` : '<p class="receipt-empty">아직 주문 없음</p>'}
    ${reached('confirm') ? `<div class="receipt-total"><span>결제 금액</span><strong>0원</strong></div>` : ''}
    ${paid ? '<p class="receipt-stamp">결제 완료</p>' : ''}`;
}

go('idle');
