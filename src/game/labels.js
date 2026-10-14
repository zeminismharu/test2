// 주문서·결과 카드에 같이 쓰는 이름들
export function coatingLabel(c) {
  if (c < 0.15) return '얇음';
  if (c < 0.45) return '보통';
  if (c < 0.8) return '두꺼움';
  return '엄청 두꺼움';
}

export const FRY_LABEL = { raw: '덜 익음', golden: '황금', burnt: '탄' };
