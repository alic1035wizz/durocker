/* Дурокер — отрисовка, анимации раздачи и «сочные» надписи комбинаций, подсказки, лобби, управление. */
'use strict';

/* ---------- эффекты ---------- */
function fx(o) { o.id = ++fxId; G.fx = o; showFx(o); }
function showFx(o) {
  const me = o.actor === 'p', opp = oppName();
  sfxFor(o);
  if (o.what === 'trump') {
    const c = o.low != null ? mkCard(o.low) : null;
    const t = c ? cardName(c) : '';
    return banner('КОЗЫРЬ ' + SU[G.T],
      c ? (me ? `Младший козырь твой: ${t}. Ходи!` : `У соперника ${t}. Он ходит.`)
        : (me ? 'Козырей нет. Ходи первым.' : 'Козырей нет. Соперник ходит.'), 'gold');
  }
  if (o.what === 'bito') return banner('БИТО', '', 'gold');
  if (o.what === 'takes') {
    if (!me && NET) say('Беру…');
    return banner(me ? 'БЕРУ' : 'БЕРЁТ!', me ? 'Соперник может подкинуть' : 'Можешь подкинуть вдогонку', 'take');
  }
  if (o.what === 'action') {
    const c = { action: o.act, s: o.s, id: 'z', n: -1, r: 16 };
    if (!me) say(ACTS[o.act].name + '!');
    VFX.actionZoom(c, me);
    if (o.act === 'trump') setTimeout(() => { $('felt').classList.remove('tpulse'); void $('felt').offsetWidth; $('felt').classList.add('tpulse'); }, 400);
    return;
  }
  if (o.what === 'transfer') {
    if (!me && NET) say('Перевожу!');
    banner('ПЕРЕВОД', me ? 'Теперь отбивается соперник' : 'Атака перешла к тебе', 'gold');
    return shake(6);
  }
  const sub = {
    attack: me ? 'Твой ход' : `${opp} ходит`, throw: me ? 'Подкидываешь' : `${opp} подкидывает`,
    defend: me ? 'Покрыл!' : `${opp} кроет`, addtake: me ? 'Вдогонку' : `${opp} вдогонку`,
  }[o.what] || '';
  if (NET && !me) say({ attack: 'Хожу', throw: 'Подкину', defend: 'Бью!', addtake: 'Вдогонку!' }[o.what] || '');
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
  else if (w === 'action') { AU.play('action'); if (o.act === 'trump') AU.play('trump'); }
  else if (w === 'trump') AU.play('trump');
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
  clearTimeout(sayT); sayT = setTimeout(() => b.classList.remove('on'), 1300);
}

