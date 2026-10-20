/* ДурКер — ход партии. Движок крутится в игре с ботом и у хозяина онлайн-стола. */
'use strict';

/* ---------- режим игры: своя игра, карьера, ежедневная раздача ---------- */
let MODE = { kind: 'free' };
const blitzOn = () => load('durocker-blitz') === '1';
/* матч — до N побед в партиях: bo1 (1 победа), bo3 (2), bo5 (3).
   Карьера: соседи bo3, боссы bo5; своя игра и онлайн — выбор игрока (по умолчанию bo3); дейли и босс недели — bo1. */
const boWins = v => (v === 1 ? 1 : v === 5 ? 3 : 2);
const boOf = to => to * 2 - 1;
function matchTo() {
  if (NET) return boWins(NET.bo || +load('durocker-bo-net') || 3);
  if (MODE.kind === 'daily' || MODE.kind === 'weekly' || MODE.kind === 'tutorial') return 1;
  if (MODE.kind === 'career') return currentBot().boss ? 3 : 2;
  return boWins(+load('durocker-bo') || 3);
}
/* сколько побед нужно в текущем матче (фиксируется при начале матча) */
function seriesTo() { return (SERIES && SERIES.to) || matchTo(); }
function turnMs(seat) {
  if (!NET && currentBot().boss === 'taxi' && seat === 'p') return 10000;
  return 30000;
}
/* Блиц — шахматные часы: у каждого 2,5 минуты на всю партию, тикают только в свой ход */
const BLITZ_MS = 150000;
const blitzHere = () => blitzOn() && !(NET && NET.quick) && (!!NET || MODE.kind === 'free');
/* остаток времени seat на часах прямо сейчас */
function clockLeft(seat) {
  const c = G && G.clock;
  if (!c) return 0;
  return Math.max(0, c[seat] - (c.run === seat ? Date.now() - c.since : 0));
}
let clockTimer = null;
function clockSync() {
  const c = G && G.clock;
  if (!c || G.guest) return;
  const now = Date.now();
  if (c.run) { c[c.run] = Math.max(0, c[c.run] - (now - c.since)); }
  const who = !G.over && !G.busy && G.phase.who ? G.phase.who : null;
  c.run = who; c.since = now;
  clearTimeout(clockTimer);
  if (who) {
    const t = TOK;
    clockTimer = setTimeout(() => { if (t === TOK && G.clock && G.clock.run === who && clockLeft(who) <= 0) flagFall(who); }, c[who] + 30);
  }
}
/* флажок упал: время вышло — партия проиграна, штраф по картам, но не меньше 3 */
function flagFall(seat) {
  if (!G || G.over) return;
  clockSync();
  G.clock[seat] = 0; G.clock.run = null;
  finishGame(other(seat), Math.max(3, Math.min(10, H(seat).length)), 'time');
}

/* матч: SERIES.w — победы в партиях, SERIES.to — сколько нужно; p/b — штрафные очки за матч
   (карты на руке проигравшего, «могнул», шулер) — для щелбанов и статистики, исход матча они не решают */
let SERIES = { p: 0, b: 0, w: { p: 0, b: 0 }, to: 2, games: 0, done: false };
const emptySeries = () => ({ p: 0, b: 0, w: { p: 0, b: 0 }, to: matchTo(), games: 0, done: false });
/* старый сохранённый формат (серия до 21 штрафа) — начинаем матч заново */
function normSeries(s) {
  if (!s || typeof s !== 'object' || !s.w || typeof s.w.p !== 'number' || !s.to) return emptySeries();
  return s;
}
function seriesKey() {
  if (NET) return null;
  if (MODE.kind === 'daily' || MODE.kind === 'weekly') return null;
  if (MODE.kind === 'career') return 'durocker-series-career-' + MODE.stage;
  return 'durocker-series-' + currentBot().id + '-bo' + boOf(matchTo()) + (blitzOn() ? '-blitz' : '');
}
function loadSeries() {
  if (NET) { SERIES = NET.series = normSeries(NET.series); return; }
  const k = seriesKey();
  if (!k) { if (!SERIES || SERIES.mode !== 'daily' || SERIES.done) SERIES = { ...emptySeries(), mode: 'daily' }; return; }
  try { SERIES = normSeries(JSON.parse(load(k))); } catch (e) { SERIES = emptySeries(); }
}
function saveSeries() { const k = seriesKey(); if (k) store(k, JSON.stringify(SERIES)); }
function newSeries() { SERIES = MODE.kind === 'daily' ? { ...emptySeries(), mode: 'daily' } : emptySeries(); if (NET) NET.series = SERIES; saveSeries(); }

