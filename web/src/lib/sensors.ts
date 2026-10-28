import catalog from '../../../protocol/sensors.json';
import type { SensorInfo } from './protocol';

export interface CalSpec { kind: 'none' | 'one-point' | 'two-point' | 'scale' | 'tare-scale'; refs?: number[]; hint?: string }
export interface SensorType {
  type: string;
  name: string;
  unit: string;
  decimals: number;
  slope?: number;
  offset?: number;
  min?: number;
  max?: number;
  cal: CalSpec;
  stableBand: number;
  requiresCal?: boolean;
  note: string;
  port?: 'pulse';   // D3 펄스 입력에만 (Hz × slope + offset)
  full?: boolean;   // 전체 버전 펌웨어(UNO R4·Mega)에서만 바르게 변환
  src?: string;
  app?: AppConv;    // 보드는 전압을 보내고 앱이 바꾸는 센서 (측정 프로그램 업데이트 없이 모든 보드)
}

/** 앱에서 바꾸기: divider = 잴 저항이 5V 쪽, 기준 저항 r이 GND 쪽 → R = r × (Vref − V) / V */
export interface AppConv { kind: 'divider'; r: number }

export const analogTypes: SensorType[] = catalog.analog as SensorType[];
export const digitalTypes: SensorType[] = catalog.digital as SensorType[];
const all = [...analogTypes, ...digitalTypes];

export function typeInfo(type: string | undefined): SensorType | undefined {
  return all.find((t) => t.type === type);
}

/** 보드가 보낸 센서 정보 + 카탈로그 → 화면에 쓸 정보 */
export interface ResolvedSensor extends SensorInfo {
  type: string;
  spec?: SensorType;
  displayName: string;
  displayUnit: string;
  decimals: number;
}

export function resolveSensor(s: SensorInfo & { type?: string }): ResolvedSensor {
  const type = s.type ?? s.id;
  const spec = typeInfo(type);
  const port = s.src && /^(A\d|D3)$/.test(s.src) ? s.src : '';
  const dup = s.id.includes('_') ? ` (${port})` : '';
  return {
    ...s,
    type,
    spec,
    displayName: (spec?.name ?? s.name ?? s.id) + dup,
    displayUnit: spec?.unit ?? s.unit ?? '',
    decimals: spec?.decimals ?? 2,
  };
}

export function fmtValue(v: number | undefined, decimals = 2) {
  if (v === undefined || !isFinite(v)) return '—';
  return v.toFixed(decimals);
}

/** 보드 기준 전압: 3.3 V 보드는 3.3, 나머지 5 (보드는 이 값으로 전압을 계산해 보냄) */
export function boardVref(logic: string | undefined): number {
  return logic && logic.startsWith('3.3') ? 3.3 : 5;
}

/** 앱 변환 하나: 범위를 벗어나면(끊김·바로 닿음) undefined */
export function appConvValue(conv: AppConv, v: number, vref: number): number | undefined {
  if (conv.kind === 'divider') {
    if (!(v > 0.02 && v < vref - 0.02)) return undefined;
    return Math.round(conv.r * (vref - v) / v);
  }
  return v;
}

/** 데이터 줄 v(센서 id → 값)에서 앱 변환 센서만 바꿈 (그 밖의 값은 그대로) */
export function applyAppConv(v: Record<string, number>, sensors: { id: string; type?: string }[] | undefined, vref: number): Record<string, number> {
  if (!sensors) return v;
  let out: Record<string, number> | null = null;
  for (const s of sensors) {
    const conv = typeInfo(s.type ?? s.id)?.app;
    if (!conv || typeof v[s.id] !== 'number') continue;
    out ??= { ...v };
    const r = appConvValue(conv, v[s.id], vref);
    if (r === undefined) delete out[s.id]; else out[s.id] = r;
  }
  return out ?? v;
}
