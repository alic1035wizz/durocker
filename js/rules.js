/* Дурокер — правила: колода, комбинации, кто кого бьёт, перевод.
   Общие глобальные переменные игры тоже живут здесь. */
'use strict';

const SU = ['♠', '♥', '♦', '♣', '★'];
/* типы комбинаций; внутри одного числа карт старше тот, у кого больше индекс */
const TYPES = [
  { name: 'Одиночка', n: 1 },
  { name: 'Пара', n: 2 },
  { name: 'Мини-флеш', n: 3 },
  { name: 'Мини-стрит', n: 3 },
  { name: 'Сет', n: 3 },
  { name: 'Мини-стрит-флеш', n: 3 },
  { name: 'Две пары', n: 4 },
  { name: 'Каре', n: 4 },
  { name: 'Стрит', n: 5 },
  { name: 'Флеш', n: 5 },
  { name: 'Фулл-хаус', n: 5 },
  { name: 'Стрит-флеш', n: 5 },
];
const TN = TYPES.map(t => t.name);
const HAND = 8;
const DECK = 54;          // 52 карты + 2 джокера
const JOKER_R = 15;
const TURN_MS = 30000;    // ход онлайн
const SERIES_TO = 21;     // штрафных очков до проигрыша серии

const $ = id => document.getElementById(id);
const rn = r => (r === JOKER_R ? '★' : ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[r] || String(r));
const other = s => (s === 'p' ? 'b' : 'p');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* карта — число 0..53: 0..51 обычные (масть = n/13, ранг = n%13 + 2), 52 и 53 — джокеры */
const mkCard = n => (n >= 52 ? { n, r: JOKER_R, s: 4, id: 'c' + n, joker: true } : { n, r: n % 13 + 2, s: Math.floor(n / 13), id: 'c' + n });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = n => (n === 1 ? 'карта' : n < 5 ? 'карты' : 'карт');
const cardName = c => (c.joker ? 'джокер' : rn(c.r) + SU[c.s]);

/* G — партия; 'p' — ты (или хозяин стола), 'b' — соперник (бот или гость) */
let G, TOK = 0, NET = null, fxId = 0;

function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

/* таймеры, которые умирают при новой партии */
function wait(ms) { const t = TOK; return new Promise((res, rej) => setTimeout(() => (t === TOK ? res() : rej('stale')), ms)); }
function run(f) { f().catch(e => { if (e !== 'stale') console.error(e); }); }

const myNick = () => (load('durocker-nick') || 'Игрок').slice(0, 16);

