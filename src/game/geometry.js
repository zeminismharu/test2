// 다각형 도구 — 뿌시기에서 껍질을 조각으로 나눌 때 쓴다.
// 다각형은 [[x, y], ...] 배열.

// a*x + b*y <= c 쪽만 남긴다 (Sutherland–Hodgman, 볼록한 자르기 영역이면 어떤 다각형에도 동작)
export function clipHalfPlane(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - c;
    const dq = a * q[0] + b * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

// 다각형을 씨앗 점들의 보로노이 영역으로 나눈다. 반환: [{ poly, seed }]
export function voronoiSplit(poly, seeds) {
  const cells = [];
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    let cell = poly;
    for (let j = 0; j < seeds.length && cell.length >= 3; j++) {
      if (i === j) continue;
      const o = seeds[j];
      // s 보다 o 에 가까운 쪽을 잘라낸다: (o - s)·x <= (|o|² - |s|²) / 2
      cell = clipHalfPlane(cell, o[0] - s[0], o[1] - s[1], (o[0] ** 2 + o[1] ** 2 - s[0] ** 2 - s[1] ** 2) / 2);
    }
    if (cell.length >= 3 && Math.abs(area(cell)) > 1e-6) cells.push({ poly: cell, seed: s });
  }
  return cells;
}

export function area(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    s += p[0] * q[1] - q[0] * p[1];
  }
  return s / 2;
}

export function centroid(poly) {
  let x = 0;
  let y = 0;
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const cross = p[0] * q[1] - q[0] * p[1];
    a += cross;
    x += (p[0] + q[0]) * cross;
    y += (p[1] + q[1]) * cross;
  }
  if (Math.abs(a) < 1e-9) return poly[0].slice();
  return [x / (3 * a), y / (3 * a)];
}

export function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function bounds(poly) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

export function circlePoly(cx, cy, r, n = 64) {
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}

// 다각형 경로를 만든다 (scale 배 하고 ox, oy 만큼 옮겨서)
export function tracePoly(ctx, poly, scale = 1, ox = 0, oy = 0) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * scale, oy + y * scale) : ctx.moveTo(ox + x * scale, oy + y * scale)));
  ctx.closePath();
}
