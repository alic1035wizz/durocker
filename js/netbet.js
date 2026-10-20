/* ДурКер — ставки фишками в онлайн-матче и удвоение после 1:1.
   Без сервера: хозяин предлагает ставку, гость принимает, фишки списываются у обоих, по итогам матча обе стороны
   обмениваются «итогом» и сверяют его; расхождение — ставки возвращаются, выход из матча — ставка сгорает.
   Деньги настоящие не участвуют: фишки игровые, купить их нельзя. Честность без сервера ограничена (см. README):
   хозяин стола держит партию у себя. Типы сообщений 'bet' и 'dbl' версионированы (v:1), старые клиенты их игнорируют. */
'use strict';

/* ---------- чистое ядро: разбор сообщений и расчёт (проверяется в node: tests/bets.js) ---------- */
const NBC = (() => {
  const BETS = [50, 100, 250, 500];
  const ID_RE = /^[a-z0-9]{6,12}$/;
  const isInt = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  function normBet(d) {
    if (!d || typeof d !== 'object' || d.v !== 1 || typeof d.id !== 'string' || !ID_RE.test(d.id)) return null;
    const k = d.k;
    if (k !== 'offer' && k !== 'ok' && k !== 'no' && k !== 'go' && k !== 'res') return null;
    const o = { k, id: d.id };
    if (k === 'offer') { if (!BETS.includes(d.amt)) return null; o.amt = d.amt; }
    if (k === 'res') {
      if (!isInt(d.amt, 0, 8000) || (d.w !== 'h' && d.w !== 'g' && d.w !== 'x')) return null;
      o.amt = d.amt; o.w = d.w;
    }
    return o;
  }
  function normDbl(d) {
    if (!d || typeof d !== 'object' || d.v !== 1 || typeof d.id !== 'string' || !ID_RE.test(d.id)) return null;
    if (!isInt(d.n, 0, 20) || (d.a !== 'y' && d.a !== 'n')) return null;
    return { id: d.id, n: d.n, a: d.a };
  }
  /* решающая партия впереди: счёт «до N-1 : N-1», матч ещё не закончен */
  const isTie = (w, to, done) => !done && to >= 2 && !!w && w.p === to - 1 && w.b === to - 1;
  /* кто выиграл матч глазами этой стороны: 'h' хозяин, 'g' гость, 'x' — не определено */
  function winnerChar(role, w, to, done) {
    if (!done || !w) return 'x';
    const mine = role === 'host' ? 'h' : 'g', their = role === 'host' ? 'g' : 'h';
    if (w.p >= to && w.b < to) return mine;
    if (w.b >= to && w.p < to) return their;
    return 'x';
  }
  /* итог ставки: own = {id, role, amt, paid, w}, peer = {id, amt, w} | null (соперник не ответил или пропал) */
  function settle(own, peer) {
    const side = own.role === 'host' ? 'h' : 'g';
    if (own.w === 'x') return { kind: 'refund', pay: own.paid };
    if (peer && (peer.id !== own.id || peer.w !== own.w || peer.amt !== own.amt)) return { kind: 'refund', pay: own.paid, why: 'mismatch' };
    if (own.w === side) return { kind: 'win', stake: own.paid, profit: own.paid };
    return { kind: 'lose', pay: 0 };
  }
  /* исход удвоения: оба «да» → ставка ×2 */
  function dblOutcome(mine, theirs) {
    if (mine == null || theirs == null) return null;
    return mine === 'y' && theirs === 'y' ? 'double' : 'keep';
  }
  return { BETS, normBet, normDbl, isTie, winnerChar, settle, dblOutcome };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NBC;

/* ---------- в браузере ---------- */
if (typeof window !== 'undefined' && typeof document !== 'undefined' && typeof BUS !== 'undefined') (() => {
  const K = 'durocker-netbet', KSEL = 'durocker-netbet-sel';
  const $n = id => document.getElementById(id);
  const E = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const say = (t, ms) => { try { toast(t, ms); } catch (e) {} };
  const snd = n => { try { AU.play(n); } catch (e) {} };
  const rid = () => { let s = ''; try { const a = new Uint8Array(8); crypto.getRandomValues(a); a.forEach(x => { s += (x % 36).toString(36); }); } catch (e) {} while (s.length < 8) s += Math.floor(Math.random() * 36).toString(36); return s; };
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const C = () => window.CHIPS;

  /* состояние переживает обновление страницы */
  let S = (() => { try { const d = JSON.parse(rd(K) || '{}'); return { ob: d.ob || null, settled: Array.isArray(d.settled) ? d.settled.slice(-30) : [] }; } catch (e) { return { ob: null, settled: [] }; } })();
  const save = () => wr(K, JSON.stringify(S));
  let sel = (() => { const v = parseInt(rd(KSEL), 10); return NBC.BETS.includes(v) ? v : 0; })();
  const timers = {};
  const setT = (k, fn, ms) => { clearTimeout(timers[k]); timers[k] = setTimeout(fn, ms); };
  const clrT = k => { clearTimeout(timers[k]); delete timers[k]; };
  const peerRes = {};               /* id → итог, присланный соперником */
  let dbl = null;                   /* идущее удвоение: {key, n, mine, theirs} */
  let lastNote = null;              /* итог ставки для экрана итога */
  let rate = [];                    /* ограничитель входящих сообщений */

  const role = () => (typeof NET !== 'undefined' && NET ? NET.role : null);
  const send = (topic, data) => { try { TR.send(topic, { v: 1, ...data }); } catch (e) {} };
  const toOf = () => (typeof seriesTo === 'function' ? seriesTo() : (SERIES && SERIES.to) || 2);
  const allowed = () => {
    const now = Date.now(); rate = rate.filter(t => now - t < 10000);
    if (rate.length >= 30) return false;
    rate.push(now); return true;
  };
  const ob = () => S.ob;
  const clearOb = () => { S.ob = null; save(); paintTag(); };

  /* ---------- плашка «ставка» ---------- */
  function paintTag() {
    const bar = $n('chBar'); if (!bar) return;
    let t = $n('nbTag');
    const o = S.ob, live = o && (o.st === 'live' || o.st === 'settling');
    if (!live) { if (t) t.remove(); return; }
    if (!t) { t = document.createElement('span'); t.id = 'nbTag'; t.className = 'chtag bet'; bar.appendChild(t); }
    t.textContent = `🎲 ставка ${o.amt}`;
  }

  /* ---------- предложение ставки (хозяин) ---------- */
  function offerBet() {
    if (role() !== 'host') return;
    const o = S.ob;
    /* старая незавершённая ставка за другим столом сгорает */
    if (o && o.code !== NET.code) forfeit('другой стол');
    if (S.ob && S.ob.code === NET.code) { if (S.ob.st === 'offer') send('bet', { k: 'offer', id: S.ob.id, amt: S.ob.amt }); return; }
    if (!sel) return;
    if (C().calm()) { say('🌙 Спокойный режим: ставки сегодня отключены', 3500); return; }
    if (C().get() < sel) { say('Не хватает фишек на ставку — играем без неё', 3500); return; }
    S.ob = { id: rid(), code: NET.code, role: 'host', amt: sel, paid: 0, st: 'offer', t: Date.now() };
    save();
    send('bet', { k: 'offer', id: S.ob.id, amt: S.ob.amt });
    say(`🎲 Ставка ${sel} 🪙 предложена — ждём ответа`, 3000);
    setT('offer', () => { if (S.ob && S.ob.st === 'offer') { clearOb(); say('Соперник не ответил на ставку — играем без неё', 3500); } }, 25000);
  }

  /* ---------- входящая ставка (гость) ---------- */
  function guestAsk(m) {
    const cur = S.ob;
    if (cur && cur.id === m.id) return;                   /* дубль предложения */
    if (cur && cur.code !== NET.code) forfeit('другой стол');
    const calm = C().calm(), can = C().get() >= m.amt;
    if (calm || !can || (typeof SERIES !== 'undefined' && SERIES && SERIES.games > 0)) {
      send('bet', { k: 'no', id: m.id });
      say(calm ? '🌙 Спокойный режим: от ставки отказался' : !can ? `Хозяин предложил ставку ${m.amt} 🪙 — не хватает фишек` : 'Ставка опоздала — матч уже идёт', 4000);
      return;
    }
    S.ob = { id: m.id, code: NET.code, role: 'guest', amt: m.amt, paid: 0, st: 'ask', t: Date.now() };
    save();
    const w = document.createElement('div'); w.id = 'nbAsk'; w.className = 'chdw';
    w.innerHTML = `<div class="chdbl" role="dialog" aria-label="Ставка"><h3>🎲 СТАВКА</h3>
      <p>${E(NET.oppNick || 'Хозяин')} предлагает сыграть матч на <b>${m.amt}</b> 🪙<br><span class="m">выиграешь +${m.amt} · проиграешь −${m.amt} · у тебя ${C().get()} 🪙</span></p>
      <div class="row"><button class="btn gold" type="button" id="nbYes">Принять</button><button class="btn grey" type="button" id="nbNo">Без ставки</button></div></div>`;
    document.body.appendChild(w);
    const done = () => { clrT('ask'); w.remove(); };
    $n('nbYes').onclick = () => { done(); S.ob.st = 'await'; save(); send('bet', { k: 'ok', id: m.id }); setT('await', () => { if (S.ob && S.ob.st === 'await') { clearOb(); say('Ставка не состоялась', 3000); } }, 10000); };
    $n('nbNo').onclick = () => { done(); send('bet', { k: 'no', id: m.id }); clearOb(); };
    setT('ask', () => { if ($n('nbAsk')) { w.remove(); send('bet', { k: 'no', id: m.id }); clearOb(); say('Ставка отклонена — время вышло', 3000); } }, 20000);
  }

  /* ---------- входящие сообщения ---------- */
  function onBet(raw) {
    if (!allowed()) return;
    const m = NBC.normBet(raw); if (!m) return;
    const r = role();
    if (m.k === 'res') { peerRes[m.id] = m; tryFinalize(m.id); return; }
    if (r === 'guest') {
      if (m.k === 'offer') { guestAsk(m); return; }
      const o = S.ob; if (!o || o.id !== m.id) return;
      if (m.k === 'go' && o.st === 'await') {
        clrT('await');
        if (!C().spend(o.amt)) { send('bet', { k: 'no', id: o.id }); clearOb(); say('Не хватило фишек — ставка отменена', 3000); return; }
        o.st = 'live'; o.paid = o.amt; save(); paintTag(); snd('combo');
        say(`🎲 Играем на ${o.amt} 🪙`, 3000);
      }
      if (m.k === 'no') { clearOb(); }
      return;
    }
    if (r === 'host') {
      const o = S.ob; if (!o || o.id !== m.id) return;
      if (m.k === 'no' && o.st === 'offer') { clrT('offer'); clearOb(); say('Соперник отказался от ставки — играем без неё', 3500); return; }
      if (m.k === 'ok' && o.st === 'offer') {
        clrT('offer');
        const late = typeof SERIES !== 'undefined' && SERIES && SERIES.games > 0;
        if (late || !C().spend(o.amt)) { send('bet', { k: 'no', id: o.id }); clearOb(); say(late ? 'Ставка опоздала — играем без неё' : 'Не хватило фишек на ставку', 3500); return; }
        o.st = 'live'; o.paid = o.amt; save(); paintTag(); snd('combo');
        send('bet', { k: 'go', id: o.id });
        say(`🎲 Играем на ${o.amt} 🪙`, 3000);
      }
    }
  }

  /* ---------- удвоение ---------- */
  function askDouble() {
    const o = S.ob;
    if (!o || o.st !== 'live' || !G || !G.over || SERIES.done) return;
    if (!NBC.isTie(SERIES.w, toOf(), SERIES.done)) return;
    const n = SERIES.games | 0, key = o.id + ':' + n;
    if (o.dk === key || (dbl && dbl.key === key)) return;
    o.dk = key; save();
    dbl = { key, n, mine: null, theirs: (peerDbl[key] || null), t: Date.now() };
    const can = C().get() >= o.amt && !C().calm();
    const w = document.createElement('div'); w.id = 'nbDbl'; w.className = 'chdw';
    const w2 = NET && NET.oppNick ? E(NET.oppNick) : 'соперник';
    w.innerHTML = `<div class="chdbl" role="dialog" aria-label="Удвоить ставку"><h3>🎲 УДВОИТЬ?</h3>
      <p>Счёт ${SERIES.w.p}:${SERIES.w.b} — решающая партия.<br>Ставка ${o.amt} → <b>${o.amt * 2}</b> 🪙 (нужно согласие обоих)<br><span class="m" id="nbDblSt">${can ? `ответ у ${w2} — 10 секунд` : 'не хватает фишек на удвоение'}</span></p>
      <div class="row"><button class="btn gold" type="button" id="nbDy" ${can ? '' : 'disabled'}>Удвоить ×2</button><button class="btn grey" type="button" id="nbDn">Как есть</button></div></div>`;
    document.body.appendChild(w);
    const pick = a => { if (!dbl || dbl.mine) return; dbl.mine = a; send('dbl', { id: o.id, n, a }); const st = $n('nbDblSt'); if (st && a === 'y') st.textContent = 'ждём ответа соперника…'; resolveDbl(); if (a === 'n') closeDbl(); };
    $n('nbDy').onclick = () => pick('y');
    $n('nbDn').onclick = () => pick('n');
    if (!can) { dbl.mine = 'n'; send('dbl', { id: o.id, n, a: 'n' }); }
    setT('dbl', () => {
      if (!dbl || dbl.key !== key) return;
      if (dbl.mine == null) { dbl.mine = 'n'; send('dbl', { id: o.id, n, a: 'n' }); }
      else if (dbl.mine === 'y' && dbl.theirs == null) send('dbl', { id: o.id, n, a: 'n' });   /* отзываем: время вышло */
      if (dbl.theirs == null) dbl.theirs = 'n';
      resolveDbl(); closeDbl();
    }, 10000);
    resolveDbl();
  }
  const peerDbl = {};
  function closeDbl() { clrT('dbl'); const w = $n('nbDbl'); if (w) w.remove(); }
  function resolveDbl() {
    if (!dbl) return;
    const out = NBC.dblOutcome(dbl.mine, dbl.theirs);
    if (!out) return;
    const o = S.ob, key = dbl.key; dbl = null; closeDbl();
    if (!o || o.st !== 'live') return;
    if (out === 'double') {
      if (C().spend(o.amt)) { o.paid += o.amt; o.amt *= 2; save(); paintTag(); snd('combo'); say(`🎲 Ставка удвоена: ${o.amt} 🪙`, 3500); }
      else say('Не хватило фишек на удвоение — остаёмся при своих', 3500);
    } else say('Остаёмся при своих', 2500);
    delete peerDbl[key];
  }
  function onDbl(raw) {
    if (!allowed()) return;
    const m = NBC.normDbl(raw); const o = S.ob;
    if (!m || !o || o.id !== m.id) return;
    const key = m.id + ':' + m.n;
    if (dbl && dbl.key === key) { dbl.theirs = m.a; resolveDbl(); }
    else peerDbl[key] = m.a;                 /* ответ пришёл раньше, чем у нас открылось окно */
  }

  /* ---------- итог матча ---------- */
  function startSettle() {
    const o = S.ob;
    if (!o || o.st !== 'live' || !G || !SERIES || !SERIES.done) return;
    const w = NBC.winnerChar(o.role, SERIES.w, toOf(), SERIES.done);
    o.st = 'settling'; o.w = w; save(); paintTag();
    send('bet', { k: 'res', id: o.id, amt: o.amt, w });
    const gone = NET && (NET.fled || !NET.connected);
    if (gone) finalize(o.id, true);
    else { tryFinalize(o.id); setT('settle', () => finalize(o.id, true), 12000); }
  }
  function tryFinalize(id) {
    const o = S.ob;
    if (o && o.id === id && o.st === 'settling' && peerRes[id]) finalize(id, false);
  }
  /* idempotent: id попадает в «рассчитанные» ДО выплаты */
  function finalize(id, noPeer) {
    const o = S.ob;
    if (!o || o.id !== id || S.settled.includes(id)) return;
    clrT('settle');
    S.settled.push(id); S.settled = S.settled.slice(-30);
    const plan = NBC.settle({ id, role: o.role, amt: o.amt, paid: o.paid, w: o.w }, peerRes[id] || null);
    S.ob = null; save(); delete peerRes[id]; paintTag();
    let text;
    if (plan.kind === 'win') { const r = C().payout(plan.stake, plan.profit); text = `🎲 Ставка выиграна: +${plan.profit} 🪙${r.paid ? ` (${r.paid} — Торгашу в счёт займа)` : ''}`; snd('win'); try { VFX.confetti(); } catch (e) {} }
    else if (plan.kind === 'refund') { C().refund(plan.pay); text = plan.why === 'mismatch' ? `🎲 Итоги ставки не сошлись — ${plan.pay} 🪙 возвращены обоим` : `🎲 Ставка ${plan.pay} 🪙 возвращена`; }
    else text = `🎲 Ставка ${o.paid} 🪙 проиграна`;
    lastNote = { id, text, t: Date.now() };
    say(text, 5000); decorate();
  }
  /* выход из матча со ставкой / брошенный матч: ставка сгорает */
  function forfeit(why) {
    const o = S.ob; if (!o) return;
    clrT('offer'); clrT('ask'); clrT('await'); clrT('settle');
    if (o.st === 'settling') { finalize(o.id, true); return; }
    const burned = o.paid > 0;
    if (burned && !S.settled.includes(o.id)) S.settled.push(o.id);
    S.ob = null; save(); paintTag();
    if (burned) say(`Выход из матча со ставкой (${why}) — ${o.paid} 🪙 сгорели`, 5000);
  }

  /* ---------- экран итога ---------- */
  function decorate() {
    try {
      const o = $n('over');
      if (!o || o.hidden || !G || !G.over || !lastNote || Date.now() - lastNote.t > 600000) return;
      if ($n('nbNote')) return;
      const n = document.createElement('div'); n.className = 'chnote'; n.id = 'nbNote';
      n.innerHTML = `<div class="ln"><span>${E(lastNote.text)}</span></div>`;
      const row = o.querySelector('.row'); if (row) o.insertBefore(n, row); else o.appendChild(n);
    } catch (e) {}
  }

  /* ---------- окно выбора ставки в лобби хозяина ---------- */
  function lobbyPicker() {
    const bo = $n('boNet'), host = $n('hostBtn');
    if (!bo || !host || $n('nbSeg')) return;
    const c = C(), chips = c ? c.get() : 0, calm = c ? c.calm() : false;
    if (sel > chips || calm) sel = 0;
    const box = document.createElement('div'); box.id = 'nbBox';
    box.innerHTML = `<div class="small">Ставка 🪙 <span style="opacity:.7">баланс ${chips}</span></div>
      <div class="cbets" id="nbSeg">${[0, ...NBC.BETS].map(b => `<button type="button" data-nb="${b}" class="${b === sel ? 'on' : ''}" ${b > chips || (calm && b) ? 'disabled' : ''}>${b === 0 ? 'Без' : b}</button>`).join('')}</div>
      <p class="small">${calm ? '🌙 Спокойный режим: ночью и после трёх проигрышей подряд ставки выключены.' : 'Гость сам решает, принять ли ставку. Выиграл матч — забираешь обе ставки; вышел посреди матча — ставка сгорает.'}</p>
      ${chips === 0 && c && !c.state().debt ? '<button class="btn orange" type="button" id="nbLoan">🧔 Займ у Торгаша: 200 🪙</button>' : ''}`;
    bo.after(box);
    $n('nbSeg').onclick = e => {
      const b = e.target.closest('[data-nb]'); if (!b || b.disabled) return;
      sel = +b.dataset.nb; wr(KSEL, String(sel));
      $n('nbSeg').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
    };
    const l = $n('nbLoan'); if (l) l.onclick = () => { c.loan(); box.remove(); lobbyPicker(); };
  }

  /* ---------- подписки ---------- */
  BUS.on('net:hi', m => { try { if (m.role === 'host') offerBet(); } catch (e) { console.warn('[netbet]', e); } });
  BUS.on('net:bet', m => { try { onBet(m.d); } catch (e) { console.warn('[netbet]', e); } });
  BUS.on('net:dbl', m => { try { onDbl(m.d); } catch (e) { console.warn('[netbet]', e); } });
  BUS.on('net:leave', () => { try { if (S.ob) forfeit('ты вышел'); } catch (e) {} });
  BUS.on('over', () => {
    try {
      if (!(NET && S.ob && NET.code === S.ob.code)) { decorate(); return; }
      if (G && G.over) { startSettle(); askDouble(); }
      decorate();
    } catch (e) { console.warn('[netbet]', e); }
  });
  BUS.on('lobby:render', () => { try { lobbyPicker(); } catch (e) {} });
  BUS.on('game:start', () => {
    try {
      /* новая партия вне онлайна, пока висит живая ставка с другого стола — ставка сгорела */
      if (S.ob && (S.ob.st === 'live') && (!NET || NET.code !== S.ob.code)) forfeit('другой матч');
      paintTag();
    } catch (e) {}
  });
  BUS.on('hud:render', () => { try { if (S.ob) paintTag(); } catch (e) {} });
  /* сразу после загрузки: брошенная ставка (вкладку закрыли посреди матча) сгорает, если стол не вернулся за минуту */
  setTimeout(() => { try { if (S.ob && !NET) { if (S.ob.st === 'settling') finalize(S.ob.id, true); else forfeit('вкладку закрыли'); } } catch (e) {} }, 60000);
  window.NETBET = { state: () => S, core: NBC, sel: () => sel, _peerRes: peerRes };
})();
