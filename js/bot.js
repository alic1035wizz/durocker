/* Дурокер — соперники. Студент ошибается, Дядя Валера играет ровно, Шулер просчитывает ходы вперёд.
   ai — базовый уровень (student / valera / sharper), style — характер, который меняет решения, peek — подглядывание. */
'use strict';

/* ai — как играет (student / valera / sharper), boss — особое правило босса */
const BOTS = [
  { id: 'student', ai: 'student', name: 'Студент', face: 'СТ', color: '#4f8fd8', level: 'легко',
    desc: 'Ходит что попало, тратит козыри не глядя и иногда берёт, хотя мог отбиться.' },
  { id: 'valera', ai: 'valera', name: 'Дядя Валера', face: 'ДВ', color: '#d9a03c', level: 'средне',
    desc: 'Сбрасывает мелочь, бережёт козыри, кроет самым дешёвым. Переводит, когда выгодно.' },
  { id: 'sharper', ai: 'sharper', style: 'sharper', peek: 'always', name: 'Шулер', face: 'Ш', color: '#c8402f', level: 'сложно',
    desc: 'Подглядывает в твои карты и просчитывает ходы вперёд. Честно играть не умеет.' },
];
/* карьера «С подъезда в казино»: 5 районов, в каждом двое соседей и босс */
const CAREER = [
  { name: 'Подъезд', reward: { table: 'kitchen' }, ops: [
    { id: 'c-tolik', ai: 'student', style: 'student', name: 'Сосед Толик', face: 'Т', color: '#6d8fb8', desc: 'Играет в тапках и спешит к сериалу.' },
    { id: 'c-vovan', ai: 'student', style: 'student', name: 'Вован с пятого', face: 'В', color: '#7b6db8', desc: 'Уверен, что козырь — это любая красная.' },
    { id: 'c-babka', ai: 'valera', style: 'valera', boss: 'babka', name: 'Бабка у подъезда', face: 'Б', color: '#b86d9a', desc: 'БОСС: каждый третий ход меняет козырь. «Я так всегда играла».' } ] },
  { name: 'Двор', reward: { back: 'blue' }, ops: [
    { id: 'c-mihalych', ai: 'valera', style: 'mihalych', name: 'Дворник Михалыч', face: 'М', color: '#8a9a5b', desc: 'Метёт всё со стола. Терпеливый.' },
    { id: 'c-patsan', ai: 'valera', style: 'patsan', name: 'Пацан с района', face: 'П', color: '#5b8a8a', desc: 'Любит переводить и смотреть, как ты злишься.' },
    { id: 'c-vahter', ai: 'valera', style: 'valera', boss: 'vahter', name: 'Вахтёр', face: 'ВХ', color: '#8a6a3b', desc: 'БОСС: «Не положено!» — переводы запрещены.' } ] },
  { name: 'Рынок', reward: { track: 'night' }, ops: [
    { id: 'c-torgash', ai: 'valera', style: 'torgash', name: 'Торгаш', face: 'ТР', color: '#b8863b', desc: 'Каждую карту продаёт дороже, чем она стоит.' },
    { id: 'c-zina', ai: 'sharper', style: 'zina', name: 'Тётя Зина', face: 'З', color: '#b85b5b', desc: 'Всё помнит. Всё.' },
    { id: 'c-taxi', ai: 'valera', style: 'valera', boss: 'taxi', name: 'Таксист', face: 'ТК', color: '#d9c23c', desc: 'БОСС: счётчик тикает — у тебя 10 секунд на ход.' } ] },
  { name: 'Вокзал', reward: { table: 'neon' }, ops: [
    { id: 'c-provod', ai: 'sharper', style: 'lite', name: 'Проводница', face: 'ПР', color: '#3b6db8', desc: 'Видала и не таких пассажиров.' },
    { id: 'c-dembel', ai: 'valera', style: 'dembel', name: 'Дембель', face: 'Д', color: '#4f7a3b', desc: 'Два года тренировался в казарме.' },
    { id: 'c-major', ai: 'sharper', style: 'sharper', boss: 'major', name: 'Мажор', face: 'МЖ', color: '#c79bff', desc: 'БОСС: начинает партию с полным зарядом. Папа купил.' } ] },
  { name: 'Казино', reward: { table: 'gold', back: 'gold' }, ops: [
    { id: 'c-krupie', ai: 'sharper', style: 'lite', name: 'Крупье', face: 'КР', color: '#2e9d5b', desc: 'Улыбается и считает каждую карту.' },
    { id: 'c-valera', ai: 'valera', style: 'lite', name: 'Дядя Валера', face: 'ДВ', color: '#d9a03c', desc: 'Старый друг. Теперь играет по-крупному.' },
    { id: 'c-sharper', ai: 'sharper', style: 'sharper', peek: 'late', boss: 'sharper', name: 'Шулер', face: 'Ш', color: '#c8402f', desc: 'ФИНАЛЬНЫЙ БОСС: знает твою руку в конце колоды и не прощает ошибок.' } ] },
];
const CAREER_OPS = CAREER.flatMap((d, di) => d.ops.map((o, oi) => ({ ...o, district: di, slot: oi, level: o.boss ? 'босс' : d.name })));
function currentBot() {
  if (MODE.kind === 'career') return CAREER_OPS[MODE.stage] || CAREER_OPS[0];
  if (MODE.kind === 'daily') return BOTS[2];
  return BOTS.find(b => b.id === load('durocker-bot')) || BOTS[1];
}
const oppName = () => (NET ? (NET.oppNick || 'Соперник') : currentBot().name);

