/* Копирует сайт ДурКера (../index.html, css, js, assets, manifest, sw.js) в native/www — это webDir для Capacitor.
   Запуск: node scripts/copy-web.js   (или npm run copy-web) */
'use strict';
const fs = require('fs'), path = require('path');
const SRC = path.resolve(__dirname, '..', '..'), DST = path.resolve(__dirname, '..', 'www');
const ITEMS = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'assets'];
fs.rmSync(DST, { recursive: true, force: true });
fs.mkdirSync(DST, { recursive: true });
let n = 0;
for (const it of ITEMS) {
  const from = path.join(SRC, it);
  if (!fs.existsSync(from)) { console.warn('нет:', it); continue; }
  fs.cpSync(from, path.join(DST, it), { recursive: true, filter: f => { if (fs.statSync(f).isFile()) n++; return true; } });
}
console.log(`скопировано файлов: ${n} → ${path.relative(process.cwd(), DST) || DST}`);
