// 2.1 화면 흐름 시험: 보드(체험) + 이 기기 센서 함께 재기 · 긴 측정 안내 · 깨진 공유 링크
// 실행: npm run build && npx vite preview --port 4173 & node e2e/v21.cjs   (가짜 카메라·마이크 사용)
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

(async () => {
  const b = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  let fail = 0;
  const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) fail++; };

  for (const [name, vp] of [['desktop', { width: 1280, height: 860 }], ['phone', { width: 390, height: 844 }]]) {
    const ctx = await b.newContext({ viewport: vp, locale: 'ko-KR', permissions: ['camera', 'microphone'] });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(URL + '#x=' + b64({ e: 'quick-ds18b20', i: 200 }));
    await p.waitForTimeout(800);
    await p.locator('.home-tiles .t-sim').click();
    await p.waitForTimeout(900);
    const sel = p.locator('#companion');
    check(await sel.count() === 1, `${name}: 측정 화면에 [이 기기 센서 함께 재기]`);
    const opts = await sel.locator('option').evaluateAll((os) => os.map((o) => o.value));
    check(opts.includes('dev-sound') && opts.includes('dev-color'), `${name}: 소리·카메라 색 카드를 고를 수 있음 (${opts.length - 1}개)`);
    await sel.selectOption('dev-sound');
    await p.waitForTimeout(400);
    const chartsBefore = await p.locator('.chart').count();
    check(chartsBefore >= 2, `${name}: 그래프에 이 기기 센서 축이 더해짐 (${chartsBefore}개)`);
    await p.locator('button.primary.rec').first().click();
    await p.waitForTimeout(3500);
    check(await p.locator('.note.longrun').count() === 1, `${name}: 측정 중 화면 안내`);
    check(await sel.isDisabled(), `${name}: 측정 중에는 함께 재기를 못 바꿈`);
    await p.locator('button.danger').first().click();
    await p.waitForTimeout(1800);
    const saved = await p.evaluate(() => {
      const a = JSON.parse(localStorage.getItem('chemdict.sessions.v1') || '[]');
      const s = a[0]; if (!s) return null;
      const rows = s.runs.flatMap((r) => r.rows);
      return { rows: rows.length, both: rows.filter((r) => typeof r.v.T === 'number' && typeof r.v.DSND === 'number').length,
               y: s.exp.y.map((y) => y.sensor), dev: s.sensors.filter((x) => x.src === 'device').map((x) => x.id) };
    });
    check(!!saved && saved.rows >= 8, `${name}: 측정이 자동 저장됨 (${saved && saved.rows}점)`);
    check(!!saved && saved.both >= saved.rows - 3 && saved.both > 0, `${name}: 보드 값과 이 기기 소리 값이 같은 줄에 (${saved && saved.both}줄)`);
    check(!!saved && saved.y.includes('DSND') && saved.dev.includes('DSND'), `${name}: 저장 파일에 이 기기 센서 축·센서가 남음`);
    // 카메라 색으로 바꾸면 미리보기가 뜨고, 끄면 사라짐
    await sel.selectOption('dev-color');
    await p.waitForTimeout(2000);
    check(await p.locator('.cam-box video').count() === 1, `${name}: 카메라 색 함께 재기 → 미리보기`);
    await sel.selectOption('');
    await p.waitForTimeout(500);
    check(await p.locator('.cam-box video').count() === 0, `${name}: 함께 재지 않음 → 미리보기 닫힘`);
    check(await p.locator('.chart').count() === chartsBefore - 1, `${name}: 원래 그래프로 돌아옴`);
    check(errs.length === 0, `${name}: 페이지 오류 없음 ${errs.join(' | ')}`);
    await ctx.close();
  }

  // 깨진 공유 링크: 흰 화면이 아니라 그대로 열리거나 안내가 나와야 함
  for (const [what, spec] of [['계산 열 값이 숫자', { e: 'quick-ds18b20', c: { expr: 5 } }], ['계산 열이 글자', { e: 'quick-ds18b20', c: 'x' }], ['간격이 음수', { e: 'quick-ds18b20', i: -5 }]]) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR' });
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(String(e)));
    await p.goto(URL + '#x=' + b64(spec));
    await p.waitForTimeout(700);
    await p.locator('.home-tiles .t-sim').click();
    await p.waitForTimeout(900);
    const rec = p.locator('button.primary.rec');
    check(await rec.count() >= 1 && errs.length === 0, `깨진 링크(${what}): 측정 화면이 열림`);
    await ctx.close();
  }

  await b.close();
  console.log(fail ? `${fail}개 실패` : '모두 통과');
  process.exit(fail ? 1 : 0);
})();
