/* Дурокер — три соперника. Студент ошибается, Дядя Валера играет ровно, Шулер помнит твои карты. */
'use strict';

const BOTS = [
  { id: 'student', name: 'Студент', face: 'СТ', color: '#4f8fd8', level: 'легко',
    desc: 'Ходит что попало, тратит козыри не глядя и иногда берёт, хотя мог отбиться.' },
  { id: 'valera', name: 'Дядя Валера', face: 'ДВ', color: '#d9a03c', level: 'средне',
    desc: 'Сбрасывает мелочь, бережёт козыри, кроет самым дешёвым. Переводит, когда выгодно.' },
  { id: 'sharper', name: 'Шулер', face: 'Ш', color: '#c8402f', level: 'сложно',
    desc: 'Помнит каждую карту, которую ты забрал, ходит тем, чем тебе нечем крыть, и копит джокеров к концу колоды.' },
];
const currentBot = () => BOTS.find(b => b.id === load('durocker-bot')) || BOTS[1];
const oppName = () => (NET ? (NET.oppNick || 'Соперник') : currentBot().name);

/* насколько охотно бот отдаёт эти карты; когда колода кончилась — сбрасывает всё подряд */
function heur(e, noise) {
  const late = !G.deck.length;
  const s = cost(e.cards);
  return late ? e.n * 10 - s * 0.3 + Math.random() * 2
              : e.cards.reduce((a, c) => a + 16 - val(c), 0) + e.n * 2 + Math.random() * (noise || 3);
}
function pickMax(list, score) { let b = null, h = -1e9; for (const e of list) { const v = score(e); if (v > h) { h = v; b = e; } } return b ? { e: b, h } : null; }
const sizesUpTo = m => [1, 2, 3, 4, 5].filter(n => n <= m);
/* Шулер: чем игрок может ответить. Он помнит карты, которые ты забрал со стола,
   а когда колода кончилась, вычисляет твою руку целиком: все карты, которых нет у него, в бито и на столе */
function playerAnswers() {
  const kc = !G.deck.length ? G.P : G.P.filter(c => G.known && G.known.has(c.id));
  const by = {};
  if (kc.length) combos(kc, [1, 2, 3, 4, 5]).forEach(e => (by[e.n] = by[e.n] || []).push(e));
  return by;
}
const canBeat = (by, e) => (by[e.n] || []).some(d => beats(d, e));

function botAttackPick(bot) {
  const list = combos(G.B, sizesUpTo(Math.min(5, G.limit - atkCount(), G.P.length)));
  if (bot.id === 'student') return (pickMax(list, e => heur(e, 30) - e.n * 3) || {}).e;
  if (bot.id === 'sharper') {
    const by = playerAnswers(), late = !G.deck.length;
    return (pickMax(list, e => heur(e) + (canBeat(by, e) ? -25 : late ? 20 : 0) + (e.n >= 3 ? 4 : 0)) || {}).e;
  }
  return (pickMax(list, e => heur(e)) || {}).e;
}
function botThrowPick(bot, forTake) {
  const room = Math.min(5, G.limit - atkCount(), forTake ? 99 : G.P.length);
  if (room < 1) return null;
  if (bot.id === 'student' && Math.random() < 0.5) return null;
  const rs = tableRanks(), late = !G.deck.length;
  const list = combos(G.B, sizesUpTo(room)).filter(e =>
    e.cards.some(c => rs.has(c.r)) && (late || (e.tr === 0 && !e.jk && e.cards.every(c => c.r <= 11))));
  const by = bot.id === 'sharper' && !forTake ? playerAnswers() : null;
  const r = pickMax(list, e => heur(e) + (by ? (canBeat(by, e) ? -14 : late ? 12 : 0) : 0));
  if (!r || (!late && r.h <= 0)) return null;
  return r.e;
}
/* ответ на открытую атаку: покрыть, перевести или взять */
function botDefense(bot) {
  const { cover, transfer } = defenseOptions('b');
  if (bot.id === 'student') {
    if (!cover.length || Math.random() < 0.15) return null;
    return { type: 'play', e: cover[Math.floor(Math.random() * cover.length)] };
  }
  const c = cover[0], t = transfer[0];
  const pricey = c && (c.tr > 0 || c.jk > 0);
  if (t && (!c || pricey || cost(t.cards) + 8 < cost(c.cards))) return { type: 'transfer', e: t };
  if (!c) return null;
  /* Шулер не тратит джокера на мелкую атаку, пока колода толстая */
  if (bot.id === 'sharper' && c.jk && G.deck.length > 14 && openB().a.n <= 2) return null;
  return { type: 'play', e: c };
}

