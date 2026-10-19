/* Дурокер — интерфейс: табло, блок «его × твоя», рука и кнопки под ней, хайп-фразы, заряд,
   меню (карьера, своя игра, ежедневная, онлайн, коллекция, настройки, правила). */
'use strict';

/* ================= эффекты ходов ================= */
function fx(o) {
  o.id = ++fxId; G.fx = o;
  G.fxList = (G.fxList || []).concat(o).slice(-6);
  showFx(o);
}
function showFx(o) {
  const me = o.actor === 'p', opp = oppName();
  sfxFor(o);
  if (o.what === 'hype') return showHype(o.key, me);
  if (o.what === 'charged') {
    if (!me) say('Зарядился!');
    return banner('ЗАРЯД', `${me ? 'Ты взял' : opp + ' взял'}: ${ACTS[o.act].name} ${SU[o.s]}`, 'gold');
  }
  if (o.what === 'trump') {
    const c = o.low != null ? mkCard(o.low) : null, t = c ? cardName(c) : '';
    return banner('КОЗЫРЬ ' + SU[G.T], c ? (me ? `Младший козырь твой: ${t}. Ходи!` : `У соперника ${t}. Он ходит.`)
      : (me ? 'Козырей нет. Ходи первым.' : 'Козырей нет. Соперник ходит.'), 'gold');
  }
  if (o.what === 'bito') return banner('БИТО', '', 'gold');
  if (o.what === 'takes') {
    if (me) buzz('bad');
    if (!me) say('Беру…');
    return banner(me ? 'БЕРУ' : 'БЕРЁТ!', me ? 'Соперник может подкинуть' : 'Можешь подкинуть вдогонку', 'take');
  }
  if (o.what === 'action') {
    if (!me) say(ACTS[o.act].name + '!');
    VFX.actionZoom({ action: o.act, s: o.s, id: 'z', n: -1, r: 16 }, me);
    if (o.act === 'trump') setTimeout(() => { const f = $('felt'); f.classList.remove('tpulse'); void f.offsetWidth; f.classList.add('tpulse'); }, 400);
    return;
  }
  if (o.what === 'transfer') { if (!me) say('Перевожу!'); banner('ПЕРЕВОД', me ? 'Теперь отбивается соперник' : 'Атака перешла к тебе', 'gold'); return shake(6); }
  const sub = {
    attack: me ? 'Твой ход' : `${opp} ходит`, throw: me ? 'Подкидываешь' : `${opp} подкидывает`,
    defend: me ? 'Покрыл!' : `${opp} кроет`, addtake: me ? 'Вдогонку' : `${opp} вдогонку`,
  }[o.what] || '';
  banner(String(o.big || '').toUpperCase(), sub, o.kind);
  if (o.t >= 5) shake(o.t);
  if (o.t >= 3) VFX.burstFelt(o.t);
}
function sfxFor(o) {
  const w = o.what;
  if (w === 'attack' || w === 'throw' || w === 'addtake') { AU.play('place'); AU.play('combo', o.t || 0); }
  else if (w === 'defend') { AU.play('place'); AU.play('cover'); if (o.t) AU.play('combo', o.t); }
  else if (w === 'takes') AU.play('take');
  else if (w === 'bito') AU.play('bito');
  else if (w === 'transfer') AU.play('transfer');
  else if (w === 'action' || w === 'charged') { AU.play('action'); if (o.act === 'trump') AU.play('trump'); }
  else if (w === 'trump') AU.play('trump');
  else if (w === 'hype') AU.play(o.actor === 'p' ? 'hype' : 'hypeBad');
}
/* хайп-фраза: граффити поверх стола, чуть позже надписи комбинации */
let hypeQ = Promise.resolve();
function showHype(key, mine) {
  const txt = hypeText(key, mine);
  if (!txt) return;
  hypeQ = hypeQ.then(() => new Promise(res => setTimeout(() => {
    const el = $('hype');
    el.textContent = txt; el.className = 'hype' + (mine ? '' : ' bad'); el.hidden = false;
    void el.offsetWidth; el.classList.add('on');
    if (mine) VFX.burstFelt(9); else shake(9);
    buzz(mine ? 'big' : 'bad');
    setTimeout(() => { el.hidden = true; }, 1800);
    res();
  }, 450)));
}
function banner(big, sub, kind) {
  const b = $('banner');
  $('bBig').textContent = big; $('bSub').textContent = sub || ''; $('bSub').hidden = !sub;
  b.className = 'banner ' + (kind || ''); void b.offsetWidth; b.classList.add('on');
}
function shake(t) {
  if (reduced) return;
  const m = t >= 9 ? 9 : 5;
  $('felt').animate([{ transform: 'none' }, { transform: `translate(${m}px,-2px) rotate(.6deg)` },
    { transform: `translate(-${m}px,2px) rotate(-.6deg)` }, { transform: `translate(${m / 2}px,0)` }, { transform: 'none' }], { duration: 380 });
}
let sayT;
function say(t) {
  if (!t) return;
  const b = $('bubble'); b.textContent = t; b.classList.add('on');
  clearTimeout(sayT); sayT = setTimeout(() => b.classList.remove('on'), 1400);
}

/* ================= состояние для интерфейса ================= */
const selected = () => G.P.filter(c => G.sel.has(c.id));
function uiPhase() {
  if (!G) return 'wait';
  if (G.over) return 'over';
  if (G.pending) return 'wait';
  if (G.phase.who === 'p' && !G.busy) return 'p_' + G.phase.kind;
  return 'wait';
}
/* подсказки: в онлайне всегда как у «профи», чтобы было честно */
const level = () => (NET ? 'pro' : hintLevel());
function selectedAction() {
  const cs = selected(), a = cs.filter(c => c.action);
  if (!a.length) return null;
  return cs.length === 1 ? a[0] : 'mixed';
}

/* ================= карты ================= */
function cardHTML(c, down) {
  if (down) return `<div class="card down" data-id="${c.id}"><div class="back"></div></div>`;
  if (c.action) {
    const red = c.s === 1 || c.s === 2, a = ACTS[c.action];
    return `<div class="card act act-${c.action} ${c.s === G.T ? 'trump' : ''}" data-id="${c.id}"><div class="front ${red ? 'red' : ''}"><span class="ix tl">${SU[c.s]}</span><span class="pip"><span class="ai">${a.icon}</span><small>${a.name}</small></span><span class="ix br">${SU[c.s]}</span></div><div class="back"></div></div>`;
  }
  if (c.joker) return `<div class="card joker" data-id="${c.id}"><div class="front"><span class="ix tl">★<i>JK</i></span><span class="pip"><span class="jk">★<small>джокер</small></span></span><span class="ix br">★<i>JK</i></span></div><div class="back"></div></div>`;
  const red = c.s === 1 || c.s === 2, tr = c.s === G.T, rk = rn(c.r);
  const center = c.r > 10 && c.r < 14 ? `<span class="fc">${rk}<small>${SU[c.s]}</small></span>` : SU[c.s];
  return `<div class="card ${tr ? 'trump' : ''}" data-id="${c.id}"><div class="front ${red ? 'red' : ''}"><span class="ix tl">${rk}<i>${SU[c.s]}</i></span><span class="pip">${center}</span><span class="ix br">${rk}<i>${SU[c.s]}</i></span></div><div class="back"></div></div>`;
}
function sortHand(h) {
  return h.slice().sort(G.sort === 'r' ? (a, b) => (!!a.action - !!b.action) || a.r - b.r || a.s - b.s
    : (a, b) => (!!a.action - !!b.action) || (!!a.joker - !!b.joker) || ((a.s === G.T) - (b.s === G.T)) || a.s - b.s || a.r - b.r);
}
const shortCards = cs => cs.map(c => (c.joker ? '★' : c.action ? ACTS[c.action].name : rn(c.r) + SU[c.s])).join(' ');
const pipsHTML = n => [0, 1, 2].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('');

