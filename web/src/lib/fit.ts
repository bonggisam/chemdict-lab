// 함수 찾기 (곡선 맞춤) · 접선 · 넓이 · 변화율 · 부드럽게
// Vernier Graphical Analysis / PASCO SPARKvue의 해석 도구를 참고해 학교 실험에 자주 쓰는 것만 골랐습니다.
import type { Pt } from './analysis';

export type ModelId = 'auto' | 'prop' | 'linear' | 'quad' | 'cubic' | 'exp' | 'approach' | 'power' | 'log' | 'inverse';

export interface ModelInfo { id: Exclude<ModelId, 'auto'>; name: string; form: string; params: string[]; use: string }

export const MODELS: ModelInfo[] = [
  { id: 'linear', name: '직선', form: 'y = m·x + b', params: ['m', 'b'], use: '일정한 속도로 변함 (반응 속도, 가열 초기)' },
  { id: 'prop', name: '비례', form: 'y = A·x', params: ['A'], use: '원점을 지나는 직선 (질량–부피, 샤를 법칙 K)' },
  { id: 'quad', name: '2차 함수', form: 'y = A·x² + B·x + C', params: ['A', 'B', 'C'], use: '휘어진 곡선 (가속, 포물선)' },
  { id: 'cubic', name: '3차 함수', form: 'y = A·x³ + B·x² + C·x + D', params: ['A', 'B', 'C', 'D'], use: 'S자 모양 일부' },
  { id: 'exp', name: '지수', form: 'y = A·e^(B·x)', params: ['A', 'B'], use: '일정 비율로 늘거나 줄어듦 (1차 반응 농도)' },
  { id: 'approach', name: '지수 접근', form: 'y = A·e^(−C·x) + B', params: ['A', 'B', 'C'], use: '어떤 값에 다가감 (냉각·가열 곡선, 뉴턴 냉각)' },
  { id: 'power', name: '거듭제곱', form: 'y = A·x^B', params: ['A', 'B'], use: '두 양의 거듭제곱 관계' },
  { id: 'log', name: '로그', form: 'y = A + B·ln x', params: ['A', 'B'], use: '빨리 늘다 천천히 늘어남 (희석–pH)' },
  { id: 'inverse', name: '반비례', form: 'y = A / x', params: ['A'], use: '곱이 일정 (보일 법칙 P–V)' },
];

export interface FitResult {
  model: Exclude<ModelId, 'auto'>;
  params: number[];
  f: (x: number) => number;
  r2: number;
  rmse: number;
  n: number;
}

// ---- 선형대수: 최소제곱 (작은 정규방정식, 부분 피벗 가우스 소거)
function solve(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-14) return null;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  return M.map((r, i) => r[n] / r[i]);
}

/** y ≈ Σ p_j · g_j(x) */
function lsq(pts: Pt[], basis: ((x: number) => number)[]): number[] | null {
  const k = basis.length;
  const A = Array.from({ length: k }, () => new Array(k).fill(0));
  const b = new Array(k).fill(0);
  for (const [x, y] of pts) {
    const g = basis.map((fn) => fn(x));
    for (let i = 0; i < k; i++) { b[i] += g[i] * y; for (let j = 0; j < k; j++) A[i][j] += g[i] * g[j]; }
  }
  return solve(A, b);
}

function score(pts: Pt[], f: (x: number) => number) {
  const n = pts.length;
  const mean = pts.reduce((a, p) => a + p[1], 0) / n;
  let ssr = 0, sst = 0;
  for (const [x, y] of pts) { const e = y - f(x); ssr += e * e; sst += (y - mean) ** 2; }
  return { r2: sst > 1e-15 ? 1 - ssr / sst : (ssr < 1e-15 ? 1 : 0), rmse: Math.sqrt(ssr / n) };
}