/* наборы правил: «Классика» — комбинации, подкидывание и перевод; «Полные» — всё.
   В карьере правила открываются по районам: Подъезд — классика без перевода, Двор — +перевод,
   Рынок — +могнул и заряд, Вокзал — +перекрытие и апгрейд, Казино — всё. */
const RULESETS = {
  classic: { transfer: true, mognul: false, charge: false, over: false, upgrade: false, typeThrow: true },
  full:    { transfer: true, mognul: true,  charge: true,  over: true,  upgrade: true,  typeThrow: true },
};
const DISTRICT_RULES = [
  { ...RULESETS.classic, transfer: false },
  { ...RULESETS.classic },
  { ...RULESETS.classic, mognul: true, charge: true },
  { ...RULESETS.full },
  { ...RULESETS.full },
];
/* «Классика» или «Полные» для своей игры и онлайн-стола (выбирает хозяин) */
/* босс недели: «Полные» правила плюс одно особое (номер правила — MODE.rule, оформление — в weekly.js) */
const WEEKLY_RULES = [
  { trumpEvery: true },
  { noSingles: true },
  { jokers: 4 },
  { transfer: false, singleThrow: true },
  { chargeCover: true },
  { hand: 10 },
  { overAny: true },
  { noTrump: true },
];
const ruleSetName = () => (load('durocker-ruleset') === 'classic' ? 'classic' : 'full');
const careerDistrict = () => (MODE.kind === 'career' ? Math.floor((MODE.stage || 0) / 3) : -1);
function tableRules() {
  let base, set;
  if (!NET && MODE.kind === 'career') { set = 'career'; base = DISTRICT_RULES[Math.min(careerDistrict(), DISTRICT_RULES.length - 1)]; }
  else if (!NET && MODE.kind === 'daily') { set = 'full'; base = RULESETS.full; }
  else if (!NET && MODE.kind === 'weekly') { set = 'weekly'; base = { ...RULESETS.full, ...(WEEKLY_RULES[MODE.rule] || {}) }; }
  else { set = ruleSetName(); base = RULESETS[set]; }
  const t = load('durocker-transfer');
  const transferOn = (MODE.kind === 'career' || MODE.kind === 'weekly') && !NET ? true : (t == null ? true : t === '1');
  const r = { ...base, set, transfer: base.transfer && transferOn, blitz: blitzHere() };
  /* Вахтёр: «всё по-старому» — без переводов и без перекрытия */
  if (!NET && currentBot().boss === 'vahter') { r.transfer = false; r.over = false; }
  return r;
}

