// 센서 점검 (protocol/sensor_checks.json): 사양·기준 상황·테스트 절차, 측정값과 기준값의 오차 계산
import raw from '../../../protocol/sensor_checks.json';

export interface RefPoint { situation: string; expect: number; tol: number; note?: string }
export interface RefRange { situation: string; min: number; max: number; note?: string }
export type RefSituation = RefPoint | RefRange;
export interface SensorCheck {
  name: string; range: string; accuracy: string; resolution: string; response: string;
  refs: RefSituation[]; test: string[]; fail: string[]; errorNote: string;
}
const data = raw as { bySensor: Record<string, SensorCheck>; aliases: Record<string, string> };

export const isPoint = (r: RefSituation): r is RefPoint => 'expect' in r;

/** 센서 type → 점검 키 (변형 코드는 aliases로 가족 코드에 묶음; analysis_methods와 같은 규칙) */
export function checkKey(type: string): string | null {
  const base = type.replace(/_.*$/, '');
  for (const k of [type, base, data.aliases[type] ?? '', data.aliases[base] ?? '']) if (k && k in data.bySensor) return k;
  return null;
}
export function checkFor(type: string): SensorCheck | null {
  const k = checkKey(type);
  return k ? data.bySensor[k] : null;
}

export interface Stats { n: number; mean: number; sd: number; min: number; max: number }
export function stats(vals: number[]): Stats | null {
  if (!vals.length) return null;
  const n = vals.length, mean = vals.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, min: Math.min(...vals), max: Math.max(...vals) };
}

export interface Verdict {
  pass: boolean;
  err: number;          // 측정 − 기준 (범위형은 가장 가까운 경계와의 차이, 안이면 0)
  rel?: number;         // 상대 오차 % (기준이 0이 아닐 때)
  target: string;       // 기준 표시 ("0 ± 1" 또는 "18~27")
}
/** 측정 평균을 기준 상황과 비교 */
export function judge(mean: number, r: RefSituation, decimals = 2): Verdict {
  const f = (x: number) => Number(x.toFixed(decimals)).toString();
  if (isPoint(r)) {
    const err = mean - r.expect;
    return { pass: Math.abs(err) <= r.tol, err, rel: r.expect !== 0 ? (err / r.expect) * 100 : undefined, target: `${f(r.expect)} ± ${f(r.tol)}` };
  }
  const err = mean < r.min ? mean - r.min : mean > r.max ? mean - r.max : 0;
  return { pass: err === 0, err, target: `${f(r.min)} ~ ${f(r.max)}` };
}