/* ---------- общее: как бот ценит карты ---------- */
const STYLE = {
  student:  { search: 0 },
  valera:   { search: 0 },
  patsan:   { search: 0, transfer: 'always' },
  mihalych: { search: 0, patient: true },
  torgash:  { search: 0, hoard: 1.6 },
  dembel:   { search: 0, aggro: true },
  zina:     { search: 10 },
  lite:     { search: 16 },
  sharper:  { search: 36 },
};
const styleOf = bot => STYLE[bot.style] || STYLE[bot.ai] || STYLE.valera;

/* насколько охотно бот отдаёт эти карты; когда колода кончилась — сбрасывает всё подряд */
function heur(e, noise) {
  const late = !G.deck.length;
  const s = cost(e.cards);
  return late ? e.n * 10 - s * 0.3 + Math.random() * 2
              : e.cards.reduce((a, c) => a + 16 - val(c), 0) + e.n * 2 + Math.random() * (noise || 3);
}
function pickMax(list, score) { let b = null, h = -1e9; for (const e of list) { const v = score(e); if (v > h) { h = v; b = e; } } return b ? { e: b, h } : null; }
const sizesUpTo = m => [1, 2, 3, 4, 5].filter(n => n <= m);
const plainCards = h => h.filter(c => !c.action);
/* на огромной руке перебор пятёрок слишком дорог для телефона — ищем их только на руке до 13 карт */
const capSizes = (L, sizes) => sizes.filter(n => !(n === 5 && L > 13) && !(n === 4 && L > 18));
const BW = { sp: 1, refill: 0.55, over: 0.5, cb: 1, lateN: 1.4, lateSp: 0.45, tE: 0.4, tL: 0.6 };

