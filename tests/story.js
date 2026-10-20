/* Тест сюжета и памяти соперников: полнота досье, выбор реплик, отношения, награды.
   Запуск: node tests/story.js */
const vm = require('vm'), fs = require('fs'), path = require('path');
const R = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('FAIL:', m); } else console.log('ok  ', m); };

const botSrc = R('js/bot.js'), weeklySrc = R('js/weekly.js');
const careerIds = [...botSrc.matchAll(/id: '(c-[a-z]+)'/g)].map(m => m[1]);
const bossIds = [...weeklySrc.matchAll(/id: '(w-[a-z]+)'/g)].map(m => m[1]);
const neighbors = [...botSrc.matchAll(/\{ id: '(c-[a-z]+)'[^}]*?(boss:)?/g)];

function world() {
  const store = {}, unl = [], toasts = [];
  const ctx = { console, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } } };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  ctx.unl = unl; ctx.toasts = toasts;
  vm.runInContext(`
    const CAREER_OPS = ${JSON.stringify([...botSrc.matchAll(/\{ id: '(c-[a-z]+)'[^}]*?\}/g)].map(m => ({ id: m[1], boss: /boss:/.test(m[0]) })))};
    let NET = null, MODE = { kind: 'career', stage: 0 };
    let SERIES = { done: false, w: { p: 0, b: 0 }, to: 2 };
    function unlock(k, id) { unl.push(k + ':' + id); return true; }
    function toast(t) { toasts.push(t); }
    function seriesTo() { return SERIES.to; }
    function currentBot() { return { id: 'c-tolik' }; }
    const BUS = { on() {}, hook() {}, menuKey() {} };
  `, ctx);
  vm.runInContext(R('js/story-data.js') + '\n' + R('js/story.js') + '\nthis.STORY = STORY; this.DATA = STORY_DATA;', ctx);
  return ctx;
}
const w = world(), ST = w.STORY, D = w.DATA;

/* --- 1. полнота данных --- */
ok(careerIds.length === 15, `в карьере 15 соперников (нашлось ${careerIds.length})`);
ok(bossIds.length === 8, `8 боссов недели (нашлось ${bossIds.length})`);
const need = ['neutral', 'friend', 'grudge', 'revenge', 'cocky', 'gameWin', 'gameLose', 'matchWin', 'dry', 'close', 'matchWinFriend', 'matchLose', 'matchLoseFriend'];
for (const [a, set] of Object.entries(D.ARCH)) ok(need.every(k => Array.isArray(set[k]) && set[k].length >= 4), `характер «${a}»: по 4+ реплик на каждую из ${need.length} ситуаций`);
for (const id of [...careerIds, ...bossIds, 'student', 'valera', 'sharper']) {
  const d = D.DOSSIER[id];
  ok(d && D.ARCH[d.arch] && d.nick && d.bio && d.manner && d.hates && d.weak && d.meet && d.meet.length >= 1 && d.quip && d.quip.length >= 1, `досье ${id} заполнено`);
}
for (const id of careerIds) for (const sit of ['grudge', 'matchWin', 'matchLose', 'revenge', 'cocky', 'friend', 'neutral', 'gameWin', 'gameLose'])
  if (ST.pool(id, sit).length < 6) { ok(false, `${id}/${sit}: меньше 6 реплик (${ST.pool(id, sit).length})`); }