/* детерминированный генератор для ежедневной раздачи */
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function newGame() {
  if (NET && NET.role === 'guest') return;
  TOK++;
  loadSeries();
  if (SERIES.done) newSeries();
  const rnd = MODE.kind === 'daily' ? seeded(MODE.seed) : Math.random;
  const rules = tableRules();
  HAND = rules.hand || 8;
  const deck = [];
  /* джокеров обычно 2 (52 и 53); босс недели может положить 4 */
  for (let n = 0; n < 52 + (rules.jokers || 2); n++) deck.push(mkCard(n));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  /* под колоду кладём обычную карту, а не джокера: по ней определяется козырь */
  if (deck[0].joker) { const k = deck.findIndex(c => !c.joker); [deck[0], deck[k]] = [deck[k], deck[0]]; }
  G = {
    /* «козырей нет»: козырем считается масть джокеров ★ — то есть козыри только джокеры */
    deck, T: rules.noTrump ? 4 : deck[0].s, trump: deck[0], P: [], B: [], table: [], grave: 0, attacker: 'p', phase: { who: null },
    limit: HAND, sel: new Set(), sort: G ? G.sort : 'r', over: null, busy: true, fx: null, fxList: [], online: !!NET,
    rules, known: new Set(), deadline: 0, extra: { p: 0, b: 0 },
    clock: blitzHere() ? { p: BLITZ_MS, b: BLITZ_MS, run: null, since: Date.now() } : null,
    charge: { p: 0, b: 0 }, offer: { p: null, b: null }, lastSuit: { p: deck[0].s, b: deck[0].s },
    turnNo: 0, turnCovers: 0, chained: false, actSerial: 0,
    stats: { mognul: { p: 0, b: 0 }, transfer: { p: 0, b: 0 }, chain: { p: 0, b: 0 }, best: { p: -1, b: -1 }, turns: 0 },
  };
  $('over').hidden = true;
  commit();
  for (let i = 0; i < HAND; i++) { G.P.push(G.deck.pop()); G.B.push(G.deck.pop()); }
  update(true); sync();
  if (!NET && (currentBot().boss === 'major' || currentBot().boss === 'sharper')) makeOffer('b');
  const low = s => H(s).filter(c => c.s === G.T && c.r <= 14).sort((a, b) => a.r - b.r)[0];
  const lp = low('p'), lb = low('b');
  let first = !lb || (lp && lp.r < lb.r) ? 'p' : 'b';
  /* в матче первый ход чередуется; в решающей партии первым ходит проигравший предыдущую */
  if (SERIES.games > 0 && SERIES.first) {
    first = other(SERIES.first);
    const to = seriesTo(), w = SERIES.w || { p: 0, b: 0 };
    if (w.p === to - 1 && w.b === to - 1 && SERIES.lastLoser) first = SERIES.lastLoser;
  }
  SERIES.first = first; saveSeries();
  const lc = H(first).filter(c => c.s === G.T && c.r <= 14).sort((a, b) => a.r - b.r)[0] || null;
  run(async () => {
    await wait(reduced ? 100 : 1400);
    fx({ what: 'trump', actor: first, kind: 'gold', low: lc ? lc.n : null });
    await wait(1100);
    startTurn(first);
  });
}

function startTurn(who) {
  if (!G || G.over) return; /* G=null — режим сменили до конца раздачи (setMode → карточка правила) */
  G.attacker = who; G.table = []; G.turnCovers = 0; G.chained = false; G.upgraded = false;
  G.turnNo++; G.stats.turns++; G.noTransfer = false;
  G.limit = Math.min(HAND, H(other(who)).length);
  /* Бабка у подъезда: каждый третий ход меняет козырь */
  if (!NET && currentBot().boss === 'babka' && G.turnNo % 3 === 0) {
    const s = [0, 1, 2, 3].filter(x => x !== G.T)[Math.floor(Math.random() * 3)];
    G.T = s;
    fx({ what: 'action', actor: 'b', act: 'trump', s, kind: 'gold' });
    hype('babka', 'b');
  }
  /* босс недели «козырь меняется каждый ход» */
  if (wrule('trumpEvery') && G.turnNo > 1) {
    const s = [0, 1, 2, 3].filter(x => x !== G.T)[Math.floor(Math.random() * 3)];
    G.T = s;
    fx({ what: 'action', actor: 'b', act: 'trump', s, kind: 'gold' });
  }
  G.phase = { who, kind: 'attack' }; G.busy = false;
  commit();
}

/* ---------- заряд: копится за мастерство, полная шкала — выбор действия ---------- */
const CHARGE_MAX = 3;
function addCharge(seat, n) {
  if (!rule('charge') || G.offer[seat]) return;
  G.charge[seat] += n;
  if (G.charge[seat] >= CHARGE_MAX) makeOffer(seat);
}
function makeOffer(seat) {
  if (!rule('charge')) return;
  G.charge[seat] = 0;
  let ks = ACT_KEYS.filter(k => !(k === 'trump' && wrule('noTrump'))).sort(() => Math.random() - 0.5);
  /* козырной щит бьёт любую атаку — предлагаем его вдвое реже */
  if (G.lastSuit[seat] === G.T && Math.random() < 0.5) { const w = ks.filter(k => k !== 'shield'); ks = w.slice(0, 2); }
  else ks = ks.slice(0, 2);
  G.offer[seat] = { kinds: ks, s: G.lastSuit[seat] };
}
function pickAction(seat, kind) {
  const o = G.offer[seat];
  if (!o || !o.kinds.includes(kind)) return false;
  const n = 1000 + (++G.actSerial) * 16 + ACT_KEYS.indexOf(kind) * 4 + o.s;
  H(seat).push(mkCard(n));
  G.offer[seat] = null;
  fx({ what: 'charged', actor: seat, act: kind, s: o.s, kind: 'gold' });
  commit();
  return true;
}
function noteSuit(seat, cs) { const c = cs.filter(x => !x.joker && !x.action).pop(); if (c) G.lastSuit[seat] = c.s; }