/* сила карты: джокер и козыри дороже, ранг 2..A даёт 0..1 */
function power(c, hoard) {
  if (c.action) return 2;
  if (c.joker) return 3.2 * (hoard || 1);
  const b = (c.r - 2) / 12;
  return c.s === G.T ? (1.3 + b) * (hoard || 1) : b;
}
const powSum = (cs, hoard) => cs.reduce((a, c) => a + power(c, hoard), 0);
function comboBonus(h) {
  const by = {}, su = {};
  h.forEach(c => { if (c.action || c.joker) return; by[c.r] = (by[c.r] || 0) + 1; su[c.s] = (su[c.s] || 0) + 1; });
  let b = 0;
  Object.values(by).forEach(k => { b += k >= 4 ? 1 : k === 3 ? 0.6 : k === 2 ? 0.25 : 0; });
  Object.values(su).forEach(k => { if (k >= 5) b += 0.3; });
  return b;
}
const lateness = () => 1 - Math.min(G.deck.length, 16) / 16;
/* оценка руки: пока колода толстая — важна сила карт, к концу — их количество */
function handQ(h, hoard) {
  const n = h.length, late = lateness(), sp = powSum(h, hoard), cb = comboBonus(h);
  const refill = Math.min(Math.max(0, 8 - n), Math.ceil(G.deck.length / 2));
  return (1 - late) * (BW.sp * sp + BW.refill * refill - BW.over * Math.max(0, n - 8) + BW.cb * cb)
       + late * (-BW.lateN * n + BW.lateSp * sp + 0.5 * cb);
}
const tempo = () => BW.tE + BW.tL * lateness();
const minus = (h, cs) => { const ids = new Set(cs.map(c => c.id)); return h.filter(c => !ids.has(c.id)); };
const tblCards = () => G.table.flatMap(b => [...b.a.cards, ...(b.d && !b.d.shield ? b.d.cards : [])]);

/* ---------- память и догадки о руке соперника ---------- */
const ALL_CARDS = Array.from({ length: DECK }, (_, n) => mkCard(n));
let MEM = { g: null, seen: new Set() };
function remember() {
  if (MEM.g !== G) MEM = { g: G, seen: new Set() };
  G.table.forEach(b => { b.a.cards.forEach(c => MEM.seen.add(c.n)); if (b.d) b.d.cards.forEach(c => MEM.seen.add(c.n)); });
}
/* N вариантов руки соперника: известные карты (видел, как он их забрал со стола) + случайные из невиданных */
function sampleHands(bot, N) {
  const peek = bot.peek === 'always' || (bot.peek === 'late' && G.deck.length <= 10) || !G.deck.length && bot.peek;
  if (peek) return [mkSample(G.P.slice())];
  const mine = new Set(G.B.map(c => c.n)), onTable = new Set(tblCards().map(c => c.n));
  const opp = new Set(G.P.map(c => c.n));
  const known = G.P.filter(c => c.action || MEM.seen.has(c.n));
  const gone = n => MEM.seen.has(n) && !opp.has(n) && !mine.has(n) && !onTable.has(n);
  const pool = ALL_CARDS.filter(c => !mine.has(c.n) && !onTable.has(c.n) && !gone(c.n)
    && !(known.some(k => k.n === c.n)) && !(G.deck.length && G.trump && c.n === G.trump.n));
  const need = G.P.length - known.length;
  if (need <= 0 || pool.length <= need) return [mkSample(known.concat(pool.slice(0, Math.max(0, need))))];
  const out = [];
  for (let i = 0; i < N; i++) {
    const p = pool.slice();
    for (let j = 0; j < need; j++) { const k = j + Math.floor(Math.random() * (p.length - j)); [p[j], p[k]] = [p[k], p[j]]; }
    out.push(mkSample(known.concat(p.slice(0, need))));
  }
  return out;
}
function mkSample(cards) { return { cards, by: {}, q: null }; }
function sampleCombos(s, n) {
  if (!s.by[n]) { const L = plainCards(s.cards).length; s.by[n] = L >= n && capSizes(L, [n]).length ? combos(s.cards, [n]) : []; }
  return s.by[n];
}
/* чем соперник ответит на e в этом варианте руки: самое дешёвое покрытие, или null — берёт */
function oppAnswer(s, e) {
  const sizes = e.n === 1 ? [1] : [2, 3, 4, 5].filter(n => n >= e.n);
  let best = null, bc = 1e9;
  for (const n of sizes) for (const d of sampleCombos(s, n)) {
    if (!beats(d, e)) continue;
    const c = powSum(d.cards); if (c < bc) { bc = c; best = d; }
  }
  if (!best && G.rules && G.rules.charge !== false) {
    const sh = s.cards.find(c => c.action === 'shield' && (c.s === G.T || e.cards.some(x => x.s === c.s)));
    if (sh) return { cards: [sh], shield: true };
  }
  return best;
}
const sQ = s => (s.q == null ? (s.q = handQ(s.cards)) : s.q);

