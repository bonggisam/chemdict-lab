import { t } from '../i18n';
/** Intel HEX → 0번지부터 이어진 바이트 배열 (빈 곳은 0xFF) */
export function parseHex(text: string): Uint8Array {
  const chunks: { addr: number; data: number[] }[] = [];
  let base = 0;
  let end = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith(':')) continue;
    const b = line.slice(1).match(/../g)!.map((h) => parseInt(h, 16));
    const sum = b.reduce((a, x) => (a + x) & 0xff, 0);
    if (sum !== 0) throw new Error(t('펌웨어 파일이 손상되었습니다 (체크섬)'));
    const [len, hi, lo, type] = b;
    const data = b.slice(4, 4 + len);
    if (type === 0) {
      const addr = base + ((hi << 8) | lo);
      chunks.push({ addr, data });
      end = Math.max(end, addr + len);
    } else if (type === 1) break;
    else if (type === 2) base = ((data[0] << 8) | data[1]) << 4;
    else if (type === 4) base = ((data[0] << 8) | data[1]) << 16;
  }
  const out = new Uint8Array(end).fill(0xff);
  for (const c of chunks) out.set(c.data, c.addr);
  return out;
}
