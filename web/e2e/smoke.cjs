// 화면 흐름 시험 (UI 시험): 첫 화면 → 보드 없이 체험 → 기기 센서 카드 → 측정 → 분석 칸 → 큰 화면
// 실행: npm run build && npx vite preview --port 4173 & node e2e/smoke.cjs
// Playwright가 필요합니다 (npm i -g playwright 또는 npx playwright). 가짜 카메라·마이크를 씁니다.
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/';

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  let fail = 0;
  const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) fail++; };
  for (const [name, vp] of [['desktop', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, locale: 'ko-KR', permissions: ['camera', 'microphone'] });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(URL);
    await p.waitForTimeout(1000);
    check(await p.locator('.home-tiles button').count() >= 2, `${name}: 첫 화면 큰 버튼`);
    await p.locator('.home-tiles .t-sim').click();
    await p.waitForTimeout(600);
    check(await p.locator('.sensor-cards').count() > 0, `${name}: 보드 없이 체험 → 센서 카드`);
    // 보드(체험)가 연결된 동안 이 기기 센서 칸은 접혀 있음 → 펼침
    const fold = p.locator('details.device-section > summary');
    if (await fold.count()) { await fold.first().click(); await p.waitForTimeout(200); }
    const absorb = p.locator('.device-section .sensor-card', { hasText: '흡광도' });
    if (await absorb.count()) {
      await absorb.first().click();
      await p.waitForTimeout(2000);
      check(await p.locator('.cam-box video').count() === 1, `${name}: 카메라 미리보기`);
      await p.locator('.device-camera button').first().click({ force: true });
      await p.locator('.sheet .primary').click();
      await p.waitForTimeout(2500);
      check(await p.locator('.status-strip .dot.rec').count() === 1, `${name}: 기기 센서로 측정 중`);
      await p.locator('.tabs3 button').nth(1).click();
      await p.waitForTimeout(300);
      check(await p.locator('.analysis').count() === 1, `${name}: 분석 칸`);
      await p.locator('.status-strip button').click();
      await p.waitForTimeout(800);
      check(await p.locator('.big-screen .big-value').count() > 0, `${name}: 큰 화면`);
    }
    check(errs.length === 0, `${name}: 페이지 오류 없음 ${errs.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  process.exit(fail ? 1 : 0);
})();