/* ---------- просчёт ходов ---------- */
function deadline() { return Date.now() + 90; }
/* атака/подкидывание: что выгоднее отдать, если соперник ответит по-своему */
function evalThrow(bot, samples, e, withTable) {
  const hoard = styleOf(bot).hoard, B2 = minus(G.B, e.cards), bq = handQ(B2, hoard);
  const extra = withTable ? tblCards() : [];
  let sum = 0;
  for (const s of samples) {
    const d = oppAnswer(s, e);
    if (d) sum += bq - handQ(minus(s.cards, d.cards)) - tempo();
    else sum += bq - handQ(s.cards.concat(extra, e.cards)) + tempo();
  }
  return sum / samples.length;
}
function searchAttack(bot, list, kind) {
  const N = styleOf(bot).search, end = deadline();
  remember();
  const samples = sampleHands(bot, N);
  const cand = list.slice().sort((a, b) => heur(b, 0.01) - heur(a, 0.01)).slice(0, 9);
  let best = null, bs = -1e9;
  if (kind === 'throw') {
    /* «Бито»: стол уходит, соперник ходит следующим */
    bs = samples.reduce((a, s) => a + handQ(G.B, styleOf(bot).hoard) - sQ(s), 0) / samples.length - tempo();
  }
  for (const e of cand) {
    if (Date.now() > end && best) break;
    const v = evalThrow(bot, samples, e, kind === 'throw') + Math.random() * 0.02;
    if (v > bs) { bs = v; best = e; }
  }
  return best;
}
function searchAddTake(bot, list) {
  /* соперник берёт: докидываем то, от чего выгодно избавиться */
  const hoard = styleOf(bot).hoard, base = handQ(G.B, hoard);
  let best = null, bs = 0.05;
  for (const e of list) {
    const gain = handQ(minus(G.B, e.cards), hoard) - base + powSum(e.cards) * 0.6 * (1 - lateness()) * -1 + e.n * 0.6 * lateness();
    if (gain > bs) { bs = gain; best = e; }
  }
  return best;
}
function searchDefense(bot, cover, transfer) {
  const st = styleOf(bot), hoard = st.hoard, end = deadline();
  remember();
  const samples = transfer.length ? sampleHands(bot, Math.max(6, Math.floor((st.search || 6) / 2))) : [];
  const openLeft = G.table.filter(b => !b.d).length;
  const take = handQ(G.B.concat(tblCards()), hoard) - tempo() - 0.25 * lateness() * 2;
  let best = null, bs = take;
  for (const d of cover.slice(0, 7)) {
    const v = handQ(minus(G.B, d.cards), hoard) + (openLeft <= 1 ? tempo() : 0) - 0.15 * d.n * (1 - lateness());
    if (v > bs) { bs = v; best = { type: 'play', e: d }; }
  }
  for (const t of transfer.slice(0, 2)) {
    if (Date.now() > end && best) break;
    const atks = G.table.map(b => b.a).concat([t]), B2 = minus(G.B, t.cards), bq = handQ(B2, hoard);
    let sum = 0;
    for (const s of samples) {
      let rest = s.cards, ok = true;
      for (const a of atks) { const d = oppAnswer(mkSample(rest), a); if (!d) { ok = false; break; } rest = minus(rest, d.cards); }
      sum += ok ? bq - handQ(rest) - tempo() + sQ(s) : bq - handQ(s.cards.concat(tblCards(), t.cards)) + tempo() + sQ(s);
    }
    const v = sum / Math.max(1, samples.length);
    if (v > bs) { bs = v; best = { type: 'transfer', e: t }; }
  }
  return best;
}

