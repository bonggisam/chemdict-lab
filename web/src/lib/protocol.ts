// 통신 규칙: protocol/PROTOCOL.md

export interface SensorInfo {
  id: string;
  type?: string;
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

export interface EventSpec {
  label: string;        // 예: NaOH 부피
  unit: string;         // 예: mL
  start: number;        // 첫 값
  step: number;         // 다음 값 제안 간격
  scale?: 'linear' | 'log';
}

export type AnalysisTool = 'stats' | 'fit' | 'equivalence' | 'plateau';

/** 교과서·지도서에 실린 같은 활동 (출판사·쪽·활동 이름) */
export interface TextbookRef {
  publisher: string;           // 미래엔, 동아출판, 천재교과서(임성숙) …
  course: string;
  level?: string;              // 그 교과서의 학교급 (실험이 여러 과목에 실릴 때 찾기에 씀)
  note: string;                // 예전 형식: '96쪽 …' (activity가 없을 때 표시)
  sure: 'confirmed' | 'mentioned' | 'similar';
  page?: string;               // 교과서 쪽
  activity?: string;           // 활동 이름
  unit?: string;               // 단원
  uses?: boolean;              // 교과서가 이미 센서·디지털 도구를 씀
}

export interface Experiment {
  id: string;
  order: number;
  title: string;
  subject: string;
  standards: string[];
  sensors: string[];           // 센서 종류(type). '*' = 모든 센서
  mode?: 'time' | 'event';     // time: 일정 간격 자동 기록, event: 버튼을 누를 때 기록
  event?: EventSpec;
  intervalMs: number;
  x: { label: string; unit: string };
  y: { sensor: string; label: string; unit?: string; min?: number; max?: number }[];
  markers: { enabled: boolean; label: string; prompt: string };
  analysis?: AnalysisTool[];
  setup?: ExperimentSetup;     // 연결 안내 (protocol/guide.json의 parts를 참조)
  steps: string[];
  // 실험으로 찾기 (2022 개정 교육과정)
  level?: '중학교' | '고1 공통' | '고2·3 선택' | '공통';
  course?: string;             // 과학 1·2·3, 통합과학1, 과학탐구실험1, 물리학, 화학 …
  area?: string;               // 영역·단원
  summary?: string;            // 한 줄 소개
  textbooks?: TextbookRef[];   // 한국 교과서 참조 (번역하지 않음)
  standardTexts?: string[];    // 성취기준 문장 (standards와 같은 순서)
  breadboard?: { need: 'required' | 'recommended'; why: string; circuit: string | null };
}

export interface ExperimentSetup {
  parts: string[];       // guide.json parts[].id
  choose?: boolean;      // true면 parts 중 하나를 골라 연결 (예: Modulino 또는 DHT)
  materials: string[];
  attach: string[];      // 실험 장치에 센서를 붙이는 방법
  cautions: string[];
}