/* хайп-событие: фразу показывает интерфейс, движок только отмечает */
function hype(key, actor) { fx({ what: 'hype', key, actor }); }

/* единственная точка изменения партии: seat делает ход type с картами cards */
function act(seat, type, cards) {
  if (type === 'pick') return !G.over && pickAction(seat, cards);
  if (type === 'upgrade') return upgradeAttack(seat, cards || []);
  if (G.busy || G.over || G.phase.who !== seat) return false;
  const k = G.phase.kind, hand = H(seat);
  cards = cards || [];
  if (type === 'play') {
    const r = checkMove(seat, cards);
    if (!r.ok) return false;
    const e = r.e;
    removeFrom(hand, e.cards); forget(e.cards); noteSuit(seat, e.cards);
    if (e.t > G.stats.best[seat]) G.stats.best[seat] = e.t;
    if (k === 'defend') {
      const b = openB(), a = b.a;
      b.d = e;
      fx({ what: 'defend', actor: seat, kind: 'def', big: e.name, t: e.t });
      judgeCover(seat, e, a);
      return afterCover(seat);
    }
    G.table.push({ a: e, d: null });
    if (k === 'addtake') {
      fx({ what: 'addtake', actor: seat, kind: 'take', big: e.name, t: e.t });
      if (atkCount() >= G.limit || !hand.length) { commit(); run(() => endTurn(false)); return true; }
      commit(); return true;
    }
    fx({ what: k, actor: seat, big: e.name, t: e.t });
    G.phase = { who: other(seat), kind: 'defend' };
    commit(); return true;
  }
  if (type === 'action') return playAction(seat, cards[0]);
  if (type === 'transfer') {
    const r = checkTransfer(seat, cards);
    if (!r.ok) return false;
    removeFrom(hand, r.e.cards); forget(r.e.cards); noteSuit(seat, r.e.cards);
    G.table.push({ a: r.e, d: null });
    G.attacker = seat;
    G.limit = Math.min(HAND, H(other(seat)).length);
    G.phase = { who: other(seat), kind: 'defend' };
    G.turnCovers = 0;
    fx({ what: 'transfer', actor: seat, kind: 'gold', big: 'ПЕРЕВОД', t: r.e.t });
    G.stats.transfer[seat]++;
    hype('transfer', seat);
    addCharge(seat, 1);
    commit(); return true;
  }
  if (type === 'bito' && k === 'throw') { run(() => endTurn(true)); return true; }
  if (type === 'take' && k === 'defend') {
    fx({ what: 'takes', actor: seat, kind: 'take' });
    if (atkCount() >= G.limit || !H(G.attacker).length) { commit(); run(() => endTurn(false)); return true; }
    G.phase = { who: G.attacker, kind: 'addtake' };
    commit(); return true;
  }
  if (type === 'enough' && k === 'addtake') { run(() => endTurn(false)); return true; }
  return false;
}

