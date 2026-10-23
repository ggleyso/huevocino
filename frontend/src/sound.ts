// Синтез звуков через WebAudio — без единого ассета.
let on = true;
try {
  on = localStorage.getItem('vzlet-sound') !== '0';
} catch {
  on = true;
}

let ctx: AudioContext | null = null;
const subs = new Set<() => void>();

function ac(): AudioContext | null {
  if (!on) return null;
  if (!ctx) {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function soundOn(): boolean {
  return on;
}

export function toggleSound(): boolean {
  on = !on;
  try {
    localStorage.setItem('vzlet-sound', on ? '1' : '0');
  } catch {
    /* ignore */
  }
  if (on) ac();
  else void ctx?.suspend();
  subs.forEach(f => f());
  return on;
}

export function subSound(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

interface Tone {
  f: number;
  to?: number;
  d: number;
  type?: OscillatorType;
  v?: number;
  at?: number;
}

function tone({ f, to, d, type = 'sine', v = 0.12, at = 0 }: Tone) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + at;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t0);
  if (to && to !== f) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + d);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(v, t0 + Math.min(0.015, d / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  osc.connect(g);
  g.connect(a.destination);
  osc.start(t0);
  osc.stop(t0 + d + 0.03);
}

function noise(d: number, v = 0.1, at = 0, freq = 1600, q = 0.8) {
  const a = ac();
  if (!a) return;
  const t0 = a.currentTime + at;
  const len = Math.max(1, Math.floor(a.sampleRate * d));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  const filt = a.createBiquadFilter();
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(freq, t0);
  filt.Q.value = q;
  const g = a.createGain();
  g.gain.setValueAtTime(v, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  src.connect(filt);
  filt.connect(g);
  g.connect(a.destination);
  src.start(t0);
  src.stop(t0 + d + 0.02);
}

export const sfx = {
  click: () => tone({ f: 660, d: 0.05, type: 'square', v: 0.05 }),

  spin: () => {
    tone({ f: 200, to: 420, d: 0.3, type: 'sawtooth', v: 0.05 });
    noise(0.26, 0.05, 0, 900);
  },

  reelStop: () => {
    tone({ f: 520, d: 0.05, type: 'square', v: 0.06 });
    noise(0.07, 0.07, 0, 2400);
  },

  lose: () => tone({ f: 260, to: 170, d: 0.2, type: 'triangle', v: 0.07 }),

  win: (big: boolean) => {
    if (big) {
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone({ f, d: 0.16, type: 'triangle', v: 0.12, at: i * 0.09 }),
      );
      noise(0.4, 0.04, 0.45, 5200);
    } else {
      tone({ f: 784, d: 0.1, type: 'triangle', v: 0.1, at: 0 });
      tone({ f: 1047, d: 0.14, type: 'triangle', v: 0.1, at: 0.09 });
    }
  },

  takeoff: () => tone({ f: 280, to: 720, d: 0.5, type: 'sawtooth', v: 0.05 }),

  tick: () => tone({ f: 1400, d: 0.04, type: 'square', v: 0.045 }),

  boom: () => {
    noise(0.55, 0.22, 0, 700, 1.2);
    tone({ f: 380, to: 55, d: 0.5, type: 'sawtooth', v: 0.14 });
  },

  cashout: () => {
    [1047, 1319, 1568, 2093].forEach((f, i) => tone({ f, d: 0.1, type: 'square', v: 0.07, at: i * 0.07 }));
  },

  deal: () => noise(0.1, 0.09, 0, 3200, 1),

  flip: () => {
    noise(0.06, 0.08, 0, 4200, 1);
    tone({ f: 900, d: 0.04, type: 'triangle', v: 0.05 });
  },

  winCards: () => [523, 659, 784].forEach((f, i) => tone({ f, d: 0.14, type: 'triangle', v: 0.1, at: i * 0.1 })),

  loseCards: () => [330, 262].forEach((f, i) => tone({ f, d: 0.2, type: 'triangle', v: 0.09, at: i * 0.16 })),

  push: () => tone({ f: 440, d: 0.16, type: 'triangle', v: 0.08 }),
};
