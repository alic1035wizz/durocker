/* Компания 3–4: партия с ботами до конца, итог целиком виден, портреты меняют эмоции, тосты идут очередью. */
const http = require('http'), fs = require('fs'), path = require('path');
let T; try { T = require('@playwright/test'); } catch (e) { T = require('playwright/test'); }
const { test, expect } = T;
const ROOT = path.join(__dirname, '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
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
const IGNORE = /fonts\.(googleapis|gstatic)|mqtt|unpkg|jsdelivr|ERR_|Failed to load resource|WebSocket|net::|manifest|serviceWorker|service worker/i;

for (const vp of [{ width: 430, height: 930 }, { width: 844, height: 390 }]) {
  test(`компания 4: партия до конца, ${vp.width}×${vp.height}`, async ({ browser }) => {
    test.setTimeout(240000);
    const ctx = await browser.newContext({ viewport: vp, serviceWorkers: 'block' });
    await ctx.addInitScript(() => { try { localStorage.setItem('durocker-tut', 'skip'); localStorage.setItem('durocker-speed', 'turbo'); localStorage.setItem('durocker-events', '0'); localStorage.setItem('durocker-seen', '1'); } catch (e) {} });
    const page = await ctx.newPage(), errors = [];
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !IGNORE.test(m.text())) errors.push(m.text()); });
    await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await page.goto(base + '/index.html');
    await page.waitForFunction(() => typeof UI4 !== 'undefined' && document.querySelectorAll('#hand > *').length > 0, null, { timeout: 15000 });
    await page.evaluate(() => { document.querySelectorAll('.sheet').forEach(s => { s.hidden = true; }); const l = document.getElementById('lobby'); if (l) l.hidden = true; UI4.saveOpts({ to: 1, set: 'full', sharper: false }); UI4.startBots(4); });
    expect(await page.evaluate(() => document.getElementById('m4').dataset.theme)).toBe('kitchen');
    const emos = new Set();
    for (let i = 0; i < 900; i++) {
      const st = await page.evaluate(() => { const V = UI4.C.V; return V && { over: V.over, who: V.phase.who }; });
      (await page.$$eval('#m4 .m4opp svg.pt', els => els.map(e => e.dataset.e))).forEach(e => emos.add(e));
      if (!st || st.over != null) break;
      if (await page.$('#m4offer [data-pick4]')) { await page.evaluate(() => document.querySelector('#m4offer [data-pick4]').click()); continue; }
      if (st.who === 0) {
        await page.evaluate(() => { const p = document.getElementById('m4pick'); if (!p.disabled) p.click(); });
        await page.evaluate(() => {
          const b = document.querySelector('#m4main button:not([disabled])') || document.querySelector('#m4alt button:not([disabled])');
          if (b) b.click(); else { const c = document.querySelector('#m4hand .card'); if (c) c.click(); }
        });
      }
      await page.waitForTimeout(100);
    }
    await page.waitForSelector('#m4over .m4over .box', { timeout: 20000 });
    const fit = await page.evaluate(() => {
      const r = document.querySelector('#m4over .m4over .box').getBoundingClientRect();
      const bs = [...document.querySelectorAll('#m4over .btn')].map(b => b.getBoundingClientRect());
      return { top: r.top, bottom: r.bottom, h: innerHeight, btnBottom: Math.max(...bs.map(b => b.bottom)) };
    });
    expect(fit.top, 'итог не обрезан сверху').toBeGreaterThanOrEqual(0);
    expect(fit.bottom, 'итог не обрезан снизу').toBeLessThanOrEqual(fit.h + 1);
    expect(fit.btnBottom).toBeLessThanOrEqual(fit.h + 1);
    expect(emos.size, 'эмоции портретов меняются').toBeGreaterThan(1);
    /* тосты: очередь не больше двух одновременно */
    await page.evaluate(() => { document.getElementById('m4over').innerHTML = ''; ['a', 'b', 'c', 'd'].forEach(t => toast('🏆 ' + t, 2200)); });
    await page.waitForTimeout(300);
    expect(await page.locator('#toast .tpill').count()).toBe(2);
    expect(errors, errors.join('\n')).toEqual([]);
    await ctx.close();
  });
}
