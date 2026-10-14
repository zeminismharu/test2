// 4단계 · 튀김기에 던지기
// 치킨을 손가락/마우스로 위로 휙 던져 기름에 풍덩.
// 실패하면 깜짝 연출: 치킨이 화면 쪽으로 날아와 "철퍽" → 번쩍 + 흔들림 + 기름 자국 + (안드로이드) 진동
//   → 스르륵 흘러내림 → "...일단 다시 던짐"
// 번쩍임은 engine.flash() 가 1초에 1번 넘게 못 하도록 막는다 (광과민성 발작 위험 기준: 초당 3회 미만).
// 3번 연속 실패하면 마스코트가 대신 넣어 준다.
import { runScene, clamp, lerp, rand, easeInCubic, easeOutCubic, Popups, Particles } from '../game/engine.js';
import { C, drawCoatedBall, drawFryer, label, mascotImage, roundRect } from '../game/draw.js';
import { sfx } from '../audio.js';

const FLY_TIME = 0.5;
const THROW_SPEED = 7; // 클수록 세게 던져야 함

export const throwStage = {
  id: 'throw',
  guide: '튀김기에 던지세요',
  line: '',
  render({ stage, actions, state, go, setLine, signal, updateReceipt }) {
    state.throwFails = 0;
    let streak = 0;
    let mascotT = -1; // 마스코트가 나와 있으면 0 이상
    let time = 0;
    let phase = 'ready';
    let phaseT = 0;
    const ball = { x: 0, y: 0, scale: 1, alpha: 1, sx: 1, sy: 1, rot: 0 };
    let fly = null; // { x0, y0, x1, y1, success }
    let history = [];
    let stains = [];
    let oil = { cx: 0, cy: 0, rx: 1, ry: 1 };
    const popups = new Popups();
    const drops = new Particles();
    const layout = { w: 1, h: 1, homeX: 0, homeY: 0, r: 1, fryerY: 0, fryerW: 1 };

    const setPhase = (p) => { phase = p; phaseT = 0; };
    const resetBall = () => Object.assign(ball, { x: layout.homeX, y: layout.homeY, scale: 1, alpha: 1, sx: 1, sy: 1, rot: 0 });

    function launch(vx, vy) {
      // 날아가는 거리 = 손 속도에 비례. 튀김기까지 거리(D)의 THROW_SPEED 배 속도(px/s)면 딱 들어간다.
      const speed = Math.hypot(vx, vy);
      const D = ball.y - oil.cy;
      const dist = D * clamp(speed / (D * THROW_SPEED), 0.2, 2.5);
      const x1 = ball.x + (vx / speed) * dist;
      const y1 = ball.y + (vy / speed) * dist;
      const inX = Math.abs(x1 - oil.cx) < oil.rx * 1.05;
      const inY = y1 > oil.cy - oil.ry * 2.6 && y1 < oil.cy + oil.ry * 2.2;
      fly = { x0: ball.x, y0: ball.y, x1, y1, success: inX && inY };
      sfx.whoosh();
      setPhase('fly');
    }

    function autoThrow() {
      fly = { x0: layout.homeX, y0: layout.homeY, x1: oil.cx, y1: oil.cy, success: true };
      sfx.whoosh();
      setPhase('fly');
    }

    function landed() {
      if (fly.success) {
        sfx.plop();
        popups.add('풍덩!', oil.cx, oil.cy - oil.ry * 2, { color: C.amberDark, size: 40 });
        for (let i = 0; i < 18; i++) {
          drops.add({
            x: oil.cx + rand(-20, 20), y: oil.cy,
            vx: rand(-220, 220), vy: rand(-520, -200),
            size: rand(3, 7), color: i % 2 ? C.oil : '#f7c35a', life: rand(0.5, 0.9),
          });
        }
        engine.shake(5);
        setPhase('splash');
      } else {
        sfx.whoosh();
        setPhase('incoming');
      }
    }

    function splat() {
      sfx.splat();
      engine.flash(0.9);
      engine.shake(18);
      engine.vibrate([60, 30, 120]);
      popups.add('철퍽!', layout.w / 2, layout.h * 0.25, { color: C.ink, size: 64, life: 1 });
      const cx = layout.w / 2;
      const cy = layout.h * 0.45;
      for (let i = 0; i < 9; i++) {
        const a = rand(0, Math.PI * 2);
        const d = rand(0.15, 0.55) * Math.min(layout.w, layout.h);
        stains.push({
          x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d,
          r: rand(10, 34), age: 0, drip: rand(20, 90),
          shape: Array.from({ length: 9 }, () => rand(0.7, 1.25)),
        });
      }
      state.throwFails += 1;
      streak += 1;
      updateReceipt();
      setPhase('stuck');
    }

    const scene = {
      resize(w, h) {
        Object.assign(layout, {
          w, h,
          r: Math.min(w, h) * 0.085,
          homeX: w / 2,
          homeY: h * 0.8,
          fryerY: h * 0.3,
          fryerW: Math.min(w * 0.78, h * 0.5),
        });
        if (phase === 'ready') resetBall();
      },
      pointerdown(x, y) {
        if (phase !== 'ready') return;
        if (Math.hypot(x - ball.x, y - ball.y) > layout.r * 2) return;
        setPhase('drag');
        history = [{ x, y, t: performance.now() }];
      },
      pointermove(x, y) {
        if (phase !== 'drag') return;
        ball.x = clamp(x, layout.r, layout.w - layout.r);
        ball.y = clamp(y, layout.h * 0.5, layout.h - layout.r);
        const now = performance.now();
        history.push({ x, y, t: now });
        history = history.filter((p) => now - p.t < 120);
      },
      pointerup() {
        if (phase !== 'drag') return;
        const now = performance.now();
        const recent = history.filter((p) => now - p.t < 120);
        const first = recent[0];
        const last = recent[recent.length - 1];
        // 아주 빠르게 휙 그으면 이벤트가 한두 개뿐이라 시간이 0에 가깝다 → 최소 한 프레임(16ms)으로 본다
        const dt = first && last ? Math.max((last.t - first.t) / 1000, 0.016) : 1;
        const vx = first ? (last.x - first.x) / dt : 0;
        const vy = first ? (last.y - first.y) / dt : 0;
        if (vy < -350) {
          launch(vx, vy);
        } else {
          setPhase('ready');
          resetBall();
        }
      },
      update(dt) {
        time += dt;
        phaseT += dt;
        popups.update(dt);
        drops.update(dt);
        for (const s of stains) s.age += dt;
        stains = stains.filter((s) => s.age < 7);

        const big = Math.min(layout.w, layout.h) * 0.62 / layout.r;
        if (phase === 'fly') {
          const t = Math.min(1, phaseT / FLY_TIME);
          ball.x = lerp(fly.x0, fly.x1, t);
          ball.y = lerp(fly.y0, fly.y1, t) - Math.sin(Math.PI * t) * layout.h * 0.12;
          ball.scale = lerp(1, 0.6, t);
          ball.rot += dt * 8;
          if (t >= 1) landed();
        } else if (phase === 'splash') {
          ball.scale = Math.max(0, 0.6 - phaseT * 1.2);
          ball.y = fly.y1 + phaseT * 20;
          if (phaseT > 1) go('fry');
        } else if (phase === 'incoming') {
          // 화면 쪽으로 빠르게 커지며 날아옴
          const t = easeInCubic(Math.min(1, phaseT / 0.38));
          ball.x = lerp(fly.x1, layout.w / 2, t);
          ball.y = lerp(fly.y1 - layout.h * 0.05, layout.h * 0.45, t);
          ball.scale = lerp(0.6, big, t);
          ball.rot += dt * 14;
          if (phaseT >= 0.38) splat();
        } else if (phase === 'stuck') {
          // 철퍽 붙어서 납작
          const t = Math.min(1, phaseT / 0.15);
          ball.sx = lerp(1.25, 1.12, t);
          ball.sy = lerp(0.8, 0.92, t);
          if (phaseT > 0.6) setPhase('slide');
        } else if (phase === 'slide') {
          // 스르륵 흘러내림
          const t = Math.min(1, phaseT / 1.5);
          ball.y = layout.h * 0.45 + easeInCubic(t) * layout.h * 0.7;
          ball.sy = 0.92 + t * 0.25;
          ball.alpha = 1 - Math.max(0, (t - 0.6) / 0.4);
          if (t >= 1) {
            resetBall();
            if (streak >= 3) {
              setPhase('mascot');
            } else {
              popups.add('...일단 다시 던짐', layout.w / 2, layout.homeY - layout.r * 2.2, { color: C.inkSoft, size: 24, life: 1.6 });
              setLine('...일단 다시 던짐');
              setPhase('ready');
            }
          }
        } else if (phase === 'mascot') {
          if (phaseT > 0.1 && phaseT - dt <= 0.1) setLine('일단 모르겠고 그냥 넣음');
          if (phaseT > 1.4) autoThrow();
        }
        if (mascotT >= 0) mascotT += dt;
        if (phase === 'mascot' && mascotT < 0) mascotT = 0;
      },
      draw(g, w, h) {
        oil = drawFryer(g, w / 2, layout.fryerY, layout.fryerW, time, { bubbles: 1 });

        if (phase === 'ready') {
          // 안내 화살표
          g.save();
          g.strokeStyle = C.inkSoft;
          g.lineWidth = 3;
          g.setLineDash([8, 10]);
          g.lineDashOffset = -time * 30;
          g.beginPath();
          g.moveTo(layout.homeX, layout.homeY - layout.r * 1.5);
          g.lineTo(oil.cx, oil.cy + oil.ry * 2.2);
          g.stroke();
          g.restore();
          label(g, '위로 휙!', layout.homeX + layout.r * 2.2, layout.homeY - layout.r * 0.4, { size: 20, color: C.inkSoft, align: 'left' });
        }

        const inFront = phase === 'incoming' || phase === 'stuck' || phase === 'slide';
        if (!inFront && ball.scale > 0.01) {
          drawBall(g);
        }
        drops.draw(g);

        // 기름 자국 (화면에 묻은 것)
        for (const s of stains) {
          const a = Math.max(0, 1 - s.age / 7) * 0.55;
          g.fillStyle = `rgba(214, 150, 40, ${a})`;
          g.beginPath();
          s.shape.forEach((k, i) => {
            const ang = (i / s.shape.length) * Math.PI * 2;
            const px = s.x + Math.cos(ang) * s.r * k;
            const py = s.y + Math.sin(ang) * s.r * k;
            i ? g.lineTo(px, py) : g.moveTo(px, py);
          });
          g.closePath();
          g.fill();
          const dl = Math.min(1, s.age / 2) * s.drip;
          g.strokeStyle = `rgba(214, 150, 40, ${a})`;
          g.lineWidth = s.r * 0.35;
          g.lineCap = 'round';
          g.beginPath();
          g.moveTo(s.x, s.y);
          g.lineTo(s.x, s.y + dl);
          g.stroke();
        }

        if (inFront) {
          g.globalAlpha = ball.alpha;
          drawBall(g);
          g.globalAlpha = 1;
        }

        if (mascotT >= 0) drawMascot(g, w, h);
        popups.draw(g);
        if (state.throwFails > 0) label(g, `실패 ${state.throwFails}회`, w - 16, 22, { size: 16, color: C.inkSoft, align: 'right' });
      },
    };

    function drawBall(g) {
      drawCoatedBall(g, ball.x, ball.y, layout.r * ball.scale, {
        base: state.beatenCanvas, coating: state.coating ?? 0.5, sx: ball.sx, sy: ball.sy, rot: ball.rot,
      });
    }

    function drawMascot(g, w, h) {
      const s = Math.min(w, h) * 0.38;
      const t = easeOutCubic(Math.min(1, mascotT / 0.4));
      const x = lerp(w + s, w - s * 0.75, t);
      const y = h - s * 0.85;
      const img = mascotImage('throw');
      if (img.complete && img.naturalWidth) g.drawImage(img, x - s / 2, y - s / 2, s, s);
      // 말풍선
      const text = '일단 모르겠고 그냥 넣음';
      g.font = '18px Jua, sans-serif';
      const tw = g.measureText(text).width + 28;
      const bx = clamp(x - tw * 0.8, 10, w - tw - 10);
      const by = y - s * 0.75;
      g.globalAlpha = t;
      g.fillStyle = C.creamLight;
      g.strokeStyle = C.ink;
      g.lineWidth = 3;
      roundRect(g, bx, by, tw, 40, 14);
      g.fill();
      g.stroke();
      label(g, text, bx + tw / 2, by + 20, { size: 18, stroke: false });
      g.globalAlpha = 1;
    }

    const engine = runScene(stage, scene, signal);
    resetBall();

    actions.innerHTML = '';
  },
};
