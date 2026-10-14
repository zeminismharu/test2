// 2단계 · 생닭 때리기
// 싫은 사진이 입혀진 동그란 생닭을 그물(mesh)로 쪼개 그린다.
// 때린 자리 주변의 그물 점을 바깥으로 밀어내서 사진이 늘어나고 뭉개지게 한다 (워프 효과).
import { runScene, lerp, rand, Popups, Particles } from '../game/engine.js';
import { C, drawFist, label, makeRawChickenTexture } from '../game/draw.js';
import { sfx } from '../audio.js';
import { button } from '../ui/dom.js';

const N = 16; // 그물 칸 수 (N x N)
const HIT_RADIUS = 0.55; // 한 대가 영향을 주는 범위 (생닭 반지름 = 1)
const MAX_DISP = 0.6;
const COMBO_GAP = 0.7; // 초. 이 안에 또 때리면 콤보

const LINES = [
  [1, '일단 때림.'],
  [5, '이유는 모름.'],
  [15, '...계속 때림.'],
  [30, '손 안 아픔?'],
  [60, '일단 모르겠고 계속.'],
  [100, '백 대. 차분해짐?'],
];

export const beat = {
  id: 'beat',
  guide: '원하는 만큼 때리세요',
  line: '때리셈. 이유는 없음.',
  render({ stage, actions, state, go, setLine, signal, updateReceipt }) {
    let tex = makeRawChickenTexture(null);
    if (state.dislikeImage) {
      const img = new Image();
      img.onload = () => { tex = makeRawChickenTexture(img); };
      img.src = state.dislikeImage;
    }

    const count = (N + 1) * (N + 1);
    const restX = new Float32Array(count);
    const restY = new Float32Array(count);
    const targetX = new Float32Array(count);
    const targetY = new Float32Array(count);
    const curX = new Float32Array(count);
    const curY = new Float32Array(count);
    const velX = new Float32Array(count);
    const velY = new Float32Array(count);
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const k = j * (N + 1) + i;
        restX[k] = (i / N) * 2 - 1;
        restY[k] = (j / N) * 2 - 1;
      }
    }

    state.hits = 0;
    const popups = new Popups();
    const bits = new Particles();
    const layout = { cx: 0, cy: 0, R: 1 };
    let combo = 0;
    let comboShow = 0;
    let lastHitAt = -10;
    let time = 0;
    let squash = 0;
    let squashV = 0;
    let fist = null;
    let fistSide = 1;
    let lineIndex = -1;

    function hit(x, y) {
      const u = (x - layout.cx) / layout.R;
      const v = (y - layout.cy) / layout.R;
      if (u * u + v * v > 1.25) return;

      state.hits += 1;
      combo = time - lastHitAt < COMBO_GAP ? combo + 1 : 1;
      lastHitAt = time;
      if (combo >= 3) comboShow = 1;

      // 그물 점 밀어내기 + 출렁
      let nearest = 0;
      let nearestD = Infinity;
      const swirl = Math.random() < 0.5 ? -1 : 1;
      for (let k = 0; k < count; k++) {
        const px = restX[k] + curX[k];
        const py = restY[k] + curY[k];
        let dx = px - u;
        let dy = py - v;
        const d = Math.hypot(dx, dy);
        if (d < nearestD) { nearestD = d; nearest = k; }
        if (d >= HIT_RADIUS) continue;
        if (d < 1e-4) { dx = rand(-1, 1); dy = rand(-1, 1); }
        const len = Math.hypot(dx, dy);
        dx /= len;
        dy /= len;
        const f = (1 - d / HIT_RADIUS) ** 2;
        targetX[k] += dx * f * 0.13 - dy * f * 0.04 * swirl;
        targetY[k] += dy * f * 0.13 + dx * f * 0.04 * swirl;
        const tl = Math.hypot(targetX[k], targetY[k]);
        if (tl > MAX_DISP) { targetX[k] *= MAX_DISP / tl; targetY[k] *= MAX_DISP / tl; }
        velX[k] += dx * f * 2.4;
        velY[k] += dy * f * 2.4;
      }
      bruise(restX[nearest], restY[nearest]);

      squashV += 6;
      const sideX = fistSide > 0 ? layout.cx + layout.R * 2.2 : layout.cx - layout.R * 2.2;
      fist = { fromX: sideX, fromY: layout.cy + layout.R * 2.4, x, y, t: 0 };
      fistSide *= -1;

      sfx.punch();
      popups.add(combo >= 5 ? '퍼퍽!' : '퍽!', x + rand(-20, 20), y - 30, { color: C.ink, size: 36 + Math.min(combo, 10) * 2 });
      for (let i = 0; i < 9; i++) {
        bits.add({
          x, y,
          vx: rand(-320, 320), vy: rand(-420, -80),
          size: rand(2, 6),
          color: i % 3 ? C.raw : '#fff',
          life: rand(0.35, 0.7),
        });
      }
      engine.shake(Math.min(4 + combo * 0.8, 14));
      engine.vibrate(15);
      updateReceipt();
      while (lineIndex + 1 < LINES.length && state.hits >= LINES[lineIndex + 1][0]) {
        lineIndex++;
        setLine(LINES[lineIndex][1]);
      }
    }

    // 맞은 자리에 멍 (텍스처에 직접 칠해서 그물과 같이 늘어나게)
    function bruise(ru, rv) {
      const g = tex.getContext('2d');
      const s = tex.width;
      const x = ((ru + 1) / 2) * s;
      const y = ((rv + 1) / 2) * s;
      const r = s * rand(0.06, 0.1);
      g.save();
      g.beginPath();
      g.arc(s / 2, s / 2, s * 0.47, 0, Math.PI * 2);
      g.clip();
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(150, 50, 70, 0.22)');
      grad.addColorStop(1, 'rgba(150, 50, 70, 0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.restore();
    }

    function drawMesh(g, cx, cy, R, sx = 1, sy = 1) {
      const ts = tex.width;
      const sxs = (k) => cx + (restX[k] + curX[k]) * R * sx;
      const sys = (k) => cy + (restY[k] + curY[k]) * R * sy;
      for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
          const a = j * (N + 1) + i;
          const b = a + 1;
          const c = a + N + 1;
          const d = c + 1;
          // 텍스처가 비어 있는 네 귀퉁이는 건너뛴다
          const minR = Math.min(Math.hypot(restX[a], restY[a]), Math.hypot(restX[b], restY[b]), Math.hypot(restX[c], restY[c]), Math.hypot(restX[d], restY[d]));
          if (minR > 0.98) continue;
          const uv = (k) => [((restX[k] + 1) / 2) * ts, ((restY[k] + 1) / 2) * ts];
          texturedTriangle(g, tex, [sxs(a), sys(a)], [sxs(b), sys(b)], [sxs(d), sys(d)], uv(a), uv(b), uv(d));
          texturedTriangle(g, tex, [sxs(a), sys(a)], [sxs(d), sys(d)], [sxs(c), sys(c)], uv(a), uv(d), uv(c));
        }
      }
    }

    const scene = {
      resize(w, h) {
        layout.R = Math.min(w * 0.36, h * 0.32);
        layout.cx = w / 2;
        layout.cy = h * 0.5;
      },
      pointerdown: hit,
      update(dt) {
        time += dt;
        const damp = Math.pow(0.003, dt);
        for (let k = 0; k < count; k++) {
          velX[k] = (velX[k] + (targetX[k] - curX[k]) * 140 * dt) * damp;
          velY[k] = (velY[k] + (targetY[k] - curY[k]) * 140 * dt) * damp;
          curX[k] += velX[k] * dt;
          curY[k] += velY[k] * dt;
        }
        squashV = (squashV - squash * 300 * dt) * Math.pow(0.002, dt);
        squash += squashV * dt;
        if (fist) {
          fist.t += dt;
          if (fist.t > 0.32) fist = null;
        }
        if (time - lastHitAt > COMBO_GAP) comboShow = Math.max(0, comboShow - dt * 3);
        popups.update(dt);
        bits.update(dt);
      },
      draw(g, w, h) {
        const { cx, cy, R } = layout;
        // 도마
        g.fillStyle = '#ead2a4';
        g.strokeStyle = C.ink;
        g.lineWidth = 4;
        g.beginPath();
        g.ellipse(cx, cy + R * 0.95, R * 1.35, R * 0.32, 0, 0, Math.PI * 2);
        g.fill();
        g.stroke();

        drawMesh(g, cx, cy, R, 1 + squash * 0.06, 1 - squash * 0.06);
        bits.draw(g);

        if (fist) {
          const t = fist.t;
          const k = t < 0.07 ? t / 0.07 : t < 0.14 ? 1 : 1 - (t - 0.14) / 0.18;
          const fx = lerp(fist.fromX, fist.x, k);
          const fy = lerp(fist.fromY, fist.y, k);
          const angle = Math.atan2(fist.y - fist.fromY, fist.x - fist.fromX) + Math.PI / 2;
          drawFist(g, fx, fy, R * 0.42, angle);
        }
        popups.draw(g);

        label(g, `${state.hits}대`, w / 2, 26, { size: 22, color: C.inkSoft });
        if (comboShow > 0.01) {
          g.globalAlpha = comboShow;
          label(g, `${combo} 콤보!`, w / 2, 56, { size: 26 + Math.min(combo, 20), color: C.amberDark });
          g.globalAlpha = 1;
        }
        if (state.hits === 0) {
          label(g, '생닭을 톡톡 눌러서 때리세요', w / 2, h - 24, { size: 17, color: C.inkSoft });
        }
      },
    };

    const engine = runScene(stage, scene, signal);

    actions.innerHTML = '';
    actions.append(button('다음으로', () => {
      sfx.beep();
      // 다음 단계에서 쓸 "맞은 생닭" 그림
      state.beatenCanvas = engine.snapshot(512, 512, (g, w) => drawMesh(g, w / 2, w / 2, w / 2 / 1.08));
      go('shake');
    }, 'primary'));
  },
};

