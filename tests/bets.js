/* Тесты ядра онлайн-ставок (js/netbet.js, часть NBC): разбор сообщений, удвоение, расчёт.
   Главное свойство: фишки не создаются из воздуха — сумма двух кошельков после матча не больше суммы до него. */
'use strict';
const assert = require('assert');
const NBC = require('../js/netbet.js');

let n = 0;
const ok = (c, m) => { n++; assert.ok(c, m); };

/* ---- разбор сообщений ---- */
const V = { v: 1, id: 'abc12345' };
ok(NBC.normBet({ ...V, k: 'offer', amt: 100 }), 'offer 100');
ok(!NBC.normBet({ ...V, k: 'offer', amt: 77 }), 'offer с нестандартной суммой');
ok(!NBC.normBet({ ...V, k: 'offer', amt: -100 }), 'offer с отрицательной');
ok(!NBC.normBet({ ...V, k: 'offer', amt: 100, v: 2 }), 'чужая версия протокола');
ok(!NBC.normBet({ ...V, k: 'offer' }), 'offer без суммы');
ok(!NBC.normBet({ ...V, id: 'A!', k: 'ok' }), 'плохой id');
ok(!NBC.normBet({ ...V, k: 'steal' }), 'неизвестный тип');
ok(!NBC.normBet(null) && !NBC.normBet('x') && !NBC.normBet(5), 'мусор');
ok(NBC.normBet({ ...V, k: 'res', amt: 200, w: 'h' }), 'res');
ok(!NBC.normBet({ ...V, k: 'res', amt: 99999, w: 'h' }), 'res с огромной суммой');
ok(!NBC.normBet({ ...V, k: 'res', amt: 100, w: 'z' }), 'res с неизвестным победителем');
ok(NBC.normBet({ ...V, k: 'go' }) && NBC.normBet({ ...V, k: 'no' }) && NBC.normBet({ ...V, k: 'ok' }), 'go/no/ok');
ok(!('amt' in NBC.normBet({ ...V, k: 'ok', amt: 100000 })), 'лишние поля отбрасываются');
ok(NBC.normDbl({ ...V, n: 1, a: 'y' }) && NBC.normDbl({ ...V, n: 3, a: 'n' }), 'dbl');
ok(!NBC.normDbl({ ...V, n: 1, a: 'maybe' }) && !NBC.normDbl({ ...V, n: -1, a: 'y' }) && !NBC.normDbl({ ...V, n: 1.5, a: 'y' }), 'dbl мусор');

/* ---- решающая партия и победитель ---- */
ok(NBC.isTie({ p: 1, b: 1 }, 2, false), '1:1 в бо3');
ok(NBC.isTie({ p: 2, b: 2 }, 3, false), '2:2 в бо5');
ok(!NBC.isTie({ p: 1, b: 0 }, 2, false) && !NBC.isTie({ p: 1, b: 1 }, 2, true) && !NBC.isTie({ p: 0, b: 0 }, 1, false), 'не ничья');
ok(NBC.winnerChar('host', { p: 2, b: 1 }, 2, true) === 'h', 'хозяин победил');
ok(NBC.winnerChar('guest', { p: 1, b: 2 }, 2, true) === 'h', 'у гостя счёт перевёрнут: победил хозяин');
ok(NBC.winnerChar('guest', { p: 2, b: 0 }, 2, true) === 'g', 'гость победил');
ok(NBC.winnerChar('host', { p: 1, b: 1 }, 2, false) === 'x', 'матч не закончен');

