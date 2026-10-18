/* Дурокер — бот «Дядя Валера»: сбрасывает мелочь, бережёт козыри, кроет самым дешёвым. */
'use strict';

function combos(hand, sizes) {
  const out = [], L = hand.length, pick = [];
  for (const n of sizes) {
    if (n < 1 || n > L || (n === 5 && L > 24)) continue;
    const rec = (st, d) => {
      if (d === n) { const e = ev(pick.slice(0, n)); if (e) out.push(e); return; }
      for (let i = st; i <= L - (n - d); i++) { pick[d] = hand[i]; rec(i + 1, d + 1); }
    };
    rec(0, 0);
  }
  return out;
}

/* чем выше, тем охотнее бот отдаёт эти карты; когда колода кончилась — сбрасывает всё подряд */
function heur(e) {
  const late = !G.deck.length;
  const s = e.cards.reduce((a, c) => a + val(c), 0);
  return late ? e.n * 10 - s * 0.3 + Math.random() * 2
              : e.cards.reduce((a, c) => a + 16 - val(c), 0) + e.n * 2 + Math.random() * 3;
}
function pickMax(list) { let b = null, h = -1e9; for (const e of list) { const v = heur(e); if (v > h) { h = v; b = e; } } return b ? { e: b, h } : null; }
const sizesUpTo = m => [1, 2, 3, 4, 5].filter(n => n <= m);

function botAttackPick() {
  const r = pickMax(combos(G.B, sizesUpTo(Math.min(5, G.limit - atkCount(), G.P.length))));
  return r && r.e;
}
function botThrowPick(forTake) {
  const room = Math.min(5, G.limit - atkCount(), forTake ? 99 : G.P.length);
  if (room < 1) return null;
  const rs = tableRanks(), late = !G.deck.length;
  const list = combos(G.B, sizesUpTo(room)).filter(e =>
    e.cards.some(c => rs.has(c.r)) && (late || (e.tr === 0 && e.cards.every(c => c.r <= 11))));
  const r = pickMax(list);
  if (!r || (!late && r.h <= 0)) return null;
  return r.e;
}
function botDefendPick(a) {
  const cost = e => e.cards.reduce((s, c) => s + val(c), 0);
  const l = combos(G.B, [a.n]).filter(e => beats(e, a)).sort((x, y) => cost(x) - cost(y));
  return l[0] || null;
}

let botQueued = 0;
function drive() {
  if (NET || !G || G.over || G.busy || G.phase.who !== 'b') return;
  const q = ++botQueued;
  run(async () => {
    await wait(820);
    if (q !== botQueued || G.phase.who !== 'b' || G.busy) return;
    const k = G.phase.kind;
    if (k === 'attack') {
      const e = botAttackPick();
      if (e) act('b', 'play', e.cards); else run(() => endTurn(true));
    } else if (k === 'throw') {
      const e = botThrowPick(false);
      if (e) { say('Подкину'); act('b', 'play', e.cards); } else { say('Бито'); act('b', 'bito'); }
    } else if (k === 'defend') {
      const e = botDefendPick(openB().a);
      if (e) { say(['Бью!', 'Покрыл', 'Держи'][Math.floor(Math.random() * 3)]); act('b', 'play', e.cards); }
      else { say('Беру…'); act('b', 'take'); }
    } else if (k === 'addtake') {
      const e = botThrowPick(true);
      if (e) { say('Вдогонку!'); act('b', 'play', e.cards); } else act('b', 'enough');
    }
  });
}
