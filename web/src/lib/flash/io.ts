/** 부트로더와 주고받기 위한 시리얼 입출력 (시간 제한 있는 바이트 읽기) */
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class SerialIO {
  private buf: number[] = [];
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private waiters: (() => void)[] = [];
  private closed = false;

  constructor(private port: SerialPort) {}

  async open(baudRate: number) {
    await this.port.open({ baudRate, bufferSize: 4096 });
    this.closed = false;
    this.loop();
  }

  private async loop() {
    if (!this.port.readable) return;
    this.reader = this.port.readable.getReader();
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        if (value) { for (const v of value) this.buf.push(v); this.wake(); }
      }
    } catch { /* 닫힘 */ } finally {
      this.reader?.releaseLock();
      this.reader = null;
      this.closed = true;
      this.wake();
    }
  }

  private wake() { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); }

  /** 보드를 리셋해 부트로더로 들어가게 함 (DTR을 내렸다 올림) */
  async reset() {
    await this.port.setSignals({ dataTerminalReady: false, requestToSend: false });
    await sleep(120);
    await this.port.setSignals({ dataTerminalReady: true, requestToSend: true });
    await sleep(60);
  }

  flush() { this.buf = []; }

  async write(bytes: number[] | Uint8Array) {
    const w = this.port.writable!.getWriter();
    try { await w.write(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); } finally { w.releaseLock(); }
  }

  /** n바이트를 읽음. 시간 안에 못 받으면 오류 */
  async read(n: number, timeoutMs = 1000): Promise<number[]> {
    const until = Date.now() + timeoutMs;
    while (this.buf.length < n) {
      const left = until - Date.now();
      if (left <= 0 || this.closed) throw new Error('timeout');
      await new Promise<void>((res) => {
        const t = setTimeout(res, left);
        this.waiters.push(() => { clearTimeout(t); res(); });
      });
    }
    return this.buf.splice(0, n);
  }

  async close() {
    try { await this.reader?.cancel(); } catch { /* noop */ }
    await sleep(20);
    try { await this.port.close(); } catch { /* noop */ }
  }
}