/* ---------- ходы по характерам ---------- */
function attackList() {
  const L = plainCards(G.B).length;
  return combos(G.B, capSizes(L, sizesUpTo(Math.min(5, G.limit - atkCount(), G.P.length)))).filter(e => checkMove('b', e.cards).ok);
}
function botAttackPick(bot) {
  const list = attackList(), st = styleOf(bot);
  if (!list.length) return null;
  if (bot.ai === 'student' || bot.style === 'student') return (pickMax(list, e => heur(e, 30) - e.n * 3) || {}).e;
  if (st.search) return searchAttack(bot, list, 'attack');
  if (st.aggro) return (pickMax(list, e => heur(e) + e.n * 6) || {}).e;
  if (st.hoard) return (pickMax(list, e => heur(e) - (e.tr + e.jk) * 12) || {}).e;
  return (pickMax(list, e => heur(e)) || {}).e;
}
function botThrowPick(bot, forTake) {
  const room = Math.min(5, G.limit - atkCount(), forTake ? 99 : G.P.length);
  if (room < 1) return null;
  const st = styleOf(bot), late = !G.deck.length;
  if (bot.ai === 'student' && Math.random() < 0.5) return null;
  if (st.patient && !late && !forTake && Math.random() < 0.7) return null;
  const all = combos(G.B, capSizes(plainCards(G.B).length, sizesUpTo(room).filter(n => n >= 2))).filter(e => checkMove('b', e.cards).ok);
  if (!all.length) return null;
  if (st.search) return forTake ? searchAddTake(bot, all) : searchAttack(bot, all, 'throw');
  const cheapOk = e => late || (st.aggro && G.deck.length < 10) || (e.tr === 0 && !e.jk && e.cards.every(c => c.r <= 11));
  const list = all.filter(cheapOk);
  const r = pickMax(list, e => heur(e) + (st.aggro ? e.n * 4 : 0));
  if (!r || (!late && r.h <= 0)) return null;
  return r.e;
}
/* ответ на открытую атаку: покрыть, перевести или взять */
function botDefense(bot) {
  const { cover, transfer } = defenseOptions('b'), st = styleOf(bot);
  if (bot.ai === 'student' || bot.style === 'student') {
    if (!cover.length || Math.random() < 0.15) return null;
    return { type: 'play', e: cover[Math.floor(Math.random() * cover.length)] };
  }
  if (st.transfer === 'always' && transfer.length) return { type: 'transfer', e: transfer[0] };
  if (st.search) return searchDefense(bot, cover, transfer);
  const c = cover[0], t = transfer[0];
  const pricey = c && (c.tr > 0 || c.jk > 0);
  /* Торгаш не тратит козыри на мелочь: мелкую атаку лучше забрать, пока колода толстая */
  if (st.hoard && pricey && G.deck.length > 8 && openB().a.n <= 2 && powSum(openB().a.cards) < 1.6) return t ? { type: 'transfer', e: t } : null;
  if (t && (!c || pricey || cost(t.cards) + 8 < cost(c.cards))) return { type: 'transfer', e: t };
  if (!c) return null;
  return { type: 'play', e: c };
}

