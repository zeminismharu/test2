// 브라우저는 사용자가 한 번 터치하기 전에는 소리를 못 내게 막는다.
// 대기 화면의 첫 터치에서 unlockAudio() 를 부른다.
//
// 녹음 파일을 쓰려면 public/sounds/ 에 파일을 넣고 public/sounds/sounds.json 에 이름을 적는다.
//   예) { "punch": "punch.mp3", "crunch2": "crunch-mid.m4a" }
// 적힌 소리는 녹음 파일로, 안 적힌 소리는 아래의 임시 효과음(WebAudio)으로 난다.

let ctx = null;
let master = null;
let noiseBuffer = null;
const recorded = new Map(); // 이름 → AudioBuffer

export const SOUND_NAMES = [
  'beep', 'buzz', 'chime', // 키오스크
  'punch', // 주먹 "퍽"
  'rustle', // 봉지 흔드는 소리
  'whoosh', 'plop', 'sizzle', // 던지기 / 풍덩 / 튀기는 소리(반복)
  'splat', // 화면에 "철퍽"
  'squish', 'crunch1', 'crunch2', 'crunch3', 'crumble', 'crack', // 물컹 / 바삭 약·중·강 / 와작 / 딱
];

export function unlockAudio() {
  if (!ctx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    noiseBuffer = makeNoise(2);
    loadRecorded();
  }
  if (ctx.state === 'suspended') ctx.resume();
}

async function loadRecorded() {
  try {
    const res = await fetch('/sounds/sounds.json', { cache: 'no-cache' });
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return;
    const manifest = await res.json();
    await Promise.all(Object.entries(manifest).map(async ([name, file]) => {
      try {
        const data = await (await fetch(`/sounds/${file}`)).arrayBuffer();
        recorded.set(name, await ctx.decodeAudioData(data));
      } catch {
        // 파일이 깨졌으면 임시 효과음으로 둔다
      }
    }));
  } catch {
    // sounds.json 이 없으면 전부 임시 효과음
  }
}

function playRecorded(name, { volume = 1, rate = 1 } = {}) {
  const buffer = recorded.get(name);
  if (!ctx || !buffer) return false;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  gain.gain.value = volume;
  src.connect(gain).connect(master);
  src.start();
  return true;
}

// ---------- 임시 효과음 재료 ----------

