/* ДурКер — запуск */
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
tgStart(() => {
  const sp = new URLSearchParams(location.search), hostCode = sp.get('h'), code = startCode();
  const back = hostCode && loadHost(hostCode);
  if (back) { hostTable(back); return; }
  if (!maybeRuleCard(newGame)) newGame();
  if (code) {
    /* пришёл по ссылке друга — сразу за его стол */
    store('durocker-seen', '1');
    $('lobby').hidden = false; renderLobby();
    $('codeIn').value = code;
    joinTable();
    return;
  }
  setUrl(null);
  /* первый визит — сразу меню, чтобы было видно карьеру и режимы */
  if (!load('durocker-seen')) { store('durocker-seen', '1'); TUT.offer(); }
});
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
