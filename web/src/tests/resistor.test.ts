import { describe, expect, it } from 'vitest';
import { analyze, decode, encode, formatOhms, nearestE, E12, type BandColor, type Pixels } from '../lib/resistor';

// 실제 사진처럼 띠 색을 조금씩 흔든 값
const SHADE: Record<BandColor, [number, number, number]> = {
  black: [38, 34, 33], brown: [118, 68, 40], red: [190, 38, 40], orange: [228, 112, 34], yellow: [228, 198, 52],
  green: [46, 138, 66], blue: [46, 82, 185], violet: [124, 72, 168], grey: [122, 122, 126], white: [236, 236, 230],
  gold: [182, 152, 72], silver: [182, 184, 190],
};

/** 가로 저항 그림: 배경 → 몸통 → 띠 (조명 기울기·잡음 포함) */
function draw(bands: BandColor[], opt: { body?: [number, number, number]; reverse?: boolean; light?: number; seed?: number } = {}): Pixels {
  const W = 600, H = 200;
  const data = new Uint8ClampedArray(W * H * 4);
  const body = opt.body ?? [214, 186, 142];
  let seed = opt.seed ?? 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const seq = opt.reverse ? [...bands].reverse() : bands;
  // 띠 위치: 앞쪽 띠들은 붙어 있고, 마지막(오차) 띠는 떨어져 있음
  const x0 = 120, x1 = 480, bw = 22, step = 40;
  const pos: number[] = [];
  const n = seq.length;
  if (!opt.reverse) { for (let i = 0; i < n - 1; i++) pos.push(x0 + 30 + i * step); pos.push(x1 - 50); }
  else { pos.push(x0 + 28); for (let i = 0; i < n - 1; i++) pos.push(x1 - 50 - (n - 2 - i) * step); }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c: [number, number, number] = [245, 245, 242];
    if (y > 70 && y < 130) {
      if (x >= x0 && x <= x1) {
        c = body;
        seq.forEach((b, i) => { if (x >= pos[i] && x < pos[i] + bw) c = SHADE[b]; });
      } else if (x > 40 && x < 560 && y > 96 && y < 104) c = [150, 150, 155]; // 다리
    }
    const light = (opt.light ?? 1) * (0.92 + 0.12 * (x / W));
    const p = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) data[p + k] = Math.max(0, Math.min(255, c[k] * light + (rnd() - 0.5) * 14));
    data[p + 3] = 255;
  }
  return { width: W, height: H, data };
}

const read = (img: Pixels) => analyze(img, { x: 120, y: 100 }, { x: 480, y: 100 });

describe('저항 색띠 계산', () => {
  it('색띠 → 값', () => {
    expect(decode(['red', 'red', 'brown', 'gold']).ohms).toBe(220);
    expect(decode(['brown', 'black', 'orange', 'gold']).ohms).toBe(10000);
    expect(decode(['yellow', 'violet', 'red', 'gold'])).toMatchObject({ ohms: 4700, tol: 5, valid: true });
    expect(decode(['brown', 'black', 'black', 'brown', 'brown'])).toMatchObject({ ohms: 1000, tol: 1 });
    expect(decode(['brown', 'black', 'gold', 'gold']).ohms).toBe(1);
    expect(decode(['gold', 'black', 'red', 'brown']).valid).toBe(false);
  });
  it('값 → 색띠', () => {
    expect(encode(220)).toEqual(['red', 'red', 'brown', 'gold']);
    expect(encode(4700)).toEqual(['yellow', 'violet', 'red', 'gold']);
    expect(encode(1000, 1, true)).toEqual(['brown', 'black', 'black', 'brown', 'brown']);
    expect(encode(4.7)).toEqual(['yellow', 'violet', 'gold', 'gold']);
    for (const v of [10, 47, 330, 1000, 2200, 10000, 47000, 100000]) expect(decode(encode(v)!).ohms).toBe(v);
  });
  it('표준값·글', () => {
    expect(nearestE(150, E12, true)).toBe(150);
    expect(nearestE(160, E12, true)).toBe(180);
    expect(nearestE(3300, E12)).toBe(3300);
    expect(formatOhms(4700)).toBe('4.7 kΩ');
    expect(formatOhms(220)).toBe('220 Ω');
  });
});

describe('사진에서 저항 읽기 (그린 그림)', () => {
  const cases: [BandColor[], number][] = [
    [['red', 'red', 'brown', 'gold'], 220],
    [['brown', 'black', 'orange', 'gold'], 10000],
    [['yellow', 'violet', 'red', 'gold'], 4700],
    [['orange', 'orange', 'brown', 'gold'], 330],
    [['brown', 'black', 'red', 'gold'], 1000],
    [['blue', 'grey', 'brown', 'gold'], 680],
  ];
  for (const [bands, ohms] of cases) {
    it(`${ohms} Ω`, () => expect(read(draw(bands)).reading?.ohms).toBe(ohms));
    it(`${ohms} Ω (거꾸로 놓음)`, () => expect(read(draw(bands, { reverse: true })).reading?.ohms).toBe(ohms));
    it(`${ohms} Ω (어두운 조명)`, () => expect(read(draw(bands, { light: 0.8, seed: 3 })).reading?.ohms).toBe(ohms));
  }
  it('5띠 금속피막 (파란 몸통) 1 kΩ', () => {
    const r = read(draw(['brown', 'black', 'black', 'brown', 'brown'], { body: [70, 130, 190] })).reading;
    expect(r?.ohms).toBe(1000);
  });
  it('띠가 없으면 읽지 않음', () => {
    expect(read(draw([])).reading).toBeNull();
  });
});
