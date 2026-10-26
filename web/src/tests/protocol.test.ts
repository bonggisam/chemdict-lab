import { describe, expect, test } from 'vitest';
import { LineAssembler, parseLine } from '../lib/protocol';
import { older } from '../lib/flash';

describe('보드 ↔ 앱 줄 (PROTOCOL.md 1·3장)', () => {
  test('hello·d·ack·cal·err 줄을 읽는다', () => {
    expect(parseLine('{"type":"hello","fw":"0.5.0","board":"UNO R4 WiFi","station":0,"demo":false,"sensors":[]}')?.type).toBe('hello');
    const d = parseLine('{"type":"d","t":1.5,"v":{"T":23.4}}');
    expect(d).toMatchObject({ type: 'd', t: 1.5, v: { T: 23.4 } });
    expect(parseLine('{"type":"ack","cmd":"START"}')).toEqual({ type: 'ack', cmd: 'START' });
    expect(parseLine('{"type":"err","cmd":"X","msg":"unknown command"}')?.type).toBe('err');
  });
  test('JSON이 아니거나 잘린 줄은 버린다', () => {
    expect(parseLine('booting...')).toBeNull();
    expect(parseLine('{"type":"d","t":1')).toBeNull();
    expect(parseLine('{"no":"type"}')).toBeNull();
  });
  test('20바이트 조각을 이어 붙여 줄 단위로 나눈다 (한글 포함)', () => {
    const line = '{"type":"hello","board":"이 기기","sensors":[]}';
    const bytes = new TextEncoder().encode(line + '\r\n' + line + '\n');
    const out: string[] = [];
    const asm = new LineAssembler((l) => out.push(l));
    const dec = new TextDecoder();
    for (let i = 0; i < bytes.length; i += 20) asm.push(dec.decode(bytes.slice(i, i + 20), { stream: true }));
    expect(out).toEqual([line, line]);
  });
  test('측정 프로그램 버전 비교', () => {
    expect(older('0.4.0', '0.5.0')).toBe(true);
    expect(older('0.5.0', '0.5.0')).toBe(false);
    expect(older('0.10.0', '0.5.0')).toBe(false);
  });
});
