/* Тест шины событий: порядок событий, изоляция ошибок, хуки, menuKey, match:over.
   Запуск: node tests/bus.js */
const vm = require('vm'), fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'bus.js'), 'utf8');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('FAIL:', m); } else console.log('ok  ', m); };

function world() {
  const log = [];
  const ctx = { console: { warn: () => { ctx.warns++; }, log, error() {} }, warns: 0 };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  /* заглушки игры: функции-объявления (как в настоящих скриптах) и let-глобалы */
  vm.runInContext(`
    let G = { over: 'p', penalty: 3 }, MODE = { kind: 'free' }, SERIES = { done: false, w: { p: 0, b: 0 }, to: 2 }, NET = null;
    const trace = [];
    function newGame() { trace.push('newGame'); return 'ng'; }
    function onGameOver() { trace.push('onGameOver'); return 'go'; }
    function showOver() { trace.push('showOver'); }
    function showFx(o) { trace.push('showFx:' + o.what); }
    function openMenu() { trace.push('openMenu'); }
    function menuGo(k) { trace.push('menuGo:' + k); return 'mg'; }
    function currentBot() { return { id: 'orig' }; }
    function seriesTo() { return SERIES.to; }
    function matchTo() { return 2; }
  `, ctx);
  vm.runInContext(src + '\nthis.BUS = BUS;', ctx);
  return ctx;
}
const run = (c, code) => vm.runInContext(code, c);

/* 1. порядок: before → оригинал → after, одна обёртка на функцию */
{
  const c = world(), order = [];
  c.BUS.on('game:start:before', () => order.push('before'));
  c.BUS.on('game:start', d => order.push('after:' + d.ret));
  c.BUS.on('game:start', () => order.push('after2'));
  const r = run(c, 'newGame()');
  ok(r === 'ng', 'возвращаемое значение сохраняется');
  ok(order.join() === 'before,after:ng,after2', 'порядок событий: ' + order.join());
  ok(run(c, 'trace.join()') === 'newGame', 'оригинал вызван один раз');
  ok(run(c, 'newGame.__bus') === true && run(c, 'newGame.__orig.__bus') !== true, 'ровно одна обёртка');
}
/* 2. ошибка подписчика не ломает игру */
{
  const c = world(); let after = 0;
  c.BUS.on('game:over', () => { throw new Error('boom'); });
  c.BUS.on('game:over', () => { after++; });
  const r = run(c, 'onGameOver()');
  ok(r === 'go' && after === 1 && c.warns === 1, 'ошибка подписчика изолирована');
}
/* 3. данные событий */
{
  const c = world(); let d1, d2, d3;
  c.BUS.on('game:over', d => { d1 = d; });
  c.BUS.on('fx', d => { d2 = d; });
  c.BUS.on('menu:go', d => { d3 = d; });
  run(c, 'onGameOver(); showFx({what:"defend",key:"k",actor:"b"}); menuGo("x")');
  ok(d1 && d1.won === true && d1.penalty === 3 && d1.series, 'game:over: won/penalty/series');
  ok(d2 && d2.what === 'defend' && d2.who === 'b' && d2.o.key === 'k', 'fx: what/who/o');
  ok(d3 && d3.key === 'x', 'menu:go: key');
}
/* 4. match:over */
{
  const c = world(); let m = null;
  c.BUS.on('match:over', d => { m = d; });
  run(c, 'onGameOver()');
  ok(m === null, 'match:over не срабатывает, пока серия не закончена');
  run(c, 'SERIES.done = true; SERIES.w.p = 2; onGameOver()');
  ok(m && m.won === true && m.bot.id === 'orig', 'match:over после победы в серии');
  m = null;
  run(c, 'SERIES.w.p = 0; SERIES.w.b = 2; onGameOver()');
  ok(m && m.won === false, 'match:over при поражении');
  m = null;
  run(c, 'NET = { role: "guest" }; onGameOver()');
  ok(m === null, 'гость match:over не получает');
}
/* 5. хуки: цепочка, подмена аргументов, откат при ошибке */
{
  const c = world();
  c.BUS.hook('currentBot', next => { const b = next(); return { ...b, a: 1 }; });
  c.BUS.hook('currentBot', next => { const b = next(); return { ...b, b: 2 }; });
  ok(run(c, 'JSON.stringify(currentBot())') === '{"id":"orig","a":1,"b":2}', 'цепочка хуков');
  c.BUS.hook('matchTo', next => 7);
  ok(run(c, 'matchTo()') === 7, 'хук может заменить результат');
  c.BUS.hook('menuGo', (next, a) => next(['y']));
  ok(run(c, 'menuGo("x")') === 'mg' && run(c, 'trace.slice(-1)[0]') === 'menuGo:y', 'хук подменяет аргументы');
  const c2 = world();
  c2.BUS.hook('currentBot', () => { throw new Error('bad'); });
  c2.BUS.hook('currentBot', next => ({ ...next(), ok: 1 }));
  ok(run(c2, 'currentBot().ok') === 1 && c2.warns === 1, 'внутренний хук упал до next() — пропускается, внешний работает');
  const c3 = world();
  c3.BUS.hook('currentBot', next => ({ ...next(), ok: 1 }));
  c3.BUS.hook('currentBot', () => { throw new Error('bad'); });
  ok(run(c3, 'currentBot().ok') === 1 && c3.warns === 1, 'внешний хук упал — внутренний всё равно применён');
}
/* 6. menuKey */
{
  const c = world(); let hit = 0;
  c.BUS.menuKey('mine', () => { hit++; });
  run(c, 'menuGo("mine")');
  ok(hit === 1 && run(c, 'trace.length') === 0, 'menuKey перехватывает пункт и не вызывает оригинал');
  ok(run(c, 'menuGo("other")') === 'mg', 'другие пункты идут в оригинал');
}
/* 7. off, отсутствующие функции */
{
  const c = world(); let n = 0; const f = () => { n++; };
  c.BUS.on('hud:render', f); c.BUS.off('hud:render', f);
  ok(n === 0, 'off снимает подписчика (renderHUD ещё не определена — не падаем)');
  c.BUS.on('menu:open', () => { n++; });
  run(c, 'openMenu()');
  ok(n === 1, 'menu:open');
  c.BUS.emit('custom', {}); ok(true, 'emit без подписчиков безопасен');
  ok(c.BUS.events().includes('match:over') && c.BUS.events().includes('fx'), 'список событий');
}
console.log(fails ? `\nПровалено: ${fails}` : '\nOK');
process.exit(fails ? 1 : 0);