// 텍스처의 삼각형(uv)을 화면 삼각형(p)에 맞춰 그린다
function texturedTriangle(g, img, p0, p1, p2, t0, t1, t2) {
  // 이음매가 안 보이게 삼각형을 아주 조금 키워서 자른다
  const mx = (p0[0] + p1[0] + p2[0]) / 3;
  const my = (p0[1] + p1[1] + p2[1]) / 3;
  const grow = (p) => {
    const dx = p[0] - mx;
    const dy = p[1] - my;
    const len = Math.hypot(dx, dy) || 1;
    return [p[0] + (dx / len) * 1.1, p[1] + (dy / len) * 1.1];
  };
  const [q0, q1, q2] = [grow(p0), grow(p1), grow(p2)];

  const du1 = t1[0] - t0[0], dv1 = t1[1] - t0[1];
  const du2 = t2[0] - t0[0], dv2 = t2[1] - t0[1];
  const det = du1 * dv2 - du2 * dv1;
  if (Math.abs(det) < 1e-9) return;
  const dx1 = p1[0] - p0[0], dx2 = p2[0] - p0[0];
  const dy1 = p1[1] - p0[1], dy2 = p2[1] - p0[1];
  const a = (dx1 * dv2 - dx2 * dv1) / det;
  const c = (dx2 * du1 - dx1 * du2) / det;
  const b = (dy1 * dv2 - dy2 * dv1) / det;
  const d = (dy2 * du1 - dy1 * du2) / det;
  const e = p0[0] - a * t0[0] - c * t0[1];
  const f = p0[1] - b * t0[0] - d * t0[1];

  g.save();
  g.beginPath();
  g.moveTo(q0[0], q0[1]);
  g.lineTo(q1[0], q1[1]);
  g.lineTo(q2[0], q2[1]);
  g.closePath();
  g.clip();
  g.transform(a, b, c, d, e, f);
  g.drawImage(img, 0, 0);
  g.restore();
}

