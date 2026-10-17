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
  src?: string;
}

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
  const port = s.src && /^A\d$/.test(s.src) ? s.src : '';
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
