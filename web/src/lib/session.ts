// 측정 자동 저장 · 측정 파일(.chemdict) 저장·열기
// 브라우저(localStorage)에 최근 측정 5개를 자동으로 남기고, 파일로 저장해 다른 기기에서 다시 열 수 있게 한다.
import type { Experiment, SensorInfo } from './protocol';
import type { Run } from './runs';
import type { ExpInfo } from './info';
import type { CustomCalc } from './formula';

export interface Session {
  app: 'chemdict-lab';
  v: 1;
  id: string;
  savedAt: string;
  exp: Experiment;
  runs: Run[];
  intervalMs: number;
  sensors: SensorInfo[];     // 측정할 때 연결돼 있던 센서 (보드 없이 다시 열 때 그래프용)
  info?: ExpInfo;
  custom?: CustomCalc | null;
}

const KEY = 'chemdict.sessions.v1';
const KEEP = 5;

export const hasData = (runs: Run[]) => runs.some((r) => r.rows.length || r.events.length);
export const newSessionId = () => `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

export function listSessions(): Session[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as Session[]) : [];
    return Array.isArray(arr) ? arr.filter(valid) : [];
  } catch { return []; }
}

/** 같은 id는 바꾸고, 최신 5개만 남김. 저장 공간이 모자라면 오래된 것부터 지우고 다시 시도 */
export function saveSession(s: Session): boolean {
  if (!hasData(s.runs)) return false;
  let list = [s, ...listSessions().filter((x) => x.id !== s.id)].slice(0, KEEP);
  while (list.length) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); return true; }
    catch { list = list.slice(0, -1); }
  }
  return false;
}

export function removeSession(id: string) {
  try { localStorage.setItem(KEY, JSON.stringify(listSessions().filter((x) => x.id !== id))); } catch { /* noop */ }
}

function valid(s: unknown): s is Session {
  const o = s as Session;
  return !!o && o.app === 'chemdict-lab' && !!o.exp && Array.isArray(o.runs) && Array.isArray(o.sensors);
}

export function sessionBlob(s: Session): Blob {
  return new Blob([JSON.stringify(s)], { type: 'application/json' });
}

export async function readSessionFile(f: File): Promise<Session> {
  const text = await f.text();
  let obj: unknown;
  try { obj = JSON.parse(text); } catch { throw new Error('parse'); }
  if (!valid(obj)) throw new Error('format');
  return { ...obj, id: newSessionId() };
}

export function sessionSummary(s: Session) {
  const n = s.runs.filter((r) => r.rows.length || r.events.length).length;
  const pts = s.runs.reduce((a, r) => a + (r.mode === 'event' ? r.events.length : r.rows.length), 0);
  return { title: s.exp.title, runs: n, points: pts, when: new Date(s.savedAt) };
}
