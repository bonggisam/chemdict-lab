import guide from '../../../protocol/guide.json';

// protocol/guide.json 을 그대로 읽습니다 (애플 앱과 같은 파일).
export type ConnectorKind = 'qwiic' | 'onewire' | 'analog' | 'dht';
export interface ConnectorGuide { level: 'ok' | 'warn'; steps: string[]; cautions: string[] }
export interface Board {
  id: string;
  name: string;
  match: string[];
  firmware: 'supported' | 'partial' | 'none';
  firmwareNote: string;
  usb: string;
  ble: boolean;
  logic: string;
  adc: string;
  qwiic: string;
  connectors: Record<ConnectorKind, ConnectorGuide>;
}
export interface Part {
  id: string;
  name: string;
  provides: string[];
  connector: ConnectorKind;
  items: string[];
  cautions: string[];
}

export const commonRules: string[] = guide.common;
export const boards: Board[] = guide.boards as Board[];
export const parts: Part[] = guide.parts as Part[];

export function partById(id: string) {
  return parts.find((p) => p.id === id);
}

/** 템플릿에 setup.parts가 없으면 필요한 센서 종류로 부품을 추정 */
export function partsFor(sensorTypes: string[], explicit?: string[]): Part[] {
  if (explicit?.length) return explicit.map(partById).filter((p): p is Part => !!p);
  const out: Part[] = [];
  for (const t of sensorTypes) {
    const p = parts.find((x) => x.provides.includes(t));
    if (p && !out.includes(p)) out.push(p);
  }
  return out;
}

/** hello.board 이름으로 보드 찾기 */
export function boardByName(name: string | undefined) {
  if (!name) return undefined;
  return boards.find((b) => b.match.some((m) => name.includes(m)));
}

const KEY = 'chemdict.board';
export function loadBoardId(): string {
  try { return localStorage.getItem(KEY) ?? boards[0].id; } catch { return boards[0].id; }
}
export function saveBoardId(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* 저장 불가 환경 */ }
}
