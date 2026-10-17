// STK500v1 — UNO R3 · Nano (optiboot / 옛 부트로더, avrdude -c arduino 와 같은 순서)
import { SerialIO, sleep } from './io';
import type { Progress } from './stk500v2';

const PAGE = 128;
const EOP = 0x20, INSYNC = 0x14, OK = 0x10;

async function cmd(io: SerialIO, bytes: number[], dataLen = 0, timeoutMs = 600): Promise<number[]> {
  await io.write([...bytes, EOP]);
  const [s] = await io.read(1, timeoutMs);
  if (s !== INSYNC) throw new Error('NOSYNC');
  const data = dataLen ? await io.read(dataLen, timeoutMs) : [];
  const [o] = await io.read(1, timeoutMs);
  if (o !== OK) throw new Error('부트로더 거부');
  return data;
}

/** 부트로더와 맞춰지면 true */
export async function syncStk500v1(io: SerialIO) {
  await io.reset();
  for (let i = 0; i < 8; i++) {
    io.flush();
    try { await cmd(io, [0x30], 0, 200); return true; } catch { await sleep(40); }
  }
  return false;
}

export async function flashStk500v1(io: SerialIO, image: Uint8Array, progress: Progress) {
  await cmd(io, [0x50]);  // ENTER_PROGMODE
  const pages = Math.ceil(image.length / PAGE);
  const load = (byteAddr: number) => cmd(io, [0x55, (byteAddr >> 1) & 0xff, (byteAddr >> 9) & 0xff]);
  for (let i = 0; i < pages; i++) {
    const chunk = new Uint8Array(PAGE).fill(0xff);
    chunk.set(image.subarray(i * PAGE, (i + 1) * PAGE));
    await load(i * PAGE);
    await cmd(io, [0x64, 0, PAGE, 0x46, ...chunk], 0, 1500);
    progress('write', (i + 1) / pages);
  }
  for (let i = 0; i < pages; i++) {
    const n = Math.min(PAGE, image.length - i * PAGE);
    await load(i * PAGE);
    const got = await cmd(io, [0x74, 0, PAGE, 0x46], PAGE, 1500);
    for (let k = 0; k < n; k++) if (got[k] !== image[i * PAGE + k]) throw new Error('VERIFY');
    progress('verify', (i + 1) / pages);
  }
  await cmd(io, [0x51]);  // LEAVE_PROGMODE → 보드가 새 프로그램으로 시작
  progress('done', 1);
}
