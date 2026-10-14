// 그림 에셋(public/assets/)이 생기기 전까지 쓰는 임시 도형.
// 나중에 <img src="/assets/logo.png"> 등으로 바꾸면 된다.

// 동글동글한 닭, 반쯤 감긴 눈, 무심한 미소
export function mascotSVG({ sleeping = false } = {}) {
  const eyes = sleeping
    ? `<path d="M70 92 q10 6 20 0 M110 92 q10 6 20 0" />`
    : `<path d="M68 90 h24 M108 90 h24" />
       <path d="M72 90 q8 7 16 0 M112 90 q8 7 16 0" fill="var(--ink)" />`;
  const zzz = sleeping
    ? `<text x="150" y="40" class="zzz">z</text><text x="165" y="22" class="zzz small">z</text>`
    : '';
  return `
  <svg class="ph-mascot${sleeping ? ' is-sleeping' : ''}" viewBox="0 0 200 200" aria-hidden="true">
    <path d="M86 38 q6 -22 16 -6 q8 -18 16 2 q10 -10 8 10" fill="var(--red-soft)" stroke="var(--ink)" stroke-width="5" stroke-linejoin="round"/>
    <circle cx="100" cy="112" r="72" fill="var(--cream-light)" stroke="var(--ink)" stroke-width="6"/>
    <ellipse cx="40" cy="122" rx="14" ry="22" fill="var(--cream-dark)" stroke="var(--ink)" stroke-width="5"/>
    <ellipse cx="160" cy="122" rx="14" ry="22" fill="var(--cream-dark)" stroke="var(--ink)" stroke-width="5"/>
    <g stroke="var(--ink)" stroke-width="5" stroke-linecap="round" fill="none">${eyes}</g>
    <path d="M92 104 l8 10 l8 -10 z" fill="var(--amber)" stroke="var(--ink)" stroke-width="4" stroke-linejoin="round"/>
    <path d="M90 126 q10 6 20 0" fill="none" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/>
    <circle cx="62" cy="114" r="7" fill="var(--blush)"/><circle cx="138" cy="114" r="7" fill="var(--blush)"/>
    ${zzz}
  </svg>`;
}

// 동그란 생닭 덩어리. imageUrl 이 있으면 싫은 사진을 입힌다.
export function rawChickenSVG(imageUrl) {
  const id = `clip-${Math.random().toString(36).slice(2, 8)}`;
  const fill = imageUrl
    ? `<clipPath id="${id}"><circle cx="100" cy="100" r="78"/></clipPath>
       <image href="${imageUrl}" x="22" y="22" width="156" height="156" preserveAspectRatio="xMidYMid slice" clip-path="url(#${id})"/>
       <circle cx="100" cy="100" r="78" fill="var(--raw)" opacity="0.25"/>`
    : `<circle cx="100" cy="100" r="78" fill="var(--raw)"/>
       <ellipse cx="74" cy="72" rx="20" ry="12" fill="#fff" opacity="0.45"/>
       <path d="M60 120 q14 8 26 0 M112 132 q12 6 22 -2" stroke="var(--raw-dark)" stroke-width="4" fill="none" stroke-linecap="round"/>`;
  return `
  <svg class="ph-raw" viewBox="0 0 200 200" aria-hidden="true">
    ${fill}
    <circle cx="100" cy="100" r="78" fill="none" stroke="var(--ink)" stroke-width="6"/>
  </svg>`;
}

// 황금 치킨볼 (사진을 못 불러왔을 때 대신 보여줄 것)
export function chickenBallSVG() {
  return `
  <svg class="ph-ball" viewBox="0 0 200 200" aria-hidden="true">
    <circle cx="100" cy="104" r="76" fill="var(--golden)" stroke="var(--ink)" stroke-width="6"/>
    <g fill="var(--amber-dark)" opacity="0.55">
      <circle cx="70" cy="80" r="8"/><circle cx="120" cy="70" r="6"/><circle cx="140" cy="118" r="9"/>
      <circle cx="84" cy="136" r="7"/><circle cx="108" cy="108" r="5"/><circle cx="58" cy="116" r="5"/>
    </g>
    <path d="M78 22 q-8 -14 4 -20 M100 20 q-8 -14 4 -20 M122 22 q-8 -14 4 -20" stroke="var(--ink-soft)" stroke-width="4" fill="none" stroke-linecap="round"/>
  </svg>`;
}
