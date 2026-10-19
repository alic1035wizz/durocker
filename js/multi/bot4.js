/* Дурокер — «Компания»: боты для стола на 3–4 игрока.
   Простые и честные: видят только свою руку и стол. Уровни: student (ошибается), valera (рассудительный), sharper (бережёт козыри, давит в конце). */
'use strict';

const BOT4 = (() => {
  const v = (S, c) => (c.joker ? 30 : c.r + (c.s === S.T ? 14 : 0));
  const cost = (S, cs) => cs.reduce((n, c) => n + v(S, c), 0);
  const hasPrecious = (S, cs) => cs.some(c => c.joker || c.s === S.T || c.r >= 13);
  /* решение бота seat: [тип, номера карт] */
  function decide(S, seat, bot) {
    const lvl = (bot && bot.ai) || 'valera';
    const hand = S.hands ? S.hands[seat] : S.hand;
    const k = S.phase.kind, late = S.deck ? S.deck.length < 4 : S.deckN < 4;
    const opts = M4.options(S, seat, hand);
    const pick = (list, score) => list.reduce((b, o) => { const sc = score(o); return !b || sc > b.sc ? { o, sc } : b; }, null);
    if (k === 'attack') {
      if (!opts.length) return ['play', [hand[0].n]];
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
      const covers = opts.filter(o => o.type === 'play').sort((x, y) => cost(S, x.e.cards) - cost(S, y.e.cards));
      const tr = opts.filter(o => o.type === 'transfer').sort((x, y) => cost(S, x.e.cards) - cost(S, y.e.cards));
      /* перевод — всегда соблазн, если он дешевле покрытия */
      const c = covers[0], t = tr[0];
      if (t && (!c || cost(S, t.e.cards) + 6 < cost(S, c.e.cards) || lvl === 'sharper')) return ['transfer', t.e.cards.map(x => x.n)];
      if (!c) return ['take', []];
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
  return { decide };
})();