function makeNoise(seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function envGain(t, volume, attack, duration) {
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  return gain;
}

function tone(freq, start, duration, { type = 'square', volume = 0.08, endFreq = null, attack = 0.005 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
  osc.connect(envGain(t, volume, attack, duration)).connect(master);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function noise(start, duration, { filter = 'bandpass', freq = 1000, endFreq = null, q = 1, volume = 0.3, attack = 0.003 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + start;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const biquad = ctx.createBiquadFilter();
  biquad.type = filter;
  biquad.frequency.setValueAtTime(freq, t);
  if (endFreq) biquad.frequency.exponentialRampToValueAtTime(endFreq, t + duration);
  biquad.Q.value = q;
  src.connect(biquad).connect(envGain(t, volume, attack, duration)).connect(master);
  src.start(t, Math.random() * 1.5);
  src.stop(t + duration + 0.02);
}

// ---------- 소리 ----------

const synth = {
  beep() { tone(1760, 0, 0.07); tone(2093, 0.09, 0.09); },
  buzz() { tone(220, 0, 0.25, { type: 'sawtooth', volume: 0.06 }); },
  chime() { [1319, 1568, 2093].forEach((f, i) => tone(f, i * 0.1, 0.18, { type: 'triangle', volume: 0.1 })); },
  punch() {
    tone(160, 0, 0.16, { type: 'sine', volume: 0.6, endFreq: 45 });
    noise(0, 0.09, { filter: 'lowpass', freq: 1400, volume: 0.5 });
  },
  rustle() { noise(0, 0.09, { freq: 2600 + Math.random() * 1500, q: 0.8, volume: 0.22 }); },
  whoosh() { noise(0, 0.28, { freq: 500, endFreq: 2400, q: 1.5, volume: 0.25, attack: 0.08 }); },
  plop() {
    tone(420, 0, 0.22, { type: 'sine', volume: 0.45, endFreq: 110 });
    noise(0.03, 0.4, { filter: 'highpass', freq: 3000, volume: 0.18, attack: 0.02 });
  },
  splat() {
    tone(120, 0, 0.25, { type: 'sine', volume: 0.7, endFreq: 40 });
    noise(0, 0.32, { filter: 'lowpass', freq: 2200, endFreq: 400, volume: 0.7 });
    noise(0.04, 0.5, { filter: 'highpass', freq: 3500, volume: 0.12, attack: 0.05 });
  },
  squish() {
    tone(230, 0, 0.28, { type: 'sine', volume: 0.35, endFreq: 70, attack: 0.03 });
    noise(0, 0.25, { filter: 'lowpass', freq: 600, endFreq: 200, q: 4, volume: 0.35, attack: 0.03 });
  },
  crunch(level) {
    const count = 3 + level * 3;
    for (let i = 0; i < count; i++) {
      noise(i * (0.018 + Math.random() * 0.03), 0.025 + Math.random() * 0.03, {
        filter: 'highpass', freq: 1800 + Math.random() * 3000, volume: 0.25 + level * 0.1,
      });
    }
  },
  crumble() {
    tone(90, 0, 0.12, { type: 'sine', volume: 0.4, endFreq: 50 });
    for (let i = 0; i < 12; i++) {
      noise(i * (0.02 + Math.random() * 0.03), 0.04, { freq: 700 + Math.random() * 1200, q: 2, volume: 0.45 });
    }
  },
  crack() {
    noise(0, 0.03, { filter: 'highpass', freq: 2500, volume: 0.45 });
    tone(900, 0, 0.04, { type: 'triangle', volume: 0.1, endFreq: 500 });
  },
};

function play(name, fallback, opts) {
  if (!ctx) return;
  if (!playRecorded(name, opts)) fallback();
}

export const sfx = {
  beep: () => play('beep', synth.beep),
  buzz: () => play('buzz', synth.buzz),
  chime: () => play('chime', synth.chime),
  punch: () => play('punch', synth.punch, { rate: 0.9 + Math.random() * 0.2 }),
  rustle: () => play('rustle', synth.rustle, { rate: 0.85 + Math.random() * 0.3 }),
  whoosh: () => play('whoosh', synth.whoosh),
  plop: () => play('plop', synth.plop),
  splat: () => play('splat', synth.splat),
  squish: () => play('squish', synth.squish, { rate: 0.9 + Math.random() * 0.2 }),
  crunch: (level = 2) => play(`crunch${level}`, () => synth.crunch(level), { rate: 0.9 + Math.random() * 0.2 }),
  crumble: () => play('crumble', synth.crumble, { rate: 0.9 + Math.random() * 0.2 }),
  crack: () => play('crack', synth.crack, { rate: 0.9 + Math.random() * 0.3 }),
};

// 예전 이름 그대로 쓰는 곳을 위해
export const beep = sfx.beep;
export const buzz = sfx.buzz;
export const chime = sfx.chime;

// 튀기는 소리 — 계속 반복. 반환값의 stop() 으로 끈다.
export function startSizzle() {
  if (!ctx) return { setLevel() {}, stop() {} };
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  let src;
  const buffer = recorded.get('sizzle');
  if (buffer) {
    src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.connect(gain);
  } else {
    src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3500;
    // 지글지글 끊기는 느낌: 빠르게 떨리는 볼륨
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 13;
    lfoGain.gain.value = 0.4;
    const crackle = ctx.createGain();
    crackle.gain.value = 0.6;
    lfo.connect(lfoGain).connect(crackle.gain);
    lfo.start();
    src.connect(hp).connect(crackle).connect(gain);
  }
  src.start();
  return {
    setLevel(level) {
      gain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.25, ctx.currentTime, 0.1);
    },
    stop() {
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.08);
      setTimeout(() => { try { src.stop(); } catch {} gain.disconnect(); }, 400);
    },
  };
}
