// 금지어 목록 — 임시. 기획서 8번 "개발하면서 정할 것"에서 확정한다.
// 브라우저(설문 화면)와 Pages Function(/api/photo)이 같은 목록을 쓴다.
export const BANNED_WORDS = [
  '씨발', '시발', 'ㅅㅂ', '병신', 'ㅂㅅ', '좆', '개새끼', '새끼',
  '섹스', '야동', '포르노', '자살', '살인', '시체', '마약',
  'fuck', 'sex', 'porn', 'nude', 'suicide', 'kill',
];

// 띄어쓰기·대소문자를 무시하고 포함 여부만 본다.
export function hasBannedWord(text) {
  const normalized = String(text).toLowerCase().replace(/\s+/g, '');
  return BANNED_WORDS.some((word) => normalized.includes(word));
}
