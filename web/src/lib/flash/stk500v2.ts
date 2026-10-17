import { t } from '../i18n';
// STK500v2 — Mega 2560 부트로더 (avrdude -c wiring 과 같은 순서)
import { SerialIO, sleep } from './io';

export type Progress = (stage: 'reset' | 'write' | 'verify' | 'done', ratio: number) => void;

const PAGE = 256;

class V2 {
  private seq = 0;
  constructor(private io: SerialIO) {}

  async cmd(body: number[], timeoutMs = 1000): Promise<number[]> {
    const seq = this.seq++ & 0xff;
    const msg = [0x1b, seq, body.length >> 8, body.length & 0xff, 0x0e, ...body];
    msg.push(msg.reduce((a, x) => a ^ x, 0));
    await this.io.write(msg);
    // 응답: 1B seq lenH lenL 0E body... cks
    for (;;) {
      const [s] = await this.io.read(1, timeoutMs);
      if (s === 0x1b) break;
    }
    const [rseq, lh, ll, tok] = await this.io.read(4, timeoutMs);
    if (tok !== 0x0e) throw new Error(t('응답 형식 오류'));
    const len = (lh << 8) | ll;
    const rb = await this.io.read(len + 1, timeoutMs);
    const cks = [0x1b, rseq, lh, ll, tok, ...rb.slice(0, len)].reduce((a, x) => a ^ x, 0);
    if (cks !== rb[len]) throw new Error(t('응답 체크섬 오류'));
    const ans = rb.slice(0, len);
    if (ans[0] !== body[0] || ans[1] !== 0x00) throw new Error(t('부트로더 거부 (명령 {cmd})', { cmd: body[0].toString(16) }));
    return ans;
  }

  async loadAddress(byteAddr: number) {
    const w = byteAddr >> 1;
    await this.cmd([0x06, 0x80 | ((w >> 24) & 0x7f), (w >> 16) & 0xff, (w >> 8) & 0xff, w & 0xff]);
  }
}

export async function flashStk500v2(io: SerialIO, image: Uint8Array, progress: Progress) {
  const p = new V2(io);
  progress('reset', 0);
  let synced = false;
  for (let attempt = 0; attempt < 4 && !synced; attempt++) {
    await io.reset();
    io.flush();
    for (let i = 0; i < 5 && !synced; i++) {
      try { await p.cmd([0x01], 250); synced = true; } catch { await sleep(50); }
    }
  }
  if (!synced) throw new Error('NOSYNC');
  await p.cmd([0x10, 200, 100, 25, 32, 0, 0x53, 3, 0xac, 0x53, 0, 0]);

  const pages = Math.ceil(image.length / PAGE);
  for (let i = 0; i < pages; i++) {
    const chunk = new Uint8Array(PAGE).fill(0xff);
    chunk.set(image.subarray(i * PAGE, (i + 1) * PAGE));
    await p.loadAddress(i * PAGE);
    await p.cmd([0x13, PAGE >> 8, PAGE & 0xff, 0xc1, 10, 0x40, 0x4c, 0x20, 0, 0, ...chunk], 2000);
    progress('write', (i + 1) / pages);
  }
  for (let i = 0; i < pages; i++) {
    const n = Math.min(PAGE, image.length - i * PAGE);
    await p.loadAddress(i * PAGE);
    const ans = await p.cmd([0x14, PAGE >> 8, PAGE & 0xff, 0x20], 2000);
    const got = ans.slice(2, 2 + n);
    for (let k = 0; k < n; k++) if (got[k] !== image[i * PAGE + k]) throw new Error('VERIFY');
    progress('verify', (i + 1) / pages);
  }
  await p.cmd([0x11, 1, 1]);
  progress('done', 1);
}
