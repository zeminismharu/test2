// 게임 캔버스 하나를 모든 게임 단계가 같이 쓴다. 폰/컴퓨터 모두 가운데 #stage 영역을 꽉 채운다.
//
// 장면(scene)은 이런 모양의 객체다 (전부 선택):
//   update(dt, time)               매 프레임 상태 갱신 (dt: 초)
//   draw(ctx, w, h)                그리기 (CSS 픽셀 기준)
//   pointerdown/move/up(x, y, e)   입력
//
// 화면 번쩍임은 flash() 로만 낸다. 광과민성 발작 위험 때문에 1초에 1번을 넘지 않게 막는다.

const canvas = document.createElement('canvas');
canvas.className = 'game-canvas';
const ctx = canvas.getContext('2d');

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const FLASH_MIN_INTERVAL = 1000; // ms. 기준은 "1초에 3회 미만" — 여유 있게 1회로 제한

export function runScene(stageEl, scene, signal) {
  let width = 0;
  let height = 0;
  let dpr = 1;
  let raf = 0;
  let last = performance.now();
  let shake = 0;
  let flash = 0;
  let lastFlashAt = -Infinity;

  stageEl.classList.add('is-game');
  stageEl.replaceChildren(canvas);

  const resize = () => {
    const rect = stageEl.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    scene.resize?.(width, height);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(stageEl);
  resize();

  const api = {
    canvas,
    get width() { return width; },
    get height() { return height; },
    shake(amount) {
      shake = Math.max(shake, reducedMotion.matches ? amount * 0.3 : amount);
    },
    // strength 0~1. 너무 자주 부르면 무시된다.
    flash(strength = 1) {
      const now = performance.now();
      if (now - lastFlashAt < FLASH_MIN_INTERVAL) return false;
      lastFlashAt = now;
      flash = reducedMotion.matches ? strength * 0.35 : strength;
      return true;
    },
    vibrate(pattern) {
      if (!reducedMotion.matches) navigator.vibrate?.(pattern); // 아이폰은 지원 안 함 (안드로이드만)
    },
    // 지금 장면을 원하는 크기의 새 캔버스에 다시 그린다 (결과 카드용 캡처)
    snapshot(w, h, drawFn) {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      drawFn(c.getContext('2d'), w, h);
      return c;
    },
  };

  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    scene.update?.(dt, now / 1000);
    // update 안에서 다음 화면으로 넘어갔으면(go) 이 장면은 여기서 끝
    if (signal.aborted) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    if (shake > 0.2) {
      ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);
    }
    scene.draw?.(ctx, width, height);
    ctx.restore();

    if (flash > 0.01) {
      ctx.fillStyle = `rgba(255, 252, 240, ${flash})`;
      ctx.fillRect(0, 0, width, height);
    }
    shake *= Math.pow(0.0015, dt); // 약 0.3초에 거의 멈춤
    flash *= Math.pow(0.002, dt);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);

  const point = (e) => {
    const rect = canvas.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };
  const on = (type, handler) => canvas.addEventListener(type, handler, { signal });
  on('pointerdown', (e) => {
    canvas.setPointerCapture?.(e.pointerId);
    scene.pointerdown?.(...point(e), e);
  });
  on('pointermove', (e) => scene.pointermove?.(...point(e), e));
  on('pointerup', (e) => scene.pointerup?.(...point(e), e));
  on('pointercancel', (e) => scene.pointerup?.(...point(e), e));

  signal.addEventListener('abort', () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    stageEl.classList.remove('is-game');
    scene.destroy?.();
  });

  return api;
}

// ---------- 작은 도구들 ----------

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInCubic = (t) => t * t * t;

// 위로 떠오르며 사라지는 글자 ("퍽!", "바삭!")
export class Popups {
  constructor() { this.items = []; }
  add(text, x, y, { color = '#4a2f1a', size = 34, life = 0.7 } = {}) {
    this.items.push({ text, x, y, color, size, life, age: 0, rot: rand(-0.25, 0.25) });
  }
  update(dt) {
    for (const p of this.items) p.age += dt;
    this.items = this.items.filter((p) => p.age < p.life);
  }
  draw(ctx) {
    for (const p of this.items) {
      const t = p.age / p.life;
      const scale = t < 0.15 ? 0.6 + (t / 0.15) * 0.6 : 1.2 - (t - 0.15) * 0.25;
      ctx.save();
      ctx.globalAlpha = 1 - Math.max(0, (t - 0.6) / 0.4);
      ctx.translate(p.x, p.y - t * 40);
      ctx.rotate(p.rot);
      ctx.scale(scale, scale);
      ctx.font = `${p.size}px Jua, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 6;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#fffaf0';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }
}

// 단순한 파편/가루 입자
export class Particles {
  constructor() { this.items = []; }
  add(p) {
    this.items.push({ vx: 0, vy: 0, gravity: 900, size: 6, life: 0.8, age: 0, color: '#fff', grow: 0, drag: 0, shape: 'circle', ...p });
  }
  update(dt) {
    for (const p of this.items) {
      p.age += dt;
      p.vx *= 1 - p.drag * dt;
      p.vy = p.vy * (1 - p.drag * dt) + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += p.grow * dt;
    }
    this.items = this.items.filter((p) => p.age < p.life);
  }
  draw(ctx) {
    for (const p of this.items) {
      ctx.globalAlpha = Math.max(0, 1 - p.age / p.life) * (p.alpha ?? 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
