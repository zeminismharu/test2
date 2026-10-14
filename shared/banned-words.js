// 금지어 목록 — 아직 정하지 않음 (기획서 8번). 비어 있으면 아무것도 막지 않는다.
// 브라우저(설문 화면)와 Pages Function(/api/photo)이 같은 목록을 쓴다.
export const BANNED_WORDS = [];

// 띄어쓰기·대소문자를 무시하고 포함 여부만 본다.
export function hasBannedWord(text) {
  const normalized = String(text).toLowerCase().replace(/\s+/g, '');
  return BANNED_WORDS.some((word) => normalized.includes(word));
}