/* ---------- отрисовка ---------- */
const selected = () => G.P.filter(c => G.sel.has(c.id));
function uiPhase() {
  if (!G) return 'wait';
  if (G.over) return 'over';
  if (G.pending) return 'wait';
  if (G.phase.who === 'p' && !G.busy) return 'p_' + G.phase.kind;
  return 'wait';
}
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
  return h.slice().sort(G.sort === 'r' ? (a, b) => a.r - b.r || a.s - b.s
    : (a, b) => (!!a.joker - !!b.joker) || ((a.s === G.T) - (b.s === G.T)) || a.s - b.s || a.r - b.r);
}
function renderNet() {
  const live = !!NET, nb = $('netBtn');
  nb.textContent = live ? 'Выйти' : 'Онлайн'; nb.classList.toggle('live', live);
  $('newBtn').disabled = !!(NET && NET.role === 'guest');
  $('scorePill').innerHTML = `${live ? esc(NET.code.toUpperCase()) + ' · ' : ''}<span class="pen">штраф</span> <b>${SERIES.p}</b>:<b>${SERIES.b}</b> <span class="pen">/ ${SERIES_TO}</span>`;
  const dot = $('oppDot'); dot.hidden = !live; dot.classList.toggle('off', !!(NET && !NET.connected));
  const bot = currentBot(), av = $('oppAva');
  av.hidden = live; av.textContent = bot.face; av.style.background = bot.color;
  $('oppName').textContent = oppName();
  $('oppBtn').disabled = live;
}
function render() {
  renderNet();
  const felt = $('felt');
  felt.dataset.trump = G.T;
  const last = !G.deck.length && !G.over;
  felt.classList.toggle('last', last);
  AU.setLevel(last ? 2 : 1);
  $('oppCount').textContent = G.B.length ? `${G.B.length} ${plural(G.B.length)}` : '';
  $('botHand').innerHTML = G.B.map(c => `<div class="slot">${cardHTML(c, true)}</div>`).join('');
  $('deckcol').innerHTML = `<div class="deck">${G.deck.length > 1 ? '<div class="stack"></div>' : ''}${G.deck.length ? `<div class="trumpcard">${cardHTML(G.trump, false)}</div>` : ''}${G.deck.length > 1 ? `<div class="cnt">${G.deck.length}</div>` : ''}</div>
    <div class="lbl"><b>${SU[G.T]}</b>козырь</div>`;
  $('gravecol').innerHTML = `<div class="grave ${G.grave ? '' : 'empty'}" id="grave">${G.grave ? '<i></i>' : ''}</div><div class="lbl">бито<br>${G.grave}</div>`;
  const ob = openB(), p = uiPhase();
  $('battles').innerHTML = G.table.length ? G.table.map(b => `<div class="battle ${b === ob ? 'open' : ''}"><span class="tag">${b.a.name}${b.a.jk ? ' ★' : ''}</span>
      <div class="row atk">${b.a.cards.map(c => cardHTML(c)).join('')}</div>
      ${b.d ? `<div class="row def">${b.d.cards.map(c => cardHTML(c)).join('')}</div>` : ''}</div>`).join('')
    : `<div class="empty-felt">${p === 'p_attack' ? 'Выбери карты и ходи' : p === 'over' ? '' : G.phase.who === 'b' ? `${esc(oppName())} думает…` : ''}</div>`;
  const hint = p === 'p_defend' ? defenseHint() : null;
  const can = hint ? hint.ids : new Set();
  $('hand').innerHTML = sortHand(G.P).map((c, i) => `<div class="slot ${G.sel.has(c.id) ? 'sel' : ''} ${can.has(c.id) ? 'can' : ''}" style="--i:${i}">${cardHTML(c)}</div>`).join('');
  $('handInfo').textContent = `На руке ${G.P.length}`;
  $('sortR').classList.toggle('on', G.sort === 'r'); $('sortS').classList.toggle('on', G.sort === 's');
  renderPanel(); renderActions(); layout();
}

/* ---------- подсказка при защите ---------- */
function defenseHint() {
  const ob = openB();
  if (!ob) return null;
  const key = G.P.map(c => c.id).join() + '|' + G.table.map(b => b.a.cards.map(c => c.id).join('.') + (b.d ? 'd' : '')).join('/');
  if (G.hintKey === key) return G.hint;
  const o = defenseOptions('p');
  const ids = new Set();
  o.cover.forEach(e => e.cards.forEach(c => ids.add(c.id)));
  o.transfer.forEach(e => e.cards.forEach(c => ids.add(c.id)));
  (o.acts || []).forEach(c => ids.add(c.id));
  G.hintKey = key; G.hint = { ...o, ids };
  return G.hint;
}
function useHint() {
  const h = uiPhase() === 'p_defend' ? defenseHint() : null;
  if (!h) return;
  const best = h.cover[0] || h.transfer[0];
  const act = (h.acts || []).find(c => c.action === 'shield') || (h.acts || []).find(c => c.action === 'reverse');
  if (!best && !act) return;
  G.sel = new Set(best ? best.cards.map(c => c.id) : [act.id]);
  update();
}

