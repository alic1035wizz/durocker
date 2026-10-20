/* ДурКер — всё, ради чего хочется вернуться: хайп-фразы, прогресс, карьера, ежедневная раздача,
   достижения и коллекция наград. Хранится на устройстве (localStorage). */
'use strict';

/* ---------- хайп-фразы: [ты сделал, сделали тебе]; мат под звёздочками, есть чистая версия ---------- */
const HYPE = {
  upgrade:  { rude: ['ДОЛОЖИЛ, Б**ТЬ', 'ОН ДОКИНУЛ, С*КА'], clean: ['АПГРЕЙД!', 'ОН ДОЛОЖИЛ'] },
  over:     { rude: ['ЗАДАВИЛ ПО-КРУПНОМУ, Б**ТЬ', 'СВЕРХУ ПРИЛЕТЕЛО, С*КА'], clean: ['ПЕРЕБИЛ ПО-КРУПНОМУ', 'НА ТЕБЕ СВЕРХУ'] },
  mognul:   { rude: ['МОГНУЛ, Б**ТЬ!', 'ТЕБЯ МОГНУЛИ'],        clean: ['МОГНУЛ!', 'ТЕБЯ МОГНУЛИ'] },
  transfer: { rude: ['ЛОВИ ОБРАТКУ, С*КА', 'ПРИЛЕТЕЛО, Б**ТЬ'],  clean: ['ЛОВИ ОБРАТКУ', 'ПРИЛЕТЕЛО ОБРАТНО'] },
  chain:    { rude: ['НЕПРОБИВАЕМЫЙ ×3', 'ОН КАК Х*ЕВА СТЕНА'],  clean: ['НЕПРОБИВАЕМЫЙ ×3', 'ОН КАК СТЕНА'] },
  loaded:   { rude: ['ЗАБИРАЙ, ДРУЖОК', 'НАГРУЗИЛИ ПО ПОЛНОЙ'],  clean: ['ЗАБИРАЙ, ДРУЖОК', 'НАГРУЗИЛИ'] },
  gg:       { rude: ['ГГ ВП', 'ДУРАК, ЧЁ'],                      clean: ['ГГ ВП', 'ДУРАК, ЧЁ'] },
  dry:      { rude: ['ВСУХУЮ, Е**ТЬ!!!', 'РАЗМАЗАЛИ НАХ*Й'],     clean: ['ВСУХУЮ!!!', 'РАЗМАЗАЛИ'] },
  legend:   { rude: ['ЛЕГЕНДА', 'ДА Л*ДНО, Б**?!'],              clean: ['ЛЕГЕНДА', 'ДА ЛАДНО?!'] },
  babka:    { rude: ['', 'БАБКА МЕНЯЕТ КОЗЫРЬ, Б**ТЬ'],          clean: ['', 'БАБКА МЕНЯЕТ КОЗЫРЬ'] },
};
const rudeOn = () => load('durocker-rude') !== '0';
function hypeText(key, mine) { const h = HYPE[key]; if (!h) return ''; return (rudeOn() ? h.rude : h.clean)[mine ? 0 : 1]; }

/* ---------- прогресс ---------- */
const PROG_KEY = 'durocker-progress';
let PROG = null;
function prog() {
  if (PROG) return PROG;
  try { PROG = JSON.parse(load(PROG_KEY)) || {}; } catch (e) { PROG = {}; }
  PROG = Object.assign({ games: 0, wins: 0, mognul: 0, ach: {}, career: 0, careerDone: false, daily: {}, friends: {},
    unlocked: { back: ['red'], table: ['felt'], track: ['lounge'] }, back: 'red', track: 'lounge' }, PROG);
  /* награды пропуска: рамки аватара, титулы, наборы фраз «могнул» — у старых сохранений этих списков ещё нет */
  ['frame', 'title'].forEach(k => { if (!Array.isArray(PROG.unlocked[k])) PROG.unlocked[k] = []; });
  if (!Array.isArray(PROG.unlocked.mog)) PROG.unlocked.mog = ['std'];
  if (PROG.frame === undefined) PROG.frame = '';
  if (PROG.title === undefined) PROG.title = '';
  if (!PROG.mog) PROG.mog = 'std';
  return PROG;
}
function saveProg() { store(PROG_KEY, JSON.stringify(PROG)); }

