// 1단계 · 키오스크 주문 — 대기 / 싫은 것(1/3) / 속 재료(2/3) / 주문 확인(3/3) / 주문 완료
import { mascotHTML, rawChickenHTML } from '../ui/placeholders.js';
import { unlockAudio, beep, buzz, chime } from '../audio.js';
import { hasBannedWord } from '../../shared/banned-words.js';
import { fetchCalmPhoto, ensurePhotoImage } from '../photo.js';
import { escapeHTML, button } from '../ui/dom.js';

const MAX_WORD_LENGTH = 30;

export const idle = {
  id: 'idle',
  guide: '화면을 터치하세요',
  line: '',
  mascot: 'sleeping',
  render({ stage, actions, go, signal }) {
    stage.innerHTML = `
      <div class="idle">
        <div class="idle-mascot">${mascotHTML({ sleeping: true })}</div>
        <p class="idle-brand">차분한치킨</p>
        <p class="idle-tagline">일단 모르겠고 차분해지는 치킨이나 먹고 싶다</p>
        <p class="idle-touch">화면을 터치하세요</p>
      </div>`;
    actions.innerHTML = `
      <ul class="notice">
        <li>⚠ 깜짝 놀람·화면 번쩍임 주의</li>
        <li>🔒 사진은 서버에 저장되지 않아요</li>
      </ul>`;
    // 화면 어디를 눌러도 시작. 이 첫 터치에서 오디오를 켠다.
    const start = () => {
      unlockAudio();
      beep();
      go('dislike');
    };
    // [처음으로]를 누른 그 클릭이 바로 시작으로 이어지지 않게 한 박자 늦게 건다.
    setTimeout(() => {
      if (!signal.aborted) document.getElementById('app').addEventListener('click', start, { once: true, signal });
    });
  },
};

export const dislike = {
  id: 'dislike',
  step: 1,
  guide: '오늘 뭐가 싫으세요?',
  line: '',
  render({ stage, actions, state, go }) {
    const draw = () => {
      const picked = state.dislikeImage;
      stage.innerHTML = `
        <div class="dislike">
          <div class="dislike-preview">${rawChickenHTML(picked)}</div>
          <p class="hint">${picked ? '이걸로 생닭을 만들게요' : '사진을 넣거나, 그냥 생닭으로 가요'}</p>
          <p class="hint small">사진은 이 기기 안에서만 써요. 서버로 안 보내요.</p>
        </div>`;
      actions.innerHTML = '';
      const fileInput = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', hidden: true });
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        if (state.dislikeImage) URL.revokeObjectURL(state.dislikeImage);
        state.dislikeImage = URL.createObjectURL(file);
        beep();
        draw();
      });
      actions.append(fileInput);

      if (picked) {
        actions.append(
          button('다시 고르기', () => fileInput.click(), 'secondary'),
          button('이걸로 할게요', () => { beep(); go('calm'); }, 'primary'),
        );
      } else {
        actions.append(
          button('📷 사진 넣기', () => fileInput.click(), 'primary'),
          button('그냥 생닭', () => { beep(); go('calm'); }, 'secondary'),
        );
      }
    };
    draw();
  },
};

export const calm = {
  id: 'calm',
  step: 2,
  guide: '뭘 보면 차분해지세요?',
  line: '',
  render({ stage, actions, state, go }) {
    stage.innerHTML = `
      <form class="calm" novalidate>
        <label class="calm-label" for="calm-input">속 재료</label>
        <input id="calm-input" class="calm-input" type="text" maxlength="${MAX_WORD_LENGTH}"
          autocomplete="off" enterkeyhint="done"
          value="${escapeHTML(state.calmWord)}">
        <p class="calm-error" role="alert"></p>
      </form>`;
    const form = stage.querySelector('form');
    const input = stage.querySelector('input');
    const error = stage.querySelector('.calm-error');

    const submit = (e) => {
      e?.preventDefault();
      const word = input.value.trim();
      if (!word) {
        buzz();
        error.textContent = '뭐라도 적어주세요';
        return;
      }
      if (hasBannedWord(word)) {
        buzz();
        error.textContent = '그건 안 튀겨요';
        return;
      }
      // 이 시점에 Pexels 검색을 미리 시작해 둔다. 같은 단어로 다시 오면 다시 찾지 않는다.
      if (word !== state.calmWord || !state.photoRequest) {
        state.calmWord = word;
        state.photoRequest = fetchCalmPhoto(word);
        state.photoImage = null;
      }
      beep();
      go('confirm');
    };
    form.addEventListener('submit', submit);
    input.addEventListener('input', () => { error.textContent = ''; });

    actions.innerHTML = '';
    actions.append(
      button('이전', () => { beep(); go('dislike'); }, 'secondary'),
      button('다음', submit, 'primary'),
    );
    // 폰에서는 키보드가 화면을 가리므로 자동 포커스는 컴퓨터에서만
    if (window.matchMedia('(pointer: fine)').matches) input.focus();
  },
};

export const confirm = {
  id: 'confirm',
  step: 3,
  guide: '주문 확인',
  line: '',
  render({ stage, actions, state, go }) {
    stage.innerHTML = `
      <div class="receipt receipt-big">
        <p class="receipt-title">주문서</p>
        <dl>
          <div><dt>차분한 순살치킨</dt><dd>1</dd></div>
          <div><dt>속</dt><dd>${escapeHTML(state.calmWord)}</dd></div>
        </dl>
        <div class="receipt-total"><span>결제 금액</span><strong>0원</strong></div>
      </div>`;
    actions.innerHTML = '';
    actions.append(
      button('이전', () => { beep(); go('calm'); }, 'secondary'),
      button('결제하기', () => {
        state.orderNo = String(Math.floor(Math.random() * 900) + 100);
        chime();
        go('done');
      }, 'primary'),
    );
  },
};

export const done = {
  id: 'done',
  guide: '주문 완료',
  line: '',
  render({ stage, actions, state, go }) {
    stage.innerHTML = `
      <div class="done">
        <p class="done-label">주문번호</p>
        <p class="done-number">${state.orderNo}</p>
        <p class="done-text">일단 모르겠고 튀기러 갑니다</p>
      </div>`;
    actions.innerHTML = '';
    // 뿌시기에서 쓸 사진을 미리 받아 둔다
    ensurePhotoImage(state);
    actions.append(button('다음으로', () => { beep(); go('beat'); }, 'primary'));
  },
};
