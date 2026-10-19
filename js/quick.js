/* Дурокер — «⚡ Быстрая игра»: случайный соперник из тех, кто сейчас онлайн.
   Своего сервера нет: ищущие перекликаются через тот же публичный MQTT-брокер, что и онлайн-стол.
   Протокол (topics durocker/q1/…):
   - seek: каждый ищущий раз в 2 с публикует {pid, nick, v, r, busy, t} и слушает чужие;
   - хозяином пары становится тот, у кого pid меньше: он открывает обычный стол (hostTable)
     и шлёт сопернику в durocker/q1/match/<его pid> {k:'offer', from, nick, r, code};
   - гость отвечает {k:'ok'} или {k:'no'} хозяину в его match-topic и садится за стол (joinTable);
   - нет ответа 6 с — стол закрывается, этот соперник на 15 с в игноре, поиск продолжается.
   Сначала (10 с) ищем соперника с близким рейтингом (±30 очков), потом любого. */
'use strict';

const QUICK = (() => {
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const ROOT = 'durocker/q1/';
  const SEEK = ROOT + 'seek';
  const BEAT = 2000, FRESH = 5000, OFFER_MS = 6000, CLOSE_MS = 10000, WAIT_BOT = 30000;
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const pid = (() => {
    let v = rd('durocker-pid');
    if (!v || !/^[a-z0-9]{8,16}$/.test(v)) { v = Math.random().toString(36).slice(2, 12).padEnd(10, '0'); wr('durocker-pid', v); }
    return v;
  })();
  const rating = () => { try { return Math.max(0, Math.round(+(JSON.parse(rd('durocker-lb')) || {}).r || 0)); } catch (e) { return 0; } };
  const major = v => String(v || '').split('-w')[0];
  const cleanNick = n => String(n == null ? '' : n).replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) || 'Соперник';
  const available = () => typeof window.mqtt === 'object' || typeof window.mqtt === 'function';

  let cl = null, timers = [], peers = new Map(), ignore = new Map();
  let st = null; /* {startedAt, busy, offerTo, offerT, waitShown, found} */

  /* ---------- соединение ---------- */
  function connect(done, fail) {
    let i = 0;
    const next = () => {
      if (i >= BROKERS.length) { fail(); return; }
      const url = BROKERS[i++];
      let c, ok = false;
      try { c = mqtt.connect(url, { clientId: 'dq_' + pid + '_' + Math.random().toString(36).slice(2, 6), connectTimeout: 6000, reconnectPeriod: 2000, clean: true, keepalive: 30 }); }
      catch (e) { next(); return; }
      const t = setTimeout(() => { if (!ok) { try { c.end(true); } catch (e) {} next(); } }, 8000);
      c.once('connect', () => { ok = true; clearTimeout(t); done(c); });
      c.on('error', () => {});
    };
    next();
  }
  const pub = (topic, d) => { if (cl) try { cl.publish(topic, JSON.stringify(d), { qos: 0 }); } catch (e) {} };
  function stopNet() {
    timers.forEach(t => clearInterval(t)); timers = [];
    if (cl) { try { cl.end(true); } catch (e) {} }
    cl = null; peers.clear();
  }

  /* ---------- поиск ---------- */
  function start() {
    if (!available()) { showUnavailable(); return; }
    try { closeSheets(); } catch (e) {}
    if (typeof NET !== 'undefined' && NET) { try { TR.close(); } catch (e) {} NET = null; setUrl(null); }
    stopNet();
    st = { startedAt: Date.now(), busy: false, offerTo: null, offerT: 0, waitShown: false, found: null };
    render('Подключаемся…');
    connect(c => {
      if (!st) { try { c.end(true); } catch (e) {} return; }
      cl = c;
      cl.subscribe(SEEK, { qos: 0 });
      cl.subscribe(ROOT + 'match/' + pid, { qos: 0 });
      cl.on('message', onMsg);
      beat();
      timers.push(setInterval(beat, BEAT));
      timers.push(setInterval(tick, 500));
      render();
    }, () => { if (st) render('Не удалось подключиться к серверу игры. Проверь интернет или VPN.', true); });
  }
  function beat() {
    if (!st || !cl) return;
    pub(SEEK, { pid, nick: cleanNick(myNick()), v: VERSION, r: rating(), busy: !!st.busy, t: Date.now() });
  }
  function onMsg(topic, payload) {
    if (!st) return;
    let m; try { m = JSON.parse(payload.toString()); } catch (e) { return; }
    if (!m || typeof m !== 'object') return;
    if (topic === SEEK) {
      if (typeof m.pid !== 'string' || !/^[a-z0-9]{8,16}$/.test(m.pid) || m.pid === pid) return;
      if (major(m.v) !== major(VERSION)) return;
      peers.set(m.pid, { nick: cleanNick(m.nick), r: Math.max(0, Math.min(1e6, Math.round(+m.r || 0))), busy: !!m.busy, seen: Date.now() });
      return;
    }
    if (topic !== ROOT + 'match/' + pid || typeof m.from !== 'string' || !/^[a-z0-9]{8,16}$/.test(m.from)) return;
    if (m.k === 'offer') onOffer(m);
    else if (m.k === 'ok' && st.offerTo === m.from) onAccepted(m);
    else if (m.k === 'no' && st.offerTo === m.from) dropOffer(m.from);
  }
  /* кому предложить игру: свободные, свежие, совместимые; сначала с близким рейтингом */
  function candidates() {
    const now = Date.now(), my = rating(), early = now - st.startedAt < 10000;
    const list = [];
    peers.forEach((p, id) => {
      if (now - p.seen > FRESH || p.busy || (ignore.get(id) || 0) > now) return;
      if (early && Math.abs(p.r - my) > 30) return;
      list.push({ id, ...p });
    });
    return list.sort((a, b) => Math.abs(a.r - my) - Math.abs(b.r - my) || (a.id < b.id ? -1 : 1));
  }
  function tick() {
    if (!st) return;
    const now = Date.now();
    /* хозяин ждёт ответа */
    if (st.offerTo && now - st.offerT > OFFER_MS) dropOffer(st.offerTo);
    /* гость ждёт стола */
    if (st.found && st.found.role === 'guest' && now - st.found.t > CLOSE_MS && !(NET && NET.got)) {
      ignore.set(st.found.from, now + 15000);
      try { TR.close(); } catch (e) {} NET = null; setUrl(null);
      st.found = null; st.busy = false; render();
    }
    if (st.found) return;
    if (!st.busy) {
      /* хозяин пары — у кого pid меньше: так двое не откроют два стола друг для друга */
      const c = candidates().find(p => pid < p.id);
      if (c) makeOffer(c);
    }
    if (!st.waitShown && now - st.startedAt > WAIT_BOT) { st.waitShown = true; }
    render();
  }
  function makeOffer(p) {
    st.busy = true; st.offerTo = p.id; st.offerT = Date.now(); st.peer = p;
    beat();
    hostTable();
    if (!NET) { st.busy = false; st.offerTo = null; return; }
    NET.quick = true; NET.bo = 3; NET.oppNick = p.nick; NET.oppR = p.r;
    $('lobby').hidden = true;
    pub(ROOT + 'match/' + p.id, { k: 'offer', from: pid, nick: cleanNick(myNick()), r: rating(), code: NET.code, v: VERSION });
  }
  function dropOffer(id) {
    ignore.set(id, Date.now() + 15000);
    if (NET && NET.quick && NET.role === 'host' && !NET.connected) { try { TR.close(); } catch (e) {} NET = null; setUrl(null); }
    st.busy = false; st.offerTo = null; st.peer = null;
    beat(); render();
  }
  function onOffer(m) {
    const reply = k => pub(ROOT + 'match/' + m.from, { k, from: pid });
    if (st.busy || st.found || !(m.from < pid) || major(m.v) !== major(VERSION) || !/^[a-z0-9]{4}$/.test(String(m.code || ''))) { reply('no'); return; }
    st.busy = true;
    st.found = { role: 'guest', from: m.from, nick: cleanNick(m.nick), r: Math.max(0, Math.round(+m.r || 0)), t: Date.now() };
    reply('ok');
    beat();
    joinTable(String(m.code));
    if (NET) { NET.quick = true; NET.bo = 3; NET.oppNick = st.found.nick; NET.oppR = st.found.r; }
    $('lobby').hidden = true;
    render();
  }
  function onAccepted() {
    st.found = { role: 'host', from: st.offerTo, nick: st.peer.nick, r: st.peer.r, t: Date.now() };
    st.offerTo = null;
    render();
  }
  /* стол сложился: соперник за столом — убираем окно поиска и отпускаем брокер поиска */
  function watchSeated() {
    setInterval(() => {
      if (!st || !st.found) return;
      const seated = NET && NET.quick && ((NET.role === 'host' && NET.connected && NET.started) || (NET.role === 'guest' && NET.got));
      if (seated) {
        const f = st.found;
        st = null; stopNet(); hide();
        toast(`⚡ Соперник найден: ${f.nick}${f.r ? ` · ★${f.r}` : ''}`);
      }
    }, 300);
  }
  function cancel() {
    if (st && st.found && NET && NET.quick && !(NET.connected || NET.got)) { try { TR.close(); } catch (e) {} NET = null; setUrl(null); }
    if (st && st.offerTo && NET && NET.quick && !NET.connected) { try { TR.close(); } catch (e) {} NET = null; setUrl(null); }
    st = null; stopNet(); hide();
    if (typeof G === 'undefined' || !G) { try { newGame(); } catch (e) {} }
  }

  /* ---------- окно поиска ---------- */
  function el() {
    let e = document.getElementById('quickBox');
    if (!e) {
      e = document.createElement('div'); e.id = 'quickBox'; e.className = 'qbox'; e.hidden = true;
      document.body.appendChild(e);
      e.addEventListener('click', ev => {
        const b = ev.target.closest('[data-q]'); if (!b) return;
        const k = b.dataset.q;
        if (k === 'cancel') cancel();
        else if (k === 'bot') { cancel(); try { openBots(); } catch (e2) {} }
        else if (k === 'more') { if (st) { st.startedAt = Date.now(); st.waitShown = false; render(); } }
        else if (k === 'close') hide();
      });
    }
    return e;
  }
  const mmss = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  function render(msg, err) {
    if (!st) return;
    const e = el(), now = Date.now();
    const n = [...peers.values()].filter(p => now - p.seen <= FRESH).length;
    const near = now - st.startedAt < 10000;
    let body;
    if (msg) body = `<p class="${err ? 'qerr' : ''}">${esc(msg)}</p>`;
    else if (st.found) body = `<p class="qfound">Нашли: <b>${esc(st.found.nick)}</b>${st.found.r ? ` · ★${st.found.r}` : ''}</p><p class="qsm">Садимся за стол…</p>`;
    else if (st.offerTo) body = `<p>Зовём <b>${esc(st.peer ? st.peer.nick : 'соперника')}</b>…</p>`;
    else body = `<p class="qsm">${near ? 'Ищем соперника твоего уровня' : 'Ищем любого свободного соперника'} · твой рейтинг ★${rating()}</p>
      <p class="qsm">Сейчас ищут игру: <b>${n + 1}</b></p>`;
    const waitBtns = st.waitShown && !st.found && !st.offerTo
      ? `<p class="qsm">Пока никого нет. Можно сыграть с ботом или подождать ещё.</p><div class="row"><button class="btn blue" type="button" data-q="bot">Играть с ботом</button><button class="btn orange" type="button" data-q="more">Искать дальше</button></div>` : '';
    e.innerHTML = `<div class="qin"><h2>⚡ БЫСТРАЯ ИГРА</h2><div class="qspin" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="qtime">${mmss(now - st.startedAt)}</div>${body}${waitBtns}
      <p class="qsm">Матч до 2 побед · полные правила</p>
      <button class="btn grey" type="button" data-q="cancel">Отмена</button></div>`;
    e.hidden = false;
  }
  function hide() { const e = document.getElementById('quickBox'); if (e) e.hidden = true; }
  function showUnavailable() {
    const e = el();
    e.innerHTML = `<div class="qin"><h2>⚡ БЫСТРАЯ ИГРА</h2><p>Быстрая игра доступна на сайте и в Telegram: <b>@durocker_bot</b>.</p>
      <button class="btn grey" type="button" data-q="close">Понятно</button></div>`;
    e.hidden = false;
  }

  /* ---------- встраивание без правки чужих файлов ---------- */
  function hook() {
    const css = document.createElement('style');
    css.textContent = `.qbox{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;background:rgba(3,12,10,.78);padding:16px}
.qbox[hidden]{display:none!important}
.qbox .qin{width:100%;max-width:380px;background:#0f1f1a;border:2px solid #d9a03c;border-radius:14px;padding:18px 16px;text-align:center;box-shadow:0 8px 0 rgba(0,0,0,.45)}
.qbox h2{font-family:var(--f-hard,monospace);color:#ffd257;font-size:16px;margin:0 0 10px}
.qbox p{margin:8px 0;color:#f3ead2;font-size:15px}.qbox .qsm{font-size:13px;opacity:.8}.qbox .qerr{color:#ff7b6b}.qbox .qfound{font-size:17px;color:#9cf0b4}
.qbox .qtime{font-family:var(--f-hard,monospace);font-size:22px;color:#fff;margin:6px 0}
.qbox .row{display:flex;gap:8px;justify-content:center;margin:10px 0}.qbox .btn{min-width:120px}
.qspin{display:flex;gap:6px;justify-content:center;margin:6px 0}.qspin span{width:10px;height:10px;border-radius:50%;background:#d9a03c;animation:qb 1s infinite ease-in-out}
.qspin span:nth-child(2){animation-delay:.15s}.qspin span:nth-child(3){animation-delay:.3s}
@keyframes qb{0%,100%{transform:translateY(0);opacity:.4}50%{transform:translateY(-8px);opacity:1}}
@media (prefers-reduced-motion:reduce){.qspin span{animation:none}}
.mi.quick{border-color:#d9a03c}`;
    document.head.appendChild(css);
    if (typeof openMenu === 'function') {
      const _om = openMenu;
      openMenu = function () {
        const r = _om.apply(this, arguments);
        try {
          const g = document.querySelector('#menuIn .menugrid');
          if (g && !g.querySelector('[data-go="quick"]')) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'mi quick'; b.dataset.go = 'quick';
            b.innerHTML = available() ? '<b>⚡ Быстрая игра</b><small>Случайный соперник онлайн</small>' : '<b>⚡ Быстрая игра</b><small>На сайте и в Telegram</small>';
            const after = g.querySelector('[data-go="career"]');
            if (after && after.nextSibling) g.insertBefore(b, after.nextSibling); else g.appendChild(b);
          }
        } catch (e) {}
        return r;
      };
    }
    if (typeof menuGo === 'function') {
      const _mg = menuGo;
      menuGo = function (k) {
        if (k === 'quick') { try { closeSheets(); } catch (e) {} start(); return; }
        return _mg.apply(this, arguments);
      };
    }
    /* в лобби онлайна — кнопка быстрой игры */
    if (typeof renderLobby === 'function') {
      const _rl = renderLobby;
      renderLobby = function () {
        const r = _rl.apply(this, arguments);
        try {
          const L = document.getElementById('lobbyIn');
          if (L && !NET && available() && !L.querySelector('#quickBtn')) {
            const b = document.createElement('button');
            b.type = 'button'; b.id = 'quickBtn'; b.className = 'btn gold'; b.textContent = '⚡ Быстрая игра — случайный соперник';
            b.onclick = () => { const n = document.getElementById('nickIn'); if (n) store('durocker-nick', (n.value.trim() || 'Игрок').slice(0, 16)); $('lobby').hidden = true; start(); };
            const host = L.querySelector('#hostBtn');
            if (host) host.parentNode.insertBefore(b, host); else L.appendChild(b);
          }
        } catch (e) {}
        return r;
      };
    }
    /* правила быстрой игры: полные, без блица, у всех одинаково */
    if (typeof tableRules === 'function') {
      const _tr = tableRules;
      tableRules = function () {
        const r = _tr.apply(this, arguments);
        if (typeof NET !== 'undefined' && NET && NET.quick) return { ...r, ...RULESETS.full, set: 'full', transfer: true, blitz: false };
        return r;
      };
    }
    /* рейтинг соперника рядом с ником */
    if (typeof renderHUD === 'function') {
      const _rh = renderHUD;
      renderHUD = function () {
        const r = _rh.apply(this, arguments);
        try { if (NET && NET.quick && NET.oppR != null) { const o = $('oppName'); if (o) o.textContent = `${oppName()} · ★${NET.oppR}`; } } catch (e) {}
        return r;
      };
    }
    /* итог: «Новый соперник»; соперник ушёл — без кода стола, сразу к поиску */
    if (typeof showOver === 'function') {
      const _so = showOver;
      showOver = function () {
        const r = _so.apply(this, arguments);
        try {
          if (!(NET && NET.quick)) return r;
          const o = $('over');
          const gone = (NET.role === 'host' && NET.started && !NET.connected) || (NET.role === 'guest' && NET.got && !NET.connected);
          if (gone) {
            o.hidden = false;
            o.innerHTML = `<h2>СОПЕРНИК УШЁЛ</h2><p>${esc(oppName())} отключился.</p><div class="row"><button class="btn gold" type="button" id="qNew">⚡ Новый соперник</button><button class="btn grey" type="button" id="qLeave">Меню</button></div>`;
          } else if (G && G.over && SERIES && SERIES.done && !o.querySelector('#qNew')) {
            const row = o.querySelector('.row') || o;
            const b = document.createElement('button');
            b.type = 'button'; b.id = 'qNew'; b.className = 'btn gold'; b.textContent = '⚡ Новый соперник';
            row.appendChild(b);
          }
          const qn = $('qNew'); if (qn) qn.onclick = () => { leaveTable(); start(); };
          const ql = $('qLeave'); if (ql) ql.onclick = () => { leaveTable(); openMenu(); };
        } catch (e) {}
        return r;
      };
    }
    watchSeated();
  }
  hook();
  return { start, cancel, get state() { return st; }, get peers() { return peers; }, pid };
})();
