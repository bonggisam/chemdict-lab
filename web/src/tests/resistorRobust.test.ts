// 사진 조건이 나쁠 때(끝을 벗어나 누름·따뜻한 조명·가는 띠·빛 반사·비스듬한 선) 저항 읽기
import { it, expect } from 'vitest';
import { analyze, type BandColor, type Pixels } from '../lib/resistor';
const SHADE: Record<BandColor, [number, number, number]> = {
  black: [38, 34, 33], brown: [118, 68, 40], red: [190, 38, 40], orange: [228, 112, 34], yellow: [228, 198, 52],
  green: [46, 138, 66], blue: [46, 82, 185], violet: [124, 72, 168], grey: [122, 122, 126], white: [236, 236, 230],
  gold: [182, 152, 72], silver: [182, 184, 190],
};
function draw(bands: BandColor[], o: { cast?: [number,number,number]; glare?: boolean; bw?: number; seed?: number } = {}): Pixels {
  const W = 600, H = 200, data = new Uint8ClampedArray(W * H * 4); let seed = o.seed ?? 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const x0 = 120, x1 = 480, bw = o.bw ?? 22, n = bands.length; const pos: number[] = [];
  for (let i = 0; i < n - 1; i++) pos.push(x0 + 30 + i * 40); pos.push(x1 - 50);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c: [number, number, number] = [245, 245, 242];
    if (y > 70 && y < 130) { if (x >= x0 && x <= x1) { c = [214, 186, 142]; bands.forEach((b, i) => { if (x >= pos[i] && x < pos[i] + bw) c = SHADE[b]; }); } else if (x > 40 && x < 560 && y > 96 && y < 104) c = [150, 150, 155]; }
    const cast = o.cast ?? [1, 1, 1];
    const p = (y * W + x) * 4;
    for (let k = 0; k < 3; k++) { let v = c[k] * cast[k] + (rnd() - 0.5) * 18; if (o.glare && x > 300 && x < 320 && y > 90 && y < 110) v = 250; data[p + k] = Math.max(0, Math.min(255, v)); }
    data[p + 3] = 255;
  }
  return { width: W, height: H, data };
}
const C: [BandColor[], number][] = [[['red','red','brown','gold'],220],[['brown','black','orange','gold'],10000],[['yellow','violet','red','gold'],4700],[['orange','orange','brown','gold'],330],[['brown','black','red','gold'],1000],[['blue','grey','brown','gold'],680],[['brown','black','yellow','gold'],100000],[['green','blue','orange','gold'],56000],[['brown','green','brown','gold'],150],[['red','violet','orange','gold'],27000]];
for (const [b, v] of C) {
  it(`taps outside ends ${v}`, () => expect(analyze(draw(b), { x: 100, y: 100 }, { x: 500, y: 100 }).reading?.ohms).toBe(v));
  it(`warm light ${v}`, () => expect(analyze(draw(b, { cast: [1.08, 1, 0.85] }), { x: 120, y: 100 }, { x: 480, y: 100 }).reading?.ohms).toBe(v));
  it(`thin bands ${v}`, () => expect(analyze(draw(b, { bw: 12 }), { x: 120, y: 100 }, { x: 480, y: 100 }).reading?.ohms).toBe(v));
  it(`glare ${v}`, () => expect(analyze(draw(b, { glare: true }), { x: 120, y: 100 }, { x: 480, y: 100 }).reading?.ohms).toBe(v));
  it(`slanted taps ${v}`, () => expect(analyze(draw(b), { x: 122, y: 92 }, { x: 478, y: 108 }).reading?.ohms).toBe(v));
}
