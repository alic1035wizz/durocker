/* Дурокер — отрисовка, анимации раздачи и «сочные» надписи комбинаций, лобби, управление. */
'use strict';

/* ---------- эффекты ---------- */
function fx(o) { o.id = ++fxId; G.fx = o; showFx(o); }
function showFx(o) {
  const me = o.actor === 'p', opp = oppName();
  if (o.what === 'trump') {
    const c = o.low != null ? mkCard(o.low) : null;
    const t = c ? `${rn(c.r)}${SU[c.s]}` : '';
    return banner('КОЗЫРЬ ' + SU[G.T],
      c ? (me ? `Младший козырь твой: ${t}. Ходи!` : `У соперника ${t}. Он ходит.`)
        : (me ? 'Козырей нет. Ходи первым.' : 'Козырей нет. Соперник ходит.'), 'gold');
  }
  if (o.what === 'bito') return banner('БИТО', '', 'gold');
  if (o.what === 'takes') {
    if (!me && NET) say('Беру…');
    return banner(me ? 'БЕРУ' : 'БЕРЁТ!', me ? 'Соперник может подкинуть' : 'Можешь подкинуть вдогонку', 'take');
  }
  const sub = {
    attack: me ? 'Твой ход' : `${opp} ходит`, throw: me ? 'Подкидываешь' : `${opp} подкидывает`,
    defend: me ? 'Покрыл!' : `${opp} кроет`, addtake: me ? 'Вдогонку' : `${opp} вдогонку`,
  }[o.what] || '';
  if (NET && !me) say({ attack: 'Хожу', throw: 'Подкину', defend: 'Бью!', addtake: 'Вдогонку!' }[o.what] || '');
  banner(String(o.big || '').toUpperCase(), sub, o.kind);
  if (o.t >= 4) shake(o.t);
}
function banner(big, sub, kind) {
  const b = $('banner');
  $('bBig').textContent = big; $('bSub').textContent = sub || ''; $('bSub').hidden = !sub;
  b.className = 'banner ' + (kind || ''); void b.offsetWidth; b.classList.add('on');
}
function shake(t) {
  if (reduced) return;
  const m = t >= 6 ? 9 : 5;
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
  const red = c.s === 1 || c.s === 2, tr = c.s === G.T, rk = rn(c.r);
  const center = c.r > 10 && c.r < 14 ? `<span class="fc">${rk}<small>${SU[c.s]}</small></span>` : SU[c.s];
  const front = down ? '' : `<div class="front ${red ? 'red' : ''}"><span class="ix tl">${rk}<i>${SU[c.s]}</i></span><span class="pip">${center}</span><span class="ix br">${rk}<i>${SU[c.s]}</i></span></div>`;
  return `<div class="card ${down ? 'down' : ''} ${tr && !down ? 'trump' : ''}" data-id="${c.id}">${front}<div class="back"></div></div>`;
}
function sortHand(h) {
  return h.slice().sort(G.sort === 'r' ? (a, b) => a.r - b.r || a.s - b.s
    : (a, b) => ((a.s === G.T) - (b.s === G.T)) || a.s - b.s || a.r - b.r);
}
function renderNet() {
  const live = !!NET, nb = $('netBtn');
  nb.textContent = live ? 'Выйти' : 'Онлайн'; nb.classList.toggle('live', live);
  $('newBtn').disabled = !!(NET && NET.role === 'guest');
  const sc = NET ? NET.score : score;
  $('scorePill').innerHTML = live ? `${esc(NET.code.toUpperCase())} · <b>${sc.w || 0}</b>:<b>${sc.l || 0}</b>`
    : `Ты <b>${sc.w}</b> : <b>${sc.l}</b> Бот`;
  const dot = $('oppDot'); dot.hidden = !live; dot.classList.toggle('off', !!(NET && !NET.connected));
  $('oppName').textContent = oppName();
}
function render() {
  renderNet();
  $('oppCount').textContent = G.B.length ? `${G.B.length} ${plural(G.B.length)}` : '';
  $('botHand').innerHTML = G.B.map(c => `<div class="slot">${cardHTML(c, true)}</div>`).join('');
  $('deckcol').innerHTML = `<div class="deck">${G.deck.length > 1 ? '<div class="stack"></div>' : ''}${G.deck.length ? `<div class="trumpcard">${cardHTML(G.trump, false)}</div>` : ''}${G.deck.length > 1 ? `<div class="cnt">${G.deck.length}</div>` : ''}</div>
    <div class="lbl"><b>${SU[G.T]}</b>козырь</div>`;
  $('gravecol').innerHTML = `<div class="grave ${G.grave ? '' : 'empty'}" id="grave">${G.grave ? '<i></i>' : ''}</div><div class="lbl">бито<br>${G.grave}</div>`;
  const ob = openB(), p = uiPhase();
  $('battles').innerHTML = G.table.length ? G.table.map(b => `<div class="battle ${b === ob ? 'open' : ''}"><span class="tag">${b.a.name}</span>
      <div class="row atk">${b.a.cards.map(c => cardHTML(c)).join('')}</div>
      ${b.d ? `<div class="row def">${b.d.cards.map(c => cardHTML(c)).join('')}</div>` : ''}</div>`).join('')
    : `<div class="empty-felt">${p === 'p_attack' ? 'Выбери карты и ходи' : p === 'over' ? '' : G.phase.who === 'b' ? `${esc(oppName())} думает…` : ''}</div>`;
  $('hand').innerHTML = sortHand(G.P).map((c, i) => `<div class="slot ${G.sel.has(c.id) ? 'sel' : ''}" style="--i:${i}">${cardHTML(c)}</div>`).join('');
  $('handInfo').textContent = `На руке ${G.P.length}`;
  $('sortR').classList.toggle('on', G.sort === 'r'); $('sortS').classList.toggle('on', G.sort === 's');
  renderPanel(); renderActions(); layout();
}
function check() { if (G.guest && G.pending) return { ok: false, e: null }; return checkMove('p', selected()); }
function renderPanel() {
  const r = check(), p = uiPhase(), ob = openB(), ct = $('ctype'), vd = $('verdict');
  const hint = {
    p_attack: 'Выбери комбинацию для хода',
    p_defend: ob ? `Покрой: ${ob.a.name.toLowerCase()}, ${ob.a.n} ${plural(ob.a.n)}` : '',
    p_throw: 'Подкинь или скажи «Бито»', p_addtake: 'Подкинь вдогонку или «Хватит»', over: 'Партия окончена',
  }[p] || `Ход: ${oppName()}…`;
  if (r.e) { ct.textContent = r.e.name.toUpperCase(); ct.className = 'ctype'; }
  else if (selected().length) { ct.textContent = 'НЕ КОМБО'; ct.className = 'ctype none'; }
  else if (p === 'p_defend' && ob) { ct.textContent = ob.a.name.toUpperCase(); ct.className = 'ctype target'; }
  else { ct.textContent = '—'; ct.className = 'ctype none'; }
  vd.textContent = r.why || hint;
  vd.className = 'verdict ' + (r.why ? (r.ok ? 'ok' : 'no') : 'hint');
  const tgt = ob && p === 'p_defend' ? ob.a.t : -1, cur = r.e ? r.e.t : -1;
  $('ladder').innerHTML = LADDER.map(t => `<span class="${t === cur ? 'on' : ''} ${t === tgt ? 'tgt' : ''}" title="${TN[t]}"></span>`).join('');
}
function renderActions() {
  const p = uiPhase(), ok = check().ok, host = !NET || NET.role === 'host';
  const dis = ok ? '' : 'disabled';
  let h;
  if (p === 'p_attack') h = `<button class="btn blue" type="button" data-a="play" ${dis}>Ходить</button>`;
  else if (p === 'p_throw') h = `<button class="btn blue" type="button" data-a="play" ${dis}>Подкинуть</button><button class="btn orange" type="button" data-a="bito">Бито</button>`;
  else if (p === 'p_defend') h = `<button class="btn blue" type="button" data-a="play" ${dis}>Покрыть</button><button class="btn red" type="button" data-a="take">Беру</button>`;
  else if (p === 'p_addtake') h = `<button class="btn blue" type="button" data-a="play" ${dis}>Подкинуть</button><button class="btn grey" type="button" data-a="enough">Хватит</button>`;
  else if (p === 'over') h = host ? `<button class="btn blue" type="button" data-a="new">Ещё партия</button>` : `<button class="btn grey" type="button" disabled>Ждём новую раздачу</button>`;
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
  const opp = esc(oppName());
  let h, s;
  if (G.over === 'draw') { h = 'НИЧЬЯ'; s = 'Оба скинули карты одновременно.'; }
  else if (G.over === 'p') { h = 'ТЫ НЕ ДУРАК!'; s = `${opp} остался с картами.`; }
  else { h = 'ДУРАК!'; s = `${opp} скинул всё, у тебя осталось ${G.P.length} ${plural(G.P.length)}.`; }
  const host = !NET || NET.role === 'host';
  o.hidden = false;
  o.innerHTML = `<h2>${h}</h2><p>${s}</p>${host ? '<button class="btn blue" type="button" id="again">Ещё партия</button>' : '<p class="small">Ждём, пока хозяин стола раздаст заново.</p>'}`;
  if (host) $('again').onclick = newGame;
}

