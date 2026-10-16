// 통신 규칙: protocol/PROTOCOL.md

export interface SensorInfo {
  id: string;
  name: string;
  unit: string;
  src: string;
  cal: boolean;
}

export interface HelloMsg {
  type: 'hello';
  fw: string;
  board: string;
  station: number;
  demo: boolean;
  interval?: number;
  running?: boolean;
  sensors: SensorInfo[];
}

export interface DataMsg {
  type: 'd';
  t: number;
  v: Record<string, number>;
}

export interface AckMsg { type: 'ack'; cmd: string }
export interface ErrMsg { type: 'err'; cmd: string; msg: string }
export interface CalMsg { type: 'cal'; id: string; slope: number; offset: number; points: number }

export type BoardMsg = HelloMsg | DataMsg | AckMsg | ErrMsg | CalMsg;

export function parseLine(line: string): BoardMsg | null {
  const s = line.trim();
  if (!s.startsWith('{')) return null;
  try {
    const obj = JSON.parse(s);
    if (obj && typeof obj.type === 'string') return obj as BoardMsg;
  } catch {
    /* 잘린 줄은 무시 */
  }
  return null;
}

/** 조각난 텍스트를 이어 붙여 '\n' 단위로 잘라 줍니다 (BLE 20바이트 조각, 시리얼 스트림 공통). */
export class LineAssembler {
  private buf = '';
  constructor(private onLine: (line: string) => void) {}
  push(chunk: string) {
    this.buf += chunk;
    let idx: number;
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).replace(/\r$/, '');
      this.buf = this.buf.slice(idx + 1);
      if (line.length) this.onLine(line);
    }
    if (this.buf.length > 4096) this.buf = ''; // 비정상 입력 보호
  }
  reset() {
    this.buf = '';
  }
}

export interface Experiment {
  id: string;
  order: number;
  title: string;
  subject: string;
  standards: string[];
  sensors: string[];
  intervalMs: number;
  x: { label: string; unit: string };
  y: { sensor: string; label: string; unit?: string; min?: number; max?: number }[];
  markers: { enabled: boolean; label: string; prompt: string };
  steps: string[];
}
