import { t, tk } from './i18n';
// 표의 계산 열 (Vernier '계산 열'처럼 자주 쓰는 것만)
export type CalcId = 'none' | 'delta' | 'rate' | 'inv' | 'ln' | 'log' | 'sq' | 'kelvin';

export const CALCS: { id: CalcId; name: string; title: (y: string) => string; tempOnly?: boolean }[] = [
  { id: 'none', name: tk('없음'), title: () => '' },
  { id: 'delta', name: tk('처음 값과의 차 (y − y₀)'), title: (y) => `Δ${y}` },
  { id: 'rate', name: tk('변화율 (Δy/Δx)'), title: (y) => t('{y} 변화율', { y }) },
  { id: 'inv', name: tk('역수 (1/y)'), title: (y) => `1/${y}` },
  { id: 'ln', name: tk('자연로그 (ln y)'), title: (y) => `ln ${y}` },
  { id: 'log', name: tk('상용로그 (log y)'), title: (y) => `log ${y}` },
  { id: 'sq', name: tk('제곱 (y²)'), title: (y) => `${y}²` },
  { id: 'kelvin', name: tk('절대온도 (K = °C + 273.15)'), title: () => t('절대온도(K)'), tempOnly: true },
];

/** xs, ys 같은 길이 (값이 없으면 NaN) → 계산 열 */
export function calcColumn(id: CalcId, xs: number[], ys: number[]): number[] {
  const y0 = ys.find((v) => isFinite(v)) ?? NaN;
  return ys.map((y, i) => {
    if (!isFinite(y)) return NaN;
    switch (id) {
      case 'delta': return y - y0;
      case 'rate': {
        // 앞뒤 값이 있는 이웃으로 기울기
        let a = i - 1, b = i + 1;
        while (a >= 0 && !isFinite(ys[a])) a--;
        while (b < ys.length && !isFinite(ys[b])) b++;
        const ia = a >= 0 ? a : i, ib = b < ys.length ? b : i;
        return xs[ib] !== xs[ia] ? (ys[ib] - ys[ia]) / (xs[ib] - xs[ia]) : NaN;
      }
      case 'inv': return y !== 0 ? 1 / y : NaN;
      case 'ln': return y > 0 ? Math.log(y) : NaN;
      case 'log': return y > 0 ? Math.log10(y) : NaN;
      case 'sq': return y * y;
      case 'kelvin': return y + 273.15;
      default: return NaN;
    }
  });
}

export const round = (v: number, d = 4) => (isFinite(v) ? Number(v.toPrecision(Math.max(d, 1))) : NaN);
