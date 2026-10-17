import { t } from './i18n';
import type { Pt } from './analysis';

export interface Row { t: number; v: Record<string, number> }
export interface Marker { t: number; note: string }
export interface EventPoint { x: number; v: Record<string, number>; t: number }

export interface Run {
  id: string;
  name: string;
  mode: 'time' | 'event';
  colorIndex: number;
  visible: boolean;
  rows: Row[];             // 자동 기록 (이벤트 모드에서도 안정 판정용으로 모음)
  events: EventPoint[];    // 이벤트 모드에서 '값 기록'한 점
  markers: Marker[];
  prediction: Pt[];        // 첫 번째 그래프 기준 예측선
  excluded?: number[];
  startedAt?: string;      // 측정을 처음 시작한 시각 (ISO)     // 해석에서 뺀 행 (시간 모드: rows 번호, 값 입력 모드: events 번호)
}

let seq = 0;
export function newRun(mode: 'time' | 'event', index: number): Run {
  seq += 1;
  return {
    id: `run-${Date.now()}-${seq}`,
    name: t('측정 {n}', { n: index + 1 }),
    mode,
    colorIndex: index % 5,
    visible: true,
    rows: [],
    events: [],
    markers: [],
    prediction: [],
  };
}

/**
 * 그래프용 점: 시간 모드는 (t, 값), 이벤트 모드는 (입력값, 값).
 * xId를 주면 가로축을 그 센서 값으로 (예: 온도–압력). 제외한 행은 빼고 줌 (keepExcluded면 포함)
 */
export function seriesPoints(run: Run, sensorId: string, opt: { xId?: string; keepExcluded?: boolean } = {}): Pt[] {
  const ex = opt.keepExcluded ? null : new Set(run.excluded ?? []);
  if (run.mode === 'event') {
    return run.events
      .filter((e, i) => typeof e.v[sensorId] === 'number' && !ex?.has(i))
      .map((e) => [e.x, e.v[sensorId]] as Pt)
      .sort((a, b) => a[0] - b[0]);
  }
  const { xId } = opt;
  const out: Pt[] = [];
  run.rows.forEach((r, i) => {
    if (typeof r.v[sensorId] !== 'number' || ex?.has(i)) return;
    if (xId) { if (typeof r.v[xId] === 'number') out.push([r.v[xId], r.v[sensorId]]); }
    else out.push([r.t, r.v[sensorId]]);
  });
  if (xId) out.sort((a, b) => a[0] - b[0]);
  return out;
}

/** 최근 windowSec초 동안의 값 (안정 판정, 이벤트 기록용) */
export function recentValues(run: Run, sensorId: string, windowSec: number): number[] {
  if (!run.rows.length) return [];
  const tEnd = run.rows[run.rows.length - 1].t;
  const out: number[] = [];
  for (let i = run.rows.length - 1; i >= 0; i--) {
    const r = run.rows[i];
    if (tEnd - r.t > windowSec) break;
    if (typeof r.v[sensorId] === 'number') out.push(r.v[sensorId]);
  }
  return out.reverse();
}

export interface Column { id: string; title: string; decimals: number }

function esc(s: string) {
  return /[",\n\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 표시(marker)를 가장 가까운 측정 행 번호에 붙임 */
function markerNotes(run: Run): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of run.markers) {
    let lo = 0, hi = run.rows.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (run.rows[mid].t < m.t) lo = mid; else hi = mid; }
    const idx = hi >= 0 && Math.abs(run.rows[hi].t - m.t) < Math.abs(run.rows[lo].t - m.t) ? hi : lo;
    out.set(idx, out.has(idx) ? `${out.get(idx)} / ${m.note}` : m.note);
  }
  return out;
}

/** 한 측정을 표로 (Numbers·엑셀 붙여넣기용) */
export function runTable(run: Run, cols: Column[], xTitle: string): string[][] {
  const head = [run.mode === 'event' ? xTitle : t('시간(s)'), ...cols.map((c) => c.title)];
  const body: string[][] = [];
  if (run.mode === 'event') {
    [...run.events].sort((a, b) => a.x - b.x).forEach((e) => {
      body.push([String(e.x), ...cols.map((c) => (e.v[c.id] !== undefined ? e.v[c.id].toFixed(c.decimals) : ''))]);
    });
  } else {
    const notes = markerNotes(run);
    run.rows.forEach((r, i) => {
      const row = [r.t.toFixed(2), ...cols.map((c) => (r.v[c.id] !== undefined ? r.v[c.id].toFixed(c.decimals) : ''))];
      if (run.markers.length) row.push(notes.get(i) ?? '');
      body.push(row);
    });
    if (run.markers.length) head.push(t('표시'));
  }
  return [head, ...body];
}

/** 여러 측정을 한 CSV로: 맨 앞에 측정 이름 열 (엑셀·Numbers에서 한글이 깨지지 않게 BOM 포함) */
export function runsCSV(runs: Run[], cols: Column[], xTitle: string): string {
  const lines: string[] = [];
  runs.forEach((run, k) => {
    const table = runTable(run, cols, xTitle);
    table.forEach((row, i) => {
      if (i === 0 && k > 0) return; // 머리글은 한 번만
      lines.push([i === 0 ? t('측정') : run.name, ...row].map(esc).join(','));
    });
  });
  return '﻿' + lines.join('\n');
}

export function toTSV(table: string[][]): string {
  return table.map((r) => r.join('\t')).join('\n');
}

export async function saveFile(content: Blob, filename: string) {
  const file = new File([content], filename, { type: content.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] }) && /iPad|iPhone|Android/.test(navigator.userAgent)) {
    try { await navigator.share({ files: [file], title: filename }); return; } catch { /* 취소 시 다운로드 */ }
  }
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