/** 다항식: x를 가운데로 옮기고 크기를 맞춘 뒤 맞춤 → 원래 x의 계수로 되돌림 (시간이 클 때도 정확) */
function polyFit(pts: Pt[], deg: number): number[] | null {
  const xs = pts.map((p) => p[0]);
  const m = xs.reduce((a, x) => a + x, 0) / xs.length;
  const s = Math.max(...xs.map((x) => Math.abs(x - m))) || 1;
  const c = lsq(pts, Array.from({ length: deg + 1 }, (_, j) => (x: number) => ((x - m) / s) ** j));
  if (!c) return null;
  // Σ c_j ((x−m)/s)^j → Σ a_k x^k
  const a = new Array(deg + 1).fill(0);
  const binom = (n: number, k: number) => { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; };
  for (let j = 0; j <= deg; j++) for (let k = 0; k <= j; k++) a[k] += c[j] * binom(j, k) * (-m) ** (j - k) / s ** j;
  return a.reverse(); // 높은 차수부터
}

export function fitModel(model: Exclude<ModelId, 'auto'>, input: Pt[]): FitResult | null {
  const pts = input.filter(([x, y]) => isFinite(x) && isFinite(y));
  const n = pts.length;
  let params: number[] | null = null;
  let f: ((x: number) => number) | null = null;

  switch (model) {
    case 'linear': case 'quad': case 'cubic': {
      const deg = model === 'linear' ? 1 : model === 'quad' ? 2 : 3;
      if (n < deg + 1) return null;
      params = polyFit(pts, deg);
      if (params) { const p = params; f = (x) => p.reduce((a, c) => a * x + c, 0); }
      break;
    }
    case 'prop': {
      if (n < 1) return null;
      const r = lsq(pts, [(x) => x]);
      if (r) { params = r; f = (x) => r[0] * x; }
      break;
    }
    case 'inverse': {
      const q = pts.filter(([x]) => x !== 0);
      if (q.length < 2) return null;
      const r = lsq(q, [(x) => 1 / x]);
      if (r) { params = r; f = (x) => r[0] / x; }
      break;
    }
    case 'log': {
      const q = pts.filter(([x]) => x > 0);
      if (q.length < 2) return null;
      const r = lsq(q, [() => 1, (x) => Math.log(x)]);
      if (r) { params = r; f = (x) => r[0] + r[1] * Math.log(x); }
      break;
    }
    case 'exp': case 'power': {
      const q = pts.filter(([x, y]) => y > 0 && (model === 'exp' || x > 0));
      if (q.length < 2) return null;
      const lin = q.map(([x, y]) => [model === 'exp' ? x : Math.log(x), Math.log(y)] as Pt);
      const r = lsq(lin, [() => 1, (x) => x]);
      if (r) {
        const A = Math.exp(r[0]), B = r[1];
        params = [A, B];
        f = model === 'exp' ? (x) => A * Math.exp(B * x) : (x) => A * x ** B;
      }
      break;
    }
    case 'approach': {
      if (n < 4) return null;
      const x0 = Math.min(...pts.map((p) => p[0])), span = Math.max(...pts.map((p) => p[0])) - x0 || 1;
      // C를 넓게 훑고(로그 간격) 가장 좋은 곳 둘레를 황금분할로 좁힘. C마다 A, B는 직선 맞춤으로 바로 구함
      const at = (C: number) => {
        const r = lsq(pts, [(x) => Math.exp(-C * (x - x0)), () => 1]);
        if (!r) return null;
        const g = (x: number) => r[0] * Math.exp(-C * (x - x0)) + r[1];
        return { r, g, s: score(pts, g).rmse };
      };
      let bestC = 0, best = Infinity;
      for (let i = 0; i <= 80; i++) {
        const C = (0.01 * 10 ** (i / 20)) / span; // 0.01/span ~ 100/span
        const a = at(C);
        if (a && a.s < best) { best = a.s; bestC = C; }
      }
      if (!bestC) return null;
      let lo = bestC / 1.15, hi = bestC * 1.15;
      for (let i = 0; i < 40; i++) {
        const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618;
        const s1 = at(m1)?.s ?? Infinity, s2 = at(m2)?.s ?? Infinity;
        if (s1 < s2) hi = m2; else lo = m1;
      }
      const C = (lo + hi) / 2, a = at(C);
      if (!a) return null;
      // x0 기준으로 구한 A를 원래 식 A·e^(−C·x)로 바꿈
      const A = a.r[0] * Math.exp(C * x0), B = a.r[1];
      params = [A, B, C];
      f = (x) => A * Math.exp(-C * x) + B;
      break;
    }
  }
  if (!params || !f || params.some((v) => !isFinite(v))) return null;
  const { r2, rmse } = score(pts, f);
  return { model, params, f, r2, rmse, n };
}

