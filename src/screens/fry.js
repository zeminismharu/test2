// 5단계 · 튀기기
// 기름 속 치킨 색이 반죽 → 황금 → 갈색 → 검정으로 변한다. 보고 [건지기] → 덜 익음 / 황금 / 탄
import { runScene, lerp, rand, Popups, Particles } from '../game/engine.js';
import { C, drawCoatedBall, drawFryer, label } from '../game/draw.js';
import { FRY_LABEL } from '../game/labels.js';
import { sfx, startSizzle } from '../audio.js';
import { button } from '../ui/dom.js';

const FULL_TIME = 9; // 초. 반죽에서 새까맣게 될 때까지
const GOLDEN = [0.45, 0.72]; // 이 사이에서 건지면 황금


export function judgeFry(cook) {
  if (cook < GOLDEN[0]) return 'raw';
  if (cook <= GOLDEN[1]) return 'golden';
  return 'burnt';
}

export const fry = {
  id: 'fry',
  guide: '색 보고 건지세요',
  line: '',
  render({ stage, actions, state, go, signal, updateReceipt }) {
    let cook = 0;
    let time = 0;
    let lifted = false;
    let liftT = 0;
    const popups = new Popups();
    const smoke = new Particles();
    const layout = { w: 1, h: 1 };
    const sizzle = startSizzle();
    signal.addEventListener('abort', () => sizzle.stop());
    state.fryState = null;

    function lift() {
      if (lifted) return;
      lifted = true;
      state.fryState = judgeFry(cook);
      sfx.beep();
      sizzle.setLevel(0.1);
      const name = FRY_LABEL[state.fryState];
      popups.add(state.fryState === 'golden' ? `${name}!` : name, layout.w / 2, layout.h * 0.2, {
        color: state.fryState === 'burnt' ? '#2a170c' : C.amberDark, size: 52, life: 2.5,
      });
      updateReceipt();
      actions.innerHTML = '';
      actions.append(button('다음으로', () => { sfx.beep(); go('crush'); }, 'primary'));
    }

    const scene = {
      resize(w, h) {
        layout.w = w;
        layout.h = h;
      },
      update(dt) {
        time += dt;
        if (!lifted) {
          cook += dt / FULL_TIME;
          sizzle.setLevel(0.5 + cook * 0.5);
          if (cook > 1.12) lift(); // 너무 오래 두면 알아서 건짐 (탄)
        } else {
          liftT += dt;
        }
        if (cook > 0.75 && !lifted && Math.random() < dt * 12) {
          smoke.add({
            x: layout.w / 2 + rand(-40, 40), y: layout.h * 0.45,
            vx: rand(-20, 20), vy: rand(-90, -50), gravity: -10,
            size: rand(8, 14), grow: 26, color: '#6b6158', alpha: Math.min(0.5, (cook - 0.75) * 2), life: 1.6,
          });
        }
        smoke.update(dt);
        popups.update(dt);
      },
      draw(g, w, h) {
        const fw = Math.min(w * 0.92, h * 0.75);
        const fy = h * 0.62;
        const r = fw * 0.17;
        const bob = Math.sin(time * 3) * r * 0.05;
        const y = lifted ? lerp(fy - fw * 0.1, fy - fw * 0.55, Math.min(1, liftT / 0.5)) : fy - fw * 0.1 + bob;
        drawFryer(g, w / 2, fy, fw, time, { bubbles: lifted ? 0.3 : 1.6 });
        if (lifted) {
          drawCoatedBall(g, w / 2, y, r, { base: state.beatenCanvas, coating: state.coating ?? 0.5, cook: Math.min(cook, 1) });
        } else {
          // 기름에 반쯤 잠긴 모습
          g.save();
          g.beginPath();
          g.rect(0, 0, w, fy - fw * 0.08 + r * 0.3);
          g.clip();
          drawCoatedBall(g, w / 2, y, r, { base: state.beatenCanvas, coating: state.coating ?? 0.5, cook: Math.min(cook, 1) });
          g.restore();
        }
        smoke.draw(g);
        popups.draw(g);
        if (!lifted && time < 3) label(g, '색이 변하는 걸 보세요', w / 2, 26, { size: 17, color: C.inkSoft });
      },
    };

    runScene(stage, scene, signal);

    actions.innerHTML = '';
    actions.append(button('건지기', () => lift(), 'primary'));
  },
};