/* уровни подсказок: новичок → игрок → профи; можно выбрать вручную */
function hintLevel() {
  const m = load('durocker-hints') || 'auto';
  if (m !== 'auto') return m;
  const g = prog().games;
  return g < 5 ? 'novice' : g < 20 ? 'player' : 'pro';
}

/* ---------- награды ---------- */
const BACKS = [
  { id: 'red', name: 'Классика' }, { id: 'blue', name: 'Синяя' }, { id: 'khokh', name: 'Хохлома' },
  { id: 'neonb', name: 'Неон' }, { id: 'gold', name: 'Золото' }, { id: 'skull', name: 'Пиксель-череп' },
];
const TRACKS = [{ id: 'lounge', name: 'Казино-лаунж' }, { id: 'night', name: 'Ночной рынок' }, { id: 'garage', name: 'Гараж' }];
function unlock(kind, id) {
  const p = prog();
  if (!Array.isArray(p.unlocked[kind])) p.unlocked[kind] = [];
  if (!p.unlocked[kind].includes(id)) { p.unlocked[kind].push(id); saveProg(); return true; }
  return false;
}

/* наборы фраз «могнул» (то, что кричит игра, когда могнул ТЫ); открываются в пропуске сезона */
const MOGNUL_SETS = [
  { id: 'std', name: 'Классика', rude: 'МОГНУЛ, Б**ТЬ!', clean: 'МОГНУЛ!' },
  { id: 'pacan', name: 'Пацанский', rude: 'ПО ФАКТУ, Б**ТЬ!', clean: 'ПО ФАКТУ, БРАТ!' },
  { id: 'intel', name: 'Интеллигент', rude: 'ПАРДОН, Б**ТЬ, ВЫ МОГНУТЫ', clean: 'ПАРДОН, ВЫ МОГНУТЫ' },
  { id: 'kosmos', name: 'Космос', rude: 'ПОЕХАЛИ, С*КА! 🚀', clean: 'ПОЕХАЛИ! 🚀' },
  { id: 'strim', name: 'Стример', rude: 'КЛИП, Б**ТЬ! КЛИП!', clean: 'КЛИП! ЭТО КЛИП!' },
];
function applyMognul() {
  const m = MOGNUL_SETS.find(x => x.id === prog().mog) || MOGNUL_SETS[0];
  HYPE.mognul.rude[0] = m.rude; HYPE.mognul.clean[0] = m.clean;
}

/* ---------- достижения ---------- */
const ACHS = [
  { id: 'first', name: 'Первая кровь', desc: 'Выиграть первую партию', reward: { back: 'blue' } },
  { id: 'mognul', name: 'Могильщик', desc: 'Могнуть 10 раз (всего)', reward: { back: 'khokh' } },
  { id: 'dry', name: 'Всухую', desc: 'Победить, когда у соперника 8+ карт', reward: { back: 'skull' } },
  { id: 'pingpong', name: 'Пинг-понг', desc: '3 перевода за партию', reward: null },
  { id: 'wall', name: 'Стена', desc: 'Отбить 3 атаки за один ход', reward: { track: 'garage' } },
  { id: 'jewel', name: 'Ювелир', desc: 'Сыграть стрит-флеш', reward: null },
  { id: 'sharper', name: 'Шулера не обманешь', desc: 'Выиграть матч у Шулера', reward: { back: 'gold' } },
  { id: 'regular', name: 'Завсегдатай', desc: 'Сыграть ежедневную раздачу 3 дня', reward: { back: 'neonb' } },
  { id: 'career', name: 'С подъезда в казино', desc: 'Пройти карьеру', reward: { table: 'gold' } },
  { id: 'blitz', name: 'Молния', desc: 'Выиграть матч в Блице', reward: null },
];
function grant(id) {
  const p = prog();
  if (p.ach[id]) return;
  p.ach[id] = Date.now();
  const a = ACHS.find(x => x.id === id);
  if (a && a.reward) Object.entries(a.reward).forEach(([k, v]) => unlock(k, v));
  saveProg();
  toast(`🏆 ${a.name}${a.reward ? ' — открыта награда' : ''}`);
}

