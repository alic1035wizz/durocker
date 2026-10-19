/* Дурокер — «Компания»: движок дурака на 3–4 игрока.
   Правила — «Классика»: комбинации, подкидывание по номиналу и по типу, перевод. Без заряда, «могнул», перекрытия и апгрейда.
   Оценку комбинаций берём из rules.js: на время вызова подставляем свой контекст вместо G (там читаются G.T, G.table, G.rules). */
'use strict';

const M4 = (() => {
  const RULES = { transfer: true, mognul: false, charge: false, over: false, upgrade: false, typeThrow: true, blitz: false, set: 'classic' };
  const SERIES_TO = 21;
  let M = null;

  /* ---------- контекст для функций rules.js ---------- */
  function withCtx(S, f) {
    const g = G;
    G = { T: S.T, table: S.table || [], rules: RULES, P: [], B: [], deck: [] };
    try { return f(); } finally { G = g; }
  }
  const cards = ns => ns.map(mkCard);
  /* оценка комбинации с кэшем: перебор джокеров дорогой, а одни и те же наборы карт проверяются много раз */
  const EVC = new Map();
  function evC(S, cs) {
    const key = S.T + '|' + cs.map(c => c.n).sort((a, b) => a - b).join('.');
    if (EVC.has(key)) { const e = EVC.get(key); return e && { ...e, cards: cs }; }
    const e = withCtx(S, () => ev(cs));
    if (EVC.size > 60000) EVC.clear();
    EVC.set(key, e ? { ...e, cards: null } : null);
    return e;
  }
  /* перебор с бюджетом: на руке в 20 карт пятёрок слишком много — останавливаемся, но сначала дешёвые карты */
  function combosC(S, hand, sizes, budget) {
    const out = [], pick = [];
    hand = hand.slice().sort((a, b) => (a.joker - b.joker) || ((a.s === S.T) - (b.s === S.T)) || a.r - b.r);
    const L = hand.length;
    let left = budget || 2500;
    for (const n of sizes) {
      if (n < 1 || n > L) continue;
      const rec = (st, d) => {
        if (left <= 0) return;
        if (d === n) { left--; const cs = pick.slice(0, n), e = evC(S, cs); if (e) out.push(e); return; }
        for (let i = st; i <= L - (n - d) && left > 0; i++) { pick[d] = hand[i]; rec(i + 1, d + 1); }
      };
      rec(0, 0);
    }
    return out;
  }

  /* ---------- места за столом ---------- */
  const isOut = (S, s) => S.out.includes(s);
  /* следующий игрок по часовой, который ещё в игре */
  function nextActive(S, s) {
    for (let i = 1; i <= S.N; i++) { const k = (s + i) % S.N; if (!isOut(S, k)) return k; }
    return s;
  }
  const atkCount = S => S.table.reduce((n, b) => n + b.a.n, 0);
  const openBattle = S => S.table.find(b => !b.d) || null;
  const noneDefended = S => S.table.length > 0 && S.table.every(b => !b.d);
  const undefendedCards = S => S.table.filter(b => !b.d).reduce((n, b) => n + b.a.n, 0);
  /* кто может подкидывать: все, кроме защитника, у кого есть карты, по кругу начиная с атакующего */
  function throwers(S) {
    const out = [];
    for (let i = 0; i < S.N; i++) {
      const s = (S.att + i) % S.N;
      if (s !== S.def && !isOut(S, s) && S.counts[s] > 0) out.push(s);
    }
    return out;
  }
  const nextThrower = S => throwers(S).find(s => !S.passed.includes(s));
  function tableRanks(S) {
    const r = new Set();
    S.table.forEach(b => { b.a.cards.forEach(c => r.add(c.r)); if (b.d) b.d.cards.forEach(c => r.add(c.r)); });
    return r;
  }

  /* ---------- проверка хода (общая для хозяина, бота и экрана гостя) ---------- */
  /* S — состояние или вид с полями phase, att, def, table, T, limit, counts, passed, out, N; cs — карты */
  function check(S, seat, cs, e0) {
    const no = why => ({ ok: false, why });
    if (!S || S.over != null || !S.phase || S.phase.who !== seat) return no(null);
    if (!cs.length) return no(null);
    const k = S.phase.kind, e = e0 || evC(S, cs);
    if (!e) return no('Не комбинация');
    if (k === 'attack') {
      const room = Math.min(S.limit, S.counts[S.def]);
      if (e.n > room) return no(`У защитника ${S.counts[S.def]} ${plural(S.counts[S.def])} — больше не положить`);
      return { ok: true, e, type: 'play', why: 'Можно ходить' };
    }
    if (k === 'defend') {
      const b = openBattle(S);
      if (!b) return no(null);
      const tr = checkTransfer(S, seat, cs, e);
      if (e.n !== b.a.n) return tr.ok ? tr : no(`Кроют тем же числом: ${b.a.n} ${plural(b.a.n)}`);
      const ok = withCtx(S, () => beats(e, b.a));
      if (ok) return { ok: true, e, type: 'play', why: 'Бьёт!' };
      return tr.ok ? tr : no('Не бьёт');
    }
    if (k === 'throw' || k === 'addtake') {
      if (e.n === 1) return no('Одиночкой не подкидывают — только комбинацией');
      const rs = tableRanks(S);
      const okRank = e.cards.some(c => rs.has(c.r)) || withCtx(S, () => tableHasType(e));
      if (!okRank) return no('Нет на столе ни номинала, ни такой комбинации');
      if (atkCount(S) + e.n > S.limit) return no(S.limit - atkCount(S) > 0 ? `Влезет ещё ${S.limit - atkCount(S)}` : 'Стол полон');
      if (k === 'throw' && undefendedCards(S) + e.n > S.counts[S.def]) return no(`У защитника ${S.counts[S.def]} ${plural(S.counts[S.def])}`);
      return { ok: true, e, type: 'play', why: k === 'throw' ? 'Можно подкинуть' : 'Вдогонку' };
    }
    return no(null);
  }
  /* перевод: на следующего за защитником, тем же типом и старшинством, пока никто не ответил */
  function checkTransfer(S, seat, cs, e) {
    const no = why => ({ ok: false, why });
    if (S.phase.kind !== 'defend' || seat !== S.def || !noneDefended(S)) return no(null);
    e = e || evC(S, cs);
    if (!e || !withCtx(S, () => sameRank(e, S.table[0].a))) return no(null);
    const to = nextActive(S, S.def);
    if (to === S.def) return no(null);
    if (atkCount(S) + e.n > Math.min(HAND, S.counts[to])) return no('У следующего не хватит карт на перевод');
    return { ok: true, e, type: 'transfer', to, why: 'Можно перевести!' };
  }
  /* все допустимые ходы из руки (для подбора и ботов) */
  function options(S, seat, hand) {
    const plain = hand.filter(c => !c.action);
    const k = S.phase && S.phase.kind;
    if (!k || S.phase.who !== seat) return [];
    const sizes = k === 'defend' ? [openBattle(S) ? openBattle(S).a.n : 1] : k === 'attack' ? [1, 2, 3, 4, 5] : [2, 3, 4, 5];
    if (plain.length > 12) { const i = sizes.indexOf(5); if (i >= 0 && k !== 'defend') sizes.splice(i, 1); }
    const list = combosC(S, plain, sizes);
    const out = [];
    list.forEach(e => { const r = check(S, seat, e.cards, e); if (r.ok) out.push({ ...r, e: r.e || e }); });
    return out;
  }

  /* ---------- партия ---------- */
  /* cfg: { N, names[], kinds[] ('me'|'bot'|'net'), bots[] (описания ботов), series[] } */
  function newGame(cfg) {
    const N = cfg.N, deck = [];
    for (let n = 0; n < DECK; n++) deck.push(mkCard(n));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    if (deck[0].joker) { const k = deck.findIndex(c => !c.joker); [deck[0], deck[k]] = [deck[k], deck[0]]; }
    M = {
      N, names: cfg.names.slice(), kinds: cfg.kinds.slice(), bots: (cfg.bots || []).slice(), hands: Array.from({ length: N }, () => []),
      deck, T: deck[0].s, trumpN: deck[0].n, table: [], grave: 0, att: 0, def: 1, phase: { kind: 'attack', who: 0 },
      limit: HAND, passed: [], out: [], over: null, pen: 0, series: (cfg.series || Array(N).fill(0)).slice(), seriesDone: false,
      turnNo: 0, games: (cfg.games || 0), ev: null, evId: 0, counts: [],
    };
    for (let r = 0; r < HAND; r++) for (let s = 0; s < N; s++) M.hands[s].push(M.deck.pop());
    /* первым ходит тот, у кого младший козырь */
    let first = 0, low = 99;
    M.hands.forEach((h, s) => h.forEach(c => { if (!c.joker && c.s === M.T && c.r < low) { low = c.r; first = s; } }));
    M.att = first; M.def = nextActive(M, first);
    sync();
    note(low < 99 ? `${M.names[first]}: младший козырь ${rn(low)}${SU[M.T]} — ходит первым` : `${M.names[first]} ходит первым`, 'trump');
    M.limit = Math.min(HAND, M.counts[M.def]);
    M.phase = { kind: 'attack', who: M.att };
    return M;
  }
  function sync() { if (M) M.counts = M.hands.map(h => h.length); }
  function note(text, kind) { M.ev = { id: ++M.evId, text, kind: kind || '' }; }
  const H4 = s => M.hands[s];
  function take(seat, ns) {
    const h = H4(seat), out = [];
    for (const n of ns) { const i = h.findIndex(c => c.n === n); if (i < 0) return null; out.push(h[i]); }
    return out;
  }
  function remove(seat, cs) { const ids = new Set(cs.map(c => c.n)); M.hands[seat] = H4(seat).filter(c => !ids.has(c.n)); }

  /* единственная точка изменения партии */
  function act(seat, type, ns) {
    if (!M || M.over != null || M.phase.who !== seat) return { ok: false };
    const k = M.phase.kind;
    if (type === 'play' || type === 'transfer') {
      const cs = take(seat, ns || []);
      if (!cs) return { ok: false };
      const r = type === 'transfer' ? checkTransfer(M, seat, cs) : check(M, seat, cs);
      if (!r.ok || (type === 'play' && r.type === 'transfer')) {
        /* выбор подходит только для перевода — переводим, если просили «Покрыть», но покрыть нельзя */
        if (!(r.ok && r.type === 'transfer')) return { ok: false, why: r.why };
      }
      const e = r.e;
      remove(seat, cs); sync();
      if (r.type === 'transfer') {
        M.table.push({ a: e, d: null, by: seat });
        M.att = seat; M.def = r.to;
        M.limit = Math.min(HAND, M.counts[M.def] + 0);
        M.phase = { kind: 'defend', who: M.def };
        note(`${M.names[seat]} переводит на ${M.names[M.def]}: ${e.name.toLowerCase()}`, 'gold');
        return { ok: true };
      }
      if (k === 'attack') {
        M.table.push({ a: e, d: null, by: seat });
        M.phase = { kind: 'defend', who: M.def };
        note(`${M.names[seat]} ходит на ${M.names[M.def]}: ${e.name.toLowerCase()}`, 'atk');
        return { ok: true };
      }
      if (k === 'defend') {
        openBattle(M).d = e;
        note(`${M.names[seat]} кроет: ${e.name.toLowerCase()}`, 'def');
        afterCover();
        return { ok: true };
      }
      if (k === 'throw') {
        M.table.push({ a: e, d: null, by: seat });
        M.passed = [];
        M.phase = { kind: 'defend', who: M.def };
        note(`${M.names[seat]} подкидывает: ${e.name.toLowerCase()}`, 'atk');
        return { ok: true };
      }
      if (k === 'addtake') {
        M.table.push({ a: e, d: null, by: seat });
        note(`${M.names[seat]} докидывает вдогонку`, 'take');
        if (atkCount(M) >= M.limit) endTurn(false);
        else if (!M.counts[seat]) pass(seat);
        return { ok: true };
      }
      return { ok: false };
    }
    if (type === 'take' && k === 'defend' && seat === M.def) {
      note(`${M.names[seat]} берёт`, 'take');
      M.passed = [];
      M.phase = { kind: 'addtake', who: null };
      if (atkCount(M) >= M.limit) { endTurn(false); return { ok: true }; }
      const t = nextThrower(M);
      if (t == null) endTurn(false); else M.phase.who = t;
      return { ok: true };
    }
    if (type === 'pass' && (k === 'throw' || k === 'addtake')) { pass(seat); return { ok: true }; }
    return { ok: false };
  }
  function pass(seat) {
    if (!M.passed.includes(seat)) M.passed.push(seat);
    const t = nextThrower(M);
    if (t == null) endTurn(M.phase.kind === 'throw');
    else M.phase.who = t;
  }
  function afterCover() {
    if (openBattle(M)) { M.phase = { kind: 'defend', who: M.def }; return; }
    if (!M.counts[M.def] || atkCount(M) >= M.limit) { endTurn(true); return; }
    M.passed = [];
    const t = nextThrower(M);
    if (t == null) { endTurn(true); return; }
    M.phase = { kind: 'throw', who: t };
  }
  /* конец хода: бито (beaten) или защитник берёт */
  function endTurn(beaten) {
    const att = M.att, def = M.def;
    const thr = throwers(M);
    if (beaten) {
      M.grave += M.table.reduce((n, b) => n + b.a.n + (b.d ? b.d.n : 0), 0);
      note(`Бито! ${M.names[def]} отбился`, 'bito');
    } else {
      M.table.forEach(b => { M.hands[def].push(...b.a.cards); if (b.d) M.hands[def].push(...b.d.cards); });
      note(`${M.names[def]} забирает ${M.table.reduce((n, b) => n + b.a.n + (b.d ? b.d.n : 0), 0)} карт`, 'take');
    }
    M.table = [];
    /* добор: атакующий, потом остальные подкидывавшие по кругу, защитник последним */
    const order = [att, ...thr.filter(s => s !== att), def];
    const seen = new Set();
    order.forEach(s => { if (seen.has(s) || isOut(M, s)) return; seen.add(s); while (M.hands[s].length < HAND && M.deck.length) M.hands[s].push(M.deck.pop()); });
    sync();
    M.turnNo++;
    /* вышли все, у кого кончились карты при пустой колоде */
    if (!M.deck.length) for (let s = 0; s < M.N; s++) if (!isOut(M, s) && !M.counts[s]) M.out.push(s);
    const alive = [...Array(M.N).keys()].filter(s => !isOut(M, s));
    if (alive.length <= 1) { finish(alive.length ? alive[0] : 'draw'); return; }
    /* защита от «вечной» партии: если все сидят с огромными руками и колода не убывает — после 50 ходов дурак тот, у кого больше всех карт */
    if (M.turnNo >= 50) {
      const mx = Math.max(...alive.map(s => M.counts[s])), top = alive.filter(s => M.counts[s] === mx);
      note('50 ходов — время вышло', 'gold');
      finish(top.length === 1 ? top[0] : 'draw'); return;
    }
    /* кто ходит дальше: отбился — защитник; взял — следующий за ним */
    let na = beaten ? def : nextActive(M, def);
    if (isOut(M, na)) na = nextActive(M, na);
    M.att = na; M.def = nextActive(M, na);
    M.passed = [];
    M.limit = Math.min(HAND, M.counts[M.def]);
    M.phase = { kind: 'attack', who: M.att };
  }
  function finish(loser) {
    M.over = loser;
    M.phase = { kind: 'over', who: null };
    M.games++;
    if (loser === 'draw') { M.pen = 0; note('Ничья — все вышли одновременно', 'gold'); return; }
    M.pen = Math.min(10, M.counts[loser]);
    M.series[loser] += M.pen;
    if (M.series[loser] >= SERIES_TO) M.seriesDone = true;
    note(`${M.names[loser]} — ДУРАК! +${M.pen} штрафа`, 'take');
  }

  /* ---------- что видит игрок seat ---------- */
  function viewFor(seat) {
    if (!M) return null;
    return {
      N: M.N, me: seat, names: M.names, kinds: M.kinds.map(k => (k === 'bot' ? 'bot' : 'p')), counts: M.counts.slice(),
      hand: M.hands[seat].map(c => c.n), T: M.T, trumpN: M.trumpN, deckN: M.deck.length, grave: M.grave,
      table: M.table.map(b => ({ a: b.a.cards.map(c => c.n), d: b.d ? b.d.cards.map(c => c.n) : null, by: b.by })),
      att: M.att, def: M.def, phase: M.phase, limit: M.limit, passed: M.passed.slice(), out: M.out.slice(),
      over: M.over, pen: M.pen, series: M.series.slice(), seriesDone: M.seriesDone, games: M.games, ev: M.ev, turnNo: M.turnNo, v: VERSION,
    };
  }
  /* вид гостя → состояние для проверок (комбинации пересчитываются у него же) */
  function fromView(V) {
    const S = { ...V, out: V.out || [], passed: V.passed || [] };
    S.table = withCtx(V, () => V.table.map(b => ({ a: ev(cards(b.a)), d: b.d ? ev(cards(b.d)) : null, by: b.by })));
    S.hand = cards(V.hand);
    return S;
  }

  /* сохранить / восстановить (хозяин стола после обновления страницы) */
  function dump() {
    if (!M) return null;
    return JSON.stringify({ ...M, table: M.table.map(b => ({ a: b.a.cards.map(c => c.n), d: b.d ? b.d.cards.map(c => c.n) : null, by: b.by })),
      hands: M.hands.map(h => h.map(c => c.n)), deck: M.deck.map(c => c.n) });
  }
  function restore(s) {
    try {
      const d = JSON.parse(s);
      d.hands = d.hands.map(cards); d.deck = cards(d.deck);
      d.table = withCtx(d, () => d.table.map(b => ({ a: ev(cards(b.a)), d: b.d ? ev(cards(b.d)) : null, by: b.by })));
      M = d; sync(); return M;
    } catch (e) { return null; }
  }

  return {
    RULES, SERIES_TO, withCtx, check, checkTransfer, options, newGame, act, viewFor, fromView, nextActive, openBattle, atkCount,
    dump, restore, throwers, get M() { return M; }, set M(v) { M = v; },
  };
})();
