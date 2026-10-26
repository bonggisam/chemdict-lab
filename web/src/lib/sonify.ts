// 2.0 접근성: 값을 소리 높낮이로 (낮은 값 220 Hz ~ 높은 값 880 Hz)
let ctx: AudioContext | null = null;
let osc: OscillatorNode | null = null;
let gain: GainNode | null = null;
let timer: number | null = null;

function ensure() {
  if (!ctx) {
    ctx = new AudioContext();
    gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(ctx.destination);
    osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 440;
    osc.connect(gain);
    osc.start();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export const pitch = (v: number, lo: number, hi: number) => 220 * Math.pow(4, hi > lo ? Math.min(Math.max((v - lo) / (hi - lo), 0), 1) : 0.5);

/** 실시간: 지금 값에 맞춰 소리를 냄 */
export function liveTone(v: number, lo: number, hi: number) {
  const c = ensure();
  osc!.frequency.setTargetAtTime(pitch(v, lo, hi), c.currentTime, 0.05);
  gain!.gain.setTargetAtTime(0.15, c.currentTime, 0.05);
}

export function silence() {
  if (timer !== null) { clearInterval(timer); timer = null; }
  if (ctx && gain) gain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}

/** 지금까지의 그래프를 몇 초 동안 소리로 */
export function playSeries(values: number[], seconds = 5) {
  if (values.length < 2) return;
  const lo = Math.min(...values), hi = Math.max(...values);
  const c = ensure();
  silence();
  const steps = Math.min(values.length, 200), dt = (seconds * 1000) / steps;
  let i = 0;
  gain!.gain.setTargetAtTime(0.15, c.currentTime, 0.05);
  timer = window.setInterval(() => {
    if (i >= steps) { silence(); return; }
    const v = values[Math.floor((i / steps) * values.length)];
    osc!.frequency.setTargetAtTime(pitch(v, lo, hi), c.currentTime, 0.01);
    i++;
  }, dt);
}

/** '동작 줄이기'를 켠 사용자면 부드러운 스크롤 없이 */
export const scrollBehavior = (): ScrollBehavior =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
