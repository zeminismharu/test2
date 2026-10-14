// 임시 화면 — 2단계(뿌시기)가 생기면 이 자리를 대신한다.
// 지금은 설문에서 미리 찾아 둔 Pexels 사진이 제대로 왔는지 확인하는 용도.
import { chickenBallSVG } from '../ui/placeholders.js';
import { beep } from '../audio.js';
import { escapeHTML, button } from '../ui/dom.js';

export const next = {
  id: 'next',
  guide: '뿌시기는 아직 공사 중',
  line: '아직 안 만듦. 일단 속 사진만 보셈.',
  render({ stage, actions, state, go }) {
    stage.innerHTML = `<div class="next"><p class="hint">속 사진 찾는 중...</p></div>`;
    actions.innerHTML = '';
    actions.append(button('처음으로', () => { beep(); go('idle', { reset: true }); }, 'secondary'));

    const box = stage.querySelector('.next');
    Promise.resolve(state.photoRequest).then((result) => {
      if (!box.isConnected) return;
      const photo = result?.photo;
      if (!photo) {
        box.innerHTML = `
          <div class="next-fallback">${chickenBallSVG()}</div>
          <p class="hint">사진을 못 가져왔어요 (${escapeHTML(result?.error || '요청 없음')})</p>
          <p class="hint small">npm run dev 만 켰다면 정상이에요. 사진까지 보려면 README 의 "사진까지 확인" 방법을 쓰세요.</p>`;
        return;
      }
      box.innerHTML = `
        <figure class="next-photo">
          <img src="${photo.src}" alt="${escapeHTML(photo.alt)}" style="background:${escapeHTML(photo.color || '')}">
          <figcaption>
            Photo by <a href="${photo.photographerUrl}" target="_blank" rel="noopener">${escapeHTML(photo.photographer)}</a>
            on <a href="${photo.pexelsUrl}" target="_blank" rel="noopener">Pexels</a>
          </figcaption>
        </figure>
        <p class="hint small">검색어: ${escapeHTML(result.query)}</p>`;
    });
  },
};
