// 6단계 · 뿌시기 (핵심 손맛)
// 바삭한 껍질을 누르면 누른 자리 주변이 조각나 떨어지고, 속에서 Pexels 사진이 드러난다.
// 조각은 누른 점 근처에 씨앗을 뿌려 보로노이로 나누기 때문에 매번 모양이 다르다.
//
// 튀김 상태별 차이
//   덜 익음(raw)  : 무르게 찌그러짐. 두 번 눌러야 조금씩 뜯겨 나감. "물컹"
//   황금(golden)  : 한 번에 시원하게 쩍쩍. "바삭" (깨진 양에 따라 약·중·강)
//   탄(burnt)     : 딱딱해서 세 번 눌러야 깨짐. 금만 가다가 "와작", 검은 조각
import { runScene, clamp, rand, Popups, Particles } from '../game/engine.js';
import { C, cookColor, drawCover, mascotImage, seeded, label } from '../game/draw.js';
import { area, centroid, circlePoly, pointInPolygon, voronoiSplit, bounds, tracePoly } from '../game/geometry.js';
import { sfx } from '../audio.js';
import { button } from '../ui/dom.js';
import { ensurePhotoImage } from '../photo.js';

const CONFIG = {
  raw: { hp: 2, cook: 0.22, radius: 0.15, near: 5, far: 4, speed: [0.2, 0.6], gravity: 1.6, edge: '#c9a86a', crack: '#b89255' },
  golden: { hp: 1, cook: 0.6, radius: 0.27, near: 11, far: 6, speed: [1.4, 3.2], gravity: 5, edge: '#9a5414', crack: '#7a3f0e' },
  burnt: { hp: 3, cook: 0.95, radius: 0.2, near: 8, far: 5, speed: [1.2, 2.6], gravity: 6, edge: '#0d0805', crack: '#a8571f' },
};