/* ---------- конец партии: статистика, достижения, карьера, ежедневная ---------- */
function onGameOver() {
  if (NET && NET.role === 'guest') return;
  if (!NET) store('durocker-live', '');
  const p = prog(), won = G.over === 'p';
  p.games++; if (won) p.wins++;
  p.mognul += G.stats.mognul.p;
  if (won) grant('first');
  if (p.mognul >= 10) grant('mognul');
  if (won && G.penalty >= 8) grant('dry');
  if (G.stats.transfer.p >= 3) grant('pingpong');
  if (G.stats.chain.p) grant('wall');
  if (G.stats.best.p >= 11) grant('jewel');
  if (NET && NET.oppNick) {
    const f = p.friends[NET.oppNick] || (p.friends[NET.oppNick] = { w: 0, l: 0 });
    if (won) f.w++; else if (G.over === 'b') f.l++;
  }
  if (MODE.kind === 'daily') {
    p.daily[MODE.day] = { won, mognul: G.stats.mognul.p, turns: G.stats.turns, left: G.P.length, penalty: G.penalty || 0 };
    if (Object.keys(p.daily).length >= 3) grant('regular');
  }
  if (SERIES.done && SERIES.w && SERIES.w.p >= seriesTo()) {
    /* игрок выиграл матч */
    const bot = currentBot();
    if (!NET && bot.ai === 'sharper' && (bot.boss === 'sharper' || bot.id === 'sharper')) grant('sharper');
    if (!NET && blitzOn() && MODE.kind === 'free') grant('blitz');
    if (MODE.kind === 'career' && MODE.stage === p.career) {
      const d = CAREER[bot.district];
      p.career++;
      if (bot.boss && d.reward) Object.entries(d.reward).forEach(([k, v]) => { if (unlock(k, v)) toast(`🎁 Район «${d.name}» пройден — новая награда`); });
      if (p.career >= CAREER_OPS.length) { p.careerDone = true; grant('career'); }
    }
  }
  saveProg();
}