/* оценка покрытия: «могнул», одиночка в масть, цепочка */
function judgeCover(seat, e, a) {
  const att = other(seat);
  G.turnCovers++;
  if (e.n === 1 && e.jk && !a.jk) hype('legend', seat);
  /* «могнул»: покрыл комбинацией старшего типа (на мини-флеш — сетом, на стрит — фулл-хаусом) */
  if (e.n > a.n) {
    /* перекрытие: без штрафа, но атакующему +1 заряда, а новые номиналы открывают подкидывание */
    G.stats.over = (G.stats.over || 0) + 1;
    hype('over', seat);
    addCharge(att, 1);
  } else if (e.n >= 2 && e.t > a.t && rule('mognul')) {
    G.stats.mognul[seat]++;
    SERIES[att] += 1;
    saveSeries();
    hype('mognul', seat);
    addCharge(seat, 1);
  } else if (e.n === 1 && !e.jk && e.cards[0].s === a.cards[0].s && e.cards[0].s !== G.T) {
    addCharge(seat, 1);
  }
  if (G.turnCovers >= 3 && !G.chained) {
    G.chained = true; G.stats.chain[seat]++;
    hype('chain', seat);
    addCharge(seat, 1);
  }
  /* босс недели: каждая отбитая атака даёт заряд */
  if (wrule('chargeCover')) addCharge(seat, 1);
}

function upgradeAttack(seat, cards) {
  const r = checkUpgrade(seat, cards);
  if (!r.ok) return false;
  removeFrom(H(seat), cards); forget(cards); noteSuit(seat, cards);
  const b = openB();
  b.a = r.e; G.upgraded = true;
  if (r.e.t > G.stats.best[seat]) G.stats.best[seat] = r.e.t;
  fx({ what: 'throw', actor: seat, big: 'АПГРЕЙД: ' + r.e.name, t: r.e.t });
  hype('upgrade', seat);
  commit(); return true;
}

function afterCover(seat) {
  if (!H(seat).length || (!openB() && !H(G.attacker).length)) { commit(); run(() => endTurn(true)); return true; }
  G.phase = openB() ? { who: seat, kind: 'defend' } : { who: G.attacker, kind: 'throw' };
  commit(); return true;
}

/* карта-действие */
function playAction(seat, c) {
  const r = checkAction(seat, c);
  if (!r.ok) return false;
  const k = G.phase.kind, opp = other(seat), hand = H(seat);
  removeFrom(hand, [c]); forget([c]);
  fx({ what: 'action', actor: seat, act: c.action, s: c.s, kind: 'gold' });
  if ((c.action === 'shield' || c.action === 'reverse' || (c.action === 'trump' && c.s === G.T)) && k === 'attack') {
    G.grave++; passTurn(seat); return true;
  }
  if (c.action === 'shield') {
    openB().d = { t: -1, n: 1, tr: 0, jk: 0, keys: [], name: 'Щит', cards: [c], shield: true };
    G.turnCovers++;
    return afterCover(seat);
  }
  if (c.action === 'reverse') {
    G.grave++;
    G.attacker = seat;
    G.limit = Math.min(HAND, H(opp).length);
    G.phase = { who: opp, kind: 'defend' };
    G.turnCovers = 0;
    hype('transfer', seat);
    commit(); return true;
  }
  if (c.action === 'plus') {
    G.grave++;
    const n = c.s === G.T ? 3 : 2;
    if (G.deck.length) { for (let i = 0; i < n && G.deck.length; i++) H(opp).push(G.deck.pop()); }
    else G.noTransfer = true;   /* колода пуста: соперник не сможет переводить в этот ход */
    update(true);
  }
  if (c.action === 'trump') {
    G.grave++;
    G.T = c.s;
    /* комбинации на столе пересчитываются под новый козырь */
    G.table.forEach(b => { b.a = ev(b.a.cards) || b.a; if (b.d && !b.d.shield) b.d = ev(b.d.cards) || b.d; });
    G.hintKey = null;
  }
  if (k === 'attack' && !hand.length) { commit(); run(() => endTurn(true)); return true; }
  commit(); return true;
}
/* пас вместо хода: ход переходит сопернику */
function passTurn(seat) {
  G.busy = true; G.phase = { who: null }; commit();
  run(async () => {
    await wait(700);
    refill(seat); refill(other(seat)); update(true); sync();
    await wait(reduced ? 100 : 600);
    if (checkOver()) return;
    startTurn(other(seat));
  });
}

/* Шулер помнит карты, которые ты забрал со стола */
function forget(cs) { if (G.known) cs.forEach(c => G.known.delete(c.id)); }

