// 캔버스용 그림. public/assets/ 에 PNG 가 있으면 그걸 쓰고, 없으면 임시 도형을 그린다.
import { mascotSVG } from '../ui/placeholders.js';

export const C = {
  ink: '#4a2f1a',
  inkSoft: '#8a6a4e',
  cream: '#fff4e0',
  creamLight: '#fffaf0',
  creamDark: '#f6dfb5',
  amber: '#f2a33a',
  amberDark: '#c9741a',
  golden: '#e8901f',
  raw: '#f4c7b8',
  rawDark: '#d99a88',
  oil: '#e9a93a',
  oilDark: '#b8741c',
};

// ---------- 그림 파일 (있으면 쓰고 없으면 null) ----------

const images = new Map();

export function preloadAssets(names, timeout = 1500) {
  return Promise.race([
    Promise.all(names.map((name) => new Promise((resolve) => {
      if (images.has(name)) return resolve();
      const img = new Image();
      img.onload = () => { images.set(name, img); resolve(); };
      img.onerror = () => { images.set(name, null); resolve(); };
      img.src = `/assets/${name}.png`;
    }))),
    new Promise((resolve) => setTimeout(resolve, timeout)),
  ]);
}

export function asset(name) {
  return images.get(name) || null;
}

// ---------- 결정적인 난수 (같은 씨앗이면 같은 모양) ----------

export function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 생닭 텍스처 (때리기 화면에서 그물 모양으로 늘린다) ----------

