/* После партии работают фичи, подписанные на шину: профиль, достижения, пропуск, фишки, портреты, меню. */
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

test('фичи на шине событий работают после партии', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 930 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { try { localStorage.setItem('durocker-tut', 'skip'); localStorage.setItem('durocker-speed', 'turbo'); localStorage.setItem('durocker-events', '0'); } catch (e) {} });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if ((m.type() === 'error' || m.type() === 'warning') && !IGNORE.test(m.text())) errors.push(m.type() + ': ' + m.text()); });
  await ctx.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(base + '/index.html');
  await page.waitForFunction(() => document.querySelectorAll('#hand > *').length > 0, null, { timeout: 15000 });
  for (let i = 0; i < 3; i++) { const c = page.locator('.sheet:not([hidden]) [data-close]').first(); if (await c.count()) await c.click().catch(() => {}); }

  /* шина установила по одной обёртке */
  const inst = await page.evaluate(() => Object.keys(BUS._installed));
  for (const n of ['onGameOver', 'showOver', 'showFx', 'menuGo', 'openMenu']) expect(inst, 'обёртка ' + n).toContain(n);
  /* портрет у соперника */
  expect(await page.locator('#oppAva svg.pt').count(), 'портрет соперника').toBeGreaterThan(0);

  const before = await page.evaluate(() => ({ n: STATS.st().tot.n, xp: PASS.state().xp, ch: JSON.stringify(localStorage.getItem('durocker-chips')) }));
  let emos = new Set();
  const t0 = Date.now();
  while (Date.now() - t0 < 140000) {
    const over = await page.evaluate(() => { const o = document.getElementById('over'); return !!o && !o.hidden && o.offsetParent !== null; });
    if (over) break;
    const e = await page.evaluate(() => { const s = document.querySelector('#oppAva svg.pt'); return s ? (s.dataset.emo || s.getAttribute('data-emo') || s.className.baseVal) : ''; });
    emos.add(e);
    await page.evaluate(() => {
      const vis = e => e && !e.disabled && e.offsetParent !== null;
      const sh = document.querySelector('.sheet:not([hidden]) [data-close]'); if (sh) { sh.click(); return; }
      const off = document.getElementById('offer'); if (off && !off.hidden) { const b = off.querySelector('button:not([disabled])'); if (b) { b.click(); return; } }
      const mains = () => [...document.querySelectorAll('#actMain button')];
      if (!mains().length) return;
      if (!mains().some(vis)) { const pick = document.getElementById('pickBtn'); if (vis(pick)) pick.click(); if (![...document.querySelectorAll('#actMain button')].some(vis)) { const alt = [...document.querySelectorAll('#actAlt button')].find(vis); if (alt) alt.click(); } return; }
      mains().find(vis).click();
    });
    await page.waitForTimeout(70);
  }
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => ({ n: STATS.st().tot.n, xp: PASS.state().xp, over: !document.getElementById('over').hidden, emoDom: !!document.querySelector('#over .pt-over svg.pt, #over svg.pt'), ach: Object.keys(prog().ach || {}).length }));
  expect(after.over, 'экран итога').toBe(true);
  expect(after.n, 'профиль: счётчик партий вырос').toBeGreaterThan(before.n);
  expect(after.xp, 'пропуск: XP начислен').toBeGreaterThan(before.xp);
  expect(after.emoDom, 'портрет на экране итога').toBe(true);
  expect(emos.size, 'эмоции портрета менялись за партию').toBeGreaterThan(1);
  /* меню: пункты от фич добавлены шиной */
  await page.evaluate(() => openMenu());
  const gos = await page.evaluate(() => [...document.querySelectorAll('#menuIn .menugrid [data-go]')].map(b => b.dataset.go));
  for (const k of ['chips', 'pass', 'rogue', 'quick', 'profile']) expect(gos, 'пункт меню ' + k).toContain(k);
  /* menuKey: пункты «Фишки» и «Профиль» открываются */
  await page.evaluate(() => menuGo('chips'));
  expect(await page.locator('.sheet:not([hidden])').count(), 'окно «Фишки»').toBeGreaterThan(0);
  expect(errors, errors.join('\n')).toEqual([]);
  await ctx.close();
});