async function endTurn(defended) {
  G.busy = true; G.phase = { who: null }; commit();
  const att = G.attacker, def = other(att);
  const cards = G.table.flatMap(b => [...b.a.cards, ...(b.d ? b.d.cards : [])]);
  await wait(350);
  if (defended) {
    await flyToGrave();
    G.grave += cards.length; G.table = [];
    if (cards.length) fx({ what: 'bito', actor: att, kind: 'gold' });
    commit();
  } else {
    H(def).push(...cards);
    if (def === 'p' && G.known) cards.forEach(c => G.known.add(c.id));
    if (cards.length >= 6) hype('loaded', att);
    G.table = []; commit();
  }
  await wait(450);
  if (G.over) return;
  refill(att); refill(def);
  update(true); sync();
  await wait(reduced ? 100 : 750);
  if (checkOver()) return;
  startTurn(defended ? def : att);
}

function checkOver() {
  if (G.deck.length) return false;
  /* карты-действия за заряд не держат на руке: остались только они — партию уже можно выиграть */
  const live = h => (rule('charge') ? h.filter(c => !c.action).length : h.length);
  const p0 = !live(G.P), b0 = !live(G.B);
  if (!p0 && !b0) return false;
  const win = p0 && b0 ? 'draw' : p0 ? 'p' : 'b';
  /* больше 10 штрафных за партию не дают, чтобы одна неудачная раздача не убивала серию */
  finishGame(win, win === 'draw' ? 0 : Math.min(10, H(other(win)).length));
  return true;
}
function finishGame(win, pen, why) {
  if (G.clock) clockSync();
  G.over = win; G.overWhy = why || null;
  G.phase = { who: null }; G.busy = false;
  G.penalty = 0;
  if (win !== 'draw') {
    const loser = other(win);
    G.penalty = pen;
    SERIES[loser] += G.penalty;
    SERIES.lastLoser = loser;
    hype(why === 'time' ? 'gg' : G.penalty >= 8 ? 'dry' : 'gg', win);
  }
  SERIES.p += G.extra.p; SERIES.b += G.extra.b;
  SERIES.games++;
  /* ничья партии в матче не засчитывается */
  if (win !== 'draw') { SERIES.w = SERIES.w || { p: 0, b: 0 }; SERIES.w[win]++; }
  if (SERIES.w && (SERIES.w.p >= seriesTo() || SERIES.w.b >= seriesTo())) SERIES.done = true;
  saveSeries();
  if (typeof onGameOver === 'function') onGameOver();
  commit();
}

/* ---------- таймер хода: онлайн (ведёт хозяин) и у босса Таксиста ---------- */
let turnTimer = null;
function armTimer() {
  const online = NET && NET.role === 'host' && NET.connected;
  if (G && G.clock) clockSync();
  const taxi = !NET && G && currentBot().boss === 'taxi' && G.phase.who === 'p';
  /* в Блице ход не ограничен — тикают шахматные часы */
  const live = ((online && !(G && G.clock)) || taxi) && G && !G.busy && !G.over && G.phase.who;
  if (!live) { clearTimeout(turnTimer); if (G) { G.deadline = 0; G.timerKey = null; } return; }
  const key = G.phase.who + G.phase.kind + G.table.length + ':' + G.table.filter(b => b.d).length;
  if (key === G.timerKey) return;
  G.timerKey = key;
  const ms = turnMs(G.phase.who);
  G.deadline = Date.now() + ms; G.turnMs = ms;
  clearTimeout(turnTimer);
  const t = TOK;
  turnTimer = setTimeout(() => { if (t === TOK && G.timerKey === key) autoAct(G.phase.who); }, ms);
}
/* время вышло: самое безопасное действие за игрока */
function autoAct(seat) {
  if (!G || G.busy || G.over || G.phase.who !== seat) return;
  const k = G.phase.kind;
  if (k === 'defend') act(seat, 'take');
  else if (k === 'throw') act(seat, 'bito');
  else if (k === 'addtake') act(seat, 'enough');
  else if (k === 'attack') {
    const h = H(seat).slice().sort((a, b) => val(a) - val(b));
    for (const c of h) if (c.action ? act(seat, 'action', [c]) : act(seat, 'play', [c])) break;
  }
}

/* после каждого изменения: таймер, перерисовка, отправка гостю, ход бота */
function commit() { armTimer(); update(); sync(); botPick(); drive(); showOver(); }
