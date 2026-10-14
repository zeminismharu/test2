// 브라우저는 사용자가 한 번 터치하기 전에는 소리를 못 내게 막는다.
// 대기 화면의 첫 터치에서 unlockAudio() 를 부른다.
// 녹음 파일(public/sounds/)이 생기기 전까지는 WebAudio 로 만든 임시 효과음을 쓴다.

let ctx = null;

export function unlockAudio() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone(freq, start, duration, { type = 'square', volume = 0.08 } = {}) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration);
}

// 키오스크 "삐빅"
export function beep() {
  tone(1760, 0, 0.07);
  tone(2093, 0.09, 0.09);
}

// 잘못 눌렀을 때 "뿌우"
export function buzz() {
  tone(220, 0, 0.25, { type: 'sawtooth', volume: 0.06 });
}

// 결제 완료 "띠리링"
export function chime() {
  [1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.1, 0.18, { type: 'triangle', volume: 0.1 }));
}