export function makeRawChickenTexture(photo, size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const r = size / 2;
  g.save();
  g.beginPath();
  g.arc(r, r, r * 0.94, 0, Math.PI * 2);
  g.clip();
  const rawImg = asset('raw-chicken');
  if (photo) {
    drawCover(g, photo, 0, 0, size, size);
    g.fillStyle = 'rgba(244, 199, 184, 0.28)'; // 생닭 느낌의 분홍빛
    g.fillRect(0, 0, size, size);
  } else if (rawImg) {
    g.drawImage(rawImg, 0, 0, size, size);
  } else {
    const grad = g.createRadialGradient(r * 0.75, r * 0.7, r * 0.1, r, r, r);
    grad.addColorStop(0, '#fbe1d6');
    grad.addColorStop(1, C.raw);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    g.strokeStyle = C.rawDark;
    g.lineWidth = size * 0.02;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(size * 0.3, size * 0.6); g.quadraticCurveTo(size * 0.37, size * 0.65, size * 0.43, size * 0.6);
    g.moveTo(size * 0.56, size * 0.66); g.quadraticCurveTo(size * 0.62, size * 0.7, size * 0.67, size * 0.65);
    g.moveTo(size * 0.45, size * 0.78); g.quadraticCurveTo(size * 0.5, size * 0.81, size * 0.55, size * 0.78);
    g.stroke();
  }
  // 반짝임
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(r * 0.68, r * 0.55, r * 0.22, r * 0.12, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // 테두리
  if (!rawImg || photo) {
    g.strokeStyle = C.ink;
    g.lineWidth = size * 0.03;
    g.beginPath();
    g.arc(r, r, r * 0.94 - size * 0.015, 0, Math.PI * 2);
    g.stroke();
  }
  return c;
}

export function drawCover(g, img, x, y, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s;
  const dh = ih * s;
  g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

// ---------- 주먹 ----------

export function drawFist(g, x, y, s, angle) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.lineWidth = Math.max(2, s * 0.07);
  g.strokeStyle = C.ink;
  g.lineJoin = 'round';
  // 팔
  g.fillStyle = C.amber;
  roundRect(g, -s * 0.28, s * 0.35, s * 0.56, s * 1.6, s * 0.18);
  g.fill(); g.stroke();
  // 주먹
  g.fillStyle = C.creamLight;
  roundRect(g, -s * 0.5, -s * 0.45, s, s * 0.9, s * 0.3);
  g.fill(); g.stroke();
  // 손가락 마디
  g.beginPath();
  for (let i = 1; i < 4; i++) {
    const fx = -s * 0.5 + (s / 4) * i;
    g.moveTo(fx, -s * 0.45);
    g.lineTo(fx, -s * 0.1);
  }
  g.stroke();
  // 엄지
  g.beginPath();
  g.ellipse(-s * 0.05, s * 0.12, s * 0.3, s * 0.13, -0.2, 0, Math.PI * 2);
  g.fillStyle = C.creamDark;
  g.fill(); g.stroke();
  g.restore();
}

// ---------- 튀김가루 봉지 ----------

export function drawBag(g, x, y, s, rot = 0, open = 0) {
  const img = asset('bag');
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  if (img) {
    g.drawImage(img, -s * 0.6, -s * 0.75, s * 1.2, s * 1.5);
    g.restore();
    return;
  }
  g.lineWidth = Math.max(3, s * 0.035);
  g.strokeStyle = C.ink;
  g.lineJoin = 'round';
  // 몸통
  g.beginPath();
  g.moveTo(-s * 0.42, -s * 0.5);
  g.lineTo(s * 0.42, -s * 0.5);
  g.lineTo(s * 0.5, s * 0.62);
  g.quadraticCurveTo(0, s * 0.72, -s * 0.5, s * 0.62);
  g.closePath();
  g.fillStyle = C.creamLight;
  g.fill(); g.stroke();
  // 띠
  g.fillStyle = C.amber;
  g.beginPath();
  g.moveTo(-s * 0.45, s * 0.02); g.lineTo(s * 0.45, s * 0.02);
  g.lineTo(s * 0.47, s * 0.26); g.lineTo(-s * 0.47, s * 0.26);
  g.closePath();
  g.fill(); g.stroke();
  // 밀가루 그림 (글자 대신)
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(-s * 0.1, -s * 0.2, s * 0.1, 0, Math.PI * 2);
  g.arc(s * 0.08, -s * 0.22, s * 0.12, 0, Math.PI * 2);
  g.arc(-s * 0.01, -s * 0.12, s * 0.1, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = Math.max(2, s * 0.02);
  g.stroke();
  // 접힌 입구
  g.lineWidth = Math.max(3, s * 0.035);
  g.fillStyle = C.creamDark;
  g.beginPath();
  g.moveTo(-s * 0.42, -s * 0.5);
  g.lineTo(-s * 0.3 - open * s * 0.1, -s * 0.66 - open * s * 0.12);
  g.lineTo(s * 0.3 + open * s * 0.1, -s * 0.66 - open * s * 0.12);
  g.lineTo(s * 0.42, -s * 0.5);
  g.closePath();
  g.fill(); g.stroke();
  g.restore();
}

// ---------- 튀김기 ----------
// 기름 표면 타원을 돌려준다: { cx, cy, rx, ry }

export function drawFryer(g, cx, cy, w, time = 0, { bubbles = 1 } = {}) {
  const img = asset('fryer');
  const oil = { cx, cy: cy - w * 0.08, rx: w * 0.4, ry: w * 0.13 };
  if (img) {
    g.drawImage(img, cx - w / 2, cy - w * 0.35, w, w * 0.8);
    return oil;
  }
  g.save();
  g.lineWidth = Math.max(3, w * 0.018);
  g.strokeStyle = C.ink;
  g.lineJoin = 'round';
  // 몸통
  g.fillStyle = '#d9d2c4';
  g.beginPath();
  g.moveTo(cx - w * 0.47, cy - w * 0.1);
  g.lineTo(cx - w * 0.42, cy + w * 0.32);
  g.quadraticCurveTo(cx, cy + w * 0.4, cx + w * 0.42, cy + w * 0.32);
  g.lineTo(cx + w * 0.47, cy - w * 0.1);
  g.closePath();
  g.fill(); g.stroke();
  // 손잡이
  g.beginPath();
  g.moveTo(cx + w * 0.47, cy);
  g.lineTo(cx + w * 0.62, cy - w * 0.02);
  g.lineWidth = Math.max(5, w * 0.04);
  g.stroke();
  g.lineWidth = Math.max(3, w * 0.018);
  // 테두리
  g.fillStyle = '#b9b0a0';
  g.beginPath();
  g.ellipse(cx, cy - w * 0.1, w * 0.47, w * 0.16, 0, 0, Math.PI * 2);
  g.fill(); g.stroke();
  // 기름
  const grad = g.createRadialGradient(oil.cx, oil.cy - oil.ry * 0.3, oil.ry * 0.2, oil.cx, oil.cy, oil.rx);
  grad.addColorStop(0, '#f7c35a');
  grad.addColorStop(1, C.oilDark);
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(oil.cx, oil.cy, oil.rx, oil.ry, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // 기포
  g.fillStyle = 'rgba(255, 240, 200, 0.75)';
  const n = Math.round(10 * bubbles);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39 + time * (0.6 + (i % 3) * 0.3);
    const rr = ((i * 0.37) % 1) * 0.85;
    const bx = oil.cx + Math.cos(a) * oil.rx * rr;
    const by = oil.cy + Math.sin(a) * oil.ry * rr;
    const bs = (1.5 + ((time * 3 + i) % 1) * 3) * (w / 300);
    g.beginPath();
    g.arc(bx, by, bs, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  return oil;
}

// ---------- 튀김옷 입은 치킨볼 ----------

const COOK_STOPS = [
  [0, [246, 230, 186]], // 반죽
  [0.45, [236, 184, 92]],
  [0.6, [226, 150, 42]], // 황금
  [0.75, [170, 92, 30]],
  [1, [42, 24, 12]], // 탐
];

export function cookColor(cook, shade = 0) {
  const c = Math.max(0, Math.min(1, cook));
  let i = 0;
  while (i < COOK_STOPS.length - 2 && c > COOK_STOPS[i + 1][0]) i++;
  const [t0, a] = COOK_STOPS[i];
  const [t1, b] = COOK_STOPS[i + 1];
  const t = (c - t0) / (t1 - t0);
  const rgb = a.map((v, k) => Math.round((v + (b[k] - v) * t) * (1 + shade)));
  return `rgb(${rgb.map((v) => Math.max(0, Math.min(255, v))).join(',')})`;
}

// base: 때린 생닭 그림(캔버스), coating: 0~1 튀김옷 두께, cook: 0~1 익은 정도
export function drawCoatedBall(g, x, y, r, { base = null, coating = 0.5, cook = 0, sx = 1, sy = 1, rot = 0, seed = 7, outline = true } = {}) {
  const img = cook > 0.5 && cook < 0.75 ? asset('chicken-ball') : null;
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(sx, sy);
  if (img) {
    g.drawImage(img, -r * 1.1, -r * 1.1, r * 2.2, r * 2.2);
    g.restore();
    return;
  }
  const rnd = seeded(seed);
  const bumps = Array.from({ length: 5 }, () => [1 + Math.floor(rnd() * 6), rnd() * Math.PI * 2, rnd()]);
  const lump = 0.03 + coating * 0.07;
  const shape = new Path2D();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    let k = 1;
    for (const [f, ph, amp] of bumps) k += Math.sin(a * f + ph) * amp * lump * 0.5;
    const px = Math.cos(a) * r * k;
    const py = Math.sin(a) * r * k;
    i ? shape.lineTo(px, py) : shape.moveTo(px, py);
  }
  shape.closePath();
  g.save();
  g.clip(shape);
  if (base) g.drawImage(base, -r, -r, r * 2, r * 2);
  // 튀김옷
  g.globalAlpha = Math.min(1, 0.55 + coating * 0.45 + cook * 0.3);
  const grad = g.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  grad.addColorStop(0, cookColor(cook, 0.12));
  grad.addColorStop(1, cookColor(cook, -0.18));
  g.fillStyle = grad;
  g.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  g.globalAlpha = 1;
  // 바삭한 알갱이
  const crumbs = Math.round(18 + coating * 50);
  for (let i = 0; i < crumbs; i++) {
    const a = rnd() * Math.PI * 2;
    const d = Math.sqrt(rnd()) * r;
    g.fillStyle = rnd() < 0.5 ? cookColor(cook + 0.08, -0.1) : cookColor(Math.max(0, cook - 0.1), 0.15);
    g.beginPath();
    g.arc(Math.cos(a) * d, Math.sin(a) * d, r * (0.025 + rnd() * 0.04), 0, Math.PI * 2);
    g.fill();
  }
  // 윤기
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.beginPath();
  g.ellipse(-r * 0.35, -r * 0.42, r * 0.32, r * 0.16, -0.5, 0, Math.PI * 2);
  g.fill();
  g.restore();
  if (outline) {
    g.lineWidth = Math.max(2.5, r * 0.06);
    g.strokeStyle = C.ink;
    g.stroke(shape);
  }
  g.restore();
}

// ---------- 마스코트 (캔버스용 이미지) ----------

const mascotCache = new Map();

export function mascotImage(pose = 'normal') {
  const fromFile = asset(pose === 'sleeping' ? 'mascot-sleep' : pose === 'throw' ? 'mascot-throw' : 'mascot');
  if (fromFile) return fromFile;
  if (mascotCache.has(pose)) return mascotCache.get(pose);
  // SVG 안의 CSS 변수(var(--ink) 등)를 실제 색으로 바꿔서 이미지로 만든다
  const style = getComputedStyle(document.documentElement);
  const svg = mascotSVG({ sleeping: pose === 'sleeping' })
    .replace(/var\((--[\w-]+)\)/g, (_, name) => style.getPropertyValue(name).trim() || '#000')
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" ');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  mascotCache.set(pose, img);
  return img;
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// 캔버스 위 안내 글자
export function label(g, text, x, y, { size = 20, color = C.ink, align = 'center', stroke = true } = {}) {
  g.font = `${size}px Jua, sans-serif`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  if (stroke) {
    g.lineWidth = 5;
    g.lineJoin = 'round';
    g.strokeStyle = C.cream;
    g.strokeText(text, x, y);
  }
  g.fillStyle = color;
  g.fillText(text, x, y);
}
