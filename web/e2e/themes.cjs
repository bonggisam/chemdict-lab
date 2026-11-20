// 화면 디자인 시험 (2.1): 10가지 디자인 + 기기 설정 따르기 — 고르면 바로 바뀌고, 다시 열어도 남고, 측정 화면까지 오류 없이 그려지는지
// 실행: npx vite build && npx vite preview --port 4173 & node e2e/themes.cjs   (SHOTS=폴더 를 주면 디자인마다 화면을 찍음)
const { chromium } = require('playwright');
const URL = process.env.URL || 'http://localhost:4173/';
const SHOTS = process.env.SHOTS || '';
const IDS = ['light', 'ocean', 'lavender', 'blossom', 'paper', 'mono', 'dark', 'board', 'navy', 'contrast'];
const DARK = ['dark', 'board', 'navy', 'contrast'];

(async () => {
  const b = await chromium.launch();
  let fail = 0;
  const check = (ok, what) => { console.log(`${ok ? '✓' : '✗'} ${what}`); if (!ok) fail++; };
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e)));
  await p.goto(URL);
  await p.waitForTimeout(800);
  const attr = () => p.evaluate(() => [document.documentElement.dataset.theme, document.documentElement.dataset.scheme, getComputedStyle(document.body).backgroundColor]);
  check((await attr())[0] === 'light', '처음은 민트(밝게)');
  await p.locator('.design-open').click();
  check(await p.locator('.design-chip').count() === 11, '고르기 칩 11개 (기기 설정 + 10가지)');
  const seen = new Set();
  for (const id of IDS) {
    await p.locator('.design-chip').nth(IDS.indexOf(id) + 1).click();
    await p.waitForTimeout(120);
    const [t, s, bg] = await attr();
    seen.add(bg);
    check(t === id && s === (DARK.includes(id) ? 'dark' : 'light'), `${id}: 바로 바뀜 (${s}, 바탕 ${bg})`);
  }
  check(seen.size === 10, '바탕색이 10가지 모두 다름');
  check(await p.evaluate(() => localStorage.getItem('chemdict.theme')) === 'contrast', '고른 값 저장');
  await p.reload();
  await p.waitForTimeout(600);
  check((await attr())[0] === 'contrast', '다시 열어도 그대로');
  await ctx.close();

  // 기기 설정 따르기: 기기가 어두우면 숲, 밝으면 민트 (2.0에서 저장한 값 그대로)
  for (const scheme of ['dark', 'light']) {
    const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', colorScheme: scheme });
    await c.addInitScript(() => localStorage.setItem('chemdict.theme', 'system'));
    const q = await c.newPage();
    await q.goto(URL);
    await q.waitForTimeout(500);
    const t = await q.evaluate(() => document.documentElement.dataset.theme);
    check(t === (scheme === 'dark' ? 'dark' : 'light'), `기기 설정 따르기 (${scheme}) → ${t}`);
    await c.close();
  }

  // 디자인마다 체험 측정 화면까지 가 보기
  for (const id of IDS) {
    const c = await b.newContext({ viewport: { width: 1280, height: 860 }, locale: 'ko-KR', deviceScaleFactor: 1 });
    await c.addInitScript((v) => localStorage.setItem('chemdict.theme', v), id);
    const q = await c.newPage();
    const e2 = [];
    q.on('pageerror', (e) => e2.push(String(e)));
    await q.goto(URL);
    await q.waitForTimeout(700);
    if (SHOTS) await q.screenshot({ path: `${SHOTS}/${id}_1_home.png` });
    await q.locator('.home-tiles .t-sim').click();
    await q.waitForTimeout(600);
    if (SHOTS) await q.screenshot({ path: `${SHOTS}/${id}_2_pick.png` });
    await q.locator('.sensor-cards .sensor-card:visible').first().click();
    await q.waitForTimeout(700);
    const start = q.locator('.sheet .primary');
    if (await start.count()) { await start.first().click(); await q.waitForTimeout(400); }
    await q.waitForTimeout(2500);
    if (SHOTS) await q.screenshot({ path: `${SHOTS}/${id}_3_measure.png` });
    check(e2.length === 0, `${id}: 첫 화면 → 센서 카드 → 측정 오류 없음 ${e2.join(' | ')}`);
    await c.close();
  }
  check(errs.length === 0, `페이지 오류 없음 ${errs.join(' | ')}`);
  await b.close();
  process.exit(fail ? 1 : 0);
})();