/* ================= табло ================= */
function renderHUD() {
  const live = !!NET, bot = currentBot(), av = $('oppAva');
  av.textContent = live ? (NET.oppNick || '?').slice(0, 2).toUpperCase() : bot.face;
  av.style.background = live ? '#3b6db8' : bot.color;
  $('oppName').textContent = oppName();
  $('oppCount').textContent = G && G.B ? `${G.B.length} ${plural(G.B.length)}` : '';
  $('oppDot').hidden = !live; $('oppDot').classList.toggle('off', !!(NET && !NET.connected));
  $('oppBtn').disabled = live || MODE.kind !== 'free';
  const ch = G && G.charge ? G.charge.b : 0, full = G && G.offer && G.offer.b;
  const op = $('oppPips'); op.innerHTML = pipsHTML(full ? 3 : ch); op.classList.toggle('full', !!full);
  const lim = NET ? 11 : seriesTo();
  $('scP').textContent = SERIES.p; $('scB').textContent = SERIES.b;
  $('scP').classList.toggle('hot', SERIES.p >= lim - 4); $('scB').classList.toggle('hot', SERIES.b >= lim - 4);
  $('scOpp').textContent = oppName().split(' ').pop();
  $('scTo').textContent = MODE.kind === 'daily' ? 'одна партия' : `штраф до ${lim}`;
  /* режим и особые правила */
  const chips = [];
  if (NET) {
    chips.push(`стол ${esc(NET.code.toUpperCase())}`);
    const f = prog().friends[NET.oppNick];
    if (f) chips.push(`против ${esc(NET.oppNick)}: ${f.w}–${f.l}`);
  } else if (MODE.kind === 'career') chips.push(`${esc(CAREER[bot.district].name)} · ${bot.slot + 1}/3`);
  else if (MODE.kind === 'daily') chips.push(`Ежедневная #${dailyNumber(MODE.day)}`);
  if ((G && G.rules && G.rules.blitz) || (!NET && blitzOn() && MODE.kind === 'free')) chips.push('Блиц');
  if (!NET && bot.boss && MODE.kind === 'career') chips.push(`<span class="boss">${esc(bossRule(bot.boss))}</span>`);
  $('modeBox').innerHTML = chips.map(c => c.startsWith('<span') ? c : `<span>${c}</span>`).join('');
  if (G && G.T != null) {
    const red = G.T === 1 || G.T === 2;
    $('trumpBox').innerHTML = `<b class="${red ? 'red' : ''}">${SU[G.T]}</b><span>козырь<br>в колоде ${G.deck.length}${G.deck.length ? '' : ' — последний круг'}</span>`;
  }
  renderSound();
}
function bossRule(b) {
  return { babka: 'Каждый 3-й ход — новый козырь', vahter: 'Переводы запрещены', taxi: '10 секунд на ход', major: 'Начинает с полным зарядом', sharper: 'Знает твою руку в конце' }[b] || '';
}

/* ================= стол и рука ================= */
function render() {
  document.documentElement.dataset.hints = level();
  renderHUD();
  const felt = $('felt');
  felt.dataset.trump = G.T;
  const last = !G.deck.length && !G.over;
  felt.classList.toggle('last', last);
  AU.setLevel(last ? 2 : 1);
  $('botHand').innerHTML = G.B.map(c => `<div class="slot">${cardHTML(c, true)}</div>`).join('');
  $('deckcol').innerHTML = `<div class="deck">${G.deck.length > 1 ? '<div class="stack"></div>' : ''}${G.deck.length ? `<div class="trumpcard">${cardHTML(G.trump, false)}</div>` : ''}${G.deck.length > 1 ? `<div class="cnt">${G.deck.length}</div>` : ''}</div>
    <div class="lbl"><b>${SU[G.T]}</b>${G.deck.length}/${DECK}</div>`;
  $('gravecol').innerHTML = `<div class="grave ${G.grave ? '' : 'empty'}" id="grave">${G.grave ? '<i></i>' : ''}</div><div class="lbl">бито ${G.grave}</div>`;
  const ob = openB(), p = uiPhase();
  $('battles').innerHTML = G.table.length ? G.table.map(b => `<div class="battle ${b === ob ? 'open' : ''}"><span class="tag">${b.a.name}${b.a.jk ? ' ★' : ''}</span>
      <div class="row atk">${b.a.cards.map(c => cardHTML(c)).join('')}</div>
      ${b.d ? `<div class="row def">${b.d.cards.map(c => cardHTML(c)).join('')}</div>` : ''}</div>`).join('')
    : `<div class="empty-felt">${p === 'p_attack' ? 'Выбери карты и ходи' : p === 'over' ? '' : G.phase.who === 'b' ? `${esc(oppName())} думает…` : ''}</div>`;
  const hint = p === 'p_defend' && level() !== 'pro' ? defenseHint() : null;
  const can = hint ? hint.ids : new Set();
  $('hand').innerHTML = sortHand(G.P).map((c, i) => `<div class="slot ${G.sel.has(c.id) ? 'sel' : ''} ${can.has(c.id) ? 'can' : ''}" style="--i:${i}">${cardHTML(c)}</div>`).join('');
  const mine = G.offer && G.offer.p ? 3 : (G.charge ? G.charge.p : 0);
  $('myCharge').innerHTML = `${pipsHTML(mine).replace(/<i/g, '<i')}<em>заряд</em>`;
  $('myCharge').querySelectorAll('i').forEach((i, k) => i.classList.toggle('on', k < mine));
  $('handInfo').textContent = `на руке ${G.P.length}`;
  $('reactBtn').hidden = !NET;
  $('sortR').classList.toggle('on', G.sort === 'r'); $('sortS').classList.toggle('on', G.sort === 's');
  renderCombo(); renderActions(); renderOffer(); layout();
}

/* можно сделать апгрейд: ты атакуешь, соперник думает над защитой */
function upPhase() {
  return !!(G && !G.over && !G.pending && !G.busy && G.attacker === 'p' && G.phase.kind === 'defend' && G.phase.who === 'b' && !G.upgraded && openB());
}