/* апгрейд: пока ты думаешь, бот докладывает карты к своей непокрытой атаке */
function botUpgradePick(bot) {
  if (typeof checkUpgrade !== 'function' || (G.rules && G.rules.upgrade === false)) return null;
  if (G.over || G.busy || G.attacker !== 'b' || G.phase.kind !== 'defend' || G.phase.who !== 'p' || G.upgraded) return null;
  const b = openB();
  if (!b) return null;
  const hand = plainCards(G.B), max = Math.min(4, 5 - b.a.n), opts = [], pick = [];
  let budget = 4000;
  const rec = (st, d, k) => {
    if (budget-- <= 0) return;
    if (d === k) { const cs = pick.slice(0, k), r = checkUpgrade('b', cs); if (r.ok) opts.push({ cs, e: r.e }); return; }
    for (let i = st; i <= hand.length - (k - d); i++) { pick[d] = hand[i]; rec(i + 1, d + 1, k); }
  };
  for (let k = 1; k <= max; k++) rec(0, 0, k);
  if (!opts.length) return null;
  const st = styleOf(bot), late = !G.deck.length;
  if (bot.ai === 'student' || bot.style === 'student') return Math.random() < 0.2 ? opts[Math.floor(Math.random() * opts.length)].cs : null;
  if (st.search) {
    remember();
    const samples = sampleHands(bot, Math.max(8, Math.floor(st.search / 2)));
    const pAns = e => samples.filter(s => oppAnswer(s, e)).length / samples.length;
    const p0 = pAns(b.a);
    let best = null, bs = 0.12;
    for (const o of opts.slice(0, 30)) {
      const gain = (p0 - pAns(o.e)) * (2 + 2 * lateness()) - powSum(o.cs) * 0.35 * (1 - lateness()) + o.cs.length * 0.3 * lateness();
      if (gain > bs) { bs = gain; best = o.cs; }
    }
    return best;
  }
  const cheap = opts.filter(o => late || o.cs.every(c => !c.joker && c.s !== G.T && c.r <= 11))
    .sort((x, y) => powSum(x.cs) - powSum(y.cs));
  return cheap.length && Math.random() < (st.aggro ? 0.9 : 0.6) ? cheap[0].cs : null;
}

/* карты-действия бота */
const botActs = kind => G.B.filter(c => c.action === kind && checkAction('b', c).ok);
function trumpWorth(c) {
  /* меняем козырь, если в новой масти у бота заметно больше карт, чем в старой */
  const cnt = s => G.B.filter(x => x.s === s && !x.action && !x.joker).length;
  return cnt(c.s) >= cnt(G.T) + 2;
}
function botActionFirst(bot) {
  const k = G.phase.kind, rnd = bot.ai === 'student' ? Math.random() < 0.5 : true;
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
  if (bot.ai !== 'student' && (d.e.tr > 0 || d.e.jk > 0 || a.n >= 4)) return sh[0] || null;
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

let botQueued = 0, upKey = '';
function drive() {
  if (!NET && G && !G.over && G.phase.who === 'p' && G.phase.kind === 'defend' && G.attacker === 'b') planUpgrade();
  if (NET || !G || G.over || G.busy || G.phase.who !== 'b') return;
  const q = ++botQueued, bot = currentBot();
  run(async () => {
    await wait(bot.ai === 'student' ? 650 : 850);
    if (q !== botQueued || G.phase.who !== 'b' || G.busy) return;
    const [type, cards, line] = botDecide(bot);
    if (line) say(line);
    if (type === 'pass') { run(() => endTurn(true)); return; }
    if (!act('b', type, cards)) { console.warn('бот: ход отклонён', type); act('b', G.phase.kind === 'defend' ? 'take' : G.phase.kind === 'throw' ? 'bito' : 'enough'); }
  });
}

/* апгрейд бота — отложенный ход, пока игрок думает над защитой */
function planUpgrade() {
  if (G.upgraded || (G.rules && G.rules.upgrade === false) || typeof checkUpgrade !== 'function') return;
  const key = G.turnNo + ':' + atkCount();
  if (key === upKey) return;
  upKey = key;
  const bot = currentBot();
  run(async () => {
    await wait(1200 + Math.random() * 800);
    if (NET || !G || G.over || G.busy || G.attacker !== 'b' || G.phase.who !== 'p' || G.phase.kind !== 'defend' || G.upgraded) return;
    if (G.turnNo + ':' + atkCount() !== key) return;
    const cs = botUpgradePick(bot);
    if (cs && act('b', 'upgrade', cs)) say(['Доложу!', 'А вот так?', 'Ещё сверху'][Math.floor(Math.random() * 3)]);
  });
}

/* бот сразу забирает действие за полный заряд: щит и разворот спасают в защите, +2 — давит */
function botPick() {
  if (NET || !G || G.over || !G.offer || !G.offer.b) return;
  const pref = ['shield', 'plus', 'reverse', 'trump'];
  const k = G.offer.b.kinds.slice().sort((a, b) => pref.indexOf(a) - pref.indexOf(b))[0];
  act('b', 'pick', k);
}
