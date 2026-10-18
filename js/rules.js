/* Дурокер — правила: колода, комбинации, кто кого бьёт.
   Общие глобальные переменные игры тоже живут здесь. */
'use strict';

const SU = ['♠', '♥', '♦', '♣'];
const TN = ['Одиночка', 'Пара', 'Две пары', 'Сет', 'Стрит', 'Флеш', 'Фулл-хаус', 'Каре', 'Стрит-флеш'];
/* порядок полосок «силы» на панели: по числу карт, потом по старшинству */
const LADDER = [0, 1, 3, 2, 7, 4, 5, 6, 8];
const HAND = 8;

const $ = id => document.getElementById(id);
const rn = r => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' })[r] || String(r);
const other = s => (s === 'p' ? 'b' : 'p');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
/* карта кодируется числом 0..51: масть = n/13, ранг = n%13 + 2 */
const mkCard = n => ({ n, r: n % 13 + 2, s: Math.floor(n / 13), id: 'c' + n });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const plural = n => (n === 1 ? 'карта' : n < 5 ? 'карты' : 'карт');

/* G — состояние партии; 'p' — ты (или хозяин стола), 'b' — соперник (бот или гость) */
let G, TOK = 0, NET = null, fxId = 0, score = { w: 0, l: 0 };

function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
try { score = JSON.parse(load('durocker-score')) || score; } catch (e) {}

/* таймеры, которые умирают при новой партии */
function wait(ms) { const t = TOK; return new Promise((res, rej) => setTimeout(() => (t === TOK ? res() : rej('stale')), ms)); }
function run(f) { f().catch(e => { if (e !== 'stale') console.error(e); }); }

const myNick = () => (load('durocker-nick') || 'Игрок').slice(0, 16);
const oppName = () => (NET ? (NET.oppNick || 'Соперник') : 'Дядя Валера');

function straightHigh(cs) {
  const rs = [...new Set(cs.map(c => c.r))].sort((a, b) => a - b);
  if (rs.length !== 5) return 0;
  if (rs[4] - rs[0] === 4) return rs[4];
  if (rs.join() === '2,3,4,5,14') return 5;
  return 0;
}

/* оценка набора карт: тип комбинации, ключи старшинства, число козырей */
function ev(cs) {
  const n = cs.length;
  if (!n || n > 5) return null;
  const byR = {};
  cs.forEach(c => (byR[c.r] = (byR[c.r] || 0) + 1));
  const g = Object.entries(byR).map(([r, k]) => [+r, k]).sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const tr = cs.filter(c => c.s === G.T).length;
  const mk = (t, keys) => ({ t, keys, n, tr, name: TN[t], cards: cs });
  if (n === 1) return mk(0, [cs[0].r]);
  if (n === 2) return g[0][1] === 2 ? mk(1, [g[0][0]]) : null;
  if (n === 3) return g[0][1] === 3 ? mk(3, [g[0][0]]) : null;
  if (n === 4) {
    if (g[0][1] === 4) return mk(7, [g[0][0]]);
    if (g.length === 2 && g[0][1] === 2) return mk(2, [g[0][0], g[1][0]]);
    return null;
  }
  const fl = cs.every(c => c.s === cs[0].s), sh = straightHigh(cs);
  if (fl && sh) return mk(8, [sh]);
  if (g[0][1] === 3 && g[1] && g[1][1] === 2) return mk(6, [g[0][0], g[1][0]]);
  if (fl) return mk(5, cs.map(c => c.r).sort((a, b) => b - a));
  if (sh) return mk(4, [sh]);
  return null;
}

/* d кроет a? Одиночка — как в обычном дураке, комбинации — тип, потом козыри, потом ранги */
function beats(d, a) {
  if (!d || !a || d.n !== a.n) return false;
  if (d.n === 1) {
    const x = d.cards[0], y = a.cards[0];
    return (x.s === y.s && x.r > y.r) || (x.s === G.T && y.s !== G.T);
  }
  if (d.t !== a.t) return d.t > a.t;
  if (d.tr !== a.tr) return d.tr > a.tr;
  for (let i = 0; i < d.keys.length; i++) if (d.keys[i] !== a.keys[i]) return d.keys[i] > a.keys[i];
  return false;
}

const H = s => (s === 'p' ? G.P : G.B);
const val = c => c.r + (c.s === G.T ? 14 : 0);
const atkCount = () => G.table.reduce((s, b) => s + b.a.n, 0);
const openB = () => { const b = G.table[G.table.length - 1]; return b && !b.d ? b : null; };
function tableRanks() {
  const s = new Set();
  G.table.forEach(b => { b.a.cards.forEach(c => s.add(c.r)); if (b.d) b.d.cards.forEach(c => s.add(c.r)); });
  return s;
}
function removeFrom(h, cs) { const ids = new Set(cs.map(c => c.id)); for (let i = h.length - 1; i >= 0; i--) if (ids.has(h[i].id)) h.splice(i, 1); }
function refill(s) { const h = H(s); while (h.length < HAND && G.deck.length) h.push(G.deck.pop()); }

/* проверка хода для места за столом: и подсказки в интерфейсе, и проверка гостя у хозяина */
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
