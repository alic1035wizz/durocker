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
  if (!p.unlocked[kind].includes(id)) { p.unlocked[kind].push(id); saveProg(); return true; }
  return false;
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
let toastT;
function toast(t, ms) {
  const el = $('toast'); if (!el) return;
  el.textContent = t; el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, ms || 3200);
}

/* ---------- применить выбранную рубашку и трек ---------- */
function applyLooks() {
  const p = prog();
  document.documentElement.dataset.back = p.back;
  if (typeof AU !== 'undefined' && AU.setTrack) AU.setTrack(p.track);
}
