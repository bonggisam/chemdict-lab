// 실제 사진(휴대폰으로 찍어 작게 줄어든 사진, 띠 하나가 2~3픽셀)에서 저항 읽기
// 띠가 너무 작아 모두 맞히지는 못함 → 저항마다 양방향으로 누른 결과의 다수가 맞아야 함
import { it, expect } from 'vitest';
import { analyze } from '../lib/resistor';
import raw from './fixtures/real_resistors.json';
const meta = raw as Record<string, { ohms: number; width: number; height: number; ends: number[][]; rgb: string }>;
for (const [name, m] of Object.entries(meta)) {
  it(`실제 사진 ${name}`, () => {
    const rgb = Uint8Array.from(atob(m.rgb), (ch) => ch.charCodeAt(0));
    const data = new Uint8ClampedArray(m.width * m.height * 4);
    for (let i = 0; i < m.width * m.height; i++) { data[i * 4] = rgb[i * 3]; data[i * 4 + 1] = rgb[i * 3 + 1]; data[i * 4 + 2] = rgb[i * 3 + 2]; data[i * 4 + 3] = 255; }
    const img = { width: m.width, height: m.height, data };
    let ok = 0, all = 0;
    for (const [x, t, b] of m.ends) for (const [p, q] of [[t, b], [b, t]]) {
      all++; if (analyze(img, { x, y: p }, { x, y: q }).reading?.ohms === m.ohms) ok++;
    }
    console.log(name, ok, '/', all);
    expect(ok / all).toBeGreaterThanOrEqual(0.6);
  });
}