/* карты-действия бота */
const botActs = kind => G.B.filter(c => c.action === kind && checkAction('b', c).ok);
function trumpWorth(c) {
  /* меняем козырь, если в новой масти у бота заметно больше карт, чем в старой */
  const cnt = s => G.B.filter(x => x.s === s && !x.action && !x.joker).length;
  return cnt(c.s) >= cnt(G.T) + 2;
}
function botActionFirst(bot) {
  const k = G.phase.kind, rnd = bot.id === 'student' ? Math.random() < 0.5 : true;
  const only = G.B.every(c => c.action);
  if (k === 'attack' || k === 'throw' || k === 'addtake') {
    const plus = botActs('plus')[0];
    if (plus && rnd && (k !== 'attack' || G.B.length > 1 || only)) return plus;
    const tr = botActs('trump').find(trumpWorth);
    if (tr && rnd) return tr;
    if (k === 'attack' && only) return G.B.find(c => checkAction('b', c).ok) || null;
  }
  return null;
}
function botDefenseAction(bot, d) {
  const sh = botActs('shield'), rv = botActs('reverse');
  const a = openB().a;
  if (!d) return sh[0] || rv[0] || null;
  /* Шулер и Валера бросают щит на дорогую атаку, чтобы не тратить козыри */
  if (bot.id !== 'student' && (d.e.tr > 0 || d.e.jk > 0 || a.n >= 4)) return sh[0] || null;
  return null;
}

/* решение бота: что сделать сейчас. Возвращает [действие, карты, реплика] */
function botDecide(bot) {
  const k = G.phase.kind;
  const first = botActionFirst(bot);
  if (first) return ['action', [first], ACTS[first.action].name + '!'];
  if (k === 'attack') {
    const e = botAttackPick(bot);
    if (e) return ['play', e.cards];
    const any = G.B.find(c => checkAction('b', c).ok);
    return any ? ['action', [any]] : ['pass'];
  }
  if (k === 'throw') {
    const e = botThrowPick(bot, false);
    return e ? ['play', e.cards, 'Подкину'] : ['bito', [], 'Бито'];
  }
  if (k === 'defend') {
    const d = botDefense(bot);
    const ac = botDefenseAction(bot, d);
    if (ac) return ['action', [ac], ACTS[ac.action].name + '!'];
    if (!d) return ['take', [], 'Беру…'];
    if (d.type === 'transfer') return ['transfer', d.e.cards, 'Перевожу!'];
    return ['play', d.e.cards, ['Бью!', 'Покрыл', 'Держи'][Math.floor(Math.random() * 3)]];
  }
  const e = botThrowPick(bot, true);
  return e ? ['play', e.cards, 'Вдогонку!'] : ['enough', []];
}

let botQueued = 0;
function drive() {
  if (NET || !G || G.over || G.busy || G.phase.who !== 'b') return;
  const q = ++botQueued, bot = currentBot();
  run(async () => {
    await wait(bot.id === 'student' ? 650 : 850);
    if (q !== botQueued || G.phase.who !== 'b' || G.busy) return;
    const [type, cards, line] = botDecide(bot);
    if (line) say(line);
    if (type === 'pass') { run(() => endTurn(true)); return; }
    if (!act('b', type, cards)) { console.warn('бот: ход отклонён', type); act('b', G.phase.kind === 'defend' ? 'take' : G.phase.kind === 'throw' ? 'bito' : 'enough'); }
  });
}
