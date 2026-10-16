// 데이터 해석 도구: 통계, 직선 맞춤, 당량점, 평탄 구간, 안정 판정

export type Pt = [number, number]; // [x, y]

export interface Stats {
  n: number; min: number; max: number; mean: number; sd: number;
  first: number; last: number; dy: number; dx: number;
}

export function stats(pts: Pt[]): Stats | null {
  if (!pts.length) return null;
  const ys = pts.map((p) => p[1]);
  const n = ys.length;
  const mean = ys.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(ys.reduce((a, y) => a + (y - mean) ** 2, 0) / (n - 1)) : 0;
  return {
    n, mean, sd,
    min: Math.min(...ys), max: Math.max(...ys),
    first: ys[0], last: ys[n - 1],
    dy: ys[n - 1] - ys[0], dx: pts[n - 1][0] - pts[0][0],
  };
}

export interface Fit { m: number; b: number; r2: number }

/** 최소제곱 직선 y = m x + b */
export function linearFit(pts: Pt[]): Fit | null {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y; }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-12) return null;
  const m = (n * sxy - sx * sy) / den;
  const b = (sy - m * sx) / n;
  const ssTot = syy - (sy * sy) / n;
  const ssRes = pts.reduce((a, [x, y]) => a + (y - (m * x + b)) ** 2, 0);
  const r2 = ssTot > 1e-12 ? 1 - ssRes / ssTot : 1;
  return { m, b, r2 };
}

export interface Equivalence {
  x: number;       // 당량점 부피
  y: number;       // 당량점 pH
  slope: number;   // 최대 기울기 (dpH/dV)
  halfX: number;   // 반당량점 부피
  halfY: number | null; // 반당량점 pH (약산이면 ≈ pKa)
}

/** 적정 곡선에서 기울기가 가장 큰 곳 = 당량점 (x 순서로 정렬된 점) */
export function findEquivalence(input: Pt[]): Equivalence | null {
  const pts = [...input].sort((a, b) => a[0] - b[0]);
  if (pts.length < 4) return null;
  // 1차 미분 (구간 중점에서의 기울기)
  const mids: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const dx = pts[i + 1][0] - pts[i][0];
    if (dx <= 0) continue;
    mids.push([(pts[i][0] + pts[i + 1][0]) / 2, Math.abs((pts[i + 1][1] - pts[i][1]) / dx)]);
  }
  if (!mids.length) return null;
  // 뚜렷한 급변이 없으면 당량점으로 보지 않음 (pH 변화 2 미만, 또는 최대 기울기가 평균 기울기의 3배 미만)
  const ys = pts.map((q) => q[1]);
  const meanSlope = mids.reduce((a, m) => a + m[1], 0) / mids.length;
  const maxSlope = Math.max(...mids.map((m) => m[1]));
  if (Math.max(...ys) - Math.min(...ys) < 2 || maxSlope < meanSlope * 3) return null;
  let k = 0;
  mids.forEach((m, i) => { if (m[1] > mids[k][1]) k = i; });
  let x = mids[k][0];
  const bestSlope = mids[k][1];
  // 최댓값 양옆 기울기로 포물선 꼭짓점 보정 (간격이 같을 때 더 정확)
  if (k > 0 && k < mids.length - 1) {
    const [x0, y0] = mids[k - 1], [x1, y1] = mids[k], [x2, y2] = mids[k + 1];
    const denom = (x0 - x1) * (x0 - x2) * (x1 - x2);
    if (Math.abs(denom) > 1e-12) {
      const A = (x2 * (y1 - y0) + x1 * (y0 - y2) + x0 * (y2 - y1)) / denom;
      const B = (x2 * x2 * (y0 - y1) + x1 * x1 * (y2 - y0) + x0 * x0 * (y1 - y2)) / denom;
      if (A < 0) {
        const xv = -B / (2 * A);
        if (xv >= x0 && xv <= x2) x = xv;
      }
    }
  }
  const y = interpolate(pts, x) ?? 0;
  const halfX = x / 2;
  return { x, y, slope: bestSlope, halfX, halfY: interpolate(pts, halfX) };
}

export function interpolate(pts: Pt[], x: number): number | null {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    if ((x0 <= x && x <= x1) || (x1 <= x && x <= x0)) {
      if (x1 === x0) return y0;
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return null;
}

export interface Plateau { x0: number; x1: number; mean: number; sd: number }

/**
 * 값이 거의 변하지 않는 가장 긴 구간 (어는점, 끓는점 등).
 * band: 이 범위 안에서 흔들리면 '평탄'으로 봄
 */
export function findPlateau(pts: Pt[], band: number, minSpan: number): Plateau | null {
  if (pts.length < 5) return null;
  let best: Plateau | null = null;
  let i = 0;
  while (i < pts.length) {
    let j = i, lo = pts[i][1], hi = pts[i][1];
    while (j + 1 < pts.length) {
      const y = pts[j + 1][1];
      const nlo = Math.min(lo, y), nhi = Math.max(hi, y);
      if (nhi - nlo > band) break;
      lo = nlo; hi = nhi; j++;
    }
    const span = pts[j][0] - pts[i][0];
    if (span >= minSpan && (!best || span > best.x1 - best.x0)) {
      const s = stats(pts.slice(i, j + 1))!;
      best = { x0: pts[i][0], x1: pts[j][0], mean: s.mean, sd: s.sd };
    }
    i = j > i ? j : i + 1;
  }
  return best;
}

/** 최근 값들이 band 안에서만 흔들리면 '안정' */
export function isStable(recent: number[], band: number): boolean {
  if (recent.length < 4) return false;
  return Math.max(...recent) - Math.min(...recent) <= band * 2;
}
