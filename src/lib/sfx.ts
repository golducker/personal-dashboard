// Synthesised UI sounds (Web Audio, no files). Client only. Quiet by default, per-theme timbre.
// The AudioContext is created lazily and unlocked on the first pointerdown (iOS requires a gesture).

type SfxName = "tap" | "toggle" | "success" | "undo" | "error" | "theme" | "mascot";
type World = "light" | "dark";

const KEY = "sfx";
const MASTER_GAIN = 0.16;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled: boolean | null = null;
const listeners = new Set<() => void>();

function world(): World {
  const t = document.documentElement.dataset.theme;
  if (t === "light" || t === "dark") return t;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readEnabled(): boolean {
  if (enabled === null) {
    try {
      enabled = localStorage.getItem(KEY) !== "0";
    } catch {
      enabled = true;
    }
  }
  return enabled;
}

export const isSfxEnabled = () => (typeof window === "undefined" ? true : readEnabled());

export function subscribeSfx(l: () => void) {
  listeners.add(l);
  return () => void listeners.delete(l);
}

export function setSfxEnabled(on: boolean) {
  enabled = on;
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // storage blocked: keep the in-memory value
  }
  for (const l of listeners) l();
  if (on) play("toggle");
}

/** Create/resume the AudioContext. Call from a user gesture. */
export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = MASTER_GAIN;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  } catch {
    ctx = null;
  }
}

type Tone = {
  type: OscillatorType;
  f: number;
  to?: number;
  at?: number;
  d: number;
  g?: number;
  detune?: number;
  lp?: number;
};

function tone(c: AudioContext, out: AudioNode, o: Tone) {
  const t0 = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + o.d);
  if (o.detune) osc.detune.value = o.detune;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(o.g ?? 0.5, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.d);
  if (o.lp) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = o.lp;
    osc.connect(f);
    f.connect(g);
  } else {
    osc.connect(g);
  }
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + o.d + 0.03);
}

/** Psyduck's short "quack": square wave with a quick pitch drop. */
function quack(c: AudioContext, out: AudioNode, base: number, at = 0) {
  tone(c, out, { type: "square", f: base, to: base * 0.48, at, d: 0.11, g: 0.4, lp: 1700 });
  tone(c, out, { type: "square", f: base * 1.12, to: base * 0.5, at: at + 0.13, d: 0.12, g: 0.34, lp: 1500 });
}

const SOUNDS: Record<World, Record<SfxName, (c: AudioContext, o: AudioNode) => void>> = {
  light: {
    tap: (c, o) => tone(c, o, { type: "triangle", f: 880, to: 690, d: 0.055, g: 0.32 }),
    toggle: (c, o) => {
      tone(c, o, { type: "triangle", f: 660, d: 0.05, g: 0.3 });
      tone(c, o, { type: "triangle", f: 990, at: 0.06, d: 0.07, g: 0.3 });
    },
    success: (c, o) => {
      tone(c, o, { type: "triangle", f: 784, d: 0.12, g: 0.4 });
      tone(c, o, { type: "triangle", f: 1175, at: 0.09, d: 0.22, g: 0.42 });
    },
    undo: (c, o) => tone(c, o, { type: "triangle", f: 900, to: 380, d: 0.2, g: 0.34 }),
    error: (c, o) => {
      tone(c, o, { type: "square", f: 240, to: 200, d: 0.12, g: 0.3, lp: 900 });
      tone(c, o, { type: "square", f: 190, to: 150, at: 0.14, d: 0.18, g: 0.3, lp: 800 });
    },
    theme: (c, o) => quack(c, o, 640),
    mascot: (c, o) => quack(c, o, 760),
  },
  dark: {
    tap: (c, o) => {
      tone(c, o, { type: "sine", f: 240, to: 170, d: 0.07, g: 0.42 });
      tone(c, o, { type: "triangle", f: 480, to: 340, d: 0.05, g: 0.1, detune: 14 });
    },
    toggle: (c, o) => {
      tone(c, o, { type: "sine", f: 300, d: 0.06, g: 0.4 });
      tone(c, o, { type: "sine", f: 225, at: 0.07, d: 0.09, g: 0.4, detune: -12 });
    },
    success: (c, o) => {
      for (const d of [-9, 9]) {
        tone(c, o, { type: "triangle", f: 392, d: 0.16, g: 0.26, detune: d });
        tone(c, o, { type: "triangle", f: 587, at: 0.1, d: 0.3, g: 0.28, detune: d });
      }
    },
    undo: (c, o) => tone(c, o, { type: "sine", f: 620, to: 170, d: 0.26, g: 0.4, lp: 1200 }),
    error: (c, o) => {
      tone(c, o, { type: "sine", f: 185, d: 0.16, g: 0.5 });
      tone(c, o, { type: "sawtooth", f: 138, at: 0.15, d: 0.26, g: 0.22, lp: 420 });
    },
    theme: (c, o) => {
      for (const d of [-14, 14]) tone(c, o, { type: "sine", f: 180, to: 720, d: 0.42, g: 0.24, detune: d });
      tone(c, o, { type: "triangle", f: 1440, at: 0.3, d: 0.2, g: 0.08 });
    },
    mascot: (c, o) => {
      // a low "kekeke"
      [0, 0.1, 0.2, 0.3].forEach((at, i) =>
        tone(c, o, { type: "triangle", f: i % 2 ? 300 : 360, to: i % 2 ? 260 : 310, at, d: 0.07, g: 0.34, lp: 1100 }),
      );
    },
  },
};

function play(name: SfxName) {
  if (typeof window === "undefined" || !readEnabled()) return;
  unlockAudio();
  if (!ctx || !master || ctx.state === "closed") return;
  try {
    SOUNDS[world()][name](ctx, master);
  } catch {
    // never let audio break the UI
  }
}

export const sfx = {
  tap: () => play("tap"),
  toggle: () => play("toggle"),
  success: () => play("success"),
  undo: () => play("undo"),
  error: () => play("error"),
  theme: () => play("theme"),
  mascot: () => play("mascot"),
};
