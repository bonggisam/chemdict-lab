// 손쉬운 사용 시험 (2.2): 설정 칸 · 큰 버튼 화면 · 시작·정지 알림 띠 · 키보드(Alt+R, 그래프 ←→) · 상태 기호
// 실행: npx vite build && npx vite preview --port 4173 & node e2e/assist.cjs
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/';

(async () => {
  const b = await chromium.launch();
  let fail = 0;
  const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) fail++; };
  for (const vp of [{ name: 'desktop', width: 1280, height: 860 }, { name: 'phone', width: 390, height: 844 }]) {
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height }, locale: 'ko-KR' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(URL);
    await p.waitForTimeout(800);

    if (vp.name === 'desktop') {
      await p.locator('.a11y-open').click();
      check(await p.locator('#a11y-list input[type=checkbox]').count() >= 3, `${vp.name}: 손쉬운 사용 설정 칸 열림`);
      await p.locator('#a11y-list select').selectOption('10');
      check(await p.evaluate(() => localStorage.getItem('chemdict.a11y.speakEvery')) === '10', `${vp.name}: 값 읽어 주기 간격 저장`);
      await p.locator('#a11y-list label', { hasText: '큰 버튼 화면' }).locator('input').check();
      check(await p.evaluate(() => localStorage.getItem('chemdict.a11y.big')) === '1', `${vp.name}: 큰 버튼 화면 저장`);
    } else {
      await p.evaluate(() => localStorage.setItem('chemdict.a11y.big', '1'));
    }

    await p.locator('.home-tiles .t-sim').click();
    await p.waitForTimeout(600);
    await p.locator('.sensor-cards .sensor-card:visible').first().click();
    await p.waitForTimeout(700);
    const start = p.locator('.sheet .primary');
    if (await start.count()) { await start.first().click(); }
    // 시작 알림 띠
    let sawStart = false;
    for (let i = 0; i < 20 && !sawStart; i++) { sawStart = (await p.locator('.a11y-alert.k-start').count()) > 0; if (!sawStart) await p.waitForTimeout(150); }
    if (!sawStart) {
      const go = p.locator('main.big-buttons button.big.rec');
      if (await go.count()) { await go.click(); for (let i = 0; i < 20 && !sawStart; i++) { sawStart = (await p.locator('.a11y-alert.k-start').count()) > 0; if (!sawStart) await p.waitForTimeout(150); } }
    }
    check(sawStart, `${vp.name}: 시작 알림 띠(● 측정을 시작했습니다)`);
    check(await p.locator('.a11y-flash').count() > 0, `${vp.name}: 화면 테두리 번쩍`);
    check(await p.locator('main.big-buttons').count() === 1, `${vp.name}: 큰 버튼 화면`);
    await p.waitForTimeout(1500);
    const num = await p.locator('main.big-buttons .big-value .num').first().innerText();
    check(/\d/.test(num), `${vp.name}: 큰 숫자에 값 (${num.replace(/\s+/g, ' ')})`);
    const h = await p.locator('main.big-buttons button.big').first().boundingBox();
    check(h && h.height >= 70, `${vp.name}: 큰 버튼 높이 ${h && Math.round(h.height)}px`);
    await p.locator('main.big-buttons button.danger.big').click();
    let sawStop = false;
    for (let i = 0; i < 20 && !sawStop; i++) { sawStop = (await p.locator('.a11y-alert.k-stop').count()) > 0; if (!sawStop) await p.waitForTimeout(150); }
    check(sawStop, `${vp.name}: 정지 알림 띠(■)`);
    await p.locator('main.big-buttons button', { hasText: '보통 화면으로' }).click();
    await p.waitForTimeout(400);
    check(await p.locator('main.big-buttons').count() === 0, `${vp.name}: 보통 화면으로 돌아옴`);
    check((await p.locator('.status-strip .dot.sym').innerText()).trim() === '✓', `${vp.name}: 상태 기호(✓ 연결)`);

    if (vp.name === 'desktop') {
      // 키보드: Alt+R 시작·정지
      await p.keyboard.press('Alt+KeyR');
      await p.waitForTimeout(1200);
      check(await p.locator('.status-strip .dot.sym.rec').count() === 1, `${vp.name}: Alt+R 측정 시작`);
      await p.keyboard.press('Alt+KeyR');
      await p.waitForTimeout(800);
      check(await p.locator('.status-strip .dot.sym.rec').count() === 0, `${vp.name}: Alt+R 정지`);
      // 그래프를 고르고 ←→로 점 하나씩
      const cv = p.locator('.chart canvas').first();
      await cv.focus();
      await p.keyboard.press('ArrowRight');
      await p.waitForTimeout(150);
      const said = await p.locator('.chart .sr-only').first().innerText();
      check(/\(1\//.test(said), `${vp.name}: 그래프 ←→ 점 읽기 (${said})`);
      await p.keyboard.press('End');
      await p.keyboard.press('[');
      await p.waitForTimeout(100);
      await p.keyboard.press('Home');
      await p.keyboard.press(']');
      await p.waitForTimeout(150);
      check(/구간/.test(await p.locator('.chart .sr-only').first().innerText()), `${vp.name}: [ ]로 구간 고르기`);
      // 실험 순서 읽어 주기 버튼
      await p.locator('details.steps summary').click();
      check(await p.locator('details.steps .read-aloud').count() === 1, `${vp.name}: 실험 순서 읽어 주기 버튼`);
    }
    check(errs.length === 0, `${vp.name}: 페이지 오류 없음 ${errs.join(' | ')}`);
    await ctx.close();
  }
  await b.close();
  console.log(fail ? `${fail}개 실패` : '모두 통과');
  process.exit(fail ? 1 : 0);
})();