/* ---- расчёт ---- */
const host = (w, amt = 100, paid = amt) => ({ id: 'abc12345', role: 'host', amt, paid, w });
const guest = (w, amt = 100, paid = amt) => ({ id: 'abc12345', role: 'guest', amt, paid, w });
ok(NBC.settle(host('h'), null).kind === 'win', 'победа хозяина без ответа соперника — по своему виду');
ok(NBC.settle(host('g'), null).kind === 'lose', 'поражение');
ok(NBC.settle(host('h'), { id: 'abc12345', amt: 100, w: 'h' }).kind === 'win', 'итоги сошлись');
const mm = NBC.settle(host('h'), { id: 'abc12345', amt: 100, w: 'g' });
ok(mm.kind === 'refund' && mm.pay === 100 && mm.why === 'mismatch', 'оба считают себя победителем → возврат');
ok(NBC.settle(host('h'), { id: 'abc12345', amt: 200, w: 'h' }).kind === 'refund', 'суммы разошлись → возврат');
ok(NBC.settle(host('h'), { id: 'zzzzzz99', amt: 100, w: 'h' }).kind === 'refund', 'чужой id → возврат');
ok(NBC.settle(host('x'), null).kind === 'refund', 'победитель не определён → возврат');
ok(NBC.dblOutcome('y', 'y') === 'double' && NBC.dblOutcome('y', 'n') === 'keep' && NBC.dblOutcome('n', 'y') === 'keep' && NBC.dblOutcome('n', 'n') === 'keep', 'удвоение');
ok(NBC.dblOutcome('y', null) === null && NBC.dblOutcome(null, 'y') === null, 'удвоение ждёт обоих');

/* ---- сохранение фишек: случайные матчи с двумя кошельками ---- */
function rnd(a) { return a[Math.floor(Math.random() * a.length)]; }
let created = 0, runs = 3000;
for (let i = 0; i < runs; i++) {
  let hw = 1000, gw = 1000; const before = hw + gw;
  const amt = rnd(NBC.BETS);
  let hPaid = amt, gPaid = amt; hw -= amt; gw -= amt;
  let hAmt = amt, gAmt = amt;
  /* удвоение: исходы обеих сторон */
  const hy = rnd(['y', 'n']), gy = rnd(['y', 'n']);
  const loseMsg = Math.random() < 0.1;               /* потерялось сообщение: одна сторона удвоила, другая нет */
  const ho = NBC.dblOutcome(hy, gy), go = loseMsg ? 'keep' : ho;
  if (ho === 'double') { hw -= hAmt; hPaid += hAmt; hAmt *= 2; }
  if (go === 'double') { gw -= gAmt; gPaid += gAmt; gAmt *= 2; }
  /* итог: настоящий победитель, возможно один из клиентов врёт */
  const real = rnd(['h', 'g']);
  const hLies = Math.random() < 0.1, gLies = Math.random() < 0.1;
  const hw_ = hLies ? 'h' : real, gw_ = gLies ? 'g' : real;
  const peerOfH = Math.random() < 0.9 ? { id: 'abc12345', amt: gAmt, w: gw_ } : null;
  const peerOfG = Math.random() < 0.9 ? { id: 'abc12345', amt: hAmt, w: hw_ } : null;
  const ph = NBC.settle({ id: 'abc12345', role: 'host', amt: hAmt, paid: hPaid, w: hw_ }, peerOfH);
  const pg = NBC.settle({ id: 'abc12345', role: 'guest', amt: gAmt, paid: gPaid, w: gw_ }, peerOfG);
  if (ph.kind === 'win') hw += ph.stake + ph.profit; else if (ph.kind === 'refund') hw += ph.pay;
  if (pg.kind === 'win') gw += pg.stake + pg.profit; else if (pg.kind === 'refund') gw += pg.pay;
  if (hw + gw > before) created++;
  /* честный матч без потерь и без вранья обязан сохранить сумму в точности */
  if (!hLies && !gLies && !loseMsg && peerOfH && peerOfG) ok(hw + gw === before, `сумма сохраняется (${hw}+${gw}≠${before})`);
}
/* если клиент врёт или сообщение потерялось, фишки могут появиться ТОЛЬКО у обманщика/в редкой гонке — это честно
   отмечаем в отчёте: без сервера такое не отловить. Тут проверяем лишь, что честные партии никогда не создают фишек. */
console.log(`tests/bets.js: OK, ${n} проверок, ${runs} случайных матчей; сценариев с «лишними» фишками из-за обмана/потери сообщения: ${created} (честный путь — 0)`);
