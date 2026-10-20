/* ДурКер — «Компания»: боты для стола на 3–4 игрока.
   Видят только свою руку и стол. Уровни: student (ошибается), valera (рассудительный), sharper (бережёт козыри, давит в конце).
   В «Полных правилах» умеют играть карты-действия, перекрывать и докладывать к своей атаке. */
'use strict';

const BOT4 = (() => {
  const v = (S, c) => (c.action ? 22 : c.joker ? 30 : c.r + (c.s === S.T ? 14 : 0));
  const cost = (S, cs) => cs.reduce((n, c) => n + v(S, c), 0);
  const hasPrecious = (S, cs) => cs.some(c => c.joker || c.s === S.T || c.r >= 13);
  const handOf = (S, seat) => (S.hands ? S.hands[seat] : S.hand);
  const deckLeft = S => (S.deck ? S.deck.length : S.deckN);
  /* карты-действия, которые можно сыграть прямо сейчас */
  function acts(S, seat, kind) {
    return handOf(S, seat).filter(c => c.action && (!kind || c.action === kind) && M4.checkAction(S, seat, c).ok);
  }
  /* менять козырь стоит, если в новой масти заметно больше карт */
  function trumpWorth(S, seat, c) {
    const h = handOf(S, seat), cnt = s => h.filter(x => x.s === s && !x.action && !x.joker).length;
    return c.s !== S.T && cnt(c.s) >= cnt(S.T) + 2;
  }
  /* решение бота seat: [тип, номера карт] */
  function decide(S, seat, bot) {
    const lvl = (bot && bot.ai) || 'valera';
    const hand = handOf(S, seat);
    const k = S.phase.kind, late = deckLeft(S) < 4;
    const full = S.rules && S.rules.charge;
    const opts = M4.options(S, seat, hand, hand.length > 9 ? 700 : hand.length > 7 ? 1400 : 2500);
    const pick = (list, score) => list.reduce((b, o) => { const sc = score(o); return !b || sc > b.sc ? { o, sc } : b; }, null);
    if (full) {
      /* +2 и смена козыря — до основного хода */
      const tr = acts(S, seat, 'trump').find(c => trumpWorth(S, seat, c));
      if (tr && lvl !== 'student') return ['action', [tr.n]];
      if ((k === 'attack' || k === 'throw') && deckLeft(S) > 0) {
        const pl = acts(S, seat, 'plus')[0];
        if (pl && (lvl !== 'student' || Math.random() < 0.5) && (k === 'attack' || Math.random() < 0.5)) return ['action', [pl.n]];
      }
    }
    if (k === 'attack') {
      if (!opts.length) {
        const a = full ? acts(S, seat)[0] : null;
        if (a) return ['action', [a.n]];
        const c = hand.find(x => !x.action) || hand[0];
        return c ? ['play', [c.n]] : ['pass', []];
      }
      const best = pick(opts, o => {
        const e = o.e, avg = cost(S, e.cards) / e.n;
        let s = e.n * (late ? 8 : 3) - avg;
        if (!late && hasPrecious(S, e.cards)) s -= 12;
        if (lvl === 'student') s += Math.random() * 10;
        return s;
      });
      return ['play', best.o.e.cards.map(c => c.n)];
    }
    if (k === 'defend') {
      const b = M4.openBattle(S);
      const covers = opts.filter(o => o.type === 'play').sort((x, y) => (x.e.n - y.e.n) || cost(S, x.e.cards) - cost(S, y.e.cards));
      const tr = opts.filter(o => o.type === 'transfer').sort((x, y) => cost(S, x.e.cards) - cost(S, y.e.cards));
      const sh = full ? acts(S, seat, 'shield')[0] : null, rv = full ? acts(S, seat, 'reverse')[0] : null;
      /* перевод — всегда соблазн, если он дешевле покрытия */
      const c = covers[0], t = tr[0];
      if (t && (!c || cost(S, t.e.cards) + 6 < cost(S, c.e.cards) || lvl === 'sharper')) return ['transfer', t.e.cards.map(x => x.n)];
      /* щит на дорогую атаку: не тратим козыри */
      if (sh && lvl !== 'student' && (!c || (c.e.tr > 0 || c.e.jk > 0 || b.a.n >= 4))) return ['action', [sh.n]];
      if (!c) {
        if (rv) return ['action', [rv.n]];
        if (sh) return ['action', [sh.n]];
        return ['take', []];
      }
      if (lvl === 'student' && Math.random() < 0.12) return ['take', []];
      /* не жжём джокера и старшие козыри на мелкую одиночку, пока колода толстая */
      const pricey = cost(S, c.e.cards) - cost(S, b.a.cards);
      if (!late && b.a.n === 1 && pricey > 18 && hand.length <= 6 && lvl !== 'student') return ['take', []];
      return ['play', c.e.cards.map(x => x.n)];
    }
    if (k === 'throw' || k === 'addtake') {
      let list = opts;
      if (!late) list = list.filter(o => !hasPrecious(S, o.e.cards));
      if (!list.length) return ['pass', []];
      if (k === 'throw' && lvl === 'student' && Math.random() < 0.5) return ['pass', []];
      const best = pick(list, o => -cost(S, o.e.cards) / o.e.n + o.e.n * 2);
      /* в чужую драку подкидываем только мелочь */
      if (k === 'throw' && seat !== S.att && !late && cost(S, best.o.e.cards) / best.o.e.n > 9) return ['pass', []];
      return ['play', best.o.e.cards.map(c => c.n)];
    }
    return ['pass', []];
  }
  /* апгрейд своей непокрытой атаки, пока защитник думает: дешёвые 1–2 карты, без джокеров и козырей до конца колоды */
  function upgrade(S, seat, bot) {
    if (!S.rules || !S.rules.upgrade || S.upgraded || !S.phase || S.phase.kind !== 'defend' || seat === S.def) return null;
    const b = M4.openBattle(S);
    if (!b || b.by !== seat) return null;
    if (((bot && bot.ai) || 'valera') === 'student' && Math.random() < 0.6) return null;
    const late = deckLeft(S) < 4;
    const hand = handOf(S, seat).filter(c => !c.action && (late || (!c.joker && c.s !== S.T)));
    let best = null;
    for (let i = 0; i < hand.length; i++) {
      for (let j = i; j < hand.length; j++) {
        const cs = i === j ? [hand[i]] : [hand[i], hand[j]];
        if (!M4.checkUpgrade(S, seat, cs).ok) continue;
        const c = cost(S, cs);
        if (!best || c < best.c) best = { cs, c };
      }
    }
    return best && best.c <= (late ? 60 : 24) ? best.cs.map(c => c.n) : null;
  }
  return { decide, upgrade };
})();
