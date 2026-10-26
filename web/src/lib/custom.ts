// 2.0: 교사가 만든 실험 — 이 기기에 저장하고, 링크·QR로 학생에게 나눔 (서버 없음)
// 애플 앱 CustomExperiments.swift와 같은 짧은 형식을 공유 주소(#x=…)의 x 칸에 담는다.
import type { Experiment } from './protocol';
import { typeInfo } from './sensors';
import { t } from './i18n';

export interface CustomExp {
  t: string;                    // 제목
  s: string[];                  // 센서 종류
  iv: number;                   // 측정 간격 ms
  st: string[];                 // 실험 순서
  m?: 'time' | 'event';
  ev?: { l: string; u: string; s: number; d: number };   // 값 입력 모드: 이름·단위·시작·간격
}

export const CUSTOM_COURSE = '내가 만든 실험';
const KEY = 'chemdict.custom';

/** 같은 내용이면 같은 id (다시 받아도 겹치지 않게) */
export function customId(x: CustomExp): string {
  // 애플 앱과 같은 글자열로 만들어 같은 id가 나오게 (JSON 순서에 기대지 않음)
  const ev = x.m === 'event' && x.ev ? `${x.ev.l}|${x.ev.u}|${x.ev.s}|${x.ev.d}` : '';
  const s = [x.t, x.s.join(','), String(x.iv), x.st.join('\n'), x.m ?? 'time', ev].join('\u0001');
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return `my-${(h >>> 0).toString(36)}`;
}

export function toExperiment(x: CustomExp): Experiment {
  const mode = x.m ?? 'time';
  return {
    id: customId(x), order: 50, title: x.t, subject: t(CUSTOM_COURSE), standards: [], sensors: x.s, mode,
    event: mode === 'event' && x.ev ? { label: x.ev.l, unit: x.ev.u, start: x.ev.s, step: x.ev.d, scale: 'linear' } : undefined,
    intervalMs: x.iv,
    x: mode === 'event' && x.ev ? { label: x.ev.l, unit: x.ev.u } : { label: t('시간'), unit: 's' },
    y: x.s.map((ty) => { const s = typeInfo(ty); return { sensor: ty, label: s?.name ?? ty, unit: s?.unit, min: s?.min, max: s?.max }; }),
    markers: { enabled: mode === 'time', label: t('관찰 기록'), prompt: t('한 일 (예: 시약 넣음)') },
    analysis: ['stats', 'fit', 'plateau'], steps: x.st, level: '공통', course: CUSTOM_COURSE,
    summary: t('선생님이 만든 실험'),
  };
}

export function loadCustom(): CustomExp[] {
  try { const a = JSON.parse(localStorage.getItem(KEY) ?? '[]'); return Array.isArray(a) ? a.filter(valid) : []; } catch { return []; }
}

export function saveCustom(list: CustomExp[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* 저장 못 해도 이번에는 씀 */ }
}

export function valid(x: unknown): x is CustomExp {
  const o = x as CustomExp;
  return !!o && typeof o.t === 'string' && o.t.trim().length > 0 && o.t.length <= 120 && Array.isArray(o.s) && o.s.length > 0 && o.s.length <= 8
    && o.s.every((s) => typeof s === 'string' && !!typeInfo(s)) && typeof o.iv === 'number' && o.iv >= 20 && o.iv <= 600000
    && Array.isArray(o.st) && o.st.length <= 30 && o.st.every((s) => typeof s === 'string' && s.length <= 300)
    && (o.m === undefined || o.m === 'time' || (o.m === 'event' && !!o.ev && typeof o.ev.l === 'string' && typeof o.ev.u === 'string'
      && Number.isFinite(o.ev.s) && Number.isFinite(o.ev.d) && o.ev.d > 0));
}
