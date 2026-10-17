// 실험 정보 (모둠·이름·날짜 등): 측정 화면에서 입력하고, 저장하는 모든 파일에 함께 남깁니다.
import type { Run } from './runs';

export interface ExpInfo {
  group: string;      // 모둠 이름 · 실험조
  members: string;    // 이름 (구성원)
  className: string;  // 학년 · 반
  date: string;       // YYYY-MM-DD (비우면 측정 시작 날짜)
  time: string;       // HH:MM (비우면 측정 시작 시각)
  place: string;      // 장소
  note: string;       // 메모 (조건, 날씨 등)
}

export const EMPTY_INFO: ExpInfo = { group: '', members: '', className: '', date: '', time: '', place: '', note: '' };

// 모둠·이름·반·장소는 다음 시간에도 그대로 (이 기기·브라우저에만 저장). 날짜·시간·메모는 매번 새로.
const KEY = 'chemdict.info';
export function loadInfo(): ExpInfo {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    return { ...EMPTY_INFO, group: v.group ?? '', members: v.members ?? '', className: v.className ?? '', place: v.place ?? '' };
  } catch { return { ...EMPTY_INFO }; }
}
export function saveInfo(i: ExpInfo) {
  try { localStorage.setItem(KEY, JSON.stringify({ group: i.group, members: i.members, className: i.className, place: i.place })); } catch { /* noop */ }
}

const z = (n: number) => String(n).padStart(2, '0');
export const fmtDate = (d: Date) => `${d.getFullYear()}.${z(d.getMonth() + 1)}.${z(d.getDate())}`;
export const fmtTime = (d: Date) => `${z(d.getHours())}:${z(d.getMinutes())}`;

/** 저장 파일에 넣을 항목 [이름, 값] (비어 있는 칸은 뺌) */
export function infoRows(i: ExpInfo, runs: Run[], station?: number): [string, string][] {
  const first = runs.map((r) => r.startedAt).filter((x): x is string => !!x).sort()[0];
  const d0 = first ? new Date(first) : undefined;
  const date = i.date ? i.date.replace(/-/g, '.') : d0 ? fmtDate(d0) : '';
  const time = i.time || (d0 ? fmtTime(d0) : '');
  const rows: [string, string][] = [
    ['모둠·실험조', i.group],
    ['이름', i.members],
    ['학년·반', i.className],
    ['날짜', date],
    ['시간', time],
    ['장소', i.place],
    ['보드 모둠 번호', station ? `ChemDict-${z(station)}` : ''],
    ['메모', i.note],
  ];
  const out = rows.filter(([, v]) => v.trim());
  // 측정별 시작 시각
  for (const r of runs) if (r.startedAt) { const d = new Date(r.startedAt); out.push([`${r.name} 시작`, `${fmtDate(d)} ${fmtTime(d)}`]); }
  out.push(['저장한 때', `${fmtDate(new Date())} ${fmtTime(new Date())}`]);
  return out;
}

export function infoSummary(i: ExpInfo): string {
  return [i.group, i.members, i.className, i.date && i.date.replace(/-/g, '.'), i.time].filter(Boolean).join(' · ');
}
