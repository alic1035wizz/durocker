/* Дурокер — ход партии. Движок крутится у игры с ботом и у хозяина онлайн-стола. */
'use strict';

function newGame() {
  if (NET && NET.role === 'guest') return;
  TOK++;
  const deck = [];
  for (let n = 0; n < 52; n++) deck.push(mkCard(n));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  G = {
    deck, T: deck[0].s, trump: deck[0], P: [], B: [], table: [], grave: 0, attacker: 'p', phase: { who: null },
    limit: HAND, sel: new Set(), sort: G ? G.sort : 'r', over: null, busy: true, fx: null, online: !!NET,
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
  if (type === 'play') {
    const r = checkMove(seat, cards || []);
    if (!r.ok) return false;
    const e = r.e;
    removeFrom(hand, e.cards);
    if (k === 'defend') {
      openB().d = e;
      fx({ what: 'defend', actor: seat, kind: 'def', big: e.name, t: e.t });
      if (!hand.length || !H(G.attacker).length) { commit(); run(() => endTurn(true)); return true; }
      G.phase = { who: G.attacker, kind: 'throw' };
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
    H(def).push(...cards); G.table = []; commit();
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
  if (NET) { const k = G.over === 'p' ? 'w' : G.over === 'b' ? 'l' : 'd'; NET.score[k] = (NET.score[k] || 0) + 1; }
  else if (G.over !== 'draw') { score[G.over === 'p' ? 'w' : 'l']++; store('durocker-score', JSON.stringify(score)); }
  commit();
  return true;
}

/* после каждого изменения: перерисовать, отправить гостю, дать боту походить */
function commit() { update(); sync(); drive(); showOver(); }
