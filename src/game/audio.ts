let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let sfxBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let padNodes: { stop: () => void } | null = null;
let wantSfx = 0.7;
let wantMusic = 0.3;
const lastAt: Record<string, number> = {};

function ensure(): void {
  if (ctx || typeof window === "undefined") return;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  ctx = new Ctx({ latencyHint: "interactive" });
  master = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(ctx.destination);
  master.gain.value = 1;
}

function applyMix(): void {
  if (!ctx || !sfxBus || !musicBus) return;
  const now = ctx.currentTime;
  sfxBus.gain.setTargetAtTime(wantSfx * wantSfx, now, 0.03);
  musicBus.gain.setTargetAtTime(wantMusic * wantMusic * 0.45, now, 0.05);
  if (wantMusic > 0.02) startPad();
  else stopPad();
}

export function setMix(sfx: number, music: number): void {
  wantSfx = Math.min(1, Math.max(0, sfx));
  wantMusic = Math.min(1, Math.max(0, music));
  applyMix();
}

export function unlockAudio(): void {
  if (typeof window === "undefined") return;
  ensure();
  if (ctx && ctx.state === "suspended") void ctx.resume();
  applyMix();
}

export function resumeAudio(): void {
  if (ctx && ctx.state === "suspended") void ctx.resume();
}

function startPad(): void {
  if (padNodes || !ctx || !musicBus) return;
  const gain = ctx.createGain();
  gain.gain.value = 0.09;
  gain.connect(musicBus);
  const a = ctx.createOscillator();
  a.type = "sine";
  a.frequency.value = 98;
  const b = ctx.createOscillator();
  b.type = "triangle";
  b.frequency.value = 146.8;
  a.connect(gain);
  b.connect(gain);
  a.start();
  b.start();
  padNodes = {
    stop: () => {
      const t = ctx!.currentTime;
      gain.gain.setTargetAtTime(0.0001, t, 0.05);
      a.stop(t + 0.2);
      b.stop(t + 0.2);
      padNodes = null;
    },
  };
}

function stopPad(): void {
  padNodes?.stop();
}

function allow(name: string, gapMs: number): boolean {
  const now = performance.now();
  if (now - (lastAt[name] ?? 0) < gapMs) return false;
  lastAt[name] = now;
  return true;
}

function tone(freq: number, dur: number, type: OscillatorType, peak: number, bus: GainNode): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(bus);
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export function play(name: "ui" | "hit" | "coin" | "summon" | "breach" | "clear" | "legendary"): void {
  if (!ctx || !sfxBus || wantSfx <= 0.01) return;
  if (ctx.state === "suspended") return;
  const bus = sfxBus;
  if (name === "ui") {
    if (!allow("ui", 40)) return;
    tone(620, 0.05, "sine", 0.08, bus);
    return;
  }
  if (name === "hit") {
    if (!allow("hit", 80)) return;
    tone(180 + Math.random() * 140, 0.06, "square", 0.05, bus);
    return;
  }
  if (name === "coin") {
    if (!allow("coin", 70)) return;
    tone(880, 0.07, "sine", 0.07, bus);
    tone(1320, 0.09, "sine", 0.05, bus);
    return;
  }
  if (name === "summon") {
    tone(392, 0.12, "triangle", 0.08, bus);
    window.setTimeout(() => tone(523, 0.12, "triangle", 0.08, bus), 90);
    window.setTimeout(() => tone(659, 0.16, "triangle", 0.08, bus), 180);
    return;
  }
  if (name === "legendary") {
    tone(523, 0.16, "sawtooth", 0.05, bus);
    window.setTimeout(() => tone(659, 0.16, "triangle", 0.08, bus), 110);
    window.setTimeout(() => tone(784, 0.22, "triangle", 0.09, bus), 220);
    window.setTimeout(() => tone(1046, 0.28, "sine", 0.08, bus), 340);
    return;
  }
  if (name === "breach") {
    if (!allow("breach", 200)) return;
    tone(70, 0.32, "sawtooth", 0.09, bus);
    return;
  }
  if (name === "clear") {
    tone(523, 0.12, "triangle", 0.07, bus);
    window.setTimeout(() => tone(659, 0.12, "triangle", 0.07, bus), 100);
    window.setTimeout(() => tone(784, 0.2, "triangle", 0.08, bus), 200);
  }
}
