// 사진 조건이 나쁠 때(끝을 벗어나 누름·따뜻한 조명·가는 띠·빛 반사·비스듬한 선) 저항 읽기
import { it, expect } from 'vitest';
import { analyze, findBands, type BandColor, type Pixels } from '../lib/resistor';
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
// 어둡고 누런 실내 사진 (실제 학생 사진처럼 몸통이 갈색에 가깝게 찍힘)
for (const [b, v] of C) {
  it(`dim warm light ${v}`, () => expect(analyze(draw(b, { cast: [0.55, 0.5, 0.42] }), { x: 120, y: 100 }, { x: 480, y: 100 }).reading?.ohms).toBe(v));
}

// 저항이 아닌 사진(꽃·잎)에서는 값을 지어내지 않음
function scene(kind: 'flowers' | 'leaves'): Pixels {
  const W = 400, H = 200, data = new Uint8ClampedArray(W * H * 4); let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    // 자주색 꽃밭 사이사이 빨간 꽃·갈색 줄기 (띠처럼 보이는 줄무늬)
    const p = (y * W + x) * 4;
    const stripe = [[100, 120, [200, 35, 45]], [150, 170, [200, 35, 45]], [200, 220, [110, 65, 40]], [260, 280, [200, 35, 45]], [310, 330, [200, 35, 45]]].find(([a, b]) => x >= (a as number) && x < (b as number));
    const c = (stripe ? stripe[2] : kind === 'flowers' ? [205, 40, 140] : [80, 150, 55]) as number[];
    for (let k = 0; k < 3; k++) data[p + k] = Math.max(0, Math.min(255, c[k] + (rnd() - 0.5) * 40));
    data[p + 3] = 255;
  }
  return { width: W, height: H, data };
}
it('꽃 사진에서는 값 없음', () => expect(analyze(scene('flowers'), { x: 40, y: 100 }, { x: 360, y: 100 }).reading).toBeNull());
it('잎 사진에서는 값 없음', () => expect(analyze(scene('leaves'), { x: 40, y: 100 }, { x: 360, y: 100 }).reading).toBeNull());
it('몸통 색이 저항답지 않으면(자주·초록) 몸통 없음으로 봄', () => {
  const line = (c: [number, number, number]) => Array.from({ length: 200 }, (_, i): [number, number, number] => (i % 40 < 8 ? [40, 30, 25] : c));
  expect(findBands(line([205, 40, 140])).noBody).toBe(true);   // 자주색 꽃
  expect(findBands(line([80, 150, 55])).noBody).toBe(true);    // 잎
  expect(findBands(line([214, 186, 142])).noBody).toBe(false); // 베이지 몸통
  expect(findBands(line([70, 130, 190])).noBody).toBe(false);  // 파란 몸통
  expect(findBands(line([118, 93, 60])).noBody).toBe(false);   // 어두운 베이지
});
