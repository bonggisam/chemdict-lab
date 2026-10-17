import guide from '../../../protocol/guide.json';
import type { Experiment } from './protocol';
import { typeInfo } from './sensors';
import { t } from './i18n';

// protocol/guide.json 을 그대로 읽습니다 (애플 앱과 같은 파일, tools/make_guide.py로 생성).
export type SensorSet = 'full' | 'lite' | 'mini' | 'none';
export type PinRole =
  | 'PWR' | 'PWR3' | 'GND' | 'SDA' | 'SCL' | 'A' | 'ONEWIRE' | 'DHT'
  | 'HX_DT' | 'HX_SCK' | 'TRIG' | 'ECHO' | 'TC_CS' | 'TC_SO' | 'TC_SCK' | 'U_RX' | 'U_TX';

export interface Board {
  id: string;
  name: string;
  match: string[];
  firmware: 'verified' | 'compiled' | 'none';
  sensorSet: SensorSet;
  firmwareNote: string;
  usb: string;
  ble: boolean;
  logic: string;
  adc: string;
  qwiic: string;
  pins: Record<PinRole, string>;
  notes: string[];
}

export interface Wire { term: string; pin: PinRole; color: string }
export interface Connector {
  name: string;
  wires: Wire[];
  cable?: boolean;                              // Qwiic 케이블 하나로 연결 가능
  resistor?: { between: [PinRole, PinRole]; value: string };
  breadboard?: BBNeed;
  steps: string[];
  cautions: string[];
}

export interface Part {
  id: string;
  name: string;
  category: string;
  connector: string;
  provides: string[];
  minSet: Exclude<SensorSet, 'none'>;
  support: 'verified' | 'firmware';
  items: string[];
  cautions: string[];
  analogType?: string;   // 아날로그 센서: 포트에 지정할 종류
  addr?: string;
}

export const commonRules: string[] = guide.common;
export const categories: string[] = guide.categories;
export const boards = guide.boards as unknown as Board[];
export const connectors = guide.connectors as unknown as Record<string, Connector>;
export const parts = guide.parts as unknown as Part[];
export const planned: string[] = guide.planned;
export interface BBNeed { need: 'required' | 'recommended'; why: string; circuit: string | null }
export interface BBCircuit {
  id: string; name: string; what: string; steps: string[]; caution?: string;
  wires: { a: string; b: string; color: string }[];
  parts: { kind: 'resistor' | 'sensor' | 'led' | 'cap' | 'pot' | 'probe'; label: string; legs: string[] }[];
}
export interface BreadboardInfo {
  intro: string; structure: string[]; rules: string[];
  resistors: { value: string; bands: string; use: string }[];
  circuits: BBCircuit[];
}
export const breadboard = guide.breadboard as unknown as BreadboardInfo;

/** 실험에 브레드보드가 필요한지: 실험에 적힌 것 → 없으면 쓰는 센서의 연결 방식으로 */
export function breadboardFor(e: Experiment): BBNeed | null {
  if (e.breadboard) return e.breadboard;
  const ps = partsFor(e.sensors.filter((s) => s !== '*'), e.setup?.parts);
  const needs = ps.map((p) => connectors[p.connector].breadboard).filter((b): b is BBNeed => !!b && b.need === 'required');
  return needs[0] ?? null;
}

export interface Trouble { id: string; title: string; steps: string[] }
export const troubles = guide.troubles as Trouble[];

const RANK: Record<SensorSet, number> = { none: 0, mini: 1, lite: 2, full: 3 };

export function partById(id: string) {
  return parts.find((p) => p.id === id);
}

/** 이 보드의 펌웨어가 이 센서를 읽을 수 있는지 */
export function partSupported(board: Board, p: Part) {
  return RANK[board.sensorSet] >= RANK[p.minSet];
}

// Qwiic 단자 여부는 번역 전(한국어) 값으로 한 번만 정함 (board.qwiic 글은 언어에 따라 바뀜)
const QWIIC = new Set(boards.filter((b) => !b.qwiic.startsWith('없음')).map((b) => b.id));
export function hasQwiic(board: Board) {
  return QWIIC.has(board.id);
}

/** 보드에 맞춘 배선 목록 (보드 핀 이름까지) */
export function wiring(board: Board, p: Part) {
  const c = connectors[p.connector];
  const cable = !!c.cable && hasQwiic(board);
  const wires = c.wires.map((w) => ({ ...w, boardPin: board.pins[w.pin] }));
  return { connector: c, cable, wires };
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

/** 센서 하나로 바로 측정할 때 쓰는 실험 (그래프는 센서가 주는 값마다 하나) */
export function quickExperiment(p: Part): Experiment {
  return {
    id: `quick-${p.id}`,
    order: 0,
    title: p.name,
    subject: t('바로 측정'),
    standards: [],
    sensors: p.provides,
    mode: 'time',
    intervalMs: 1000,
    x: { label: t('시간'), unit: 's' },
    y: p.provides.map((t) => {
      const s = typeInfo(t);
      return { sensor: t, label: s?.name ?? t, unit: s?.unit, min: s?.min, max: s?.max };
    }),
    markers: { enabled: true, label: t('관찰 기록'), prompt: t('한 일 (예: 시약 넣음)') },
    analysis: ['stats', 'fit', 'plateau'],
    steps: [],
  };
}

/** hello.board 이름으로 보드 찾기 (긴 이름 먼저: "Nano R4"가 "Nano"보다 먼저) */
export function boardByName(name: string | undefined) {
  if (!name) return undefined;
  const cands = boards.flatMap((b) => b.match.map((m) => ({ b, m }))).sort((x, y) => y.m.length - x.m.length);
  return cands.find(({ m }) => name.includes(m))?.b;
}

const KEY = 'chemdict.board';
export function loadBoardId(): string {
  try { return localStorage.getItem(KEY) ?? boards[0].id; } catch { return boards[0].id; }
}
export function saveBoardId(id: string) {
  try { localStorage.setItem(KEY, id); } catch { /* 저장 불가 환경 */ }
}
