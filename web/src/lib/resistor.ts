// 저항 색띠 읽기·쓰기 (애플 앱 Resistor.swift와 같은 방법 — PROTOCOL.md 11장)
// 1) 사진 위 두 점(저항 몸통 왼쪽 끝 → 오른쪽 끝)을 잇는 선을 따라 색을 뽑고
// 2) 몸통 색과 다른 구간을 띠로 나눈 뒤 3) 띠마다 가장 가까운 색 후보를 정하고
// 4) 방향·띠 수·실제 파는 저항값(E 계열)을 함께 따져 가장 그럴듯한 읽기를 고름.

export type BandColor =
  | 'black' | 'brown' | 'red' | 'orange' | 'yellow' | 'green'
  | 'blue' | 'violet' | 'grey' | 'white' | 'gold' | 'silver';

export const BAND_COLORS: BandColor[] = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white', 'gold', 'silver'];

/** 숫자(0~9), 곱수 지수, 허용 오차(%) */
export const BAND: Record<BandColor, { digit?: number; exp: number; tol?: number; hex: string; ko: string }> = {
  black: { digit: 0, exp: 0, hex: '#1c1c1c', ko: '검정' },
  brown: { digit: 1, exp: 1, tol: 1, hex: '#7b4a26', ko: '갈색' },
  red: { digit: 2, exp: 2, tol: 2, hex: '#d0262b', ko: '빨강' },
  orange: { digit: 3, exp: 3, hex: '#f07a1a', ko: '주황' },
  yellow: { digit: 4, exp: 4, hex: '#f2cf1d', ko: '노랑' },
  green: { digit: 5, exp: 5, tol: 0.5, hex: '#2e9a45', ko: '초록' },
  blue: { digit: 6, exp: 6, tol: 0.25, hex: '#2f5fd0', ko: '파랑' },
  violet: { digit: 7, exp: 7, tol: 0.1, hex: '#8a4fc0', ko: '보라' },
  grey: { digit: 8, exp: 8, tol: 0.05, hex: '#8d8d8d', ko: '회색' },
  white: { digit: 9, exp: 9, hex: '#f4f4f0', ko: '흰색' },
  gold: { exp: -1, tol: 5, hex: '#c9a648', ko: '금색' },
  silver: { exp: -2, tol: 10, hex: '#c0c0c8', ko: '은색' },
};

// 사진 속 저항 띠의 대표 색 (조명이 섞인 실제 사진 기준으로 잡은 값, sRGB)
const REF: Record<BandColor, [number, number, number][]> = {
  black: [[30, 30, 30], [50, 45, 42]],
  brown: [[110, 60, 35], [125, 75, 45], [90, 55, 40]],
  red: [[200, 40, 40], [170, 30, 35]],
  orange: [[235, 120, 30], [220, 100, 35]],
  yellow: [[235, 205, 40], [220, 190, 60]],
  green: [[40, 150, 70], [50, 120, 60]],
  blue: [[40, 90, 200], [50, 70, 150]],
  violet: [[135, 80, 185], [110, 60, 140]],
  grey: [[130, 130, 130], [110, 110, 115]],
  white: [[240, 240, 235], [225, 225, 220]],
  gold: [[190, 160, 75], [170, 140, 70], [205, 175, 95]],
  silver: [[190, 190, 195], [170, 172, 178]],
};

export const E12 = [10, 12, 15, 18, 22, 27, 33, 39, 47, 56, 68, 82];
export const E24 = [10, 11, 12, 13, 15, 16, 18, 20, 22, 24, 27, 30, 33, 36, 39, 43, 47, 51, 56, 62, 68, 75, 82, 91];
const E96 = [100, 102, 105, 107, 110, 113, 115, 118, 121, 124, 127, 130, 133, 137, 140, 143, 147, 150, 154, 158, 162, 165, 169, 174, 178, 182, 187, 191, 196, 200, 205, 210, 215, 221, 226, 232, 237, 243, 249, 255, 261, 267, 274, 280, 287, 294, 301, 309, 316, 324, 332, 340, 348, 357, 365, 374, 383, 392, 402, 412, 422, 432, 442, 453, 464, 475, 487, 499, 511, 523, 536, 549, 562, 576, 590, 604, 619, 634, 649, 665, 681, 698, 715, 732, 750, 768, 787, 806, 825, 845, 866, 887, 909, 931, 953, 976];