function check() { if (G.guest && G.pending) return { ok: false, e: null }; return checkMove('p', selected()); }
function renderPanel() {
  let r = check();
  const p = uiPhase(), ob = openB(), ct = $('ctype'), vd = $('verdict'), rh = $('ruleHint');
  const tr = p === 'p_defend' && selected().length ? checkTransfer('p', selected()) : { ok: false };
  if (!r.ok && tr.ok) r = tr;
  const hint = p === 'p_defend' ? defenseHint() : null;
  const idle = {
    p_attack: 'Выбери комбинацию для хода',
    p_defend: hint && !hint.cover.length && !hint.transfer.length && !hint.acts.length ? 'Нечем крыть — бери' : (hint ? `Вариантов: ${hint.cover.length + hint.transfer.length + hint.acts.length}` : ''),
    p_throw: 'Подкинь или скажи «Бито»', p_addtake: 'Подкинь вдогонку или «Хватит»', over: 'Партия окончена',
  }[p] || `Ход: ${oppName()}…`;
  const actSel = selectedAction();
  if (actSel) {
    const ar = actSel === 'mixed' ? { ok: false, why: 'Карту-действие играют отдельно' } : checkAction('p', actSel);
    ct.textContent = actSel === 'mixed' ? 'ДЕЙСТВИЕ' : ACTS[actSel.action].name.toUpperCase() + ' ' + SU[actSel.s];
    ct.className = 'ctype act';
    vd.textContent = ar.why || 'Сейчас не сыграть'; vd.className = 'verdict ' + (ar.ok ? 'ok' : 'no');
    rh.innerHTML = actSel === 'mixed' ? '<span>Выбери только карту-действие или только обычные карты.</span>' : `<span>${esc(ACTS[actSel.action].desc(SU[actSel.s]))}</span>`;
    rh.hidden = false;
    $('ladder').innerHTML = TYPES.map((t, i) => `<span class="${i > 0 && TYPES[i - 1].n !== t.n ? 'gap' : ''}"></span>`).join('');
    return;
  }
  if (r.e) { ct.textContent = r.e.name.toUpperCase() + (r.e.jk ? ' ★' : ''); ct.className = 'ctype'; }
  else if (selected().length) { ct.textContent = 'НЕ КОМБО'; ct.className = 'ctype none'; }
  else if (p === 'p_defend' && ob) { ct.textContent = ob.a.name.toUpperCase(); ct.className = 'ctype target'; }
  else { ct.textContent = '—'; ct.className = 'ctype none'; }
  vd.textContent = r.why || idle;
  const dead = p === 'p_defend' && !selected().length && hint && !hint.cover.length && !hint.transfer.length && !hint.acts.length;
  vd.className = 'verdict ' + (r.why ? (r.ok ? 'ok' : 'no') : dead ? 'no' : 'hint');
  /* как отбиваться: правило под текущую атаку */
  if (p === 'p_defend' && ob) {
    let t = coverRule(ob.a);
    if (hint && hint.transfer.length) t += ' Можно перевести тем же старшинством.';
    if (hint && hint.acts.length) t += ` Подходит: ${hint.acts.map(c => cardName(c)).join(', ')}.`;
    rh.innerHTML = `<span>${esc(t)}</span>${hint && (hint.cover.length || hint.transfer.length || hint.acts.some(c => c.action !== 'trump')) ? '<button type="button" class="hintbtn" id="hintBtn">Подсказка</button>' : ''}`;
    rh.hidden = false;
    const hb = $('hintBtn'); if (hb) hb.onclick = useHint;
  } else if (p === 'p_attack' && !G.table.length && !selected().length) {
    rh.innerHTML = '<span>Ходи одиночкой, парой, тройкой, двумя парами, каре или пятью картами. Защитник кроет тем же числом карт.</span>';
    rh.hidden = false;
  } else { rh.hidden = true; }
  const tgt = ob && p === 'p_defend' ? ob.a.t : -1, cur = r.e ? r.e.t : -1;
  $('ladder').innerHTML = TYPES.map((t, i) => `<span class="${i === cur ? 'on' : ''} ${i === tgt ? 'tgt' : ''} ${i > 0 && TYPES[i - 1].n !== t.n ? 'gap' : ''}" title="${t.name}"></span>`).join('');
}
function selectedAction() {
  const cs = selected(), a = cs.filter(c => c.action);
  if (!a.length) return null;
  return cs.length === 1 ? a[0] : 'mixed';
}
function renderActions() {
  const p = uiPhase(), ok = check().ok, host = !NET || NET.role === 'host';
  const dis = ok ? '' : 'disabled';
  let h;
  const actSel = p.startsWith('p_') ? selectedAction() : null;
  if (actSel) {
    const aok = actSel !== 'mixed' && checkAction('p', actSel).ok;
    h = `<button class="btn gold" type="button" data-a="action" ${aok ? '' : 'disabled'}>${actSel === 'mixed' ? 'Действие — отдельно' : 'Сыграть «' + esc(ACTS[actSel.action].name) + '»'}</button>`;
    if (p === 'p_defend') h += `<button class="btn red" type="button" data-a="take">Беру</button>`;
    else if (p === 'p_throw') h += `<button class="btn orange" type="button" data-a="bito">Бито</button>`;
    else if (p === 'p_addtake') h += `<button class="btn grey" type="button" data-a="enough">Хватит</button>`;
    $('actions').innerHTML = h; return;
  }
  if (p === 'p_attack') h = `<button class="btn blue" type="button" data-a="play" ${dis}>Ходить</button>`;
  else if (p === 'p_throw') h = `<button class="btn blue" type="button" data-a="play" ${dis}>Подкинуть</button><button class="btn orange" type="button" data-a="bito">Бито</button>`;
  else if (p === 'p_defend') {
    const tr = selected().length && checkTransfer('p', selected()).ok;
    h = tr ? `<button class="btn gold" type="button" data-a="transfer">Перевести</button>` : `<button class="btn blue" type="button" data-a="play" ${dis}>Покрыть</button>`;
    h += `<button class="btn red" type="button" data-a="take">Беру</button>`;
  }
  else if (p === 'p_addtake') h = `<button class="btn blue" type="button" data-a="play" ${dis}>Подкинуть</button><button class="btn grey" type="button" data-a="enough">Хватит</button>`;
  else if (p === 'over') h = host ? `<button class="btn blue" type="button" data-a="new">${SERIES.done ? 'Новая серия' : 'Следующая партия'}</button>` : `<button class="btn grey" type="button" disabled>Ждём новую раздачу</button>`;
  else h = `<button class="btn grey" type="button" disabled>${G && G.pending ? 'Отправляем…' : `Ход: ${esc(oppName())}…`}</button>`;
  $('actions').innerHTML = h;
}
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
  if (G.overFx !== G.over) {
    G.overFx = G.over;
    if (G.over === 'p') { AU.play('win'); VFX.confetti(); } else if (G.over === 'b') AU.play('lose');
  }
  const opp = esc(oppName()), pen = G.penalty || 0;
  let h, s;
  if (G.over === 'draw') { h = 'НИЧЬЯ'; s = 'Оба скинули карты одновременно. Штрафа нет.'; }
  else if (G.over === 'p') { h = 'ТЫ НЕ ДУРАК!'; s = `${opp} остался с картами: +${pen} штрафа ему.`; }
  else { h = 'ДУРАК!'; s = `У тебя осталось карт на ${pen} штрафа (карта-действие — 2 очка).`; }
  const ex = G.extra || { p: 0, b: 0 };
  if (ex.p || ex.b) s += ` Ещё от «+2» при пустой колоде: ты +${ex.p}, ${opp} +${ex.b}.`;
  let ser = `<div class="series"><div><span>Ты</span><b>${SERIES.p}</b></div><div class="to">до ${SERIES_TO}</div><div><span>${opp}</span><b>${SERIES.b}</b></div></div>`;
  if (SERIES.done) {
    const lost = SERIES.p >= SERIES_TO && SERIES.p >= SERIES.b;
    h = lost ? 'СЕРИЯ ПРОИГРАНА' : 'СЕРИЯ ТВОЯ!';
    s = lost ? `Ты набрал ${SERIES.p} штрафных за ${SERIES.games} ${SERIES.games === 1 ? 'партию' : SERIES.games < 5 ? 'партии' : 'партий'}.` : `${opp} набрал ${SERIES.b} штрафных. Ты ушёл из-за стола чистым.`;
  }
  const host = !NET || NET.role === 'host';
  o.hidden = false;
  o.innerHTML = `<h2>${h}</h2><p>${s}</p>${ser}${host ? `<button class="btn blue" type="button" id="again">${SERIES.done ? 'Новая серия' : 'Следующая партия'}</button>` : '<p class="small">Ждём, пока хозяин стола раздаст заново.</p>'}`;
  if (host) $('again').onclick = nextGame;
}
function nextGame() {
  if (SERIES.done && !NET) { openBots(); return; }
  newGame();
}

