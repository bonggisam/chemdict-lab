// 부품 도우미 화면 시험: 3단계 → 🧰 부품 도우미 → 저항 사진 읽기 · 값→색띠 · 부품 찾기 · 계산기 · 함께 쓰기
// 실행: npx vite preview --port 4173 & node e2e/parts.cjs
const { chromium } = require('playwright');
const path = require('path');
const URL = process.env.URL || 'http://localhost:4173/';
(async () => {
  const b = await chromium.launch();
  let fail = 0;
  const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) fail++; };
  for (const [name, vp] of [['desktop', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
    const p = await (await b.newContext({ viewport: vp, locale: 'ko-KR' })).newPage();
    const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(URL); await p.waitForTimeout(800);
    await p.locator('.home-tiles .t-sim').click(); await p.waitForTimeout(500);
    if (name === 'phone') { await p.locator('.side-toggle').click(); await p.waitForTimeout(300); }
    await p.locator('.side-tree').getByText('연결 방법 · 문제 해결').first().click(); await p.waitForTimeout(400);
    await p.getByRole('tab', { name: /부품 도우미/ }).click(); await p.waitForTimeout(300);
    check(await p.locator('.parts-helper').count() === 1, `${name}: 부품 도우미 열림`);
    // 1) 저항 사진
    await p.locator('.parts-helper input[type=file]').first().setInputFiles(path.join(__dirname, 'fixtures/resistor_10k.png'));
    await p.waitForTimeout(500);
    const cv = p.locator('.resistor-photo');
    const box = await cv.boundingBox();
    const at = (x, y) => p.mouse.click(box.x + (x / 800) * box.width, box.y + (y / 400) * box.height);
    await at(205, 200); await at(595, 200); await p.waitForTimeout(400);
    const val = await p.locator('.resistor-result .resistor-value b').textContent().catch(() => '');
    check(val === '10 kΩ', `${name}: 사진 저항 읽기 = ${val}`);
    // 띠 색 고치기 → 값이 바뀜
    await p.locator('.band-chip select').nth(2).selectOption('red');
    check((await p.locator('.resistor-result .resistor-value b').textContent()) === '1 kΩ', `${name}: 띠 고치면 값 바뀜`);
    // 값 → 색띠
    await p.getByLabel('저항값 (Ω)').fill('4700');
    check((await p.locator('.helper-pane > .note').last().textContent()).includes('노랑 · 보라 · 빨강 · 금색'), `${name}: 값 → 색띠`);
    // 2) 부품 찾기
    await p.getByRole('tab', { name: /부품 찾기/ }).click();
    await p.getByPlaceholder('부품에 적힌 글자').fill('HC-SR04');
    check(await p.locator('.helper-pane .sensor-card', { hasText: 'HC-SR04' }).count() === 1, `${name}: 모델명으로 부품 찾기`);
    await p.locator('.helper-pane .sensor-card').first().click(); await p.waitForTimeout(400);
    check(await p.locator('.part-wiring').count() > 0, `${name}: 찾은 부품 → 연결 방법`);
    // 3) 계산기
    await p.getByRole('tab', { name: /부품 도우미/ }).click();
    await p.getByRole('tab', { name: /저항 계산/ }).click();
    check((await p.locator('.helper-pane .resistor-value b').first().textContent()) === '330 Ω', `${name}: LED 저항 (5 V 빨강 10 mA) = 330 Ω`);
    // 4) 함께 쓰기
    await p.getByRole('tab', { name: /함께 쓰기/ }).click();
    for (const q of ['SHT40', 'SHT30']) { await p.getByPlaceholder('센서 이름 찾기').fill(q); await p.locator('.helper-pane .chip-row button').first().click(); }
    check(await p.locator('.check-list li.bad').count() > 0, `${name}: I2C 주소 겹침 경고`);
    check(errs.length === 0, `${name}: 페이지 오류 없음 ${errs.join(' | ')}`);
  }
  await b.close();
  console.log(fail ? `실패 ${fail}` : '모두 통과');
  process.exit(fail ? 1 : 0);
})();