// ---------- 색 공간 ----------
function srgbToLinear(c: number) { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }
export function toLab([r, g, b]: [number, number, number]): [number, number, number] {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (v: number) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function dE(a: [number, number, number], b: [number, number, number]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
const REF_LAB = Object.fromEntries(BAND_COLORS.map((c) => [c, REF[c].map(toLab)])) as Record<BandColor, [number, number, number][]>;

/** 한 색에 대한 띠 색 후보 (가까운 순) — 밝기 차이를 덜 치도록 L에 0.6배 */
export function rankColor(rgb: [number, number, number]): { color: BandColor; d: number }[] {
  const lab = toLab(rgb);
  const w = (p: [number, number, number]): [number, number, number] => [p[0] * 0.6, p[1], p[2]];
  return BAND_COLORS
    .map((c) => ({ color: c, d: Math.min(...REF_LAB[c].map((r) => dE(w(lab), w(r)))) }))
    .sort((a, b) => a.d - b.d);
}

// ---------- 값 ↔ 색띠 ----------
export interface Reading { bands: BandColor[]; ohms: number; tol: number; valid: boolean }

/** 색띠(3·4·5·6개) → 값. 첫 띠가 금·은·검정이거나 숫자 자리에 금·은이 있으면 valid=false */
export function decode(bands: BandColor[]): Reading {
  const n = bands.length;
  const digitsN = n >= 5 ? 3 : 2;
  const digits = bands.slice(0, digitsN);
  const mult = bands[digitsN];
  const tolBand = n >= 4 ? bands[digitsN + 1] : undefined;
  let valid = n >= 3 && n <= 6 && digits.every((b) => BAND[b].digit !== undefined) && BAND[digits[0]].digit !== 0 && !!mult;
  const num = digits.reduce((v, b) => v * 10 + (BAND[b].digit ?? 0), 0);
  const exp = mult ? BAND[mult].exp : 0;
  if (mult && (mult === 'grey' || mult === 'white')) valid = false;   // 곱수로는 거의 안 씀
  const tol = tolBand ? BAND[tolBand].tol ?? NaN : 20;
  if (tolBand && BAND[tolBand].tol === undefined) valid = false;
  const ohms = round(num * 10 ** exp);
  return { bands, ohms, tol, valid };
}

/** 값(Ω) → 색띠. 유효숫자가 2자리면 4띠, 3자리면 5띠 */
export function encode(ohms: number, tol = 5, five = false): BandColor[] | null {
  if (!(ohms > 0) || !isFinite(ohms)) return null;
  const sig = five ? 3 : 2;
  const e = Math.floor(Math.log10(ohms)) - (sig - 1);
  const mant = Math.round(ohms / 10 ** e);
  let exp = e, m = mant;
  if (m >= 10 ** sig) { m = Math.round(m / 10); exp += 1; }
  if (exp < -2 || exp > 9) return null;
  const digits = String(m).padStart(sig, '0').split('').map((d) => BAND_COLORS[Number(d)]);
  const mult = BAND_COLORS.find((c) => BAND[c].exp === exp && (exp >= 0 ? BAND[c].digit !== undefined : true))!;
  const tolC = BAND_COLORS.find((c) => BAND[c].tol === tol) ?? 'gold';
  return [...digits, mult, tolC];
}

function round(v: number) { return Number(v.toPrecision(6)); }

/** 2Ω·10kΩ처럼 읽기 쉬운 글 */
export function formatOhms(ohms: number): string {
  if (!isFinite(ohms)) return '—';
  const f = (v: number) => String(Number(v.toPrecision(3)));
  if (ohms >= 1e6) return `${f(ohms / 1e6)} MΩ`;
  if (ohms >= 1e3) return `${f(ohms / 1e3)} kΩ`;
  return `${f(ohms)} Ω`;
}

/** 실제 파는 저항값인지 (2자리 → E24, 3자리 → E96) */
export function isStandard(ohms: number, five: boolean): boolean {
  if (!(ohms > 0)) return false;
  const sig = five ? 3 : 2;
  const m = Math.round(ohms / 10 ** (Math.floor(Math.log10(ohms)) - (sig - 1)));
  return five ? E96.includes(m) || E24.includes(Math.round(m / 10)) && m % 10 === 0 : E24.includes(m);
}

/** 가장 가까운 E 계열 값 (series 위쪽 값이 필요하면 up=true) */
export function nearestE(ohms: number, series = E12, up = false): number {
  if (!(ohms > 0)) return NaN;
  const dec = 10 ** Math.floor(Math.log10(ohms));
  const cands: number[] = [];
  for (const k of [dec / 10, dec, dec * 10]) for (const s of series) cands.push(round(s * k / 10));
  const pool = up ? cands.filter((c) => c >= ohms * 0.9999) : cands;
  return pool.reduce((best, c) => (Math.abs(Math.log(c / ohms)) < Math.abs(Math.log(best / ohms)) ? c : best), pool[0]);
}

// ---------- 사진 분석 ----------
export interface Pixels { width: number; height: number; data: Uint8ClampedArray | Uint8Array | number[] }
export interface Pt { x: number; y: number }
export interface BandFound { start: number; end: number; rgb: [number, number, number]; ranked: { color: BandColor; d: number }[] }
export interface Analysis { reading: Reading | null; alternatives: Reading[]; bands: BandFound[]; body: [number, number, number]; samples: [number, number, number][] }

/** a→b 선을 따라 n개 점의 색 (선에 수직으로 ±half 픽셀 평균) */
export function sampleLine(img: Pixels, a: Pt, b: Pt, n = 240, half = 3): [number, number, number][] {
  const out: [number, number, number][] = [];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const cx = a.x + (b.x - a.x) * t, cy = a.y + (b.y - a.y) * t;
    let r = 0, g = 0, bl = 0, k = 0;
    for (let o = -half; o <= half; o++) {
      const x = Math.round(cx + nx * o), y = Math.round(cy + ny * o);
      if (x < 0 || y < 0 || x >= img.width || y >= img.height) continue;
      const p = (y * img.width + x) * 4;
      r += img.data[p]; g += img.data[p + 1]; bl += img.data[p + 2]; k++;
    }
    out.push(k ? [r / k, g / k, bl / k] : [0, 0, 0]);
  }
  return out;
}

function median3(list: [number, number, number][]): [number, number, number] {
  const m = (i: number) => { const v = list.map((c) => c[i]).sort((x, y) => x - y); return v[Math.floor(v.length / 2)] ?? 0; };
  return [m(0), m(1), m(2)];
}

/** 선을 따라 뽑은 색 → 띠 구간 */
export function findBands(samples: [number, number, number][]): { body: [number, number, number]; bands: BandFound[] } {
  const n = samples.length;
  const trim = Math.max(1, Math.round(n * 0.03));
  const inner = samples.slice(trim, n - trim);
  const labs = inner.map(toLab);
  // 몸통 색: 서로 가장 많이 닮은 색 무리의 가운데 (띠보다 몸통이 길다는 가정)
  let bestI = 0, bestCount = -1;
  for (let i = 0; i < labs.length; i += 2) {
    let c = 0;
    for (let j = 0; j < labs.length; j++) if (dE(labs[i], labs[j]) < 12) c++;
    if (c > bestCount) { bestCount = c; bestI = i; }
  }
  const bodyLab = labs[bestI];
  const bodyRgb = median3(inner.filter((_, j) => dE(labs[j], bodyLab) < 12));
  const body = toLab(bodyRgb);
  // 몸통과 다른 점 표시 (밝기만 조금 다른 그림자는 덜 치도록)
  const diff = labs.map((l) => Math.hypot((l[0] - body[0]) * 0.7, l[1] - body[1], l[2] - body[2]));
  const thr = Math.max(14, percentile(diff, 0.5) * 1.8);
  const on = diff.map((d) => d > thr);
  // 1~2점 빈틈은 메우고, 너무 짧은 구간은 버림
  for (let i = 1; i < on.length - 1; i++) if (!on[i] && on[i - 1] && (on[i + 1] || on[i + 2])) on[i] = true;
  const minLen = Math.max(2, Math.round(inner.length * 0.015));
  // 몸통 범위: 몸통 색이 처음·마지막으로 보이는 곳 (그 바깥의 배경·다리는 띠가 아님)
  const isBody = diff.map((d) => d < thr * 0.8);
  const bodyFirst = isBody.indexOf(true), bodyLast = isBody.lastIndexOf(true);
  const bands: BandFound[] = [];
  let s = -1;
  for (let i = 0; i <= on.length; i++) {
    if (i < on.length && on[i]) { if (s < 0) s = i; continue; }
    if (s >= 0) {
      const inside = s > bodyFirst && i - 1 < bodyLast;
      const run = inner.slice(s, i);
      const runLab = toLab(median3(run));
      // 빛 반사: 몸통보다 훨씬 밝고 색이 거의 없는 줄은 띠가 아님
      const glare = runLab[0] > Math.max(88, body[0] + 12) && Math.hypot(runLab[1], runLab[2]) < 10;
      if (i - s >= minLen && inside && !glare) {
        const core = inner.slice(s + Math.floor((i - s) * 0.2), i - Math.floor((i - s) * 0.2));
        const rgb = median3(core.length ? core : inner.slice(s, i));
        bands.push({ start: (s + trim) / n, end: (i + trim) / n, rgb, ranked: rankColor(rgb) });
      }
      s = -1;
    }
  }
  return { body: bodyRgb, bands };
}

function percentile(v: number[], p: number) { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length * p)] ?? 0; }