/* ================= подбор: одна кнопка листает все ходы, которые сейчас можно сделать ================= */
function pickOptions() {
  const p = uiPhase(), hand = G.P.filter(c => !c.action);
  const sig = p + (upPhase() ? 'u' : '') + '|' + G.P.map(c => c.id).join() + '|' + G.T + '|' + G.table.map(b => b.a.cards.map(c => c.id).join('.') + (b.d ? 'd' : '')).join('/');
  if (G.pick && G.pick.sig === sig) return G.pick;
  let list = [];
  /* дорогие карты — джокеры и козыри — в конце списка */
  const pricey = cs => cs.some(c => c.joker || c.s === G.T) ? 1 : 0;
  if (p === 'p_defend') {
    const o = defenseOptions('p'), a = openB() ? openB().a : null;
    const plain = o.cover.filter(e => !a || e.n === a.n), over = o.cover.filter(e => a && e.n > a.n);
    plain.sort((x, y) => pricey(x.cards) - pricey(y.cards) || cost(x.cards) - cost(y.cards));
    over.sort((x, y) => pricey(x.cards) - pricey(y.cards) || cost(x.cards) - cost(y.cards));
    list = [...plain, ...over, ...o.transfer].map(e => e.cards);
  } else if (p === 'p_attack' || p === 'p_throw' || p === 'p_addtake') {
    list = combos(hand, [1, 2, 3, 4, 5]).filter(e => checkMove('p', e.cards).ok)
      .sort((x, y) => pricey(x.cards) - pricey(y.cards) || cost(x.cards) / x.n - cost(y.cards) / y.n || y.n - x.n).map(e => e.cards);
  } else if (upPhase()) {
    const a = openB().a, max = Math.min(5 - a.n, 4), L = hand.length, pick = [];
    const rec = (st, d, k) => {
      if (d === k) { const cs = pick.slice(0, k); if (checkUpgrade('p', cs).ok) list.push(cs); return; }
      for (let i = st; i <= L - (k - d); i++) { pick[d] = hand[i]; rec(i + 1, d + 1, k); }
    };
    for (let k = 1; k <= max; k++) rec(0, 0, k);
    list.sort((x, y) => cost(x) - cost(y));
  }
  const seen = new Set();
  list = list.filter(cs => { const k = cs.map(c => c.id).sort().join(); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 40);
  G.pick = { sig, list, i: -1 };
  return G.pick;
}
function nextPick() {
  if (!G || (!uiPhase().startsWith('p_') && !upPhase())) return;
  const pk = pickOptions();
  if (!pk.list.length) { G.sel.clear(); update(); toast('Нечего выбрать — ' + (uiPhase() === 'p_defend' ? 'бери' : uiPhase() === 'p_throw' ? 'жми «Бито»' : 'ход только картой-действием')); return; }
  pk.i = (pk.i + 1) % pk.list.length;
  G.sel = new Set(pk.list[pk.i].map(c => c.id));
  AU.play('select');
  update();
}
function renderPickBtn() {
  const b = $('pickBtn');
  if (!b) return;
  const on = G && (uiPhase().startsWith('p_') && uiPhase() !== 'p_over' || upPhase());
  b.disabled = !on;
  const pk = on && G.pick && G.pick.i >= 0 && G.pick.list.length && G.pick.list[G.pick.i].every(c => G.sel.has(c.id)) && G.sel.size === G.pick.list[G.pick.i].length ? G.pick : null;
  b.textContent = pk && pk.list.length ? `⟳ ${pk.i + 1}/${pk.list.length}` : '⟳ Подбор';
}

/* ================= подсказка при защите ================= */
function defenseHint() {
  const ob = openB();
  if (!ob) return null;
  const key = G.P.map(c => c.id).join() + '|' + G.T + '|' + G.table.map(b => b.a.cards.map(c => c.id).join('.') + (b.d ? 'd' : '')).join('/');
  if (G.hintKey === key) return G.hint;
  const o = defenseOptions('p'), ids = new Set();
  o.cover.forEach(e => e.cards.forEach(c => ids.add(c.id)));
  o.transfer.forEach(e => e.cards.forEach(c => ids.add(c.id)));
  (o.acts || []).forEach(c => ids.add(c.id));
  G.hintKey = key; G.hint = { ...o, ids };
  return G.hint;
}
function useHint() {
  if (uiPhase() !== 'p_defend' || level() !== 'novice') return;
  const h = defenseHint();
  if (!h) return;
  const best = h.cover[0] || h.transfer[0];
  const act = (h.acts || []).find(c => c.action === 'shield') || (h.acts || []).find(c => c.action === 'reverse');
  if (!best && !act) return;
  G.sel = new Set(best ? best.cards.map(c => c.id) : [act.id]);
  update();
}

/* ================= блок «его × твоя» ================= */
/* выбранные карты не складываются: ищем самую сильную комбинацию внутри выбора и говорим, что убрать */
function nearestCombo(cs) {
  const real = cs.filter(c => !c.action);
  let best = null;
  for (let k = real.length; k >= 2 && !best; k--) {
    combos(real, [k]).forEach(e => { if (!best || cmpE2(e, best) > 0) best = e; });
  }
  if (!best) return null;
  const keep = new Set(best.cards.map(c => c.id));
  return { e: best, drop: cs.filter(c => !keep.has(c.id)) };
}
function check() { if (G.guest && G.pending) return { ok: false, e: null }; return checkMove('p', selected()); }
/* цвет плашки: зелёный — можно, красный — нельзя, золотой — особый ход */
const mineCls = r => (!r || !r.ok ? 'mine no' : /перекрыт|перевест|апгрейд/i.test(r.why || '') ? 'mine gold' : 'mine ok');
function plate(cls, label, name) { return `<div class="plate ${cls}"><small>${esc(label)}</small><b>${esc(name)}</b></div>`; }
function renderCombo() {
  const p = uiPhase(), ob = openB(), el = $('combo'), rh = $('ruleHint'), lv = level();
  let r = check();
  const tr = p === 'p_defend' && selected().length ? checkTransfer('p', selected()) : { ok: false };
  /* кнопка в этом случае — «Перевести», плашка говорит то же самое */
  if (tr.ok) r = tr;
  const actSel = p.startsWith('p_') ? selectedAction() : null;
  let html = '', ruleTxt = '';
  if (actSel) {
    const ar = actSel === 'mixed' ? { ok: false, why: 'Действие играют отдельно' } : checkAction('p', actSel);
    html = plate('act wide', ar.why || 'Сейчас не сыграть', actSel === 'mixed' ? 'ДЕЙСТВИЕ' : ACTS[actSel.action].name.toUpperCase() + ' ' + SU[actSel.s])
      + `<div class="vs ${ar.ok ? 'ok' : 'no'}">${ar.ok ? '✓' : '✗'}</div>`;
    if (actSel !== 'mixed') ruleTxt = ACTS[actSel.action].desc(SU[actSel.s]);
  } else if (p === 'p_defend' && ob) {
    const a = ob.a, n = selected().length;
    const his = plate('his', `его: ${shortCards(a.cards)}`, a.name.toUpperCase() + (a.jk ? ' ★' : ''));
    const fix = !r.e && n >= 2 ? nearestCombo(selected()) : null;
    const mineName = r.e ? r.e.name.toUpperCase() + (r.e.jk ? ' ★' : '') : fix ? fix.e.name.toUpperCase() : n ? 'НЕ КОМБО' : `${a.n} ${plural(a.n)}`;
    const mineLbl = n ? (fix ? 'убери ' + fix.drop.map(cardName).join(' ') + ' →' : r.why || '') : 'твой ответ';
    html = his + `<div class="vs ${n ? (r.ok ? 'ok' : 'no') : ''}">${n ? (r.ok ? '✓' : '✗') : '×'}</div>` + plate(n ? mineCls(r) : 'idle', mineLbl, mineName);
    const hint = lv !== 'pro' ? defenseHint() : null;
    if (lv === 'novice') {
      ruleTxt = coverRule(a);
      if (hint && hint.transfer.length) ruleTxt += ' Можно перевести тем же старшинством.';
      if (hint && hint.acts.length) ruleTxt += ` Подходит: ${hint.acts.map(c => cardName(c)).join(', ')}.`;
      if (hint && !hint.cover.length && !hint.transfer.length && !hint.acts.length) ruleTxt = 'Нечем крыть — бери.';
    }
  } else if (p.startsWith('p_')) {
    const n = selected().length;
    const label = n ? (r.why || '') : { p_attack: 'твой ход', p_throw: 'подкинь или «Бито»', p_addtake: 'вдогонку или «Хватит»' }[p];
    const fix = !r.e && n >= 2 ? nearestCombo(selected()) : null;
    const name = r.e ? r.e.name.toUpperCase() + (r.e.jk ? ' ★' : '') : fix ? fix.e.name.toUpperCase() : n ? 'НЕ КОМБО' : 'ВЫБЕРИ КАРТЫ';
    if (fix) r = { ...r, why: 'убери ' + fix.drop.map(cardName).join(' ') + ' →' };
    html = plate(n ? mineCls(r) + ' wide' : 'idle wide', label, name) + `<div class="vs ${n ? (r.ok ? 'ok' : 'no') : ''}">${n ? (r.ok ? '✓' : '✗') : '·'}</div>`;
    if (lv === 'novice' && p === 'p_attack' && !n) ruleTxt = 'Ходи одиночкой, парой, тройкой, двумя парами, каре или пятью картами. Защитник кроет тем же числом карт или перекрывает старшей комбинацией из большего. Не знаешь, чем ходить, — жми «⟳ Подбор».';
    if (lv === 'novice' && p !== 'p_attack' && !n) ruleTxt = 'Подкидывают комбинацией с номиналом со стола — или любой, если такая комбинация уже сложилась из карт стола (две десятки на столе — подкидывай любую пару).';
  } else if (p === 'over') {
    html = plate('idle wide', 'партия', 'ОКОНЧЕНА');
  } else if (upPhase() && selected().length) {
    const u = checkUpgrade('p', selected());
    html = plate('his', 'ты атакуешь', ob.a.name.toUpperCase()) + `<div class="vs ${u.ok ? 'ok' : 'no'}">${u.ok ? '✓' : '✗'}</div>`
      + plate(mineCls(u), u.why || 'не подходит', u.ok ? u.e.name.toUpperCase() : 'АПГРЕЙД');
  } else {
    html = ob && G.phase.who === 'b' && G.attacker === 'p'
      ? plate('his', 'ты атакуешь', ob.a.name.toUpperCase()) + '<div class="vs">…</div>' + plate('idle', 'он думает', esc(oppName()))
      : plate('idle wide', 'ход соперника', esc(oppName()) + '…');
  }
  el.innerHTML = html;
  if (ruleTxt) {
    const showBtn = lv === 'novice' && p === 'p_defend' && G.hint && (G.hint.cover.length || G.hint.transfer.length || G.hint.acts.some(c => c.action !== 'trump'));
    rh.innerHTML = `<span>${esc(ruleTxt)}</span>${showBtn ? '<button type="button" class="hintbtn" id="hintBtn">Подсказка</button>' : ''}`;
    rh.hidden = false;
    const hb = $('hintBtn'); if (hb) hb.onclick = useHint;
  } else rh.hidden = true;
}

/* ================= кнопки под рукой ================= */
function renderActions() {
  const p = uiPhase(), ok = check().ok, host = !NET || NET.role === 'host';
  const B = (cls, a, label, en = true) => `<button class="btn ${cls}" type="button" data-a="${a}" ${en ? '' : 'disabled'}>${label}</button>`;
  let main = '', alt = '';
  const actSel = p.startsWith('p_') ? selectedAction() : null;
  if (actSel) {
    const aok = actSel !== 'mixed' && checkAction('p', actSel).ok;
    main = B('gold', 'action', actSel === 'mixed' ? 'Только действие' : 'Сыграть', aok);
  } else if (p === 'p_attack') main = B('blue', 'play', 'Ходить', ok);
  else if (p === 'p_throw') main = B('blue', 'play', 'Подкинуть', ok);
  else if (p === 'p_addtake') main = B('blue', 'play', 'Вдогонку', ok);
  else if (p === 'p_defend') {
    const tr = selected().length && checkTransfer('p', selected()).ok;
    main = tr ? B('gold', 'transfer', 'Перевести') : B('blue', 'play', 'Покрыть', ok);
  } else if (p === 'over') main = host ? B('blue', 'new', SERIES.done ? 'Новая серия' : 'Ещё партия') : B('green', 'rematch', 'Реванш');
  else if (upPhase() && selected().length) main = B('gold', 'upgrade', 'Апгрейд', checkUpgrade('p', selected()).ok);
  else main = B('ghost', 'none', G && G.pending ? 'Отправляем…' : 'Ждём…', false);
  if (p === 'p_defend') alt = B('red', 'take', 'Беру');
  else if (p === 'p_throw') alt = B('orange', 'bito', 'Бито');
  else if (p === 'p_addtake') alt = B('grey', 'enough', 'Хватит');
  else if (p === 'over') alt = B('grey', 'menu', 'Меню');
  else alt = B('ghost', 'none', p === 'p_attack' ? '—' : 'Ход соперника', false);
  $('actMain').innerHTML = main; $('actAlt').innerHTML = alt;
  renderPickBtn();
}

/* ================= выбор действия за заряд ================= */
function renderOffer() {
  const el = $('offer'), o = G && G.offer && G.offer.p;
  if (!o || G.offerLater || G.over) { el.hidden = true; return; }
  if (!el.hidden && el.dataset.k === o.kinds.join() + o.s) return;
  el.dataset.k = o.kinds.join() + o.s;
  el.innerHTML = `<h3>ЗАРЯД ПОЛНЫЙ!<br>ВЫБЕРИ КАРТУ</h3><div class="cards">${o.kinds.map(k => {
    const c = { action: k, s: o.s, id: 'o' + k, n: -1, r: 16 };
    return `<button type="button" class="pick" data-pick="${k}">${cardHTML(c)}<span>${ACTS[k].name} ${SU[o.s]}</span><em>${esc(ACTS[k].desc(SU[o.s]))}</em></button>`;
  }).join('')}</div><button type="button" class="later" id="offerLater">Выберу позже</button>`;
  el.hidden = false;
  AU.play('action');
}
function pickOffer(k) {
  $('offer').hidden = true;
  if (NET && NET.role === 'guest') { TR.send('act', { t: 'pick', k }); return; }
  act('p', 'pick', k);
}

/* ================= итог партии ================= */
function showOver() {
  const o = $('over');
  if (!G) return;
  if (NET && NET.role === 'guest' && NET.got && !NET.connected) {
    o.hidden = false;
    o.innerHTML = `<h2>СТОЛ ПУСТ</h2><p>Хозяин стола отключился.</p><button class="btn blue" type="button" id="leaveBtn">Выйти</button>`;
    $('leaveBtn').onclick = leaveTable; return;
  }
  if (NET && NET.role === 'host' && NET.started && !NET.connected) {
    o.hidden = false;
    o.innerHTML = `<h2>ЖДЁМ</h2><p>${esc(oppName())} отключился. Код стола: <b>${esc(NET.code.toUpperCase())}</b></p><button class="btn grey" type="button" id="leaveBtn">Закрыть стол</button>`;
    $('leaveBtn').onclick = leaveTable; return;
  }
  if (!G.over) { o.hidden = true; return; }
  if (G.overFx !== G.over) { G.overFx = G.over; if (G.over === 'p') { AU.play('win'); VFX.confetti(); } else if (G.over === 'b') AU.play('lose'); }
  const opp = esc(oppName()), pen = G.penalty || 0, lim = NET ? 11 : seriesTo();
  let h, s;
  if (G.over === 'draw') { h = 'НИЧЬЯ'; s = 'Оба скинули карты одновременно.'; }
  else if (G.over === 'p') { h = 'ТЫ НЕ ДУРАК!'; s = `${opp} остался с ${pen} ${plural(pen)}: +${pen} штрафа ему.`; }
  else { h = 'ДУРАК!'; s = `У тебя осталось ${pen} ${plural(pen)}: +${pen} штрафа.`; }
  let extra = '', btns = '';
  const host = !NET || NET.role === 'host';
  if (MODE.kind === 'daily' && !NET) {
    extra = `<div class="sharecard" id="shareTxt">${esc(dailyCard(MODE.day))}</div>`;
    btns = `<button class="btn gold" type="button" id="shareBtn">Скопировать результат</button><button class="btn grey" type="button" id="overMenu">Меню</button>`;
  } else {
    if (SERIES.done) {
      const lost = SERIES.p >= lim && SERIES.p >= SERIES.b;
      h = lost ? 'СЕРИЯ ПРОИГРАНА' : 'СЕРИЯ ТВОЯ!';
      s = lost ? `Ты набрал ${SERIES.p} штрафных.` : `${opp} набрал ${SERIES.b} штрафных.`;
      if (!lost && MODE.kind === 'career') s += ' Следующий соперник открыт в карьере.';
    }
    extra = `<div class="series"><div><span>Ты</span><b>${SERIES.p}</b></div><div class="to">до ${lim}</div><div><span>${opp}</span><b>${SERIES.b}</b></div></div>`;
    btns = host ? `<button class="btn blue" type="button" id="again">${SERIES.done ? (MODE.kind === 'career' ? 'Дальше' : 'Новая серия') : 'Ещё партия'}</button><button class="btn grey" type="button" id="overMenu">Меню</button>`
      : `<button class="btn green" type="button" id="rematchBtn">Реванш</button>`;
  }
  o.hidden = false;
  o.innerHTML = `<h2>${h}</h2><p>${s}</p>${extra}<div class="row">${btns}</div>`;
  const ag = $('again'); if (ag) ag.onclick = nextGame;
  const om = $('overMenu'); if (om) om.onclick = openMenu;
  const rb = $('rematchBtn'); if (rb) rb.onclick = askRematch;
  const sb = $('shareBtn'); if (sb) sb.onclick = () => copyText(dailyCard(MODE.day), sb, $('shareTxt'));
}
function nextGame() {
  if (NET) { newGame(); return; }
  if (SERIES.done && MODE.kind === 'career') { openCareer(); return; }
  if (SERIES.done && MODE.kind === 'free') { openBots(); return; }
  newGame();
}
function askRematch() { TR.send('rematch', {}); toast('Попросили реванш'); }
function copyText(t, btn, el) {
  const fallback = () => { if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { btn.textContent = 'Скопировано'; }, fallback); else fallback();
}

/* ================= таймер ================= */
function tickTimer() {
  const el = $('timer');
  if (G && G.deadline && !G.over && !G.busy) {
    const left = Math.max(0, G.deadline - Date.now()), total = G.turnMs || 30000;
    el.hidden = false;
    el.firstElementChild.style.width = (left / total * 100) + '%';
    el.classList.toggle('late', left < 5000);
    el.classList.toggle('mine', G.phase.who === 'p');
    const sec = Math.ceil(left / 1000);
    $('timerTxt').textContent = sec + ' с · ' + (G.phase.who === 'p' ? 'твой ход' : 'ход соперника');
    if (sec <= 5 && G.phase.who === 'p' && tickTimer.last !== sec) { tickTimer.last = sec; AU.play('tick'); }
  } else el.hidden = true;
  requestAnimationFrame(tickTimer);
}

/* ================= веер и анимации ================= */
function fan(el, opts) {
  const s = [...el.children], n = s.length;
  if (!n) return;
  const W = el.clientWidth, cw = s[0].firstElementChild.offsetWidth;
  const pad = cw * 0.28, step = n > 1 ? Math.min(cw * opts.spread, (W - cw - pad * 2) / (n - 1)) : 0;
  const x0 = (W - (step * (n - 1) + cw)) / 2, k = Math.min(1, 9 / n);
  s.forEach((sl, i) => {
    const mx = (n - 1) / 2, off = i - mx, rot = off * opts.ang * k * opts.dir, y = (off * off - mx * mx) * opts.arc * k * opts.dir;
    const lift = sl.classList.contains('sel') ? -24 : 0;
    sl.style.left = (x0 + i * step) + 'px'; sl.style.zIndex = i;
    sl.style.transform = `translateY(${y + lift}px) rotate(${rot}deg)`;
  });
}
function layout() {
  fan($('hand'), { spread: 0.92, ang: 4, arc: 1.6, dir: 1 });
  fan($('botHand'), { spread: 0.7, ang: 4, arc: 0.9, dir: -1 });
}
function snapshot() {
  const m = {};
  document.querySelectorAll('.app .card[data-id]').forEach(el => {
    if (el.closest('.trumpcard')) return;
    const r = el.getBoundingClientRect();
    m[el.dataset.id] = { x: r.left + r.width / 2, y: r.top + r.height / 2, down: el.classList.contains('down') };
  });
  return m;
}
/* FLIP: карты плывут оттуда, где были; новые вылетают из колоды, как при раздаче в блэкджеке */
function update(deal) {
  if (!G) return;
  const snap = snapshot();
  render();
  if (reduced) return;
  const d = document.querySelector('.deck') || $('deckcol'), dr = d.getBoundingClientRect();
  const dx0 = dr.left + dr.width / 2, dy0 = dr.top + dr.height / 2;
  let k = 0;
  document.querySelectorAll('.app .card[data-id]').forEach(el => {
    if (el.closest('.trumpcard')) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const down = el.classList.contains('down'), o = snap[el.dataset.id], end = down ? 'rotateY(180deg)' : 'none';
    if (o) {
      const dx = o.x - cx, dy = o.y - cy;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && o.down === down) return;
      el.animate([{ transform: `translate(${dx}px,${dy}px) ${o.down ? 'rotateY(180deg)' : ''}` }, { transform: end }], { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1.08)' });
    } else if (deal && el.closest('.hand,.botHand')) {
      if (k < 12) setTimeout(() => AU.play('deal'), k * 70);
      el.animate([{ transform: `translate(${dx0 - cx}px,${dy0 - cy}px) rotate(-25deg) rotateY(180deg)` }, { transform: end }],
        { duration: 480, delay: (k++) * 70, easing: 'cubic-bezier(.2,.9,.25,1.05)', fill: 'backwards' });
    } else {
      el.animate([{ transform: `scale(1.4) ${end === 'none' ? '' : end}`, opacity: 0 }, { transform: end, opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
    }
  });
}
async function flyToGrave() {
  const g = $('grave');
  if (!g || reduced) return;
  const gr = g.getBoundingClientRect(), gx = gr.left + gr.width / 2, gy = gr.top + gr.height / 2;
  const els = [...document.querySelectorAll('#battles .card')];
  await Promise.all(els.map((el, i) => {
    const r = el.getBoundingClientRect();
    return el.animate([{ transform: 'none' }, { transform: `translate(${gx - r.left - r.width / 2}px,${gy - r.top - r.height / 2}px) rotate(${(i % 2 ? 1 : -1) * (80 + i * 7)}deg) rotateY(180deg) scale(.9)` }],
      { duration: 480, delay: i * 35, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' }).finished.catch(() => {});
  }));
}

/* ================= листы ================= */
function sheet(id, html) { $(id + 'In').innerHTML = html; $(id).hidden = false; }
function closeSheets() { ['menu', 'bots', 'page'].forEach(id => { $(id).hidden = true; }); if (!NET) $('lobby').hidden = true; }
const head = t => `<div class="sheethead"><h2>${t}</h2><button type="button" class="close" data-close>×</button></div>`;

function openMenu() {
  const p = prog(), st = CAREER_OPS[Math.min(p.career, CAREER_OPS.length - 1)], day = todayKey(), played = !!p.daily[day];
  sheet('menu', `${head('Дурокер')}
    <div class="menugrid">
      <button type="button" class="mi hero" data-go="career"><b>КАРЬЕРА: С ПОДЪЕЗДА В КАЗИНО</b><small>${p.careerDone ? 'Пройдена! Можно переиграть любого' : `Район «${esc(CAREER[st.district].name)}» · следующий: ${esc(st.name)}`}</small></button>
      <button type="button" class="mi" data-go="free"><b>Своя игра</b><small>Студент, Валера или Шулер</small></button>
      <button type="button" class="mi" data-go="daily"><b>Ежедневная #${dailyNumber(day)}</b><small>${played ? 'Сыграно — поделись результатом' : 'Одна колода для всех'}</small></button>
      <button type="button" class="mi" data-go="online"><b>Онлайн</b><small>С другом по коду стола</small></button>
      <button type="button" class="mi" data-go="coll"><b>Коллекция</b><small>Рубашки, столы, достижения</small></button>
      <button type="button" class="mi" data-go="settings"><b>Настройки</b><small>Звук, мат, подсказки, Блиц</small></button>
      <button type="button" class="mi" data-go="rules"><b>Правила</b><small>Чем крыть, заряд, «могнул»</small></button>
      ${NET ? '<button type="button" class="mi" data-go="leave"><b>Выйти из-за стола</b><small>Закончить онлайн</small></button>'
            : '<button type="button" class="mi" data-go="restart"><b>Новая серия</b><small>Сбросить штрафы с этим соперником</small></button>'}
    </div>`);
}
function menuGo(k) {
  closeSheets();
  if (k === 'career') openCareer();
  else if (k === 'free') openBots();
  else if (k === 'daily') openDaily();
  else if (k === 'online') { renderLobby(); $('lobby').hidden = false; }
  else if (k === 'coll') openCollection();
  else if (k === 'settings') openSettings();
  else if (k === 'rules') sheet('page', head('Правила') + $('rulesTpl').innerHTML);
  else if (k === 'leave') leaveTable();
  else if (k === 'restart') { newSeries(); newGame(); }
}
function setMode(m) {
  if (NET) { TR.close(); NET = null; }
  MODE = m;
  if (m.kind !== 'daily') store('durocker-mode', JSON.stringify(m));
  G = null; loadSeries(); newGame();
}

/* карьера */
function openCareer() {
  const p = prog();
  sheet('page', `${head('Карьера')}<p class="small">Соседи — серия до 11, босс района — до 21. Победил босса — открыл награду района.</p>
    ${CAREER.map((d, di) => `<div class="district"><h3><span>${di + 1}. ${esc(d.name)}</span><span>${rewardName(d.reward)}</span></h3>
      <div class="bots">${d.ops.map(o => { const i = CAREER_OPS.findIndex(x => x.id === o.id), done = i < p.career, cur = i === p.career, locked = i > p.career;
        return `<button type="button" class="botcard ${cur ? 'on' : ''}" data-stage="${i}" ${locked ? 'disabled' : ''}>
          <span class="ava" style="background:${o.color}">${locked ? '?' : o.face}</span>
          <span class="bt"><b>${locked ? '???' : esc(o.name)} ${done ? '✅' : ''}</b><em>${o.boss ? 'босс' : 'сосед'}${cur ? ' · следующий' : ''}</em><span>${locked ? 'Победи предыдущих, чтобы открыть' : esc(o.desc)}</span></span></button>`; }).join('')}</div></div>`).join('')}`);
}
function rewardName(r) {
  if (!r) return '';
  const n = [];
  if (r.table) n.push('стол «' + (VFX.SKINS.find(s => s.id === r.table) || {}).name + '»');
  if (r.back) n.push('рубашка «' + (BACKS.find(s => s.id === r.back) || {}).name + '»');
  if (r.track) n.push('трек «' + (TRACKS.find(s => s.id === r.track) || {}).name + '»');
  return '🎁 ' + n.join(', ');
}

/* своя игра */
function openBots() {
  const cur = currentBot().id;
  sheet('bots', `${head('Своя игра')}
    <div class="bots">${BOTS.map(b => `<button type="button" class="botcard ${b.id === cur && MODE.kind === 'free' ? 'on' : ''}" data-bot="${b.id}">
      <span class="ava" style="background:${b.color}">${b.face}</span>
      <span class="bt"><b>${b.name}</b><em>${b.level}</em><span>${b.desc}</span></span></button>`).join('')}</div>
    ${toggleHTML('trBot', 'Переводной: можно перевести атаку тем же старшинством', tableRules().transfer)}
    ${toggleHTML('blzBot', 'Блиц: серия до 11', blitzOn())}`);
}
function toggleHTML(id, label, on) { return `<label class="toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span>${label}</label>`; }
function pickBot(id) {
  store('durocker-bot', id);
  store('durocker-transfer', $('trBot').checked ? '1' : '0');
  store('durocker-blitz', $('blzBot').checked ? '1' : '0');
  closeSheets();
  setMode({ kind: 'free' });
}

/* ежедневная раздача */
function openDaily() {
  const day = todayKey(), r = prog().daily[day];
  sheet('page', `${head('Ежедневная #' + dailyNumber(day))}
    <p>Каждый день одна и та же колода у всех. Одна партия против Шулера. Сыграй и скинь результат друзьям — у кого лучше?</p>
    ${r ? `<div class="sharecard" id="dShare">${esc(dailyCard(day))}</div><button class="btn gold" type="button" id="dCopy">Скопировать результат</button><p class="small">Новая раздача завтра в 00:00 по Москве.</p>`
        : '<button class="btn blue" type="button" id="dPlay">Играть</button>'}`);
  const pl = $('dPlay'); if (pl) pl.onclick = () => { closeSheets(); setMode({ kind: 'daily', day, seed: dailySeed(day) }); };
  const cp = $('dCopy'); if (cp) cp.onclick = () => copyText(dailyCard(day), cp, $('dShare'));
}

/* коллекция */
function openCollection() {
  const p = prog(), skin = VFX.skin();
  const backs = BACKS.map(b => { const has = p.unlocked.back.includes(b.id);
    return `<button type="button" class="ci ${p.back === b.id ? 'on' : ''}" data-back="${b.id}" ${has ? '' : 'disabled'}><i class="bk-${b.id}" style="background:${has ? backPreview(b.id) : '#222'}"></i>${has ? b.name : '???'}</button>`; }).join('');
  const tables = VFX.SKINS.map(s => { const has = p.unlocked.table.includes(s.id);
    return `<button type="button" class="skin sk-${s.id} ${skin === s.id ? 'on' : ''}" data-skin="${s.id}" ${has ? '' : 'disabled'}><i></i>${has ? s.name : '???'}</button>`; }).join('');
  const tracks = TRACKS.map(t => { const has = p.unlocked.track.includes(t.id);
    return `<button type="button" class="${p.track === t.id ? 'on' : ''}" data-track="${t.id}" ${has ? '' : 'disabled'}>${has ? t.name : '???'}</button>`; }).join('');
  const achs = ACHS.map(a => `<div class="ach ${p.ach[a.id] ? 'got' : ''}"><i>${p.ach[a.id] ? '🏆' : '🔒'}</i><div><b>${a.name}</b><small>${a.desc}${a.reward ? ' · ' + rewardName(a.reward) : ''}</small></div></div>`).join('');
  const friends = Object.entries(p.friends);
  sheet('page', `${head('Коллекция')}
    <div class="statrow"><div><b>${p.games}</b><span>партий</span></div><div><b>${p.wins}</b><span>побед</span></div><div><b>${p.mognul}</b><span>могнул</span></div><div><b>${Object.keys(p.ach).length}/${ACHS.length}</b><span>достижений</span></div></div>
    <h3>Рубашки</h3><div class="coll">${backs}</div>
    <h3>Столы</h3><div class="skins">${tables}</div>
    <h3>Музыка</h3><div class="seg">${tracks}</div>
    <h3>Достижения</h3><div class="achs">${achs}</div>
    ${friends.length ? `<h3>Против друзей</h3><div class="achs">${friends.map(([n, f]) => `<div class="ach got"><i>🤝</i><div><b>${esc(n)}</b><small>побед ${f.w} · поражений ${f.l}</small></div></div>`).join('')}</div>` : ''}`);
}
function backPreview(id) {
  const prev = document.documentElement.dataset.back;
  document.documentElement.dataset.back = id;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--backbg');
  document.documentElement.dataset.back = prev;
  return v;
}

/* настройки */
function openSettings() {
  const hl = load('durocker-hints') || 'auto';
  sheet('page', `${head('Настройки')}
    <h3>Звук</h3>
    ${toggleHTML('stMusic', 'Музыка', AU.music)}
    ${toggleHTML('stSfx', 'Звуки карт и эффектов', AU.sfx)}
    <h3>Фразы</h3>
    ${toggleHTML('stRude', 'Мат в хайп-фразах (под звёздочками)', rudeOn())}
    <h3>Подсказки</h3>
    <div class="seg" id="stHints">${[['auto', 'Сами по опыту'], ['novice', 'Новичок'], ['player', 'Игрок'], ['pro', 'Профи']].map(([k, n]) => `<button type="button" data-h="${k}" class="${hl === k ? 'on' : ''}">${n}</button>`).join('')}</div>
    <p class="small">Новичок — подсветка, «чем крыть», шпаргалка. Игрок — только подсветка. Профи — только название комбинации. Сейчас: ${({ novice: 'новичок', player: 'игрок', pro: 'профи' })[hintLevel()]}.</p>
    <h3>Игра с ботом</h3>
    ${toggleHTML('stBlitz', 'Блиц: серия до 11, онлайн 20 секунд на ход', blitzOn())}
    ${toggleHTML('stTransfer', 'Переводной', tableRules().transfer)}`);
  $('stMusic').onchange = e => { AU.unlock(); AU.setMusic(e.target.checked); renderSound(); };
  $('stSfx').onchange = e => { AU.unlock(); AU.setSfx(e.target.checked); renderSound(); };
  $('stRude').onchange = e => store('durocker-rude', e.target.checked ? '1' : '0');
  $('stBlitz').onchange = e => { store('durocker-blitz', e.target.checked ? '1' : '0'); };
  $('stTransfer').onchange = e => store('durocker-transfer', e.target.checked ? '1' : '0');
  $('stHints').onclick = e => { const b = e.target.closest('[data-h]'); if (!b) return; store('durocker-hints', b.dataset.h); openSettings(); if (G) update(); };
}

/* ================= лобби онлайна ================= */
function lobbyStatus(t, err) { const s = $('lobbyStatus'); if (s) { s.textContent = t; s.className = 'status' + (err ? ' err' : ''); } }
function renderLobby() {
  const L = $('lobbyIn');
  if (NET && NET.role === 'host' && !NET.started) {
    L.innerHTML = `<h2>Стол открыт</h2>
      <div class="codebox"><div class="small">Код для друга</div><div class="code" id="codeShow">${NET.ready ? esc(NET.code.toUpperCase()) : '····'}</div>
        ${TR.linkable ? `<button class="btn green" type="button" id="shareLink" ${NET.ready ? '' : 'disabled'}>Позвать друга ссылкой</button>` : ''}
        <button class="btn orange" type="button" id="copyCode" ${NET.ready ? '' : 'disabled'}>Скопировать код</button></div>
      <div class="status" id="lobbyStatus"><span class="wait">${NET.ready ? 'Ждём соперника…' : 'Открываем стол…'}</span></div>
      <p class="small">${TR.linkable ? 'Друг жмёт на ссылку и сразу садится за стол. Или открывает сайт, ☰ → «Онлайн» и вводит код.' : 'Друг открывает эту же страницу, жмёт ☰ → «Онлайн» и вводит код.'} Партия начнётся сама.</p>
      <button class="btn grey" type="button" id="cancelHost">Закрыть стол</button>`;
    $('copyCode').onclick = () => copyText(NET.code.toUpperCase(), $('copyCode'), $('codeShow'));
    if ($('shareLink')) $('shareLink').onclick = () => shareInvite(NET.code, $('shareLink'));
    $('cancelHost').onclick = () => { $('lobby').hidden = true; leaveTable(); };
    return;
  }
  if (NET && NET.role === 'guest' && !NET.got) {
    L.innerHTML = `<h2>Стол ${esc(NET.code.toUpperCase())}</h2><div class="status" id="lobbyStatus"><span class="wait">Подключаемся к хозяину стола…</span></div>
      <button class="btn grey" type="button" id="cancelJoin">Отмена</button>`;
    $('cancelJoin').onclick = () => { $('lobby').hidden = true; leaveTable(); };
    return;
  }
  L.innerHTML = `${head('Игра с другом')}
    <label class="field">Твоё имя за столом<input id="nickIn" maxlength="16" value="${esc(myNick())}" autocomplete="off"></label>
    ${toggleHTML('trNet', 'Переводной', tableRules().transfer)}
    ${toggleHTML('blzNet', 'Блиц: 20 секунд на ход', blitzOn())}
    <button class="btn blue" type="button" id="hostBtn">Создать стол</button>
    <div class="or">или войди к другу</div>
    <div class="joinrow"><input id="codeIn" maxlength="4" placeholder="КОД" autocomplete="off" aria-label="Код стола"><button class="btn orange" type="button" id="joinBtn">Войти</button></div>
    <div class="status" id="lobbyStatus"></div>
    <p class="small">Правила стола выбирает тот, кто его создаёт. Подсказки в онлайне выключены у обоих.</p>`;
  const saveNick = () => store('durocker-nick', ($('nickIn').value.trim() || 'Игрок').slice(0, 16));
  $('hostBtn').onclick = () => { saveNick(); store('durocker-transfer', $('trNet').checked ? '1' : '0'); store('durocker-blitz', $('blzNet').checked ? '1' : '0'); hostTable(); };
  $('joinBtn').onclick = () => { saveNick(); joinTable(); };
  $('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') { saveNick(); joinTable(); } });
}

/* ================= реакции в онлайне ================= */
const REACTS = ['Бери-бери 😏', 'Ну ты дурак', 'Везёт же…', 'Красава!', 'Думай быстрее', 'Ха-ха-ха', 'Могу ещё', 'ГГ'];
function openReacts() {
  const el = $('reacts');
  if (!el.hidden) { el.hidden = true; return; }
  el.innerHTML = REACTS.map((r, i) => `<button type="button" data-r="${i}">${esc(r)}</button>`).join('');
  el.hidden = false;
}
function sendReact(i) { $('reacts').hidden = true; TR.send('react', { i }); toast('Ты: ' + REACTS[i]); }
function showReact(i) { const t = REACTS[i | 0]; if (t) say(t); }

/* ================= звук ================= */
function renderSound() {
  const b = $('sndBtn');
  b.textContent = AU.music ? '♫' : AU.sfx ? '♪' : '×';
  b.setAttribute('aria-label', AU.music ? 'Музыка и звуки включены' : AU.sfx ? 'Только звуки' : 'Звук выключен');
  b.classList.toggle('off', !AU.sfx);
}

/* ================= управление ================= */
function toggleCard(id) {
  if (!uiPhase().startsWith('p_') && !upPhase()) return;
  if (G.sel.has(id)) G.sel.delete(id); else if (G.sel.size < 5) G.sel.add(id);
  AU.play('select');
  document.querySelectorAll('#hand .slot').forEach(s => s.classList.toggle('sel', G.sel.has(s.firstElementChild.dataset.id)));
  layout(); renderCombo(); renderActions();
}
function bindUI() {
  /* звук можно включить только из «настоящего» жеста: на iPhone это касание (touchend) или клик, не pointerdown */
  ['touchend', 'click', 'keydown'].forEach(ev => addEventListener(ev, () => AU.unlock(), { capture: true, passive: true }));
  document.addEventListener('click', e => {
    if (e.target.closest('button')) AU.play('click');
    if (e.target.closest('[data-close]')) closeSheets();
    const go = e.target.closest('[data-go]'); if (go) menuGo(go.dataset.go);
    const st = e.target.closest('[data-stage]'); if (st && !st.disabled) { closeSheets(); setMode({ kind: 'career', stage: +st.dataset.stage }); }
    const bt = e.target.closest('[data-bot]'); if (bt) pickBot(bt.dataset.bot);
    const bk = e.target.closest('button[data-back]'); if (bk && !bk.disabled) { prog().back = bk.dataset.back; saveProg(); applyLooks(); openCollection(); }
    const sk = e.target.closest('button[data-skin]'); if (sk && !sk.disabled) { VFX.skin(sk.dataset.skin); openCollection(); }
    const tk = e.target.closest('button[data-track]'); if (tk && !tk.disabled) { prog().track = tk.dataset.track; saveProg(); applyLooks(); openCollection(); }
    const pk = e.target.closest('[data-pick]'); if (pk) pickOffer(pk.dataset.pick);
    const rr = e.target.closest('[data-r]'); if (rr) sendReact(+rr.dataset.r);
  });
  $('hand').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) toggleCard(c.dataset.id); });
  const onAct = e => {
    const a = e.target.closest('[data-a]');
    if (!a || a.disabled) return;
    const k = a.dataset.a;
    if (k === 'new') nextGame(); else if (k === 'menu') openMenu(); else if (k === 'rematch') askRematch(); else if (k !== 'none') sendAct(k);
  };
  $('actMain').addEventListener('click', onAct); $('actAlt').addEventListener('click', onAct);
  $('sortR').onclick = () => { G.sort = 'r'; update(); };
  $('sortS').onclick = () => { G.sort = 's'; update(); };
  $('pickBtn').onclick = nextPick;
  $('menuBtn').onclick = openMenu;
  $('oppBtn').onclick = () => { if (!NET && MODE.kind === 'free') openBots(); };
  $('reactBtn').onclick = openReacts;
  $('myCharge').onclick = () => { if (G && G.offer && G.offer.p) { G.offerLater = false; renderOffer(); } };
  $('offer').addEventListener('click', e => { if (e.target.id === 'offerLater') { G.offerLater = true; $('offer').hidden = true; } });
  $('sndBtn').onclick = () => {
    AU.unlock();
    if (AU.music) AU.setMusic(false); else if (AU.sfx) AU.setSfx(false); else { AU.setSfx(true); AU.setMusic(true); }
    renderSound();
  };
  ['menu', 'bots', 'page', 'lobby'].forEach(id => $(id).addEventListener('click', e => { if (e.target.id === id && !(id === 'lobby' && NET)) $(id).hidden = true; }));
  addEventListener('resize', () => { if (G) layout(); });
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input')) return;
    if (['menu', 'bots', 'page', 'lobby'].some(id => !$(id).hidden)) { if (e.key === 'Escape') closeSheets(); return; }
    const k = e.key.toLowerCase();
    if (e.key === 'Enter') { const b = $('actMain').querySelector('.btn:not(:disabled)'); if (b) { e.preventDefault(); b.click(); } }
    else if (e.key === 'Escape') { if (G) { G.sel.clear(); update(); } }
    else if (k === 'b' || k === 'и') { const b = $('actAlt').querySelector('.btn:not(:disabled)'); if (b) b.click(); }
    else if (k === 'h' || k === 'р') useHint();
    else if (k === 'm' || k === 'ь') openMenu();
  });
  renderSound();
  VFX.skin(); VFX.bindTilt();
}

