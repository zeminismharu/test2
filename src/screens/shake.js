// 3단계 · 봉지 흔들기
// 폰: 실제로 흔들기(DeviceMotion). 아이폰은 권한이 필요해서 버튼을 눌러야 시작된다.
// 컴퓨터: 마우스로 봉지를 좌우로 끌기. (폰에서도 손가락으로 끌면 된다 — 센서가 안 될 때 대비)
// 많이 흔들수록 튀김옷이 두꺼워진다.
import { runScene, clamp, lerp, rand, easeInCubic, Particles } from '../game/engine.js';
import { C, drawBag, drawCoatedBall, label, roundRect } from '../game/draw.js';
import { coatingLabel } from '../game/labels.js';
import { sfx } from '../audio.js';
import { button } from '../ui/dom.js';

const ENERGY_SCALE = 25; // 클수록 두꺼워지기 어려움
const INTRO = 0.8; // 초. 닭이 봉지에 들어가는 시간

export const shake = {
  id: 'shake',
  guide: '봉지를 흔드세요',
  line: '흔들면 옷 두꺼워짐.',
  render({ stage, actions, state, go, setLine, signal, updateReceipt }) {
    state.coating = 0;
    let energy = 0;
    let time = 0;
    let offset = 0; // 봉지 가로 위치 (px)
    let target = 0;
    let rot = 0;
    let dragging = false;
    let lastX = 0;
    let lastDir = 0;
    let stroke = 0;
    let lastRustle = 0;
    let lastReceipt = 0;
    let motionSeen = false;
    const puffs = new Particles();
    const layout = { w: 1, h: 1, s: 1, cx: 0, cy: 0 };

    function addEnergy(amount) {
      if (time < INTRO) return;
      energy += amount;
      state.coating = 1 - Math.exp(-energy / ENERGY_SCALE);
      if (time - lastRustle > 0.09) {
        sfx.rustle();
        lastRustle = time;
      }
      const n = Math.min(6, 1 + Math.round(amount * 2));
      for (let i = 0; i < n; i++) {
        puffs.add({
          x: layout.cx + offset + rand(-layout.s * 0.3, layout.s * 0.3),
          y: layout.cy - layout.s * 0.6,
          vx: rand(-60, 60), vy: rand(-120, -40),
          size: rand(4, 9), grow: 20, gravity: -20, drag: 2,
          color: '#fff', alpha: 0.8, life: rand(0.5, 1),
        });
      }
      if (time - lastReceipt > 0.25) {
        updateReceipt();
        lastReceipt = time;
      }
    }

    const scene = {
      resize(w, h) {
        layout.w = w;
        layout.h = h;
        layout.s = Math.min(w * 0.42, h * 0.38);
        layout.cx = w / 2;
        layout.cy = h * 0.5;
      },
      pointerdown(x) {
        dragging = true;
        lastX = x;
        stroke = 0;
      },
      pointermove(x) {
        if (!dragging) return;
        const dx = x - lastX;
        lastX = x;
        if (Math.abs(dx) < 0.5) return;
        target = clamp(target + dx, -layout.w * 0.28, layout.w * 0.28);
        const dir = Math.sign(dx);
        if (dir !== lastDir && lastDir !== 0) {
          if (stroke > 25) addEnergy(Math.min(stroke, 250) / 100);
          stroke = 0;
        }
        lastDir = dir;
        stroke += Math.abs(dx);
      },
      pointerup() {
        dragging = false;
      },
      update(dt) {
        time += dt;
        if (!dragging && !motionSeen) target *= Math.pow(0.05, dt); // 놓으면 가운데로
        const prev = offset;
        offset = lerp(offset, target, 1 - Math.pow(0.0001, dt));
        const v = (offset - prev) / Math.max(dt, 1e-3);
        rot = lerp(rot, clamp(v / 1500, -0.5, 0.5), 1 - Math.pow(0.001, dt));
        puffs.update(dt);
      },
      draw(g, w, h) {
        const { s, cx, cy } = layout;
        const bx = cx + offset;
        // 닭이 위에서 봉지로 쏙
        if (time < INTRO) {
          const t = easeInCubic(Math.min(1, time / INTRO));
          const r = s * 0.28 * (1 - t * 0.3);
          drawCoatedBall(g, cx, lerp(cy - s * 1.3, cy - s * 0.4, t), r, { base: state.beatenCanvas, coating: 0, outline: true });
        }
        drawBag(g, bx, cy, s, rot, time < INTRO ? 1 : 0);
        puffs.draw(g);

        // 튀김옷 게이지
        const gw = Math.min(w * 0.7, 340);
        const gx = (w - gw) / 2;
        const gy = h - 46;
        g.lineWidth = 3;
        g.strokeStyle = C.ink;
        g.fillStyle = C.creamDark;
        roundRect(g, gx, gy, gw, 18, 9);
        g.fill();
        if (state.coating > 0.005) {
          g.save();
          roundRect(g, gx, gy, gw, 18, 9);
          g.clip();
          g.fillStyle = C.amber;
          g.fillRect(gx, gy, gw * state.coating, 18);
          g.restore();
        }
        roundRect(g, gx, gy, gw, 18, 9);
        g.stroke();
        label(g, `튀김옷: ${coatingLabel(state.coating)}`, w / 2, gy - 18, { size: 18, color: C.ink });
        if (energy === 0 && time > INTRO) {
          label(g, motionSeen ? '폰을 흔드세요!' : '봉지를 좌우로 끌어서 흔드세요', w / 2, 28, { size: 17, color: C.inkSoft });
        }
      },
    };

    runScene(stage, scene, signal);

    // ---------- 폰 흔들기 ----------
    function onMotion(e) {
      const a = e.acceleration;
      let mag;
      let ax;
      if (a && a.x !== null) {
        mag = Math.hypot(a.x, a.y, a.z);
        ax = a.x;
      } else {
        const ag = e.accelerationIncludingGravity;
        if (!ag || ag.x === null) return;
        mag = Math.abs(Math.hypot(ag.x, ag.y, ag.z) - 9.8);
        ax = ag.x;
      }
      if (!motionSeen) {
        motionSeen = true;
      }
      target = clamp(-ax * 12, -layout.w * 0.28, layout.w * 0.28);
      if (mag > 8) addEnergy((mag - 8) * 0.015);
    }

    actions.innerHTML = '';
    const canMotion = 'DeviceMotionEvent' in window && window.matchMedia('(pointer: coarse)').matches;
    if (canMotion) {
      const ready = button('흔들 준비 되셨나요?', async () => {
        sfx.beep();
        let granted = true;
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
          try {
            granted = (await DeviceMotionEvent.requestPermission()) === 'granted';
          } catch {
            granted = false;
          }
        }
        ready.remove();
        if (!granted) {
          setLine('권한 없음. 화면을 좌우로 문지르셈.');
          return;
        }
        window.addEventListener('devicemotion', onMotion, { signal });
        setLine('폰을 흔드셈. 떨어뜨리지 말고.');
        setTimeout(() => {
          if (!motionSeen && !signal.aborted) setLine('흔들림이 안 잡힘. 화면을 좌우로 문지르셈.');
        }, 1500);
      }, 'secondary');
      actions.append(ready);
    }
    actions.append(button('다음으로', () => {
      sfx.beep();
      go('throw');
    }, 'primary'));
  },
};
