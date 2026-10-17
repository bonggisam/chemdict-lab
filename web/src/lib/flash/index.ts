// 웹앱에서 보드에 ChemDict 측정 프로그램(펌웨어)을 올립니다. Web Serial만 쓰므로 크롬·엣지에서 동작.
import { parseHex } from './hex';
import { SerialIO } from './io';
import { syncStk500v1, flashStk500v1 } from './stk500v1';
import { flashStk500v2, type Progress } from './stk500v2';

export type { Progress };

/** 웹앱에 들어 있는 펌웨어 버전 (firmware/chemdict_lab.ino 의 FW_VERSION과 같게) */
export const BUNDLED_FW = '0.3.1';

export interface FlashTarget {
  boardId: string;           // guide.json boards[].id
  file: string;              // public/firmware/ 안의 파일
  proto: 'stk500v1' | 'stk500v2';
  bauds: number[];           // 차례로 시도
}

export const TARGETS: Record<string, FlashTarget> = {
  'mega-2560': { boardId: 'mega-2560', file: 'mega2560.hex', proto: 'stk500v2', bauds: [115200] },
  'uno-r3': { boardId: 'uno-r3', file: 'uno.hex', proto: 'stk500v1', bauds: [115200] },
  'nano': { boardId: 'nano', file: 'nano.hex', proto: 'stk500v1', bauds: [115200, 57600] }, // 57600 = 옛 부트로더(호환 보드에 많음)
};

/** 아직 웹 설치를 못 하는 보드 (Arduino IDE로 한 번 올려야 함) */
export const IDE_ONLY = new Set(['uno-r4-wifi', 'uno-r4-minima', 'nano-r4', 'leonardo']);

export interface UsbId { vid?: number; pid?: number }

/** USB 번호로 보드 알아보기. 호환 보드(CH340 등)는 알 수 없으므로 'clone' */
export function boardFromUsb({ vid, pid }: UsbId): string | 'clone' | undefined {
  if (vid === 0x2341 || vid === 0x2a03) {
    if ([0x0010, 0x0042, 0x0242, 0x0210].includes(pid!)) return 'mega-2560';
    if ([0x0001, 0x0043, 0x0243].includes(pid!)) return 'uno-r3';
    if ([0x1002, 0x006d].includes(pid!)) return 'uno-r4-wifi';
    if ([0x0069, 0x0369].includes(pid!)) return 'uno-r4-minima';
    if ([0x0074, 0x0374].includes(pid!)) return 'nano-r4';
    if ([0x0036, 0x8036, 0x0037, 0x8037].includes(pid!)) return 'leonardo';
    return undefined;
  }
  // CH340 · CP2102 · FTDI: 호환 UNO/Nano/Mega에 쓰이는 USB 칩
  if (vid === 0x1a86 || vid === 0x10c4 || vid === 0x0403) return 'clone';
  return undefined;
}

export class FlashError extends Error {
  constructor(public kind: 'nosync' | 'verify' | 'busy' | 'other', msg: string) { super(msg); }
}

export async function flashBoard(port: SerialPort, target: FlashTarget, progress: Progress) {
  const res = await fetch(`${import.meta.env.BASE_URL}firmware/${target.file}`);
  if (!res.ok) throw new FlashError('other', '펌웨어 파일을 받지 못했습니다. 인터넷 연결을 확인하세요.');
  const image = parseHex(await res.text());

  let lastErr: unknown;
  for (const baud of target.bauds) {
    const io = new SerialIO(port);
    try {
      await io.open(baud);
    } catch {
      throw new FlashError('busy', '다른 프로그램이 보드를 쓰고 있습니다.');
    }
    try {
      if (target.proto === 'stk500v2') {
        await flashStk500v2(io, image, progress);
      } else {
        progress('reset', 0);
        if (!(await syncStk500v1(io))) throw new Error('NOSYNC');
        await flashStk500v1(io, image, progress);
      }
      await io.close();
      return;
    } catch (e) {
      lastErr = e;
      await io.close();
      const m = e instanceof Error ? e.message : String(e);
      if (m === 'VERIFY') throw new FlashError('verify', '쓴 내용을 확인하다 다른 값이 나왔습니다.');
      if (!/NOSYNC|timeout/.test(m)) throw new FlashError('other', m);
    }
  }
  throw new FlashError('nosync', lastErr instanceof Error ? lastErr.message : '보드가 응답하지 않습니다.');
}

/** "0.2.2" < "0.3.0" */
export function older(a: string, b: string) {
  const pa = a.split('.').map(Number), pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) < (pb[i] ?? 0);
  return false;
}
