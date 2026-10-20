/* ДурКер — «Компания»: движок дурака на 3–4 игрока.
   Два набора правил: «Классика» (комбинации, подкидывание по номиналу и по типу, перевод) и «Полные»
   (плюс «могнул», заряд и карты-действия, перекрытие на одну карту больше, апгрейд своей атаки).
   Матч — до N побед: побеждает в партии тот, кто первым вышел; дурак получает штраф (для щелбанов и статистики).
   Оценку комбинаций берём из rules.js: на время вызова подставляем свой контекст вместо G (там читаются G.T, G.table, G.rules). */
'use strict';

const M4 = (() => {
  const RULES_CLASSIC = { transfer: true, mognul: false, charge: false, over: false, upgrade: false, typeThrow: true, blitz: false, set: 'classic' };
  const RULES_FULL = { transfer: true, mognul: true, charge: true, over: true, upgrade: true, typeThrow: true, blitz: false, set: 'full' };
  const RULES = RULES_CLASSIC;
  const rulesOf = set => (set === 'full' ? RULES_FULL : RULES_CLASSIC);
  const CHARGE_MAX = 3, CALLS = 2;
  let M = null;

  /* ---------- контекст для функций rules.js ---------- */
  function withCtx(S, f) {
    const g = G;
    G = { T: S.T, table: S.table || [], rules: S.rules || RULES_CLASSIC, P: [], B: [], deck: [] };
    try { return f(); } finally { G = g; }
  }
  const cards = ns => ns.map(mkCard);
  /* оценка комбинации с кэшем: перебор джокеров дорогой, а одни и те же наборы карт проверяются много раз */
  const EVC = new Map();
  function evC(S, cs) {
    if (cs.some(c => c.action)) return null;
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
    hand = hand.filter(c => !c.action).sort((a, b) => (a.joker - b.joker) || ((a.s === S.T) - (b.s === S.T)) || a.r - b.r);
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
  const R = S => S.rules || RULES_CLASSIC;
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
    S.table.forEach(b => { b.a.cards.forEach(c => r.add(c.r)); if (b.d && !b.d.shield) b.d.cards.forEach(c => r.add(c.r)); });
    return r;
  }

  /* ---------- проверка хода (общая для хозяина, бота и экрана гостя) ---------- */
  /* S — состояние или вид с полями phase, att, def, table, T, limit, counts, passed, out, N, rules; cs — карты */
  function check(S, seat, cs, e0) {
    const no = why => ({ ok: false, why });
    if (!S || S.over != null || !S.phase || S.phase.who !== seat) return no(null);
    if (!cs.length) return no(null);
    if (cs.some(c => c.action)) return cs.length === 1 ? checkAction(S, seat, cs[0]) : no('Карту-действие играют отдельно');
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
      const a = b.a, tr = checkTransfer(S, seat, cs, e);
      const overOk = R(S).over && a.n >= 2 && a.n < 5 && e.n === a.n + 1;
      if (e.n !== a.n && !overOk) {
        if (tr.ok) return tr;
        if (a.n === 1) return no('Одиночку кроют одной картой');
        return no(R(S).over && a.n < 5 ? `Кроют ${a.n} ${plural(a.n)} или перекрывают ${a.n + 1}` : `Кроют тем же числом: ${a.n} ${plural(a.n)}`);
      }
      const ok = withCtx(S, () => beats(e, a));
      if (ok) return { ok: true, e, type: 'play', why: e.n > a.n ? 'Перекрытие!' : 'Бьёт!' };
      if (a.n === 5 && e.n === 5 && withCtx(S, () => eachOn() && !!eachMatch(e.cards, a.cards))) return { ok: true, e, type: 'play', why: 'Поштучно!' };
      if (tr.ok) return tr;
      return no(e.n > a.n ? 'Для перекрытия нужна комбинация старшего типа' : 'Не бьёт');
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
    if (!R(S).transfer || S.noTr || S.phase.kind !== 'defend' || seat !== S.def || !noneDefended(S)) return no(null);
    e = e || evC(S, cs);
    if (!e || !withCtx(S, () => sameRank(e, S.table[0].a))) return no(null);
    const to = nextActive(S, S.def);
    if (to === S.def) return no(null);
    if (atkCount(S) + e.n > Math.min(HAND, S.counts[to])) return no('У следующего не хватит карт на перевод');
    return { ok: true, e, type: 'transfer', to, why: 'Можно перевести!' };
  }
  /* апгрейд: атакующий докладывает карты к своей непокрытой атаке, пока защитник думает (раз за ход) */
  function checkUpgrade(S, seat, cs) {
    const no = why => ({ ok: false, why });
    if (!R(S).upgrade || !S.phase || S.phase.kind !== 'defend' || S.over != null || seat === S.def || !cs.length) return no(null);
    if (S.upgraded) return no('Апгрейд — один раз за ход');
    if (cs.some(c => c.action)) return no(null);
    const b = openBattle(S);
    if (!b || b.by !== seat) return no(null);
    const e = evC(S, [...b.a.cards, ...cs]);
    if (!e || withCtx(S, () => cmpE2(e, b.a)) <= 0) return no('Так атака не станет старше');
    if (atkCount(S) + cs.length > S.limit) return no('Стол полон');
    if (undefendedCards(S) + cs.length > S.counts[S.def]) return no('У защитника не хватит карт');
    return { ok: true, e, type: 'upgrade', why: `Апгрейд: ${b.a.name.toLowerCase()} → ${e.name.toLowerCase()}` };
  }
  /* карта-действие */
  function checkAction(S, seat, c) {
    const no = why => ({ ok: false, why }), ok = why => ({ ok: true, type: 'action', c, why });
    if (!R(S).charge || !c || !c.action || S.phase.who !== seat) return no(null);
    const k = S.phase.kind, trumpy = c.s === S.T;
    const hasSuit = e => trumpy || e.cards.some(x => x.s === c.s);
    if (k === 'attack') {
      if (c.action === 'plus') return ok(S.deckN === 0 || (S.deck && !S.deck.length) ? 'Колода пуста: защитник не сможет переводить в этот ход' : `Защитник доберёт ${trumpy ? 3 : 2}`);
      if (c.action === 'trump' && !trumpy) return ok(`Козырем станет ${SU[c.s]}`);
      return ok('Пас: ход перейдёт следующему');
    }
    if (k === 'defend') {
      const b = openBattle(S);
      if (!b || seat !== S.def) return no(null);
      if (c.action === 'shield') {
        if (trumpy) return ok('Козырный щит: атака уйдёт в бито без покрытия');
        if (!hasSuit(b.a)) return no(`В атаке нет ${SU[c.s]} — щит не подходит`);
        return shieldSize(b.a) ? ok('Атака уйдёт в бито без покрытия') : no('Обычный щит держит атаку до 3 карт или одной масти');
      }
      if (c.action === 'reverse') {
        if (!noneDefended(S)) return no('Разворот — только пока ничего не покрыто');
        if (!S.table.some(x => hasSuit(x.a))) return no(`В атаке нет ${SU[c.s]} — разворот не подходит`);
        if (atkCount(S) > Math.min(HAND, S.counts[S.att])) return no('У атакующего не хватит карт');
        return ok('Вся атака развернётся на атакующего');
      }
      if (c.action === 'trump') return trumpy ? no('Эта масть уже козырь') : ok(`Козырем станет ${SU[c.s]}`);
      return no('+2 играют, когда ходишь или подкидываешь');
    }
    if (k === 'throw' || k === 'addtake') {
      if (c.action === 'plus') return ok(`Защитник доберёт ${trumpy ? 3 : 2}`);
      if (c.action === 'trump' && !trumpy) return ok(`Козырем станет ${SU[c.s]}`);
      return no('Сейчас эту карту не сыграть');
    }
    return no(null);
  }
  /* все допустимые ходы из руки (для подбора и ботов) */
  function options(S, seat, hand) {
    const plain = hand.filter(c => !c.action);
    const k = S.phase && S.phase.kind;
    if (!k || S.phase.who !== seat) return [];
    let sizes;
    if (k === 'defend') {
      const ob = openBattle(S), n = ob ? ob.a.n : 1;
      sizes = R(S).over && n >= 2 && n < 5 ? [n, n + 1] : [n];
    } else sizes = k === 'attack' ? [1, 2, 3, 4, 5] : [2, 3, 4, 5];
    if (plain.length > 12) { const i = sizes.indexOf(5); if (i >= 0 && k !== 'defend') sizes.splice(i, 1); }
    const list = combosC(S, plain, sizes);
    const out = [];
    list.forEach(e => { const r = check(S, seat, e.cards, e); if (r.ok) out.push({ ...r, e: r.e || e }); });
    return out;
  }

  /* ---------- партия ---------- */
  /* cfg: { N, names[], kinds[] ('me'|'bot'|'net'), bots[], to, set, wins[], pens[], games, calls } */
  function newGame(cfg) {
    const N = cfg.N, deck = [];
    for (let n = 0; n < 54; n++) deck.push(mkCard(n));
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    if (deck[0].joker) { const k = deck.findIndex(c => !c.joker); [deck[0], deck[k]] = [deck[k], deck[0]]; }
    const z = () => Array(N).fill(0);
    M = {
      N, names: cfg.names.slice(), kinds: cfg.kinds.slice(), bots: (cfg.bots || []).slice(), hands: Array.from({ length: N }, () => []),
      deck, T: deck[0].s, trumpN: deck[0].n, table: [], grave: 0, att: 0, def: 1, phase: { kind: 'attack', who: 0 },
      rules: { ...rulesOf(cfg.set) }, set: cfg.set === 'full' ? 'full' : 'classic',
      to: [1, 2, 3].includes(cfg.to) ? cfg.to : 2, wins: (cfg.wins || z()).slice(), pens: (cfg.pens || z()).slice(),
      matchDone: false, matchWinner: null, winner: null,
      limit: HAND, passed: [], out: [], over: null, pen: 0, turnNo: 0, games: (cfg.games || 0), ev: null, evId: 0, counts: [],
      charge: z(), offer: Array(N).fill(null), lastSuit: Array(N).fill(deck[0].s), made: 0, upgraded: false,
      turnCovers: 0, chained: false, hype: null, hypeId: 0, calls: cfg.calls || 0,
      stats: { mognul: z(), transfer: z(), over: z(), acts: z() },
    };
    for (let r = 0; r < HAND; r++) for (let s = 0; s < N; s++) M.hands[s].push(M.deck.pop());
    /* первым ходит тот, у кого младший козырь */
    let first = 0, low = 99;
    M.hands.forEach((h, s) => h.forEach(c => { if (!c.joker && c.s === M.T && c.r < low) { low = c.r; first = s; } }));
    M.att = first; M.def = nextActive(M, first);
    sync();
    note('trump', first, low < 99 ? [`младший козырь ${rn(low)}${SU[M.T]} — ходит первым`, `младший козырь ${rn(low)}${SU[M.T]} — ходишь первым`] : ['ходит первым', 'ходишь первым'], ':');
    M.limit = Math.min(HAND, M.counts[M.def]);
    M.phase = { kind: 'attack', who: M.att };
    return M;
  }
  function sync() { if (M) M.counts = M.hands.map(h => h.length); }
  /* событие для ленты: у каждого игрока свой текст — «Ты кроешь» вместо своего ника */
  function note(kind, actor, verbs, sep, rest, target) {
    M.ev = { id: ++M.evId, kind, actor, verbs, sep: sep || ' ', rest: rest || '', target };
  }
  function evText(ev, seat) {
    if (!ev) return '';
    if (ev.raw) return ev.raw;
    const me = ev.actor === seat;
    const who = ev.actor == null ? '' : me ? 'Ты' : M_names()[ev.actor];
    const verb = ev.verbs ? ev.verbs[me ? 1 : 0] : '';
    const tg = ev.target == null ? '' : ev.target === seat ? 'тебя' : M_names()[ev.target];
    const rest = (ev.rest || '').replace('@T', tg);
    return `${who}${ev.sep === ':' ? ': ' : ' '}${verb}${rest ? ' ' + rest : ''}`.trim();
  }
  let namesRef = null;
  const M_names = () => namesRef || (M ? M.names : []);
  function raw(kind, text) { M.ev = { id: ++M.evId, kind, raw: text }; }
  function hype(key, actor, target) { M.hype = { id: ++M.hypeId, key, actor, target: target == null ? null : target }; }
  const H4 = s => M.hands[s];
  function take(seat, ns) {
    const h = H4(seat), out = [];
    for (const n of ns) { const i = h.findIndex(c => c.n === n); if (i < 0) return null; out.push(h[i]); }
    return out;
  }
  function remove(seat, cs) { const ids = new Set(cs.map(c => c.n)); M.hands[seat] = H4(seat).filter(c => !ids.has(c.n)); }
  function noteSuit(seat, cs) { const c = cs.filter(x => !x.joker && !x.action).pop(); if (c) M.lastSuit[seat] = c.s; }

  /* ---------- заряд ---------- */
  function addCharge(seat, n) {
    if (!M.rules.charge || M.offer[seat] || isOut(M, seat)) return;
    M.charge[seat] += n;
    if (M.charge[seat] >= CHARGE_MAX) {
      M.charge[seat] = 0;
      M.offer[seat] = { kinds: ACT_KEYS.slice().sort(() => Math.random() - 0.5).slice(0, 2), s: M.lastSuit[seat] };
      if (M.kinds[seat] === 'bot') {
        const pref = ['shield', 'plus', 'reverse', 'trump'];
        pick(seat, M.offer[seat].kinds.slice().sort((a, b) => pref.indexOf(a) - pref.indexOf(b))[0]);
      }
    }
  }
  function pick(seat, kind) {
    const o = M.offer[seat];
    if (!o || !o.kinds.includes(kind)) return false;
    const n = 1000 + (++M.made) * 16 + ACT_KEYS.indexOf(kind) * 4 + o.s;
    M.hands[seat].push(mkCard(n));
    M.offer[seat] = null;
    sync();
    note('gold', seat, [`заряжен: ${ACTS[kind].name} ${SU[o.s]}`, `взял карту «${ACTS[kind].name}» ${SU[o.s]}`], ':');
    M.ev.what = 'charge';
    return true;
  }

  /* единственная точка изменения партии */
  function act(seat, type, ns, kind) {
    if (!M || M.over != null) return { ok: false };
    if (type === 'pick') return { ok: pick(seat, String(kind)) };
    if (type === 'upgrade') return upgrade(seat, ns || []);
    if (M.phase.who !== seat) return { ok: false };
    const k = M.phase.kind;
    if (type === 'action') return playAction(seat, (ns || [])[0]);
    if (type === 'play' || type === 'transfer') {
      const cs = take(seat, ns || []);
      if (!cs) return { ok: false };
      if (cs.some(c => c.action)) return cs.length === 1 ? playAction(seat, cs[0].n) : { ok: false, why: 'Карту-действие играют отдельно' };
      const r = type === 'transfer' ? checkTransfer(M, seat, cs) : check(M, seat, cs);
      if (!r.ok) return { ok: false, why: r.why };
      const e = r.e;
      remove(seat, cs); sync(); noteSuit(seat, cs);
      if (r.type === 'transfer') {
        M.table.push({ a: e, d: null, by: seat });
        const from = M.att;
        M.att = seat; M.def = r.to;
        M.limit = Math.min(HAND, M.counts[M.def]);
        M.phase = { kind: 'defend', who: M.def };
        M.turnCovers = 0; M.upgraded = false;
        M.stats.transfer[seat]++;
        note('gold', seat, ['переводит на', 'переводишь на'], ' ', `@T: ${e.name.toLowerCase()}`, M.def);
        M.ev.what = 'transfer';
        if (M.rules.charge) { hype('transfer', seat, M.def); addCharge(seat, 1); }
        void from;
        return { ok: true };
      }
      if (k === 'attack') {
        M.table.push({ a: e, d: null, by: seat });
        M.phase = { kind: 'defend', who: M.def };
        note('atk', seat, ['ходит на', 'ходишь на'], ' ', `@T: ${e.name.toLowerCase()}`, M.def);
        return { ok: true };
      }
      if (k === 'defend') {
        const b = openBattle(M), a = b.a;
        b.d = e;
        M.turnCovers++;
        note('def', seat, ['кроет:', 'кроешь:'], ' ', e.name.toLowerCase());
        M.ev.what = 'cover';
        judgeCover(seat, e, a, b.by);
        afterCover();
        return { ok: true };
      }
      if (k === 'throw') {
        M.table.push({ a: e, d: null, by: seat });
        M.passed = [];
        M.phase = { kind: 'defend', who: M.def };
        note('atk', seat, ['подкидывает:', 'подкидываешь:'], ' ', e.name.toLowerCase());
        return { ok: true };
      }
      if (k === 'addtake') {
        M.table.push({ a: e, d: null, by: seat });
        note('take', seat, ['докидывает вдогонку', 'докидываешь вдогонку']);
        if (atkCount(M) >= M.limit) endTurn(false);
        else if (!M.counts[seat]) pass(seat);
        return { ok: true };
      }
      return { ok: false };
    }
    if (type === 'take' && k === 'defend' && seat === M.def) {
      note('take', seat, ['берёт', 'берёшь']);
      M.ev.what = 'take';
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
  /* «могнул», перекрытие, заряд за одиночку той же мастью, цепочка */
  function judgeCover(seat, e, a, by) {
    if (!M.rules.mognul && !M.rules.charge) return;
    if (e.n > a.n) {
      M.stats.over[seat]++;
      hype('over', seat, by);
      addCharge(by, 1);
    } else if (M.rules.mognul && e.n >= 2 && e.t > a.t) {
      M.stats.mognul[seat]++;
      M.pens[by] += 1;
      hype('mognul', seat, by);
      M.ev.what = 'mognul'; M.ev.target = by;
      addCharge(seat, 1);
    } else if (e.n === 1 && !e.jk && e.cards[0].s === a.cards[0].s && e.cards[0].s !== M.T) {
      addCharge(seat, 1);
    }
    if (M.turnCovers >= 3 && !M.chained) { M.chained = true; hype('chain', seat); addCharge(seat, 1); }
  }
  function upgrade(seat, ns) {
    const cs = take(seat, ns);
    if (!cs) return { ok: false };
    const r = checkUpgrade(M, seat, cs);
    if (!r.ok) return { ok: false, why: r.why };
    remove(seat, cs); sync(); noteSuit(seat, cs);
    openBattle(M).a = r.e;
    M.upgraded = true;
    note('atk', seat, ['докладывает:', 'докладываешь:'], ' ', `теперь ${r.e.name.toLowerCase()}`);
    hype('upgrade', seat, M.def);
    return { ok: true };
  }
  function playAction(seat, n) {
    const cs = take(seat, [n]);
    if (!cs) return { ok: false };
    const c = cs[0], r = checkAction(M, seat, c);
    if (!r.ok) return { ok: false, why: r.why };
    const k = M.phase.kind;
    remove(seat, [c]); sync();
    M.stats.acts[seat]++;
    const nm = `«${ACTS[c.action].name}» ${SU[c.s]}`;
    if (k === 'attack' && (c.action === 'shield' || c.action === 'reverse' || (c.action === 'trump' && c.s === M.T))) {
      M.grave++;
      note('gold', seat, [`играет ${nm} — пас`, `играешь ${nm} — пас`]);
      passTurn(seat);
      return { ok: true };
    }
    if (c.action === 'shield') {
      openBattle(M).d = { t: -1, n: 1, tr: 0, jk: 0, keys: [], name: 'Щит', cards: [c], shield: true };
      M.turnCovers++;
      note('def', seat, [`ставит ${nm}`, `ставишь ${nm}`]);
      afterCover();
      return { ok: true };
    }
    if (c.action === 'reverse') {
      M.grave++;
      const was = M.att;
      M.att = seat; M.def = was;
      M.limit = Math.min(HAND, M.counts[M.def]);
      M.phase = { kind: 'defend', who: M.def };
      M.table.forEach(b => { b.by = seat; });
      M.turnCovers = 0; M.upgraded = false;
      note('gold', seat, ['разворачивает атаку на', 'разворачиваешь атаку на'], ' ', '@T', was);
      hype('transfer', seat, was);
      return { ok: true };
    }
    if (c.action === 'plus') {
      M.grave++;
      const n2 = c.s === M.T ? 3 : 2, to = M.def;
      let drawn = 0;
      if (M.deck.length) { for (let i = 0; i < n2 && M.deck.length; i++) { M.hands[to].push(M.deck.pop()); drawn++; } } else M.noTr = true;
      sync();
      M.limit = Math.min(HAND, Math.max(M.limit, Math.min(HAND, M.counts[to])));
      note('gold', seat, [`играет ${nm}:`, `играешь ${nm}:`], ' ', drawn ? `@T добирает ${drawn}` : '@T не сможет переводить', to);
    }
    if (c.action === 'trump') {
      M.grave++;
      M.T = c.s;
      M.table.forEach(b => { b.a = withCtx(M, () => ev(b.a.cards)) || b.a; if (b.d && !b.d.shield) b.d = withCtx(M, () => ev(b.d.cards)) || b.d; });
      note('gold', seat, ['меняет козырь на', 'меняешь козырь на'], ' ', SU[c.s]);
    }
    if (k === 'attack' && !M.counts[seat]) { passTurn(seat); return { ok: true }; }
    return { ok: true };
  }
  /* пас вместо хода: атакующий добирает, ход переходит следующему */
  function passTurn(seat) {
    M.table = [];
    while (M.hands[seat].length < HAND && M.deck.length) M.hands[seat].push(M.deck.pop());
    sync();
    M.turnNo++;
    if (checkOut()) return;
    const na = isOut(M, M.def) ? nextActive(M, seat) : M.def;
    startTurn(na);
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
      note('bito', def, ['отбился — бито!', 'отбился — бито!'], ':');
    } else {
      let n = 0;
      M.table.forEach(b => {
        M.hands[def].push(...b.a.cards); n += b.a.n;
        if (b.d && !b.d.shield) { M.hands[def].push(...b.d.cards); n += b.d.n; } else if (b.d) M.grave++;
      });
      note('take', def, [`забирает ${n} ${plural(n)}`, `забираешь ${n} ${plural(n)}`]);
    }
    M.table = [];
    /* добор: атакующий, потом остальные подкидывавшие по кругу, защитник последним */
    const order = [att, ...thr.filter(s => s !== att), def];
    const seen = new Set();
    order.forEach(s => { if (seen.has(s) || isOut(M, s)) return; seen.add(s); while (M.hands[s].length < HAND && M.deck.length) M.hands[s].push(M.deck.pop()); });
    sync();
    M.turnNo++;
    if (checkOut()) return;
    /* кто ходит дальше: отбился — защитник; взял — следующий за ним */
    let na = beaten ? def : nextActive(M, def);
    if (isOut(M, na)) na = nextActive(M, na);
    startTurn(na);
  }
  function startTurn(na) {
    M.noTr = false;
    M.att = na; M.def = nextActive(M, na);
    M.passed = []; M.turnCovers = 0; M.chained = false; M.upgraded = false;
    M.limit = Math.min(HAND, M.counts[M.def]);
    M.phase = { kind: 'attack', who: M.att };
  }
  /* вышли все, у кого кончились карты при пустой колоде; остался один — он дурак */
  function checkOut() {
    if (!M.deck.length) for (let s = 0; s < M.N; s++) if (!isOut(M, s) && !M.counts[s]) M.out.push(s);
    const alive = [...Array(M.N).keys()].filter(s => !isOut(M, s));
    if (alive.length <= 1) { finish(alive.length ? alive[0] : 'draw'); return true; }
    /* защита от «вечной» партии: после 60 ходов дурак тот, у кого больше всех карт */
    if (M.turnNo >= 60) {
      const mx = Math.max(...alive.map(s => M.counts[s])), top = alive.filter(s => M.counts[s] === mx);
      raw('gold', '60 ходов — время вышло');
      if (!M.out.length) { const mn = Math.min(...alive.map(s => M.counts[s])), lo = alive.filter(s => M.counts[s] === mn); if (lo.length === 1) M.out.push(lo[0]); }
      finish(top.length === 1 ? top[0] : 'draw'); return true;
    }
    return false;
  }
  function finish(loser) {
    M.over = loser;
    M.phase = { kind: 'over', who: null };
    M.games++;
    M.winner = M.out.length ? M.out[0] : null;
    if (M.winner != null && M.winner !== loser) {
      M.wins[M.winner]++;
      if (M.wins[M.winner] >= M.to) { M.matchDone = true; M.matchWinner = M.winner; }
    }
    if (loser === 'draw') { M.pen = 0; raw('gold', 'Ничья — все вышли одновременно'); return; }
    M.pen = Math.min(10, M.counts[loser]);
    M.pens[loser] += M.pen;
    note('take', loser, [`— ДУРАК! +${M.pen} штрафа`, `— ДУРАК! +${M.pen} штрафа`]);
    M.ev.what = 'over';
  }

  /* ---------- «Поймай шулера»: бот-Шулер подменяет худшую карту лучшей из верха колоды ---------- */
  function cheatSwap(seat) {
    if (!M || M.over != null || M.deck.length < 3) return null;
    const h = M.hands[seat], val = c => (c.action ? 99 : c.joker ? 30 : c.r + (c.s === M.T ? 14 : 0));
    const plain = h.filter(c => !c.action);
    if (!plain.length) return null;
    const worst = plain.reduce((a, b) => (val(b) < val(a) ? b : a));
    const top = M.deck.slice(-3), best = top.reduce((a, b) => (val(b) > val(a) ? b : a));
    if (val(best) <= val(worst)) return null;
    const hi = h.indexOf(worst), di = M.deck.indexOf(best);
    h[hi] = best; M.deck[di] = worst;
    return { seat, got: best.n, worst: worst.n };
  }
  /* обвинение: info — данные настоящей подтасовки или null (мерцание вхолостую) */
  function accuse(me, cheater, info) {
    if (!M || M.calls >= CALLS) return { ok: false };
    M.calls++;
    if (info) {
      const h = M.hands[info.seat], gi = h.findIndex(c => c.n === info.got), di = M.deck.findIndex(c => c.n === info.worst);
      if (gi >= 0 && di >= 0) { const g = h[gi]; h[gi] = M.deck[di]; M.deck[di] = g; }
      M.pens[info.seat] += 3;
      raw('gold', `${M.names[info.seat]} спалился на подтасовке: +3 штрафа`);
      hype('caught', me, info.seat);
      return { ok: true, caught: true };
    }
    M.pens[me] += 1;
    raw('take', `Мимо! Ложное обвинение: тебе +1 штраф`);
    hype('falsecall', cheater, me);
    return { ok: true, caught: false };
  }

  /* ---------- что видит игрок seat ---------- */
  function viewFor(seat) {
    if (!M) return null;
    namesRef = M.names;
    const ev = M.ev ? { id: M.ev.id, kind: M.ev.kind, what: M.ev.what || '', actor: M.ev.actor, target: M.ev.target, text: evText(M.ev, seat) } : null;
    return {
      N: M.N, me: seat, names: M.names, kinds: M.kinds.map(k => (k === 'bot' ? 'bot' : 'p')), counts: M.counts.slice(),
      hand: M.hands[seat].map(c => c.n), T: M.T, trumpN: M.trumpN, deckN: M.deck.length, grave: M.grave,
      table: M.table.map(b => ({ a: b.a.cards.map(c => c.n), d: b.d ? (b.d.shield ? { sh: b.d.cards[0].n } : b.d.cards.map(c => c.n)) : null, by: b.by })),
      att: M.att, def: M.def, phase: M.phase, limit: M.limit, passed: M.passed.slice(), out: M.out.slice(),
      over: M.over, pen: M.pen, games: M.games, ev, turnNo: M.turnNo, v: VERSION,
      set: M.set, rules: M.rules, to: M.to, wins: M.wins.slice(), pens: M.pens.slice(), matchDone: M.matchDone, matchWinner: M.matchWinner, winner: M.winner,
      charge: M.charge.slice(), offer: M.offer[seat], offers: M.offer.map(o => !!o), upgraded: M.upgraded, noTr: M.noTr, hype: M.hype, calls: M.calls,
    };
  }
  /* вид гостя → состояние для проверок (комбинации пересчитываются у него же) */
  const battleFrom = (S, b) => ({
    a: withCtx(S, () => ev(cards(b.a))),
    d: b.d ? (b.d.sh != null ? { t: -1, n: 1, tr: 0, jk: 0, keys: [], name: 'Щит', cards: [mkCard(b.d.sh)], shield: true } : withCtx(S, () => ev(cards(b.d)))) : null,
    by: b.by,
  });
  function fromView(V) {
    const S = { ...V, out: V.out || [], passed: V.passed || [], rules: V.rules || RULES_CLASSIC };
    S.table = [];
    S.table = V.table.map(b => battleFrom(S, b));
    S.hand = cards(V.hand);
    return S;
  }

  /* сохранить / восстановить (хозяин стола после обновления страницы) */
  function dump() {
    if (!M) return null;
    return JSON.stringify({ ...M, table: M.table.map(b => ({ a: b.a.cards.map(c => c.n), d: b.d ? (b.d.shield ? { sh: b.d.cards[0].n } : b.d.cards.map(c => c.n)) : null, by: b.by })),
      hands: M.hands.map(h => h.map(c => c.n)), deck: M.deck.map(c => c.n) });
  }
  function restore(s) {
    try {
      const d = JSON.parse(s);
      d.hands = d.hands.map(cards); d.deck = cards(d.deck);
      d.rules = d.rules || rulesOf(d.set);
      const tb = d.table; d.table = [];
      d.table = tb.map(b => battleFrom(d, b));
      if (!d.wins) { d.wins = Array(d.N).fill(0); d.pens = (d.series || Array(d.N).fill(0)).slice(); d.to = 2; }
      if (!d.charge) { d.charge = Array(d.N).fill(0); d.offer = Array(d.N).fill(null); d.lastSuit = Array(d.N).fill(d.T); d.stats = { mognul: Array(d.N).fill(0), transfer: Array(d.N).fill(0), over: Array(d.N).fill(0), acts: Array(d.N).fill(0) }; }
      M = d; sync(); return M;
    } catch (e) { return null; }
  }

  return {
    RULES, RULES_CLASSIC, RULES_FULL, rulesOf, CHARGE_MAX, CALLS, withCtx, check, checkTransfer, checkUpgrade, checkAction, options, newGame, act,
    viewFor, fromView, nextActive, openBattle, atkCount, dump, restore, throwers, cheatSwap, accuse, evText,
    get M() { return M; }, set M(v) { M = v; },
  };
})();