/* ================= фон: пиксельный водоворот в духе Balatro ================= */
function startBackground() {
  const c = $('bg'), x = c.getContext('2d'), w = 72, h = 128;
  c.width = w; c.height = h;
  const img = x.createImageData(w, h);
  const pal = [[6, 22, 22], [9, 34, 31], [12, 48, 40], [18, 66, 52], [30, 88, 62], [60, 40, 30]];
  let t = 0, last = 0;
  function frame(ts) {
    if (ts - last > 45) {
      last = ts; t += 0.035; let i = 0;
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
        const u = (xx / w - 0.5) * 2, v = (y / h - 0.5) * 3.4, r = Math.hypot(u, v), a = Math.atan2(v, u);
        const s = Math.sin(a * 2 + r * 5 - t + Math.sin(r * 2.5 - t * 0.7 + u * 2) * 1.6) + Math.sin(u * 3 + t * 0.5) * 0.4;
        let k = Math.max(0, Math.min(4, Math.floor((s * 0.5 + 0.5) * 4.2 - r * 1.1 + 1)));
        if (s > 1.25 && r < 0.9) k = 5;
        const p = pal[k]; img.data[i++] = p[0]; img.data[i++] = p[1]; img.data[i++] = p[2]; img.data[i++] = 255;
      }
      x.putImageData(img, 0, 0);
    }
    if (!reduced) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* онлайн-код зовёт эту функцию при смене статуса соединения */
function renderNet() { if (G) renderHUD(); }
