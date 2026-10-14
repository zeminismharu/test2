// 7단계 · 결과 카드 (영수증 스타일) + 이미지 저장
// 싫은 사진은 넣지 않는다. 뿌시고 난 치킨(속 Pexels 사진) + 기록 + 작가 표기.
import { C, cookColor, drawCoatedBall } from '../game/draw.js';
import { FRY_LABEL } from '../game/labels.js';
import { sfx, buzz } from '../audio.js';
import { button, escapeHTML } from '../ui/dom.js';

const W = 720;
const H = 1320;

export const result = {
  id: 'result',
  guide: '주문하신 치킨 나왔습니다',
  line: '차분해짐(아마도).',
  async render({ stage, actions, state, go, setLine, signal }) {
    if (state.calmPercent == null) state.calmPercent = Math.floor(Math.random() * 101); // 의미 없음
    stage.innerHTML = '<p class="hint">영수증 뽑는 중...</p>';
    actions.innerHTML = '';

    const photoResult = await Promise.resolve(state.photoRequest);
    const photo = photoResult?.photo || null;
    try {
      await Promise.all([document.fonts.load('48px Jua'), document.fonts.load('24px "Gowun Dodum"')]);
    } catch {
      // 폰트를 못 받아도 기본 글꼴로 그린다
    }
    if (signal.aborted) return;

    const card = drawCard(state, photo);
    let url = null;
    try {
      url = card.toDataURL('image/png');
    } catch {
      url = null; // 사진 때문에 캔버스가 막힌 경우 (보통은 /api/image 로 피함)
    }

    stage.classList.add('is-result');
    stage.innerHTML = `
      <div class="result">
        <div class="result-card"></div>
        ${photo ? `<p class="result-credit">Photo by <a href="${escapeHTML(photo.photographerUrl)}" target="_blank" rel="noopener">${escapeHTML(photo.photographer)}</a> on <a href="${escapeHTML(photo.pexelsUrl)}" target="_blank" rel="noopener">Pexels</a></p>` : ''}
        <p class="hint small">폰에서는 영수증을 길게 눌러도 저장돼요</p>
      </div>`;
    const holder = stage.querySelector('.result-card');
    if (url) {
      const img = new Image();
      img.alt = `차분한치킨 영수증. 튀김 상태 ${FRY_LABEL[state.fryState] || '모름'}, 뿌신 정도 ${state.crushPercent ?? 0}%, 차분함 ${state.calmPercent}%`;
      img.src = url;
      holder.append(img);
    } else {
      holder.append(card);
    }

    actions.append(
      button('처음으로', () => { sfx.beep(); go('idle', { reset: true }); }, 'secondary'),
      button('이미지 저장', () => {
        if (!url) {
          buzz();
          setLine('저장이 막힘. 이유는 모름.');
          return;
        }
        sfx.chime();
        card.toBlob((blob) => {
          const href = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = href;
          a.download = `chabunhan-chicken-${state.orderNo || '000'}.png`;
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(href), 10000);
        }, 'image/png');
        setLine('저장함.');
      }, 'primary'),
    );
  },
};

function drawCard(state, photo) {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const pad = 56;

  // 종이 + 아래 톱니
  g.fillStyle = '#f7e6c6';
  g.fillRect(0, 0, W, H);
  g.fillStyle = C.creamLight;
  g.beginPath();
  g.moveTo(24, 24);
  g.lineTo(W - 24, 24);
  g.lineTo(W - 24, H - 40);
  const teeth = 22;
  for (let i = 0; i <= teeth; i++) {
    const x = W - 24 - ((W - 48) / teeth) * i;
    g.lineTo(x, i % 2 ? H - 40 : H - 24);
  }
  g.lineTo(24, 24);
  g.closePath();
  g.fill();
  g.strokeStyle = C.ink;
  g.lineWidth = 4;
  g.stroke();

  const text = (str, x, y, { size = 26, font = 'Gowun Dodum', color = C.ink, align = 'left' } = {}) => {
    g.font = `${size}px ${font === 'Jua' ? 'Jua' : '"Gowun Dodum"'}, sans-serif`;
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillText(str, x, y);
  };
  const dashed = (y) => {
    g.save();
    g.strokeStyle = C.inkSoft;
    g.lineWidth = 2;
    g.setLineDash([10, 8]);
    g.beginPath();
    g.moveTo(pad, y);
    g.lineTo(W - pad, y);
    g.stroke();
    g.restore();
  };

  text('차분한치킨', W / 2, 92, { size: 58, font: 'Jua', color: C.amberDark, align: 'center' });
  text('일단 모르겠고 차분해지는 치킨', W / 2, 142, { size: 22, color: C.inkSoft, align: 'center' });
  const now = new Date();
  const stamp = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  text(`주문번호 ${state.orderNo || '000'}`, pad, 194, { size: 26, font: 'Jua' });
  text(stamp, W - pad, 194, { size: 22, color: C.inkSoft, align: 'right' });
  dashed(226);

  // 뿌시고 난 치킨 + 속 사진
  const size = 420;
  const top = 250;
  if (state.crushedCanvas) {
    g.drawImage(state.crushedCanvas, (W - size) / 2, top, size, size);
  } else {
    drawCoatedBall(g, W / 2, top + size / 2, size * 0.42, { coating: state.coating ?? 0.5, cook: 0.6 });
  }
  dashed(top + size + 24);

  const rows = [
    ['메뉴', '차분한 순살치킨 1'],
    ['때린 횟수', `${state.hits ?? 0}대`],
    ['던지기 실패', `${state.throwFails ?? 0}회`],
    ['튀김 상태', FRY_LABEL[state.fryState] || '모름'],
    ['뿌신 정도', `${state.crushPercent ?? 0}%`],
    ['속', state.calmWord || '-'],
  ];
  let y = top + size + 66;
  for (const [k, v] of rows) {
    text(k, pad, y, { size: 26, color: C.inkSoft });
    text(v.length > 16 ? `${v.slice(0, 15)}…` : v, W - pad, y, { size: 28, align: 'right' });
    y += 46;
  }
  dashed(y - 10);
  y += 36;
  text('차분함', pad, y, { size: 34, font: 'Jua' });
  text(`${state.calmPercent}%`, W - pad, y, { size: 56, font: 'Jua', color: C.amberDark, align: 'right' });
  y += 44;
  text('(의미 없음)', W - pad, y, { size: 20, color: C.inkSoft, align: 'right' });
  y += 30;
  text('결제 금액', pad, y + 10, { size: 24, color: C.inkSoft });
  text('0원', W - pad, y + 10, { size: 30, font: 'Jua', align: 'right' });

  // 작가 표기 (Pexels 이용 조건)
  const creditY = H - 92;
  if (photo) {
    text(`Photo by ${photo.photographer} on Pexels`, W / 2, creditY, { size: 22, color: C.inkSoft, align: 'center' });
    text('pexels.com', W / 2, creditY + 30, { size: 18, color: cookColor(0.7), align: 'center' });
  } else {
    text('감사합니다. 일단 모르겠고 또 오세요.', W / 2, creditY + 10, { size: 22, color: C.inkSoft, align: 'center' });
  }
  return c;
}