ok(true, 'у каждого соперника карьеры ≥6 реплик на каждую ситуацию');
ok(D.DISTRICTS.length === 5 && D.DISTRICTS.every(d => d.intro.length >= 3) && D.FINALE.length >= 3, 'сюжет: 5 районов (вступление ≥3 экранов) и финал');
const allText = JSON.stringify(D);
ok(!/undefined|\[object/.test(allText), 'в данных нет undefined/[object]');
ok(!/\{[a-z]+\}/.test(allText.replace(/\{(n|w|l|last|name)\}/g, '')), 'подстановки только известные: {n} {w} {l} {last} {name}');

/* --- 2. ситуации перед матчем --- */
ST._reset();
ok(ST.sitBefore('c-tolik') === 'meet', 'первая встреча → meet');
ST.recordMatch('c-tolik', { won: false, w: 0, b: 2, lim: 2 });
ok(ST.sitBefore('c-tolik') === 'cocky', 'игрок проиграл → соперник хвастается (cocky)');
ST.recordMatch('c-tolik', { won: true, w: 2, b: 0, lim: 2 });
ok(ST.mem('c-tolik').lastDry === true && ST.mem('c-tolik').last === '2:0', 'последний счёт 2:0, всухую');
ST.recordMatch('c-patsan', { won: true, w: 2, b: 0, lim: 2 });
ok(ST.sitBefore('c-patsan') === 'revenge' || ST.mem('c-patsan').rel > 0, 'холодный после разгрома: реванш/злость');
ok(ST.mem('c-patsan').rel === -1, 'разгром холодного: отношение −1');
ok(ST.mem('c-tolik').rel >= 1, 'добрый Толик от разгрома и поражения игрока добреет');

/* --- 3. отношение ограничено −5…+5 --- */
for (let i = 0; i < 20; i++) ST.recordMatch('c-sharper', { won: true, w: 2, b: 0, lim: 2 });
ok(ST.mem('c-sharper').rel === -5, 'отношение не ниже −5');
for (let i = 0; i < 20; i++) ST.recordMatch('c-valera', { won: false, w: 0, b: 2, lim: 2 });
ok(ST.mem('c-valera').rel === 5, 'отношение не выше +5');
ok(ST.relLabel(-5) === 'Заклятый враг' && ST.relLabel(0) === 'Знакомый' && ST.relLabel(5) === 'Приятель', 'подписи отношения');
ok(ST.sitBefore('c-valera') === 'cocky', 'если игрок проиграл — приоритет у cocky даже у приятеля');
ST.recordMatch('c-valera', { won: true, w: 2, b: 1, lim: 2 });
ok(ST.sitBefore('c-valera') === 'friend', 'приятель после победы игрока → friend');

/* --- 4. ситуации после --- */
ok(ST.sitAfter({ draw: true }) === null, 'ничья без реплики');
ok(ST.sitAfter({ gameWon: true, matchDone: false }) === 'gameWin' && ST.sitAfter({ gameWon: false, matchDone: false }) === 'gameLose', 'партия внутри матча');
ok(ST.sitAfter({ matchDone: true, match: { won: true, dry: true }, rel: 0 }) === 'dry', 'всухую');
ok(ST.sitAfter({ matchDone: true, match: { won: true, close: true }, rel: 0 }) === 'close', 'на волоске');
ok(ST.sitAfter({ matchDone: true, match: { won: true }, rel: 3 }) === 'matchWinFriend', 'победа над приятелем');
ok(ST.sitAfter({ matchDone: true, match: { won: false }, rel: 0 }) === 'matchLose' && ST.sitAfter({ matchDone: true, match: { won: false }, rel: 4 }) === 'matchLoseFriend', 'поражение (обычное/от приятеля)');

/* --- 5. реплики: без повторов подряд, подстановки --- */
ST._reset();
ST.recordMatch('c-babka', { won: false, w: 1, b: 2, lim: 2 });
let prev = '', rep = 0;
for (let i = 0; i < 300; i++) { const l = ST.pickLine('c-babka', 'cocky'); if (l === prev) rep++; prev = l; }
ok(rep === 0, 'реплика не повторяется два раза подряд (300 выборов)');
ok(!ST.pickLine('c-babka', 'cocky', 0.3).includes('{'), 'подстановки заменены');
ok(ST.sub('прошлый {last}, ты {w}:{l}', 'c-babka') === 'прошлый 1:2, ты 0:1', 'подстановка {last} {w} {l}');
const seen = new Set(); ST._reset(); for (let i = 0; i < 200; i++) seen.add(ST.pickLine('c-tolik', 'matchWin')); 
ok(seen.size >= 6, `разнообразие: ≥6 разных реплик «победа игрока» у Толика (${seen.size})`);

/* --- 6. награды за дружбу --- */
w.localStorage.setItem('durker-story', '{}'); ST._reset();
const ns = vm.runInContext('CAREER_OPS.filter(o => !o.boss).map(o => o.id)', w);
ok(ns.length === 10, `10 соседей (не боссов): ${ns.length}`);
ns.slice(0, 2).forEach(id => { ST.mem(id).rel = 5; });
ST.checkRewards(); ok(!w.unl.includes('back:st-friend'), '2 приятеля — награды ещё нет');
ST.mem(ns[2]).rel = 5; ST.checkRewards(); ok(w.unl.includes('back:st-friend'), '3 приятеля — рубашка «Друг двора»');
ok(!w.unl.includes('back:st-all'), 'все 10 — ещё нет');
ns.forEach(id => { ST.mem(id).rel = 5; }); ST.checkRewards(); ok(w.unl.includes('back:st-all'), 'все 10 соседей +5 — рубашка «Свой в каждом дворе»');

/* --- 7. сохранение --- */
ST.save(); const raw = JSON.parse(w.localStorage.getItem('durker-story'));
ok(raw && raw.opp && raw.opp[ns[0]].rel === 5, 'память сохраняется в localStorage');

console.log(fails ? `\n${fails} FAIL` : '\nOK');
process.exit(fails ? 1 : 0);
