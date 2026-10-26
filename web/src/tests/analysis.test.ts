import { describe, expect, test } from 'vitest';
import { isStable, linearFit, stats, type Pt } from '../lib/analysis';
import { area, autoFit, fitModel } from '../lib/fit';

const line: Pt[] = Array.from({ length: 20 }, (_, i) => [i, 2 * i + 1]);

describe('그래프 해석', () => {
  test('통계: 평균·최소·최대·변화량', () => {
    const s = stats(line)!;
    expect(s.n).toBe(20);
    expect(s.mean).toBeCloseTo(20);
    expect(s.min).toBe(1);
    expect(s.dy).toBe(38);
  });
  test('직선 맞춤: y = 2x + 1', () => {
    const f = linearFit(line)!;
    expect(f.m).toBeCloseTo(2);
    expect(f.b).toBeCloseTo(1);
    expect(f.r2).toBeCloseTo(1);
  });
  test('지수 맞춤과 자동 함수 찾기', () => {
    const pts: Pt[] = Array.from({ length: 30 }, (_, i) => [i, 5 * Math.exp(-0.1 * i)]);
    const r = fitModel('exp', pts)!;
    expect(r.r2).toBeGreaterThan(0.999);
    expect(r.f(10)).toBeCloseTo(5 * Math.exp(-1), 2);
    expect(autoFit(pts)[0].r2).toBeGreaterThan(0.999);
  });
  test('넓이(적분): y = 2x + 1, 0~19', () => {
    expect(area(line)).toBeCloseTo(19 * 19 + 19);
  });
  test('안정 판정', () => {
    expect(isStable([7.01, 7.02, 7.0, 7.01], 0.05)).toBe(true);
    expect(isStable([7.0, 7.3, 7.6], 0.05)).toBe(false);
  });
});
