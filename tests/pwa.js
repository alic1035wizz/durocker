/* ДурКер — проверка PWA: каждый css/js, подключённый в index.html, есть в sw.js CORE; манифест и иконки на месте.
   Запуск: node tests/pwa.js */
'use strict';
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const html = read('index.html'), sw = read('sw.js');
let bad = 0;
const fail = m => { bad++; console.log('ОШИБКА:', m); };

/* список CORE: вычисляем сам массив из sw.js */
const m = sw.match(/const CORE = ([\s\S]*?\]);\s*\nself/);
if (!m) { console.log('не нашёл CORE в sw.js'); process.exit(1); }
const core = new Function('return ' + m[1])();

const local = [];
for (const r of html.matchAll(/<(?:script src|link [^>]*href)="([^"]+)"/g)) {
  const u = r[1];
  if (/^(https?:)?\/\//.test(u)) continue;
  if (/\.(css|js)$/.test(u)) local.push(u);
}
local.forEach(u => { if (!core.includes(u)) fail(`${u} подключён в index.html, но его нет в sw.js CORE`); });
core.forEach(u => { if (u !== './' && !fs.existsSync(path.join(root, u))) fail(`${u} есть в CORE, но файла нет`); });
if (!/const CACHE = 'durker-w\d+/.test(sw)) fail('имя кэша в sw.js нужно в формате durker-wN');

/* манифест */
const man = JSON.parse(read('manifest.webmanifest'));
(man.icons || []).forEach(i => { if (!fs.existsSync(path.join(root, i.src))) fail('иконка манифеста не найдена: ' + i.src); });
if (!(man.icons || []).some(i => /maskable/.test(i.purpose || ''))) fail('нет maskable-иконки');
(man.shortcuts || []).forEach(s => { if (!s.name || !s.url) fail('ярлык без name/url'); (s.icons || []).forEach(i => { if (!fs.existsSync(path.join(root, i.src))) fail('иконка ярлыка не найдена: ' + i.src); }); });
if (!(man.shortcuts || []).length) fail('в манифесте нет shortcuts');
console.log(`CORE: ${core.length} файлов, подключено в index.html: ${local.length}, ярлыков: ${(man.shortcuts || []).length}`);
if (bad) { console.log('FAIL'); process.exit(1); }
console.log('OK');
