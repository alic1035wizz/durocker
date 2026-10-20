/* UI-тест: index.html с локального сервера, мобильный (430×930) и десктопный (1280×800) экран.
   Пропускаем обучение, играем одну партию автокликом (⟳ Подбор → основная кнопка), ловим ошибки консоли, делаем скриншоты. */
const http = require('http'), fs = require('fs'), path = require('path');
let T; try { T = require('@playwright/test'); } catch (e) { T = require('playwright/test'); }
const { test, expect } = T;

const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };
let server, base;
test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
    const f = path.join(ROOT, path.normalize(p));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(res);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + server.address().port;
});
test.afterAll(() => server && server.close());

const IGNORE = /fonts\.(googleapis|gstatic)|mqtt|unpkg|jsdelivr|ERR_(NAME_NOT_RESOLVED|INTERNET_DISCONNECTED|CONNECTION|PROXY|TUNNEL|FAILED|BLOCKED|ADDRESS)|Failed to load resource|WebSocket|net::|manifest|serviceWorker|service worker/i;

for (const vp of [{ name: 'mobile', width: 430, height: 930 }, { name: 'desktop', width: 1280, height: 800 }]) {
  test(`партия целиком, ${vp.name} ${vp.width}×${vp.height}`, async ({ browser }, info) => {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { localStorage.setItem('durocker-tut', 'skip'); localStorage.setItem('durocker-speed', 'off'); localStorage.setItem('durocker-events', '0'); } catch (e) {} });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push('console: ' + m.text()); });
    /* внешние сети (шрифты, mqtt) в тесте не нужны */
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());

    await page.goto(base + '/index.html');
    await expect(page.locator('#hand')).toBeVisible();
    /* закрыть то, что открылось поверх стола (меню/карточки) */
    for (let i = 0; i < 3; i++) { const c = page.locator('.sheet:not([hidden]) [data-close]').first(); if (await c.count()) await c.click().catch(() => {}); }
    await page.waitForFunction(() => document.querySelectorAll('#hand > *').length > 0, null, { timeout: 15000 });
    await page.screenshot({ path: info.outputPath(`start-${vp.name}.png`) });
    await info.attach(`start-${vp.name}`, { path: info.outputPath(`start-${vp.name}.png`), contentType: 'image/png' });

    const t0 = Date.now(); let clicks = 0, shot = false;
    while (Date.now() - t0 < 140000) {
      const over = await page.evaluate(() => { const o = document.getElementById('over'); return !!o && !o.hidden && o.offsetParent !== null; });
      if (over) break;
      const did = await page.evaluate(() => {
        const vis = e => e && !e.disabled && e.offsetParent !== null;
        const sh = document.querySelector('.sheet:not([hidden]) [data-close]'); if (sh) { sh.click(); return 'close'; }
        const off = document.getElementById('offer');
        if (off && !off.hidden) { const b = off.querySelector('button:not([disabled])'); if (b) { b.click(); return 'offer'; } }
        const mains = () => [...document.querySelectorAll('#actMain button')];
        if (!mains().length) return '';
        if (!mains().some(vis)) { const pick = document.getElementById('pickBtn'); if (vis(pick)) pick.click(); return 'pick'; }
        mains().find(vis).click(); return 'act';
      });
      if (did === 'pick') { await page.waitForTimeout(80); }
      /* если после подбора основная кнопка так и не включилась (например, «Вдогонку» без карт) — берём первую живую кнопку рядом («Беру», «Отбой») */
      let stuck = 0;
      if (did === 'pick') stuck = await page.evaluate(() => {
        const vis = e => e && !e.disabled && e.offsetParent !== null;
        if ([...document.querySelectorAll('#actMain button')].some(vis)) return 0;
        const alt = [...document.querySelectorAll('#actAlt button')].find(vis); if (alt) { alt.click(); return 1; } return 0;
      });
      if (did && did !== 'close') clicks++;
      if (clicks === 6 && !shot) { shot = true; await page.screenshot({ path: info.outputPath(`mid-${vp.name}.png`) }); await info.attach(`mid-${vp.name}`, { path: info.outputPath(`mid-${vp.name}.png`), contentType: 'image/png' }); }
      await page.waitForTimeout(did ? 60 : 120);
    }
    await page.waitForTimeout(500);
    const finished = await page.evaluate(() => { const o = document.getElementById('over'); return !!o && !o.hidden; });
    await page.screenshot({ path: info.outputPath(`end-${vp.name}.png`) });
    await info.attach(`end-${vp.name}`, { path: info.outputPath(`end-${vp.name}.png`), contentType: 'image/png' });
    expect(finished, `партия не дошла до экрана итогов (кликов: ${clicks})`).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
    await ctx.close();
  });
}