/** 띠 후보 → 가장 그럴듯한 읽기 (방향·띠 수·표준값을 함께 따짐) */
export function chooseReading(bands: BandFound[]): { best: Reading | null; alternatives: Reading[] } {
  if (bands.length < 3) return { best: null, alternatives: [] };
  // 띠가 7개 이상이면 몸통과 가장 덜 다른(짧은) 것부터 버려 6개 이하로
  let list = [...bands];
  while (list.length > 6) { const i = list.reduce((m, b, k, a) => ((b.end - b.start) < (a[m].end - a[m].start) ? k : m), 0); list.splice(i, 1); }
  const scored: { r: Reading; s: number }[] = [];
  for (const rev of [false, true]) {
    const seq = rev ? [...list].reverse() : list;
    const gaps = seq.slice(1).map((b, i) => (rev ? seq[i].start - b.end : b.start - seq[i].end));
    const k = seq.length;
    // 각 띠는 상위 3개 색 후보까지 (조합이 너무 많아지지 않게 앞 2자리는 3개, 나머지 2개)
    const opts = seq.map((b, i) => b.ranked.slice(0, i < 2 || i === k - 1 ? 3 : 2));
    const combos: { c: BandColor[]; d: number }[] = [];
    const walk = (i: number, acc: BandColor[], d: number) => {
      if (i === k) { combos.push({ c: acc, d }); return; }
      for (const o of opts[i]) walk(i + 1, [...acc, o.color], d + o.d);
    };
    walk(0, [], 0);
    for (const { c, d } of combos) {
      const r = decode(c);
      if (!r.valid) continue;
      const five = k >= 5;
      let s = d / k;
      if (!isStandard(r.ohms, five)) s += 12;
      // 오차 띠(마지막)는 금·은·갈색이 흔함, 앞에 두는 경우는 드묾
      const last = c[k - 1];
      if (k >= 4 && !['gold', 'silver', 'brown', 'red', 'green'].includes(last)) s += 6;
      // 오차 띠 앞의 간격이 다른 간격보다 넓으면 그 방향일 가능성이 큼
      if (k >= 4 && gaps.length) {
        const lastGap = gaps[gaps.length - 1], firstGap = gaps[0];
        if (lastGap > firstGap * 1.3) s -= 3; else if (firstGap > lastGap * 1.3) s += 3;
      }
      if (r.ohms < 0.1 || r.ohms > 1e8) s += 20;
      scored.push({ r, s });
    }
  }
  scored.sort((a, b) => a.s - b.s);
  const seen = new Set<string>();
  const uniq = scored.filter((x) => { const key = `${x.r.ohms}|${x.r.tol}`; if (seen.has(key)) return false; seen.add(key); return true; });
  return { best: uniq[0]?.r ?? null, alternatives: uniq.slice(1, 4).map((x) => x.r) };
}

/** 사진 + 두 점 → 읽기 결과 */
export function analyze(img: Pixels, a: Pt, b: Pt): Analysis {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const half = Math.max(1, Math.round(len * 0.012));
  const samples = sampleLine(img, a, b, Math.max(120, Math.min(400, Math.round(len))), half);
  const { body, bands } = findBands(samples);
  const { best, alternatives } = chooseReading(bands);
  return { reading: best, alternatives, bands, body, samples };
}

/** 두 점을 주지 않았을 때: 사진 가운데 가로줄에서 저항 몸통 끝을 추정 */
export function guessEnds(img: Pixels): [Pt, Pt] {
  const y = Math.round(img.height / 2);
  return [{ x: img.width * 0.12, y }, { x: img.width * 0.88, y }];
}