/* ---------- таймер хода ---------- */
function tickTimer() {
  const el = $('timer');
  if (G && G.deadline && !G.over && !G.busy) {
    const left = Math.max(0, G.deadline - Date.now());
    el.hidden = false;
    el.firstElementChild.style.width = (left / TURN_MS * 100) + '%';
    el.classList.toggle('late', left < 5000);
    el.classList.toggle('mine', G.phase.who === 'p');
    const sec = Math.ceil(left / 1000);
    $('timerTxt').textContent = sec + ' с · ' + (G.phase.who === 'p' ? 'твой ход' : 'ход соперника');
    if (sec <= 5 && G.phase.who === 'p' && tickTimer.last !== sec) { tickTimer.last = sec; AU.play('tick'); }
  } else el.hidden = true;
  requestAnimationFrame(tickTimer);
}

/* веер карт: края на одной линии, середина приподнята */
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

/* FLIP: каждая карта плывёт оттуда, где была; новые вылетают из колоды, как при раздаче в блэкджеке */
function snapshot() {
  const m = {};
  document.querySelectorAll('.card[data-id]').forEach(el => {
    if (el.closest('.trumpcard')) return;
    const r = el.getBoundingClientRect();
    m[el.dataset.id] = { x: r.left + r.width / 2, y: r.top + r.height / 2, down: el.classList.contains('down') };
  });
  return m;
}
function update(deal) {
  if (!G) return;
  const snap = snapshot();
  render();
  if (reduced) return;
  const d = document.querySelector('.deck') || $('deckcol'), dr = d.getBoundingClientRect();
  const dx0 = dr.left + dr.width / 2, dy0 = dr.top + dr.height / 2;
  let k = 0;
  document.querySelectorAll('.card[data-id]').forEach(el => {
    if (el.closest('.trumpcard')) return;
    const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const down = el.classList.contains('down'), o = snap[el.dataset.id], end = down ? 'rotateY(180deg)' : 'none';
    if (o) {
      const dx = o.x - cx, dy = o.y - cy;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && o.down === down) return;
      el.animate([{ transform: `translate(${dx}px,${dy}px) ${o.down ? 'rotateY(180deg)' : ''}` }, { transform: end }],
        { duration: 420, easing: 'cubic-bezier(.2,.9,.25,1.08)' });
    } else if (deal && el.closest('.hand,.botHand')) {
      if (k < 12) setTimeout(() => AU.play('deal'), k * 70);
      el.animate([{ transform: `translate(${dx0 - cx}px,${dy0 - cy}px) rotate(-25deg) rotateY(180deg)` }, { transform: end }],
        { duration: 480, delay: (k++) * 70, easing: 'cubic-bezier(.2,.9,.25,1.05)', fill: 'backwards' });
    } else {
      el.animate([{ transform: `scale(1.4) ${end === 'none' ? '' : end}`, opacity: 0 }, { transform: end, opacity: 1 }],
        { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
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
    return el.animate([{ transform: 'none' },
      { transform: `translate(${gx - r.left - r.width / 2}px,${gy - r.top - r.height / 2}px) rotate(${(i % 2 ? 1 : -1) * (80 + i * 7)}deg) rotateY(180deg) scale(.9)` }],
      { duration: 480, delay: i * 35, easing: 'cubic-bezier(.5,0,.7,.4)', fill: 'forwards' }).finished.catch(() => {});
  }));
}

/* ---------- выбор соперника ---------- */
function transferToggle(id) {
  const on = tableRules().transfer;
  return `<label class="toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span>Переводной: можно перевести атаку комбинацией того же старшинства</label>`;
}
function openBots() {
  const cur = currentBot().id;
  $('botsIn').innerHTML = `<h2>Выбери соперника</h2>
    <div class="bots">${BOTS.map(b => `<button type="button" class="botcard ${b.id === cur ? 'on' : ''}" data-bot="${b.id}">
      <span class="ava" style="background:${b.color}">${b.face}</span>
      <span class="bt"><b>${b.name}</b><em>${b.level}</em><span>${b.desc}</span></span></button>`).join('')}</div>
    ${transferToggle('trBot')}
    <p class="small">Серия идёт до ${SERIES_TO} штрафных: проигравший партию получает столько очков, сколько карт у него осталось.</p>`;
  $('bots').hidden = false;
}
function pickBot(id) {
  store('durocker-bot', id);
  store('durocker-transfer', $('trBot').checked ? '1' : '0');
  $('bots').hidden = true;
  loadSeries(); if (SERIES.done) newSeries();
  newGame();
}

/* ---------- лобби онлайна ---------- */
function lobbyStatus(t, err) { const s = $('lobbyStatus'); if (s) { s.textContent = t; s.className = 'status' + (err ? ' err' : ''); } }
function renderLobby() {
  const L = $('lobbyIn');
  if (NET && NET.role === 'host' && !NET.started) {
    L.innerHTML = `<h2>Стол открыт</h2>
      <div class="codebox"><div class="small">Код для друга</div><div class="code" id="codeShow">${NET.ready ? esc(NET.code.toUpperCase()) : '····'}</div>
        <button class="btn orange" type="button" id="copyCode" style="flex:none;padding:10px 18px" ${NET.ready ? '' : 'disabled'}>Скопировать код</button></div>
      <div class="status" id="lobbyStatus"><span class="wait">${NET.ready ? 'Ждём соперника…' : 'Открываем стол…'}</span></div>
      <p class="small">Друг открывает эту же страницу на телефоне или компьютере, жмёт «Онлайн» и вводит код. Партия начнётся сама. На ход — ${TURN_MS / 1000} секунд.</p>
      <div class="actions"><button class="btn grey" type="button" id="cancelHost">Закрыть стол</button></div>`;
    $('copyCode').onclick = () => {
      const t = NET.code.toUpperCase(), btn = $('copyCode');
      const fallback = () => { const el = $('codeShow'), r = document.createRange(); r.selectNodeContents(el); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { btn.textContent = 'Скопировано'; }, fallback); else fallback();
    };
    $('cancelHost').onclick = () => { $('lobby').hidden = true; leaveTable(); };
    return;
  }
  if (NET && NET.role === 'guest' && !NET.got) {
    L.innerHTML = `<h2>Стол ${esc(NET.code.toUpperCase())}</h2><div class="status" id="lobbyStatus"><span class="wait">Подключаемся к хозяину стола…</span></div>
      <div class="actions"><button class="btn grey" type="button" id="cancelJoin">Отмена</button></div>`;
    $('cancelJoin').onclick = () => { $('lobby').hidden = true; leaveTable(); };
    return;
  }
  L.innerHTML = `<h2>Игра с другом</h2>
    <label class="field">Твоё имя за столом<input id="nickIn" maxlength="16" value="${esc(myNick())}" autocomplete="off"></label>
    ${transferToggle('trNet')}
    <div class="actions"><button class="btn blue" type="button" id="hostBtn">Создать стол</button></div>
    <div class="or">или войди к другу</div>
    <div class="joinrow"><input id="codeIn" maxlength="4" placeholder="КОД" autocomplete="off" aria-label="Код стола"><button class="btn orange" type="button" id="joinBtn">Войти</button></div>
    <div class="status" id="lobbyStatus"></div>
    <p class="small">Правила стола (переводной или нет) выбирает тот, кто создаёт стол.</p>
    <div class="actions"><button class="btn grey" type="button" id="lobbyClose">Играть с ботом</button></div>`;
  const saveNick = () => store('durocker-nick', ($('nickIn').value.trim() || 'Игрок').slice(0, 16));
  $('hostBtn').onclick = () => { saveNick(); store('durocker-transfer', $('trNet').checked ? '1' : '0'); hostTable(); };
  $('joinBtn').onclick = () => { saveNick(); joinTable(); };
  $('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') { saveNick(); joinTable(); } });
  $('lobbyClose').onclick = () => { $('lobby').hidden = true; };
}

