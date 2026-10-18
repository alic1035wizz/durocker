/* Дурокер — запуск */
'use strict';
/* продолжаем там, где остановились: своя игра или карьера */
try {
  const m = JSON.parse(load('durocker-mode'));
  if (m && m.kind === 'career' && m.stage <= prog().career) MODE = m;
} catch (e) {}
applyLooks();
bindUI();
startBackground();
requestAnimationFrame(tickTimer);
newGame();
/* первый визит — сразу меню, чтобы было видно карьеру и режимы */
if (!load('durocker-seen')) { store('durocker-seen', '1'); openMenu(); }
