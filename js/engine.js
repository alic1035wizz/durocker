/* Дурокер — ход партии. Движок крутится в игре с ботом и у хозяина онлайн-стола. */
'use strict';

/* серия: штрафные очки = карты, оставшиеся у проигравшего; кто набрал 21 — проиграл серию */
let SERIES = { p: 0, b: 0, games: 0, done: false };
function seriesKey() { return 'durocker-series-' + (NET ? 'net' : currentBot().id); }
function loadSeries() {
  if (NET) { SERIES = NET.series || (NET.series = { p: 0, b: 0, games: 0, done: false }); return; }
  try { SERIES = JSON.parse(load(seriesKey())) || { p: 0, b: 0, games: 0, done: false }; } catch (e) { SERIES = { p: 0, b: 0, games: 0, done: false }; }
}
function saveSeries() { if (!NET) store(seriesKey(), JSON.stringify(SERIES)); }
function newSeries() { SERIES = { p: 0, b: 0, games: 0, done: false }; if (NET) NET.series = SERIES; saveSeries(); }

function tableRules() {
  const t = load('durocker-transfer');
  return { transfer: t == null ? true : t === '1' };
}

function newGame() {
  if (NET && NET.role === 'guest') return;
  TOK++;
  loadSeries();
  if (SERIES.done) newSeries();
  const deck = [];
  for (let n = 0; n < DECK; n++) deck.push(mkCard(n));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  /* под колоду кладём обычную карту, а не джокера: по ней определяется козырь */
  if (deck[0].joker) { const k = deck.findIndex(c => !c.joker); [deck[0], deck[k]] = [deck[k], deck[0]]; }
  G = {
    deck, T: deck[0].s, trump: deck[0], P: [], B: [], table: [], grave: 0, attacker: 'p', phase: { who: null },
    limit: HAND, sel: new Set(), sort: G ? G.sort : 'r', over: null, busy: true, fx: null, online: !!NET,
    rules: tableRules(), known: new Set(), deadline: 0,
  };
  $('over').hidden = true;
  commit();
  for (let i = 0; i < HAND; i++) { G.P.push(G.deck.pop()); G.B.push(G.deck.pop()); }
  update(true); sync();
  const low = s => H(s).filter(c => c.s === G.T).sort((a, b) => a.r - b.r)[0];
  const lp = low('p'), lb = low('b');
  const first = !lb || (lp && lp.r < lb.r) ? 'p' : 'b';
  const lc = first === 'p' ? lp : lb;
  run(async () => {
    await wait(reduced ? 100 : 1400);
    fx({ what: 'trump', actor: first, kind: 'gold', low: lc ? lc.n : null });
    await wait(1100);
    startTurn(first);
  });
}

function startTurn(who) {
  G.attacker = who; G.table = [];
  G.limit = Math.min(HAND, H(other(who)).length);
  G.phase = { who, kind: 'attack' }; G.busy = false;
  commit();
}

/* единственная точка изменения партии: seat делает ход type с картами cards */
function act(seat, type, cards) {
  if (G.busy || G.over || G.phase.who !== seat) return false;
  const k = G.phase.kind, hand = H(seat);
  cards = cards || [];
  if (type === 'play') {
    const r = checkMove(seat, cards);
    if (!r.ok) return false;
    const e = r.e;
    removeFrom(hand, e.cards); forget(e.cards);
    if (k === 'defend') {
      openB().d = e;
      fx({ what: 'defend', actor: seat, kind: 'def', big: e.name, t: e.t });
      if (!hand.length || (!openB() && !H(G.attacker).length)) { commit(); run(() => endTurn(true)); return true; }
      G.phase = openB() ? { who: seat, kind: 'defend' } : { who: G.attacker, kind: 'throw' };
      commit(); return true;
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
  if (type === 'transfer') {
    const r = checkTransfer(seat, cards);
    if (!r.ok) return false;
    removeFrom(hand, r.e.cards); forget(r.e.cards);
    G.table.push({ a: r.e, d: null });
    G.attacker = seat;
    G.limit = Math.min(HAND, H(other(seat)).length);
    G.phase = { who: other(seat), kind: 'defend' };
    fx({ what: 'transfer', actor: seat, kind: 'gold', big: 'ПЕРЕВОД', t: r.e.t });
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
    G.table = []; commit();
  }
  await wait(450);
  refill(att); refill(def);
  update(true); sync();
  await wait(reduced ? 100 : 750);
  if (checkOver()) return;
  startTurn(defended ? def : att);
}

function checkOver() {
  if (G.deck.length) return false;
  const p0 = !G.P.length, b0 = !G.B.length;
  if (!p0 && !b0) return false;
  G.over = p0 && b0 ? 'draw' : p0 ? 'p' : 'b';
  G.phase = { who: null };
  G.penalty = 0;
  if (G.over !== 'draw') {
    const loser = other(G.over);
    G.penalty = H(loser).length;
    SERIES[loser] += G.penalty;
  }
  SERIES.games++;
  if (SERIES.p >= SERIES_TO || SERIES.b >= SERIES_TO) SERIES.done = true;
  saveSeries();
  commit();
  return true;
}

/* ---------- таймер хода онлайн (ведёт хозяин стола) ---------- */
let turnTimer = null;
function armTimer() {
  const live = NET && NET.role === 'host' && NET.connected && G && !G.busy && !G.over && G.phase.who;
  if (!live) { clearTimeout(turnTimer); G && (G.deadline = 0); if (G) G.timerKey = null; return; }
  const key = G.phase.who + G.phase.kind + G.table.length + ':' + G.table.filter(b => b.d).length;
  if (key === G.timerKey) return;
  G.timerKey = key;
  G.deadline = Date.now() + TURN_MS;
  clearTimeout(turnTimer);
  const t = TOK;
  turnTimer = setTimeout(() => { if (t === TOK && G.timerKey === key) autoAct(G.phase.who); }, TURN_MS);
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
    for (const c of h) if (act(seat, 'play', [c])) break;
  }
}

/* после каждого изменения: таймер, перерисовка, отправка гостю, ход бота */
function commit() { armTimer(); update(); sync(); drive(); showOver(); }