/* ---------- управление ---------- */
function toggleCard(id) {
  if (!uiPhase().startsWith('p_')) return;
  if (G.sel.has(id)) G.sel.delete(id); else if (G.sel.size < 5) G.sel.add(id);
  AU.play('select');
  document.querySelectorAll('#hand .slot').forEach(s => s.classList.toggle('sel', G.sel.has(s.firstElementChild.dataset.id)));
  layout(); renderPanel(); renderActions();
}
function renderSound() {
  const b = $('sndBtn');
  b.textContent = AU.music ? '♫' : AU.sfx ? '♪' : '×';
  b.setAttribute('aria-label', AU.music ? 'Музыка и звуки включены' : AU.sfx ? 'Только звуки' : 'Звук выключен');
  b.classList.toggle('off', !AU.sfx);
}
function renderSettings() {
  const cur = VFX.skin();
  $('settings').innerHTML = `<h3>Звук</h3>
    <label class="toggle"><input type="checkbox" id="stMusic" ${AU.music ? 'checked' : ''}><span></span>Музыка</label>
    <label class="toggle"><input type="checkbox" id="stSfx" ${AU.sfx ? 'checked' : ''}><span></span>Звуки карт и эффектов</label>
    <h3>Стол</h3>
    <div class="skins">${VFX.SKINS.map(k => `<button type="button" class="skin sk-${k.id} ${k.id === cur ? 'on' : ''}" data-skin="${k.id}"><i></i>${k.name}</button>`).join('')}</div>`;
  $('stMusic').onchange = e => { AU.unlock(); AU.setMusic(e.target.checked); renderSound(); };
  $('stSfx').onchange = e => { AU.unlock(); AU.setSfx(e.target.checked); renderSound(); };
  $('settings').querySelectorAll('[data-skin]').forEach(b => { b.onclick = () => { VFX.skin(b.dataset.skin); renderSettings(); }; });
}
function bindUI() {
  addEventListener('pointerdown', () => AU.unlock(), { passive: true });
  addEventListener('keydown', () => AU.unlock());
  document.addEventListener('click', e => { if (e.target.closest('button')) AU.play('click'); });
  $('sndBtn').onclick = () => {
    AU.unlock();
    if (AU.music) AU.setMusic(false); else if (AU.sfx) AU.setSfx(false); else { AU.setSfx(true); AU.setMusic(true); }
    renderSound();
  };
  renderSound();
  VFX.skin(); VFX.bindTilt();
  $('hand').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) toggleCard(c.dataset.id); });
  $('actions').addEventListener('click', e => {
    const a = e.target.closest('[data-a]');
    if (!a || a.disabled) return;
    if (a.dataset.a === 'new') nextGame(); else sendAct(a.dataset.a);
  });
  $('sortR').onclick = () => { G.sort = 'r'; update(); };
  $('sortS').onclick = () => { G.sort = 's'; update(); };
  $('newBtn').onclick = () => { if (NET) newGame(); else openBots(); };
  $('oppBtn').onclick = () => { if (!NET) openBots(); };
  $('botsIn').addEventListener('click', e => { const b = e.target.closest('[data-bot]'); if (b) pickBot(b.dataset.bot); });
  $('bots').addEventListener('click', e => { if (e.target.id === 'bots') $('bots').hidden = true; });
  $('netBtn').onclick = () => { if (NET) { leaveTable(); return; } renderLobby(); $('lobby').hidden = false; };
  $('rulesBtn').onclick = () => { renderSettings(); $('sheet').hidden = false; };
  $('closeSheet').onclick = () => { $('sheet').hidden = true; };
  $('sheet').addEventListener('click', e => { if (e.target.id === 'sheet') $('sheet').hidden = true; });
  $('lobby').addEventListener('click', e => { if (e.target.id === 'lobby' && !NET) $('lobby').hidden = true; });
  addEventListener('resize', () => { if (G) layout(); });
  /* клавиатура на ПК */
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input')) return;
    const sheets = ['sheet', 'lobby', 'bots'].filter(id => !$(id).hidden);
    if (sheets.length) { if (e.key === 'Escape') { $('sheet').hidden = true; $('bots').hidden = true; if (!NET) $('lobby').hidden = true; } return; }
    const k = e.key.toLowerCase();
    if (e.key === 'Enter') { const b = document.querySelector('#actions .btn:not(:disabled)'); if (b) { e.preventDefault(); b.click(); } }
    else if (e.key === 'Escape') { if (G) { G.sel.clear(); update(); } }
    else if (k === 'b' || k === 'и') { const b = document.querySelector('#actions [data-a="take"],#actions [data-a="bito"],#actions [data-a="enough"]'); if (b) b.click(); }
    else if (k === 'h' || k === 'р') useHint();
  });
}

/* ---------- фон: пиксельный водоворот в духе Balatro ---------- */
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