/* ---------- ежедневная раздача ---------- */
function todayKey() {
  const d = new Date(Date.now() + 3 * 3600 * 1000); /* день по Москве */
  return d.toISOString().slice(0, 10);
}
function dailyNumber(day) { return Math.floor((Date.parse(day) - Date.parse('2026-10-18')) / 86400000) + 1; }
function dailySeed(day) { let h = 2166136261; for (const ch of 'durocker' + day) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function dailyCard(day) {
  const r = prog().daily[day];
  if (!r) return '';
  return `ДурКер #${dailyNumber(day)} ${r.won ? '✅ не дурак' : '🃏 дурак'}\nмогнул ×${r.mognul} · ходов ${r.turns}${r.won ? '' : ` · осталось ${r.left}`}\nalic1035wizz.github.io/durocker`;
}

/* ---------- всплывашка ---------- */
/* Очередь компактных всплывашек: не больше двух сразу, по тапу закрываются, пока открыт итог — ждут. */
const TQ = []; let TACT = 0, toastW = 0;
function toastBusy() {
  try {
    const ov = document.getElementById('over');
    if (ov && !ov.hidden && ov.offsetParent !== null) return true;
    return !!document.querySelector('#m4over .m4over');
  } catch (e) { return false; }
}
function toast(t, ms, o) {
  const box = $('toast'); if (!box || !t) return;
  if (TQ.some(x => x.t === t) || [...box.children].some(c => c.dataset.t === t)) return;
  TQ.push({ t, ms: ms ? Math.min(ms, 3600) : 2200, ach: !!(o && o.ach), at: Date.now() });
  toastPump();
}
function toastPump() {
  const box = $('toast'); if (!box) return;
  clearTimeout(toastW);
  while (TQ.length && Date.now() - TQ[0].at > 20000) TQ.shift();
  if (!TQ.length) return;
  if (toastBusy()) { toastW = setTimeout(toastPump, 450); return; }
  while (TACT < 2 && TQ.length) {
    const x = TQ.shift(), el = document.createElement('div');
    el.className = 'tpill' + (x.ach ? ' ach' : ''); el.dataset.t = x.t; el.setAttribute('role', 'status');
    el.textContent = x.t;
    box.hidden = false; box.appendChild(el); TACT++;
    let gone = false;
    const done = () => { if (gone) return; gone = true; el.remove(); TACT = Math.max(0, TACT - 1); if (!box.children.length) box.hidden = true; toastPump(); };
    el.addEventListener('click', done);
    setTimeout(done, x.ms * (typeof animK === 'function' && animK() === 0 ? 0.8 : 1));
  }
}

/* ---------- применить выбранную рубашку и трек ---------- */
function applyLooks() {
  const p = prog();
  document.documentElement.dataset.back = p.back;
  applyMognul();
  if (typeof AU !== 'undefined' && AU.setTrack) AU.setTrack(p.track);
}


/* ---------- честность: выход посреди партии = поражение ----------
   При раздаче партии с ботом ставим флаг «партия идёт». Партия закончилась — флаг снимает onGameOver.
   Флаг остался (обновил страницу, ушёл в другой режим) — при следующей раздаче засчитываем проигранную партию
   со штрафом 10. Дейли засчитывается сразу при старте: повторно её не сыграть. */
const LIVE_GRACE = 1500; /* двойной вызов newGame подряд (карточка правила и т.п.) за выход не считаем */
function settleAbandoned() {
  let f = null;
  try { f = JSON.parse(load('durocker-live')); } catch (e) {}
  if (!f || typeof f !== 'object') return false;
  store('durocker-live', '');
  if (Date.now() - (f.t || 0) < LIVE_GRACE && f.kind !== 'daily') return false;
  const p = prog();
  p.games++;
  if (f.key) {
    try {
      const raw = load(f.key);
      const s = raw ? JSON.parse(raw) : { p: 0, b: 0, w: { p: 0, b: 0 }, to: f.to || 2, games: 0, done: false };
      if (s && s.w && typeof s.w.b === 'number' && !s.done) {
        s.b = (s.b || 0) + 10; s.games = (s.games || 0) + 1; s.w.b++;
        if (s.w.b >= (s.to || 2)) s.done = true;
        store(f.key, JSON.stringify(s));
      }
    } catch (e) {}
  }
  if (f.kind === 'daily' && f.day) p.daily[f.day] = { won: false, mognul: 0, turns: 0, left: 8, penalty: 10, fled: true };
  saveProg();
  setTimeout(() => toast('Выход посреди партии — засчитано поражение', 4500), 300);
  return true;
}
function markLive() {
  if (NET || !G || G.over || !MODE || MODE.kind === 'tutorial') return;
  let key = null;
  try { key = seriesKey(); } catch (e) {}
  store('durocker-live', JSON.stringify({ kind: MODE.kind, stage: MODE.stage, day: MODE.day, key, to: (typeof matchTo === 'function' ? matchTo() : 2), bot: currentBot().id, t: Date.now() }));
}
(() => {
  if (typeof newGame !== 'function') return;
  const _ng = newGame;
  newGame = function () {
    if (!(typeof NET !== 'undefined' && NET)) {
      settleAbandoned();
      /* дейли — одна попытка: если сегодня уже начинал, вместо неё — своя игра */
      if (MODE && MODE.kind === 'daily') {
        const p = prog();
        if (p.daily[MODE.day]) {
          MODE = { kind: 'free' };
          setTimeout(() => toast('Ежедневная раздача — одна попытка в день. Это «Своя игра»', 4000), 300);
        } else {
          p.daily[MODE.day] = { won: false, mognul: 0, turns: 0, left: 8, penalty: 10, live: true };
          saveProg();
        }
      }
    }
    const r = _ng.apply(this, arguments);
    try { markLive(); } catch (e) {}
    return r;
  };
})();
/* обучение посреди партии не считается бегством: снимаем флаг, когда урок стартует */
if (typeof addEventListener === 'function') addEventListener('load', () => {
  try {
    if (typeof TUT !== 'undefined' && TUT && TUT.start) {
      const _ts = TUT.start;
      TUT.start = function () { store('durocker-live', ''); return _ts.apply(this, arguments); };
    }
  } catch (e) {}
});