/** 자동: 가장 잘 맞는 함수 (매개변수가 많은 함수는 R²가 확실히 좋아야 고름) */
export function autoFit(pts: Pt[]): FitResult[] {
  const order: Exclude<ModelId, 'auto'>[] = ['prop', 'linear', 'inverse', 'exp', 'power', 'log', 'quad', 'approach', 'cubic'];
  const all = order.map((m) => fitModel(m, pts)).filter((r): r is FitResult => !!r && r.n >= 3);
  const n = pts.length;
  const adj = (r: FitResult) => {
    const k = MODELS.find((m) => m.id === r.model)!.params.length;
    return n - k - 1 > 0 ? 1 - ((1 - r.r2) * (n - 1)) / (n - k - 1) - k * 0.002 : -Infinity;
  };
  return all.sort((a, b) => adj(b) - adj(a));
}

/** 식을 숫자와 함께 보여 주기 */
export function equation(r: FitResult, fmtN: (v: number) => string = sig): string {
  const p = r.params.map(fmtN);
  const sgn = (v: number, s: string) => (v < 0 ? ` − ${s.replace(/^-/, '')}` : ` + ${s}`);
  switch (r.model) {
    case 'linear': return `y = ${p[0]}x${sgn(r.params[1], p[1])}`;
    case 'prop': return `y = ${p[0]}x`;
    case 'quad': return `y = ${p[0]}x²${sgn(r.params[1], p[1])}x${sgn(r.params[2], p[2])}`;
    case 'cubic': return `y = ${p[0]}x³${sgn(r.params[1], p[1])}x²${sgn(r.params[2], p[2])}x${sgn(r.params[3], p[3])}`;
    case 'exp': return `y = ${p[0]}·e^(${p[1]}x)`;
    case 'approach': return `y = ${p[0]}·e^(−${p[2]}x)${sgn(r.params[1], p[1])}`;
    case 'power': return `y = ${p[0]}·x^${p[1]}`;
    case 'log': return `y = ${p[0]}${sgn(r.params[1], p[1])}·ln x`;
    case 'inverse': return `y = ${p[0]} / x`;
  }
}

/** 유효숫자 4개 */
export function sig(v: number): string {
  if (v === 0 || !isFinite(v)) return String(v);
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(3).replace(/\.?0+e/, 'e');
  return String(Number(v.toPrecision(4)));
}

// ---- 접선 · 넓이 · 변화율 · 부드럽게

/** x 근처 점 몇 개로 직선 맞춤 → 그 점에서의 기울기 */
export function tangentAt(pts: Pt[], x: number, half = 3): { x: number; y: number; slope: number } | null {
  if (pts.length < 3) return null;
  let k = 0, bd = Infinity;
  pts.forEach(([px], i) => { const d = Math.abs(px - x); if (d < bd) { bd = d; k = i; } });
  const w = pts.slice(Math.max(0, k - half), Math.min(pts.length, k + half + 1));
  const r = lsq(w.map(([px, py]) => [px - pts[k][0], py] as Pt), [() => 1, (u) => u]);
  if (!r) return null;
  return { x: pts[k][0], y: r[0], slope: r[1] };
}

/** 사다리꼴 넓이 (곡선 아래 넓이 = 적분) */
export function area(pts: Pt[]): number {
  let s = 0;
  for (let i = 1; i < pts.length; i++) s += ((pts[i][1] + pts[i - 1][1]) / 2) * (pts[i][0] - pts[i - 1][0]);
  return s;
}

/** 이동 평균 */
export function smooth(pts: Pt[], win: number): Pt[] {
  if (win <= 1) return pts;
  const h = Math.floor(win / 2);
  return pts.map(([x], i) => {
    const w = pts.slice(Math.max(0, i - h), Math.min(pts.length, i + h + 1));
    return [x, w.reduce((a, p) => a + p[1], 0) / w.length] as Pt;
  });
}

/** 변화율 dy/dx (양옆 점 차이) */
export function derivative(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    if (b[0] !== a[0]) out.push([pts[i][0], (b[1] - a[1]) / (b[0] - a[0])]);
  }
  return out;
}
