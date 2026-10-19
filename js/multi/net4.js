/* ДурКер — «Компания» онлайн: хозяин ведёт партию (движок M4), гостям шлёт только их руку и стол.
   До 3 гостей; пустые места занимают боты. Обновил страницу — вернулся на своё место (и гость, и хозяин). */
'use strict';

const NET4 = (() => {
  let N = null;            // { role, code, seats:[{pid,nick,kind,last}], started, want, got, lastHost }
  let turnT = null, watchT = null;
  const now = () => Date.now();
  const $4 = id => document.getElementById(id);
  const randCode4 = () => Array.from({ length: 4 }, () => 'abcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 31)]).join('');
  function setUrl4(q) {
    try {
      const u = new URL(location.href);
      ['mt', 'mh'].forEach(k => u.searchParams.delete(k));
      if (q) Object.entries(q).forEach(([k, v]) => u.searchParams.set(k, v));
      history.replaceState(null, '', u);
    } catch (e) {}
  }
  function link4(code) {
    if (typeof TG_LINK !== 'undefined' && TG_LINK) return TG_LINK + '?startapp=m_' + code;
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('mt', code); return u.toString();
  }
  function share4(code, btn) {
    const link = link4(code), text = `Го в ДурКер компанией! Стол ${code.toUpperCase()}`;
    try {
      if (typeof TGA !== 'undefined' && TGA && TGA.openTelegramLink) { TGA.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text)); return; }
    } catch (e) {}
    if (navigator.share) { navigator.share({ title: 'ДурКер', text, url: link }).catch(() => {}); return; }
    try { copyText(link, btn); } catch (e) {}
  }
  const seatOf = pid => N.seats.findIndex(s => s.pid === pid);

  /* ================= хозяин ================= */
  function host(restore) {
    if (!T4.available()) { toast('Не загрузилась библиотека онлайна — обнови страницу'); return; }
    const code = restore ? restore.code : randCode4();
    N = restore ? { ...restore.N, role: 'host', ready: false } : { role: 'host', code, seats: [{ pid: T4.me, nick: myNick(), kind: 'host', last: now() }], started: false, want: 4, ready: false };
    setUrl4({ mh: code });
    if (!restore) lobby();
    T4.host(code, {
      ready() { N.ready = true; if (!N.started) lobby(); else UI4.refresh(); },
      msg(pid, t, d) { onMsg(pid, t, d || {}); },
      error(t) { toast(t); },
    });
    clearInterval(watchT);
    watchT = setInterval(() => { if (N && N.started && UI4.on) UI4.render(); }, 5000);
  }
  function onMsg(pid, t, d) {
    if (!N || N.role !== 'host') return;
    let s = seatOf(pid);
    if (t === 'hi' || (t === 'ping' && s < 0)) {
      if (s < 0) {
        if (N.started || N.seats.length >= 4) { T4.send('full', null, pid); return; }
        N.seats.push({ pid, nick: String(d.nick || 'Игрок').slice(0, 16), kind: 'net', last: now() });
        if (d.v && d.v !== VERSION) toast('У кого-то из друзей другая версия игры — пусть обновит страницу', 6000);
        lobby(); return;
      }
      N.seats[s].last = now();
      if (!N.started) { lobby(); return; }
      sendView(s); return;
    }
    if (s < 0) return;
    N.seats[s].last = now();
    if (t === 'ping') return;
    if (t === 'act' && N.started && M4.M) {
      const ns = Array.isArray(d.c) ? d.c.slice(0, 5).map(Number) : [];
      const r = M4.act(s, String(d.t), ns);
      if (!r.ok) sendView(s); else UI4.refresh();
    }
  }
  function lobby() {
    if (!N) return;
    const host = N.role === 'host';
    const seats = N.seats.map((s, i) => `<div class="seat"><span class="ava" style="background:${i ? '#3b6db8' : '#d9a03c'}">${esc(s.nick.slice(0, 2).toUpperCase())}</span><b>${esc(s.nick)}</b>${i === 0 ? ' · хозяин' : ''}</div>`).join('');
    const empty = Math.max(0, (host ? N.want : 4) - N.seats.length);
    const bots = Array.from({ length: empty }, () => '<div class="seat off"><span class="ava" style="background:#5b6d68">🤖</span>место для друга — или сядет бот</div>').join('');
    try {
      sheet('page', `${head('Компания · стол ' + esc(N.code.toUpperCase()))}
        <div class="m4lobby" style="display:flex;flex-direction:column;gap:6px">${seats}${bots}</div>
        ${host ? `<div class="codebox"><div class="small">Код для друзей</div><div class="code">${N.ready ? esc(N.code.toUpperCase()) : '····'}</div>
          <button class="btn green" type="button" id="m4share" ${N.ready ? '' : 'disabled'}>Позвать друзей ссылкой</button></div>
          <div class="m4pick"><button class="btn ${N.want === 3 ? 'gold' : 'grey'}" type="button" data-w="3">Втроём</button><button class="btn ${N.want === 4 ? 'gold' : 'grey'}" type="button" data-w="4">Вчетвером</button></div>
          <button class="btn blue" type="button" id="m4start" ${N.ready && N.seats.length >= 2 ? '' : 'disabled'}>Начать${N.seats.length < N.want ? ' (пустые места — боты)' : ''}</button>
          <p class="small" style="color:var(--muted)">Правила — «Классика». Партию ведёт твой телефон: не закрывай вкладку.</p>
          <button class="btn grey" type="button" id="m4close">Закрыть стол</button>`
        : `<div class="status"><span class="wait">${N.got ? 'Ждём, пока хозяин начнёт…' : 'Подключаемся к столу…'}</span></div><button class="btn grey" type="button" id="m4close">Выйти</button>`}`);
      const sh = $4('m4share'); if (sh) sh.onclick = () => share4(N.code, sh);
      const st = $4('m4start'); if (st) st.onclick = start;
      $4('m4close').onclick = () => { leave(); closeSheets(); };
      document.querySelectorAll('#pageIn [data-w]').forEach(b => { b.onclick = () => { N.want = +b.dataset.w; while (N.seats.length > N.want) N.seats.pop(); lobby(); }; });
    } catch (e) { console.error(e); }
    if (host) T4.send('lobby', { seats: N.seats.map(s => s.nick), want: N.want });
  }
  function start() {
    if (!N || N.started) return;
    const n = Math.max(3, N.want), bots = UI4.C ? [] : [];
    const BN = [{ name: 'Дядя Валера', face: 'ДВ', color: '#d9a03c', ai: 'valera' }, { name: 'Тётя Зина', face: 'З', color: '#b85b5b', ai: 'sharper' }, { name: 'Студент', face: 'СТ', color: '#4f8fd8', ai: 'student' }];
    let bi = 0;
    while (N.seats.length < n) { const b = BN[bi++ % BN.length]; N.seats.push({ pid: 'bot' + bi, nick: b.name, kind: 'bot', bot: b, last: now() }); }
    N.started = true;
    const cfg = { N: n, names: N.seats.map(s => s.nick), kinds: N.seats.map((s, i) => (i === 0 ? 'me' : s.kind)), bots: N.seats.map(s => s.bot || null), series: Array(n).fill(0), games: 0 };
    UI4.C.cfg = cfg;
    UI4.setFaces(N.seats.map(s => s.bot || null));
    UI4.enter('host', 0);
    M4.newGame(cfg);
    AU.play('deal');
    UI4.refresh();
  }
  function hostNext() {
    const cfg = UI4.C.cfg;
    M4.newGame(cfg);
    UI4.C.sel.clear();
    AU.play('deal');
    UI4.refresh();
  }
  function sendView(s) {
    if (!N || !M4.M) return;
    const st = N.seats[s];
    if (!st || st.kind !== 'net') return;
    const V = M4.viewFor(s);
    V.fc = N.seats.map(x => (x.bot ? { face: x.bot.face, color: x.bot.color } : null));
    V.code = N.code;
    T4.send('st', V, st.pid);
  }
  function broadcast() {
    if (!N || N.role !== 'host' || !N.started) return;
    N.seats.forEach((s, i) => { if (s.kind === 'net') sendView(i); });
    try { sessionStorage.setItem('durocker-m4host', JSON.stringify({ code: N.code, N: { ...N, ready: false }, M: M4.dump(), cfg: UI4.C.cfg, at: now() })); } catch (e) {}
  }
  /* ход гостя: 40 секунд, а если он пропал со связи — 6 секунд, потом за него ходит бот */
  function armTurn(s) {
    clearTimeout(turnT);
    if (!N || N.role !== 'host' || !M4.M || M4.M.over != null) return;
    const seat = N.seats[s];
    if (!seat || seat.kind !== 'net') return;
    const key = M4.M.turnNo + '|' + M4.M.phase.kind + '|' + s + '|' + M4.M.table.length;
    const ms = offline(s) ? 6000 : 40000;
    turnT = setTimeout(() => {
      const M = M4.M;
      if (!M || M.over != null || M.phase.who !== s || key !== M.turnNo + '|' + M.phase.kind + '|' + s + '|' + M.table.length) return;
      const [t, ns] = BOT4.decide(M, s, { ai: 'student' });
      let r = M4.act(s, t, ns);
      if (!r.ok) r = M4.act(s, M.phase.kind === 'defend' ? 'take' : 'pass', []);
      if (!r.ok && M.phase.kind === 'attack') M4.act(s, 'play', [M.hands[s][0].n]);
      toast(`${seat.nick} долго думал — сходили за него`);
      UI4.refresh();
    }, ms);
  }
  function offline(s) { return !!(N && N.role === 'host' && N.seats[s] && N.seats[s].kind === 'net' && now() - N.seats[s].last > 15000); }

  /* ================= гость ================= */
  function join(code) {
    if (!T4.available()) { toast('Не загрузилась библиотека онлайна — обнови страницу'); return; }
    N = { role: 'guest', code, seats: [], got: false, lastHost: now() };
    setUrl4({ mt: code });
    lobby();
    T4.join(code, myNick(), {
      ready() {
        const hi = () => { if (N && N.role === 'guest' && !N.got) { T4.send('hi', { nick: myNick(), v: VERSION }); setTimeout(hi, 2000); } };
        hi();
      },
      msg(pid, t, d) {
        if (!N || N.role !== 'guest') return;
        N.lastHost = now();
        if (t === 'full') { toast('За этим столом уже нет мест'); leave(); try { closeSheets(); } catch (e) {} return; }
        if (t === 'lobby' && d) { N.got = true; N.seats = (d.seats || []).map(nick => ({ nick: String(nick).slice(0, 16) })); if (!UI4.on) lobby(); return; }
        if (t === 'st' && d && d.hand) {
          N.got = true;
          if (d.v && d.v !== VERSION) { if (!N.vw) { N.vw = 1; toast(d.v > VERSION ? 'У тебя старая версия игры — обнови страницу' : 'У хозяина старая версия — пусть обновит страницу', 7000); } }
          if (!UI4.on) UI4.enter('guest', d.me);
          UI4.setFaces(d.fc || []);
          UI4.setView(d);
        }
      },
      error(t) { toast(t); },
    });
    clearInterval(watchT);
    watchT = setInterval(() => {
      if (N && N.role === 'guest' && N.got && now() - N.lastHost > 15000 && !N.warned) { N.warned = true; toast('Хозяин стола пропал со связи — ждём…', 5000); }
      if (N && now() - N.lastHost < 15000) N.warned = false;
    }, 3000);
  }
  function sendAct(t, ns) { T4.send('act', { t, c: ns }); }
  function leave() {
    clearTimeout(turnT); clearInterval(watchT);
    try { T4.close(); } catch (e) {}
    N = null; setUrl4(null);
    try { sessionStorage.removeItem('durocker-m4host'); } catch (e) {}
  }

  /* ================= вход по ссылке и возврат после обновления ================= */
  function boot() {
    let sp = null;
    try { sp = typeof TGA !== 'undefined' && TGA && TGA.initDataUnsafe && TGA.initDataUnsafe.start_param; } catch (e) {}
    const q = new URLSearchParams(location.search);
    const mt = (sp && /^m_[a-z0-9]{4}$/.test(sp) ? sp.slice(2) : null) || (/^[a-z0-9]{4}$/.test(q.get('mt') || '') ? q.get('mt') : null);
    const mh = q.get('mh');
    if (mh) {
      let d = null; try { d = JSON.parse(sessionStorage.getItem('durocker-m4host')); } catch (e) {}
      if (d && d.code === mh && now() - d.at < 3 * 3600e3 && M4.restore(d.M)) {
        UI4.C.cfg = d.cfg;
        UI4.setFaces(d.N.seats.map(s => s.bot || null));
        UI4.enter('host', 0);
        host({ code: d.code, N: d.N });
        UI4.refresh();
        return;
      }
      setUrl4(null);
    }
    if (mt) { try { store('durocker-seen', '1'); } catch (e) {} join(mt); }
  }
  /* ждём, пока игра и Телеграм проснутся (main.js и tg.js запускаются после нас) */
  let tries = 0;
  const waitBoot = () => {
    const tgPending = /tgWebApp/.test(location.hash + location.search) && (typeof TGA === 'undefined' || !TGA);
    if ((typeof G === 'undefined' || !G || tgPending) && tries++ < 40) { setTimeout(waitBoot, 150); return; }
    try { boot(); } catch (e) { console.error(e); }
  };
  addEventListener('load', () => setTimeout(waitBoot, 200));

  return { host, join, start, hostNext, broadcast, armTurn, offline, sendAct, leave, code: () => (N ? N.code : ''), get N() { return N; } };
})();