export const crush = {
  id: 'crush',
  guide: '눌러서 뿌시세요',
  line: '',
  render({ stage, actions, state, go, signal, updateReceipt }) {
    const fry = CONFIG[state.fryState] ? state.fryState : 'golden';
    const cfg = CONFIG[fry];
    const shellTex = makeShellTexture(cfg.cook, fry === 'burnt');

    const initial = circlePoly(0, 0, 1, 72);
    const totalArea = area(initial);
    let pieces = [{ poly: initial, hp: cfg.hp, cracks: [], dents: [] }];
    let debris = [];
    const popups = new Popups();
    const crumbs = new Particles();
    let photo = null;
    let photoLoading = true;
    let squash = 0;
    let squashV = 0;
    let time = 0;
    let shellDirty = true;
    const layout = { cx: 0, cy: 0, R: 1 };
    const shellLayer = document.createElement('canvas');

    ensurePhotoImage(state).then((img) => {
      photo = img;
      photoLoading = false;
    });

    state.crushPercent = 0;

    const revealed = () => clamp(1 - pieces.reduce((s, p) => s + area(p.poly), 0) / totalArea, 0, 1);

    function press(px, py) {
      if (px * px + py * py > 1.05) return;
      const point = [px, py];
      const index = pieces.findIndex((p) => pointInPolygon(point, p.poly));
      if (index < 0) return; // 이미 뚫린 자리
      const piece = pieces[index];
      piece.hp -= 1;
      squashV += fry === 'raw' ? 9 : 5;

      if (piece.hp > 0) {
        if (fry === 'raw') {
          piece.dents.push({ x: px, y: py, r: rand(0.14, 0.22), age: 0 });
          sfx.squish();
          popups.add('물컹', ...toScreen(px, py), { color: C.inkSoft, size: 28 });
        } else {
          addCracks(piece, px, py);
          sfx.crack();
          engine.shake(2);
        }
        shellDirty = true;
        return;
      }
      breakPiece(index, px, py);
    }

    function breakPiece(index, px, py) {
      const piece = pieces[index];
      const seeds = [];
      const b = bounds(piece.poly);
      const tryPoint = (make) => {
        for (let k = 0; k < 30; k++) {
          const p = make();
          if (pointInPolygon(p, piece.poly)) return p;
        }
        return null;
      };
      seeds.push([px, py]);
      for (let i = 0; i < cfg.near; i++) {
        const p = tryPoint(() => {
          const a = Math.random() * Math.PI * 2;
          const d = Math.sqrt(Math.random()) * cfg.radius;
          return [px + Math.cos(a) * d, py + Math.sin(a) * d];
        });
        if (p) seeds.push(p);
      }
      for (let i = 0; i < cfg.far; i++) {
        const p = tryPoint(() => [rand(b.minX, b.maxX), rand(b.minY, b.maxY)]);
        if (p) seeds.push(p);
      }
      const cells = voronoiSplit(piece.poly, seeds);
      const keep = [];
      const fall = [];
      for (const cell of cells) {
        const d = Math.hypot(cell.seed[0] - px, cell.seed[1] - py);
        const a = Math.abs(area(cell.poly));
        if (d < cfg.radius * 0.8 || a < 0.004) fall.push(cell.poly);
        else keep.push({ poly: cell.poly, hp: cfg.hp, cracks: [], dents: [] });
      }
      pieces.splice(index, 1, ...keep);

      let fallArea = 0;
      for (const poly of fall) {
        fallArea += Math.abs(area(poly));
        const c = centroid(poly);
        const dx = c[0] - px;
        const dy = c[1] - py;
        const len = Math.hypot(dx, dy) || 1;
        const speed = rand(...cfg.speed);
        debris.push({
          poly: poly.map(([x, y]) => [x - c[0], y - c[1]]),
          origin: c,
          x: c[0],
          y: c[1],
          vx: (dx / len) * speed + rand(-0.3, 0.3),
          vy: (dy / len) * speed - (fry === 'raw' ? 0 : rand(0.5, 1.5)),
          rot: 0,
          vr: rand(-8, 8) * (fry === 'raw' ? 0.2 : 1),
          scale: 1,
          age: 0,
          life: fry === 'raw' ? 1.6 : 1.2,
        });
      }
      if (debris.length > 90) debris = debris.slice(-90);

      // 소리·글자·가루
      const [sx, sy] = toScreen(px, py);
      const level = fallArea < 0.04 ? 1 : fallArea < 0.11 ? 2 : 3;
      if (fry === 'golden') {
        sfx.crunch(level);
        popups.add('바삭!', sx, sy, { color: C.amberDark, size: 30 + level * 6 });
        engine.shake(2 + level * 2);
      } else if (fry === 'burnt') {
        sfx.crumble();
        popups.add('와작!', sx, sy, { color: '#2a170c', size: 40 });
        engine.shake(7);
      } else {
        sfx.squish();
        popups.add('물컹', sx, sy, { color: C.inkSoft, size: 30 });
      }
      for (let i = 0; i < 6 + level * 5; i++) {
        crumbs.add({
          x: sx, y: sy,
          vx: rand(-260, 260), vy: rand(-380, -60),
          size: rand(1.5, 4.5),
          color: cookColor(cfg.cook + rand(-0.1, 0.1)),
          life: rand(0.4, 0.9),
          gravity: fry === 'raw' ? 400 : 1100,
        });
      }

      shellDirty = true;
      state.crushPercent = Math.round(revealed() * 100);
      updateReceipt();
    }

    function addCracks(piece, px, py) {
      const n = 3;
      const start = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        let a = start + (i / n) * Math.PI * 2 + rand(-0.4, 0.4);
        let x = px;
        let y = py;
        const line = [[x, y]];
        const steps = 4;
        const len = rand(0.12, 0.28) / steps;
        for (let s = 0; s < steps; s++) {
          a += rand(-0.5, 0.5);
          x += Math.cos(a) * len;
          y += Math.sin(a) * len;
          line.push([x, y]);
        }
        piece.cracks.push(line);
      }
    }

    const toScreen = (ux, uy) => [layout.cx + ux * layout.R, layout.cy + uy * layout.R];

    // ---------- 그리기 ----------

    function drawInside(g) {
      g.save();
      g.beginPath();
      g.arc(0, 0, 0.99, 0, Math.PI * 2);
      g.clip();
      if (photo) {
        drawCover(g, photo, -1, -1, 2, 2);
      } else {
        const grad = g.createLinearGradient(0, -1, 0, 1);
        grad.addColorStop(0, '#ffe9b8');
        grad.addColorStop(1, '#f7c49a');
        g.fillStyle = grad;
        g.fillRect(-1, -1, 2, 2);
        const m = mascotImage('sleeping');
        if (m.complete && m.naturalWidth) g.drawImage(m, -0.6, -0.6, 1.2, 1.2);
      }
      // 껍질 안쪽 그림자
      const shade = g.createRadialGradient(0, 0, 0.6, 0, 0, 1);
      shade.addColorStop(0, 'rgba(60,30,10,0)');
      shade.addColorStop(1, 'rgba(60,30,10,0.45)');
      g.fillStyle = shade;
      g.fillRect(-1, -1, 2, 2);
      g.restore();
    }

    function drawPieces(g, R) {
      const px1 = 1 / R; // 화면 1픽셀
      // 1) 두께 (조각 아래로 살짝 비치는 단면)
      g.fillStyle = cfg.edge;
      for (const p of pieces) {
        tracePoly(g, p.poly, 1, 0.012, 0.022);
        g.fill();
      }
      // 2) 겉면
      for (const p of pieces) {
        g.save();
        tracePoly(g, p.poly);
        g.clip();
        g.drawImage(shellTex, -1, -1, 2, 2);
        for (const d of p.dents) {
          const depth = Math.min(1, d.age * 6);
          const grad = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r);
          grad.addColorStop(0, `rgba(120, 80, 30, ${0.35 * depth})`);
          grad.addColorStop(1, 'rgba(120, 80, 30, 0)');
          g.fillStyle = grad;
          g.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
        }
        if (p.cracks.length) {
          g.strokeStyle = cfg.crack;
          g.lineWidth = 2.2 * px1;
          g.lineJoin = 'round';
          for (const line of p.cracks) {
            g.beginPath();
            line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
            g.stroke();
          }
        }
        g.restore();
      }
      // 3) 금 (조각 경계)
      g.strokeStyle = cfg.crack;
      g.lineWidth = 1.4 * px1;
      g.lineJoin = 'round';
      for (const p of pieces) {
        tracePoly(g, p.poly);
        g.stroke();
      }
    }

    function renderShellLayer() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const size = Math.ceil(layout.R * 2.2 * dpr);
      if (shellLayer.width !== size) {
        shellLayer.width = shellLayer.height = size;
      }
      const g = shellLayer.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, size, size);
      const R = size / 2.2;
      g.translate(size / 2, size / 2);
      g.scale(R, R);
      drawPieces(g, R);
      shellDirty = false;
    }

    const scene = {
      resize(w, h) {
        layout.R = Math.min(w * 0.4, h * 0.36);
        layout.cx = w / 2;
        layout.cy = h * 0.5;
        shellDirty = true;
      },
      pointerdown(x, y) {
        press((x - layout.cx) / layout.R, (y - layout.cy) / layout.R);
      },
      update(dt) {
        time += dt;
        // 눌렀을 때 출렁 (용수철)
        squashV += -squash * 260 * dt;
        squashV *= Math.pow(fry === 'raw' ? 0.02 : 0.0008, dt);
        squash += squashV * dt;
        for (const d of debris) {
          d.age += dt;
          d.vy += cfg.gravity * dt;
          d.x += d.vx * dt;
          d.y += d.vy * dt;
          d.rot += d.vr * dt;
          if (fry === 'raw') d.scale = Math.max(0.2, 1 - d.age * 0.4);
        }
        debris = debris.filter((d) => d.age < d.life);
        let dentsMoving = false;
        for (const p of pieces) {
          for (const d of p.dents) {
            if (d.age < 0.2) dentsMoving = true;
            d.age += dt;
          }
        }
        if (dentsMoving) shellDirty = true;
        popups.update(dt);
        crumbs.update(dt);
      },
      draw(g, w, h) {
        const { cx, cy, R } = layout;
        if (shellDirty) renderShellLayer();
        const sx = 1 + squash * 0.05;
        const sy = 1 - squash * 0.05;

        // 그림자
        g.fillStyle = 'rgba(74, 47, 26, 0.15)';
        g.beginPath();
        g.ellipse(cx, cy + R * 1.08, R * 0.8, R * 0.12, 0, 0, Math.PI * 2);
        g.fill();

        g.save();
        g.translate(cx, cy);
        g.scale(sx, sy);
        g.save();
        g.scale(R, R);
        drawInside(g);
        g.restore();
        g.drawImage(shellLayer, -R * 1.1, -R * 1.1, R * 2.2, R * 2.2);

        // 떨어지는 조각
        g.scale(R, R);
        for (const d of debris) {
          g.save();
          g.globalAlpha = clamp((d.life - d.age) / 0.3, 0, 1);
          g.translate(d.x, d.y);
          g.rotate(d.rot);
          g.scale(d.scale, d.scale);
          g.fillStyle = cfg.edge;
          tracePoly(g, d.poly, 1, 0.012, 0.022);
          g.fill();
          tracePoly(g, d.poly);
          g.clip();
          g.drawImage(shellTex, -1 - d.origin[0], -1 - d.origin[1], 2, 2);
          g.restore();
        }
        g.restore();

        // 김 / 연기
        if (revealed() < 0.9) {
          g.strokeStyle = fry === 'burnt' ? 'rgba(80,80,80,0.35)' : 'rgba(255,255,255,0.7)';
          g.lineWidth = 4;
          g.lineCap = 'round';
          for (let i = -1; i <= 1; i++) {
            g.beginPath();
            const bx = cx + i * R * 0.35;
            for (let k = 0; k <= 10; k++) {
              const yy = cy - R * 1.12 - k * R * 0.04;
              const xx = bx + Math.sin(time * 2.5 + k * 0.7 + i) * R * 0.04;
              k ? g.lineTo(xx, yy) : g.moveTo(xx, yy);
            }
            g.stroke();
          }
        }

        crumbs.draw(g);
        popups.draw(g);

        label(g, `뿌신 정도 ${state.crushPercent}%`, w / 2, h - 22, { size: 18, color: C.inkSoft });
        if (photoLoading) label(g, '속 사진 찾는 중...', w / 2, 24, { size: 16, color: C.inkSoft });
      },
    };

    const engine = runScene(stage, scene, signal);

    actions.innerHTML = '';
    actions.append(button('다음으로', () => {
      sfx.beep();
      // 결과 카드용으로 지금 모양 그대로 저장 (떨어지는 조각은 빼고)
      state.crushedCanvas = engine.snapshot(640, 640, (g, w) => {
        const R = w / 2.2;
        g.translate(w / 2, w / 2);
        g.scale(R, R);
        drawInside(g);
        drawPieces(g, R);
      });
      go('result');
    }, 'primary'));
  },
};

// 껍질 겉면 (한 장 만들어 두고 조각마다 잘라 쓴다)
function makeShellTexture(cook, burnt) {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size * 0.35, size * 0.3, size * 0.05, size / 2, size / 2, size * 0.6);
  grad.addColorStop(0, cookColor(cook - 0.06, 0.15));
  grad.addColorStop(1, cookColor(cook + 0.06, -0.15));
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const rnd = seeded(42);
  for (let i = 0; i < 900; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 2 + rnd() * 7;
    g.fillStyle = rnd() < 0.5 ? cookColor(cook + 0.1, -0.12) : cookColor(cook - 0.12, 0.18);
    g.globalAlpha = 0.5 + rnd() * 0.5;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  if (burnt) {
    g.globalAlpha = 0.35;
    g.fillStyle = '#000';
    for (let i = 0; i < 40; i++) {
      g.beginPath();
      g.arc(rnd() * size, rnd() * size, 10 + rnd() * 30, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  // 윤기
  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.beginPath();
  g.ellipse(size * 0.33, size * 0.27, size * 0.17, size * 0.08, -0.5, 0, Math.PI * 2);
  g.fill();
  return c;
}