/* ---------- оценка комбинаций ---------- */
function straightHigh(cs) {
  const n = cs.length, rs = [...new Set(cs.map(c => c.r))].sort((a, b) => a - b);
  if (rs.length !== n) return 0;
  if (rs[n - 1] - rs[0] === n - 1) return rs[n - 1];
  if (rs.includes(14)) {
    const lo = rs.map(r => (r === 14 ? 1 : r)).sort((a, b) => a - b);
    if (lo[n - 1] - lo[0] === n - 1) return lo[n - 1];
  }
  return 0;
}
/* оценка без джокеров */
function evPlain(cs) {
  const n = cs.length, byR = {};
  cs.forEach(c => (byR[c.r] = (byR[c.r] || 0) + 1));
  const g = Object.entries(byR).map(([r, k]) => [+r, k]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const tr = cs.filter(c => c.s === G.T).length;
  const fl = n >= 3 && cs.every(c => c.s === cs[0].s), sh = n >= 3 ? straightHigh(cs) : 0;
  const desc = () => cs.map(c => c.r).sort((a, b) => b - a);
  const mk = (t, keys) => ({ t, keys, n, tr, jk: 0, name: TN[t] });
  if (n === 1) return mk(0, [cs[0].r]);
  if (n === 2) return g[0][1] === 2 ? mk(1, [g[0][0]]) : null;
  if (n === 3) {
    if (fl && sh) return mk(5, [sh]);
    if (g[0][1] === 3) return mk(4, [g[0][0]]);
    if (sh) return mk(3, [sh]);
    if (fl) return mk(2, desc());
    return null;
  }
  if (n === 4) {
    if (g[0][1] === 4) return mk(7, [g[0][0]]);
    if (g.length === 2 && g[0][1] === 2) return mk(6, [g[0][0], g[1][0]]);
    return null;
  }
  if (n === 5) {
    if (fl && sh) return mk(11, [sh]);
    if (g[0][1] === 3 && g[1] && g[1][1] === 2) return mk(10, [g[0][0], g[1][0]]);
    if (fl) return mk(9, desc());
    if (sh) return mk(8, [sh]);
  }
  return null;
}
/* сравнение комбинаций одного размера: тип, потом козыри, потом ранги, потом меньше джокеров */
function cmpE(a, b) {
  if (a.t !== b.t) return a.t - b.t;
  if (a.tr !== b.tr) return a.tr - b.tr;
  for (let i = 0; i < a.keys.length; i++) if (a.keys[i] !== b.keys[i]) return a.keys[i] - b.keys[i];
  return b.jk - a.jk;
}
/* полная оценка: джокер сам становится картой, которая делает комбинацию сильнее всего */
function ev(cs) {
  const n = cs.length;
  if (!n || n > 5) return null;
  const jokers = cs.filter(c => c.joker), real = cs.filter(c => !c.joker);
  if (!jokers.length) { const e = evPlain(cs); if (e) e.cards = cs; return e; }
  if (n === 1) return { t: 0, keys: [13.5], n: 1, tr: 1, jk: 1, name: 'Одиночка', cards: cs };
  const R = new Set([14, 13]), S = new Set([G.T]);
  real.forEach(c => { for (let d = -4; d <= 4; d++) { const r = c.r + d; if (r >= 2 && r <= 14) R.add(r); } S.add(c.s); });
  if (real.some(c => c.r <= 5)) R.add(14);
  const opts = [];
  R.forEach(r => S.forEach(s => opts.push({ r, s })));
  const used = new Set(real.map(c => c.r * 10 + c.s));
  let best = null;
  const rec = (i, acc) => {
    if (i === jokers.length) {
      const e = evPlain(real.concat(acc));
      if (e && (!best || cmpE(e, best) > 0)) best = e;
      return;
    }
    for (const o of opts) {
      const k = o.r * 10 + o.s;
      if (used.has(k)) continue;
      used.add(k); acc.push(o); rec(i + 1, acc); acc.pop(); used.delete(k);
    }
  };
  rec(0, []);
  if (!best) return null;
  best.jk = jokers.length; best.cards = cs;
  return best;
}

/* d кроет a? Одиночка — как в обычном дураке; одиночный джокер — старший козырь, его бьёт только козырной туз */
function singleVal(e) { const c = e.cards[0]; return c.joker ? { r: 13.5, s: G.T } : { r: c.r, s: c.s }; }
function beats(d, a) {
  if (!d || !a || d.n !== a.n) return false;
  if (d.n === 1) {
    const x = singleVal(d), y = singleVal(a);
    return (x.s === y.s && x.r > y.r) || (x.s === G.T && y.s !== G.T);
  }
  return cmpE(d, a) > 0;
}
/* перевод: тот же тип и то же старшинство */
function sameRank(e, a) {
  if (!e || !a || e.n !== a.n || e.t !== a.t) return false;
  return e.keys.every((k, i) => k === a.keys[i]);
}

/* ---------- состояние стола ---------- */
const H = s => (s === 'p' ? G.P : G.B);
const val = c => (c.joker ? 30 : c.r + (c.s === G.T ? 14 : 0));
const cost = cs => cs.reduce((s, c) => s + val(c), 0);
const atkCount = () => G.table.reduce((s, b) => s + b.a.n, 0);
const openB = () => G.table.find(b => !b.d) || null;
const noneDefended = () => G.table.length > 0 && G.table.every(b => !b.d);
function tableRanks() {
  const s = new Set();
  G.table.forEach(b => { b.a.cards.forEach(c => s.add(c.r)); if (b.d) b.d.cards.forEach(c => s.add(c.r)); });
  return s;
}
function removeFrom(h, cs) { const ids = new Set(cs.map(c => c.id)); for (let i = h.length - 1; i >= 0; i--) if (ids.has(h[i].id)) h.splice(i, 1); }
function refill(s) { const h = H(s); while (h.length < HAND && G.deck.length) h.push(G.deck.pop()); }

/* ---------- проверка хода ---------- */
function checkMove(seat, cs) {
  if (G.over || G.busy || G.phase.who !== seat || !cs.length) return { ok: false, e: null };
  const k = G.phase.kind, e = ev(cs);
  if (!e) return { ok: false, e, why: 'Не комбинация' };
  if (k === 'defend') {
    const a = openB().a;
    if (e.n !== a.n) return { ok: false, e, why: `Нужно ${a.n} ${plural(a.n)}` };
    return beats(e, a) ? { ok: true, e, why: 'Бьёт!' } : { ok: false, e, why: 'Не бьёт' };
  }
  if (k !== 'attack' && !e.cards.some(c => tableRanks().has(c.r))) return { ok: false, e, why: 'Номинала нет на столе' };
  const room = G.limit - atkCount();
  if (e.n > room) return { ok: false, e, why: room ? `Влезет ещё ${room} ${plural(room)}` : 'Стол полон' };
  const oh = H(other(seat)).length;
  if (k !== 'addtake' && e.n > oh) return { ok: false, e, why: `У соперника ${oh} ${plural(oh)}` };
  return { ok: true, e, why: k === 'attack' ? 'Можно ходить' : 'Можно подкинуть' };
}
/* можно ли перевести этими картами */
function checkTransfer(seat, cs) {
  if (!G.rules || !G.rules.transfer) return { ok: false };
  if (G.over || G.busy || G.phase.who !== seat || G.phase.kind !== 'defend' || !cs.length || !noneDefended()) return { ok: false };
  const e = ev(cs), a = G.table[0].a;
  if (!sameRank(e, a)) return { ok: false };
  const next = H(other(seat)).length;
  if (atkCount() + e.n > Math.min(HAND, next)) return { ok: false, e, why: 'У соперника не хватит карт на перевод' };
  return { ok: true, e, why: 'Можно перевести!' };
}

/* все ответы на открытую атаку: чем покрыть и чем перевести */
function defenseOptions(seat) {
  const b = openB();
  if (!b) return { cover: [], transfer: [] };
  const hand = H(seat), a = b.a;
  const cover = combos(hand, [a.n]).filter(e => beats(e, a)).sort((x, y) => cost(x.cards) - cost(y.cards));
  let transfer = [];
  if (G.rules && G.rules.transfer && noneDefended()) {
    const next = H(other(seat)).length;
    if (atkCount() + a.n <= Math.min(HAND, next))
      transfer = combos(hand, [a.n]).filter(e => sameRank(e, G.table[0].a)).sort((x, y) => cost(x.cards) - cost(y.cards));
  }
  return { cover, transfer };
}
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

/* словами: чем можно покрыть атаку */
function coverRule(a) {
  if (a.n === 1) {
    const c = a.cards[0];
    if (c.joker) return 'Джокера бьёт только козырной туз.';
    if (c.s === G.T) return `Козырную ${cardName(c)} бьёт только козырь старше.`;
    return `${cardName(c)} бьют старшей картой ${SU[c.s]} или любым козырем.`;
  }
  const higher = TYPES.map((t, i) => ({ ...t, i })).filter(t => t.n === a.n && t.i > a.t).map(t => t.name.toLowerCase());
  let s = `${a.n} ${plural(a.n)}: ${a.name.toLowerCase()} старше`;
  if (a.tr < a.n) s += ' или с козырем';
  if (higher.length) s += `, либо ${higher.join(', ')}`;
  return s + '.';
}