/* веер карт: шаг, наклон и дуга подстраиваются под ширину и число карт */
function fan(el, opts) {
  const s = [...el.children], n = s.length;
  if (!n) return;
  const W = el.clientWidth, cw = s[0].firstElementChild.offsetWidth;
  const step = n > 1 ? Math.min(cw * opts.spread, (W - cw) / (n - 1)) : 0;
  const x0 = (W - (step * (n - 1) + cw)) / 2, k = Math.min(1, 9 / n);
  s.forEach((sl, i) => {
    const off = i - (n - 1) / 2, rot = off * opts.ang * k * opts.dir, y = off * off * opts.arc * k * opts.dir;
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

/* ---------- лобби ---------- */
function lobbyStatus(t, err) { const s = $('lobbyStatus'); if (s) { s.textContent = t; s.className = 'status' + (err ? ' err' : ''); } }
function renderLobby() {
  const L = $('lobbyIn');
  if (NET && NET.role === 'host' && !NET.started) {
    L.innerHTML = `<h2>Стол открыт</h2>
      <div class="codebox"><div class="small">Код для друга</div><div class="code" id="codeShow">${NET.ready ? esc(NET.code.toUpperCase()) : '····'}</div>
        <button class="btn orange" type="button" id="copyCode" style="flex:none;padding:10px 18px" ${NET.ready ? '' : 'disabled'}>Скопировать код</button></div>
      <div class="status" id="lobbyStatus"><span class="wait">${NET.ready ? 'Ждём соперника…' : 'Открываем стол…'}</span></div>
      <p class="small">Друг открывает этот же сайт на телефоне или компьютере, жмёт «Онлайн» и вводит код. Партия начнётся сама.</p>
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
    <div class="actions"><button class="btn blue" type="button" id="hostBtn">Создать стол</button></div>
    <div class="or">или войди к другу</div>
    <div class="joinrow"><input id="codeIn" maxlength="4" placeholder="КОД" autocomplete="off" aria-label="Код стола"><button class="btn orange" type="button" id="joinBtn">Войти</button></div>
    <div class="status" id="lobbyStatus"></div>
    <p class="small">Нужен интернет у обоих. Подключение идёт напрямую между устройствами.</p>
    <div class="actions"><button class="btn grey" type="button" id="lobbyClose">Играть с ботом</button></div>`;
  const saveNick = () => store('durocker-nick', ($('nickIn').value.trim() || 'Игрок').slice(0, 16));
  $('hostBtn').onclick = () => { saveNick(); hostTable(); };
  $('joinBtn').onclick = () => { saveNick(); joinTable(); };
  $('codeIn').addEventListener('keydown', e => { if (e.key === 'Enter') { saveNick(); joinTable(); } });
  $('lobbyClose').onclick = () => { $('lobby').hidden = true; };
}

/* ---------- управление ---------- */
function toggleCard(id) {
  if (!uiPhase().startsWith('p_')) return;
  if (G.sel.has(id)) G.sel.delete(id); else if (G.sel.size < 5) G.sel.add(id);
  document.querySelectorAll('#hand .slot').forEach(s => s.classList.toggle('sel', G.sel.has(s.firstElementChild.dataset.id)));
  layout(); renderPanel(); renderActions();
}
function bindUI() {
  $('hand').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) toggleCard(c.dataset.id); });
  $('actions').addEventListener('click', e => {
    const a = e.target.closest('[data-a]');
    if (!a || a.disabled) return;
    if (a.dataset.a === 'new') newGame(); else sendAct(a.dataset.a);
  });
  $('sortR').onclick = () => { G.sort = 'r'; update(); };
  $('sortS').onclick = () => { G.sort = 's'; update(); };
  $('newBtn').onclick = () => newGame();
  $('netBtn').onclick = () => { if (NET) { leaveTable(); return; } renderLobby(); $('lobby').hidden = false; };
  $('rulesBtn').onclick = () => { $('sheet').hidden = false; };
  $('closeSheet').onclick = () => { $('sheet').hidden = true; };
  $('sheet').addEventListener('click', e => { if (e.target.id === 'sheet') $('sheet').hidden = true; });
  $('lobby').addEventListener('click', e => { if (e.target.id === 'lobby' && !NET) $('lobby').hidden = true; });
  addEventListener('resize', () => { if (G) layout(); });
  /* клавиатура на ПК */
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input')) return;
    if (!$('sheet').hidden || !$('lobby').hidden) { if (e.key === 'Escape') { $('sheet').hidden = true; if (!NET) $('lobby').hidden = true; } return; }
    if (e.key === 'Enter') { const b = document.querySelector('#actions .btn:not(:disabled)'); if (b) { e.preventDefault(); b.click(); } }
    else if (e.key === 'Escape') { if (G) { G.sel.clear(); update(); } }
    else if (e.key === 'b' || e.key === 'B' || e.key === 'и' || e.key === 'И') {
      const b = document.querySelector('#actions [data-a="take"],#actions [data-a="bito"],#actions [data-a="enough"]'); if (b) b.click();
    }
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
