let ctx: AudioContext | null = null;
let master: GainNode | null = null;

export function unlockAudio() {
  if (typeof window === "undefined") return;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  if (!ctx) {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(Math.max(gain, 0.0002), t + 0.02);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(amp);
  amp.connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

export function sfxTakeoff() {
  tone(392, 0.16, "sine", 0.12);
  tone(523, 0.22, "triangle", 0.08, 0.08);
}

export function sfxHeart(combo: number) {
  const base = 494 * Math.pow(1.05, Math.min(combo, 7));
  tone(base, 0.16, "sine", 0.16);
  tone(base * 1.5, 0.2, "triangle", 0.07, 0.035);
}

export function sfxHit() {
  tone(130, 0.2, "sawtooth", 0.09);
  tone(78, 0.32, "triangle", 0.12, 0.02);
}

export function sfxFull() {
  tone(523, 0.16, "sine", 0.12);
  tone(659, 0.2, "sine", 0.1, 0.07);
  tone(784, 0.32, "triangle", 0.08, 0.14);
}

export function sfxOver() {
  tone(311, 0.28, "sine", 0.1);
  tone(196, 0.42, "triangle", 0.09, 0.1);
}
