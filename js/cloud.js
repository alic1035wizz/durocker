/* ДурКер — «облако» на Google Apps Script (папка apps-script/).
   Сервер сам считает очки, подтверждает онлайн-матчи с двух сторон, ведёт сезон и турниры.
   Пока адрес CLOUD_URL пуст или облако не отвечает, игра работает как раньше — таблица через MQTT. */
'use strict';

/* адрес веб-приложения после «Развернуть → Новое развёртывание» (…/exec) */
const CLOUD_URL = '';

const CLOUD = (() => {
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  const escH = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let url = (new URLSearchParams(location.search).get('cloud') || CLOUD_URL || '').trim();
  let down = 0, me = null, lastBoard = null;
  const on = () => !!url && /^https:\/\//.test(url) && Date.now() > down && typeof fetch === 'function';

  /* ---------- запросы ---------- */
  async function req(method, body, params, ms) {
    if (!on()) return null;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => ctl && ctl.abort(), ms || 15000);
    try {
      let r;
      if (method === 'GET') r = await fetch(url + '?' + new URLSearchParams(params).toString(), { signal: ctl && ctl.signal });
      /* text/plain — чтобы браузер не делал предварительный CORS-запрос, который Apps Script не понимает */
      else r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctl && ctl.signal });
      const j = await r.json();
      return j && typeof j === 'object' ? j : null;
    } catch (e) {
      down = Date.now() + 60000;  // минуту не дёргаем облако — работаем по-старому
      return null;
    } finally { clearTimeout(t); }
  }
  function pid() {
    let v = rd('durocker-pid');
    if (!v || !/^[a-z0-9]{8,16}$/.test(v)) { v = Math.random().toString(36).slice(2, 12).padEnd(10, '0'); wr('durocker-pid', v); }
    return v;
  }
  const nick = () => ((typeof myNick === 'function' ? myNick() : rd('durocker-nick')) || 'Игрок').slice(0, 16);
  /* ник, титул, рамка и карьера едут с каждым запросом */
  function who() {
    const o = { pid: pid(), secret: rd('durocker-secret') || '', nick: nick() };
    try {
      const p = prog();
      if (p.title !== undefined) o.title = typeof PASS !== 'undefined' && PASS.rewardName && p.title ? PASS.rewardName('title', p.title) : '';
      if (p.frame !== undefined) o.frame = p.frame || '';
      o.career = p.career | 0; o.careerDone = !!p.careerDone;
    } catch (e) {}
    return o;
  }
  let regP = null;
  async function ensure() {
    if (!on()) return false;
    if (rd('durocker-secret')) return true;
    if (regP) return regP;
    regP = (async () => {
      let r = await req('POST', { a: 'register', pid: pid(), nick: nick() });
      if (r && r.error === 'taken') { wr('durocker-pid', Math.random().toString(36).slice(2, 12).padEnd(10, '0')); r = await req('POST', { a: 'register', pid: pid(), nick: nick() }); }
      if (r && r.ok && r.secret) { wr('durocker-secret', r.secret); return true; }
      return false;
    })();
    const ok = await regP; regP = null; return ok;
  }
  async function call(a, extra) {
    if (!(await ensure())) return null;
    let r = await req('POST', Object.assign({ a }, who(), extra || {}));
    if (r && r.error === 'auth') { wr('durocker-secret', ''); if (await ensure()) r = await req('POST', Object.assign({ a }, who(), extra || {})); }
    if (r && r.me) me = r.me;
    return r;
  }
  async function board() {
    const r = await req('GET', null, { a: 'board' });
    if (r && r.ok) { lastBoard = r; const m = r.players.find(p => p.id === pid()); if (m) me = m; return r; }
    return null;
  }

  /* ---------- отчёты о партиях ---------- */
  function oppLevel() {
    let b = null; try { b = currentBot(); } catch (e) {}
    if (!b) return 'student';
    if (b.boss === 'sharper') return 'final';
    if (b.boss && b.boss !== 'weekly') return 'boss';
    return b.ai === 'sharper' ? 'sharper' : b.ai === 'valera' ? 'valera' : 'student';
  }
  function reportGame() {
    if (!on() || !G || !G.over || G.over === 'draw') return;
    if (typeof NET !== 'undefined' && NET) return;              // онлайн — по итогу матча, с двух сторон
    const k = MODE && MODE.kind;
    if (k === 'tutorial') return;
    const result = G.over === 'p' ? 'win' : 'lose';
    let opp = ''; try { opp = currentBot().name; } catch (e) {}
    const x = { result, opp };
    if (k === 'daily') { x.kind = 'daily'; x.dailyKey = typeof todayKey === 'function' ? todayKey() : ''; x.pen = G.penalty | 0; }
    else if (k === 'weekly') x.kind = 'weekly';
    else { x.kind = 'bot'; x.oppLevel = oppLevel(); }
    /* не чаще раза в 20 с — сервер всё равно отсечёт; копим последнюю и шлём с задержкой */
    queue(x);
  }
  let qT = 0, lastSent = 0;
  const q = [];
  function queue(x) {
    q.push(x); clearTimeout(qT);
    qT = setTimeout(flush, Math.max(500, 21000 - (Date.now() - lastSent)));
  }
  async function flush() {
    const x = q.shift();
    if (!x) return;
    lastSent = Date.now();
    await call('report', x);
    if (q.length) qT = setTimeout(flush, 21000);
  }
  /* онлайн: оба игрока в конце матча присылают итог с одним номером матча */
  function reportMatch() {
    if (!on() || typeof NET === 'undefined' || !NET || !NET.code || !SERIES || !SERIES.done || !SERIES.w) return;
    const key = 'durocker-cl-done-' + NET.code, seen = JSON.parse(ss.get(key) || '[]');
    const sig = (SERIES.games | 0) + ':' + SERIES.w.p + ':' + SERIES.w.b;
    if (seen.includes(sig)) return;
    seen.push(sig); ss.set(key, JSON.stringify(seen));
    const result = SERIES.w.p > SERIES.w.b ? 'win' : 'lose';
    const tm = activeTM();
    if (tm && tm.table === NET.code) {
      call('t_report', { code: tm.code, round: tm.round, n: tm.n, result }).then(r => { if (r && r.state) saveTour(r.state); });
      ss.set('durocker-cl-tm', '');
    }
    call('report', { kind: 'online', result, role: NET.role, matchId: NET.code + '_' + seen.length });
  }

  /* ---------- турниры ---------- */
  const tours = () => { try { return JSON.parse(rd('durocker-tours') || '[]'); } catch (e) { return []; } };
  function saveTour(st) {
    if (!st) return;
    const l = tours().filter(t => t.code !== st.code);
    l.unshift({ code: st.code, name: st.name, status: st.status });
    wr('durocker-tours', JSON.stringify(l.slice(0, 8)));
    cur = st;
  }
  const activeTM = () => { try { return JSON.parse(ss.get('durocker-cl-tm') || 'null'); } catch (e) { return null; } };
  /* код стола для матча турнира — одинаковый у обоих игроков */
  function tableCode(id) {
    const CH = typeof CODE_CH === 'string' ? CODE_CH : 'abcdefghjkmnpqrstuvwxyz23456789';
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    let s = '';
    for (let i = 0; i < 4; i++) { s += CH[h % CH.length]; h = (Math.floor(h / CH.length) ^ Math.imul(h, 2654435761)) >>> 0; }
    return s;
  }
  /* сесть за стол с заданным кодом: hostTable берёт код из randCode() — подставляем нужные «случайные» числа на один вызов */
  function hostWithCode(code) {
    const CH = typeof CODE_CH === 'string' ? CODE_CH : 'abcdefghjkmnpqrstuvwxyz23456789';
    const seq = code.split('').map(c => (CH.indexOf(c) + 0.5) / CH.length), orig = Math.random;
    Math.random = () => (seq.length ? seq.shift() : orig());
    try { hostTable(); } finally { Math.random = orig; }
  }
  function playMatch(st, m) {
    const id = 't_' + st.code + '_' + m.round + '_' + m.n, table = tableCode(id);
    ss.set('durocker-cl-tm', JSON.stringify({ code: st.code, round: m.round, n: m.n, table }));
    try { store('durocker-bo-net', '3'); } catch (e) {}
    try { closeSheets(); } catch (e) {}
    const host = m.a < m.b ? m.a === pid() : m.b === pid();
    const L = $('lobby'); if (L) L.hidden = false;
    if (host) hostWithCode(table);
    else { try { renderLobby(); } catch (e) {} joinTable(table); }
    toast(host ? 'Ты хозяин стола — ждём соперника' : 'Подключаемся к сопернику…', 3000);
  }

  let openNow = false, cur = null, msg = '', pollT = 0;
  function css() {
    if (document.getElementById('clcss')) return;
    const s = document.createElement('style');
    s.id = 'clcss';
    s.textContent = `
#pageIn .tlist{display:flex;flex-direction:column;gap:6px}
#pageIn .trow{display:flex;justify-content:space-between;align-items:center;gap:8px;background:rgba(0,0,0,.28);border-radius:8px;padding:9px 12px;font-weight:700;border:none;color:inherit;font-size:14px;text-align:left}
#pageIn .tnew{display:grid;grid-template-columns:1fr auto auto;gap:6px}
#pageIn .tnew input,#pageIn .tjoin input{min-width:0;background:rgba(0,0,0,.35);border:1px solid var(--line,rgba(255,255,255,.2));border-radius:8px;color:inherit;padding:9px 10px;font-size:15px}
#pageIn .tjoin{display:grid;grid-template-columns:1fr auto;gap:6px}
#pageIn .tb{border:none;border-radius:8px;padding:9px 12px;font-weight:800;font-size:14px;background:var(--gold,#eab54b);color:#3a2306}
#pageIn .tb.g{background:var(--green,#2e9d5b);color:#fff}#pageIn .tb.s{background:rgba(255,255,255,.12);color:inherit}
#pageIn .tb[disabled]{opacity:.45}
#pageIn .tbr{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px}
#pageIn .tcol{display:flex;flex-direction:column;justify-content:space-around;gap:8px;min-width:150px}
#pageIn .tcol h4{margin:0;font-size:12px;opacity:.7;text-transform:uppercase;letter-spacing:.06em}
#pageIn .tm{background:rgba(0,0,0,.3);border-radius:8px;padding:6px 8px;font-size:13px;border:1px solid transparent}
#pageIn .tm.me{border-color:var(--gold,#eab54b)}
#pageIn .tm div{display:flex;justify-content:space-between;gap:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pageIn .tm .w{color:var(--gold,#eab54b);font-weight:800}
#pageIn .tnote{font-size:13px;opacity:.8;text-align:center;margin:0}
#pageIn .tchamp{text-align:center;font-family:var(--f-hard,monospace);color:var(--gold,#eab54b);font-size:15px;line-height:1.6}
`;
    document.head.appendChild(s);
  }
  const nameOf = (st, id) => { const p = st.players.find(x => x.pid === id); return p ? p.nick : '—'; };
  function render() {
    if (!openNow) return;
    const el = $('pageIn');
    if (!el) return;
    let body = '';
    if (!on()) body = `<p class="tnote">Турниры работают через облако ДурКер — оно пока не подключено${url ? ' или не отвечает' : ''}. Сыграть с другом можно в «Онлайн».</p>`;
    else if (cur) body = bracket(cur);
    else {
      const l = tours();
      body = `<div class="tnew"><input id="tName" maxlength="24" placeholder="Название турнира" autocomplete="off"><button type="button" class="tb" data-tsize="4">На 4</button><button type="button" class="tb" data-tsize="8">На 8</button></div>
        <div class="tjoin"><input id="tCode" maxlength="4" placeholder="КОД" autocomplete="off" aria-label="Код турнира"><button type="button" class="tb g" id="tJoin">Вступить</button></div>
        ${l.length ? `<h3>Мои турниры</h3><div class="tlist">${l.map(t => `<button type="button" class="trow" data-topen="${escH(t.code)}"><span>${escH(t.name)}</span><span>${t.status === 'done' ? '🏁' : t.status === 'running' ? '⚔️' : '⏳'} ${escH(t.code.toUpperCase())}</span></button>`).join('')}</div>` : ''}
        <p class="tnote">Турнир на выбывание: матчи до 2 побед, победитель получает титул «Чемпион турнира». В Telegram-группе турнир создаёт бот: /tournament 4</p>`;
    }
    el.innerHTML = `<div class="sheethead"><h2>Турнир 🏆</h2><button type="button" class="close" data-close>×</button></div>${msg ? `<p class="tnote">${escH(msg)}</p>` : ''}${body}`;
    el.querySelectorAll('[data-tsize]').forEach(b => { b.onclick = () => create(+b.dataset.tsize, $('tName').value); });
    const j = $('tJoin'); if (j) j.onclick = () => join($('tCode').value);
    el.querySelectorAll('[data-topen]').forEach(b => { b.onclick = () => view(b.dataset.topen); });
    const back = $('tBack'); if (back) back.onclick = () => { cur = null; msg = ''; render(); };
    const sh = $('tShare'); if (sh) sh.onclick = () => share(cur);
    const pl = $('tPlay'); if (pl) pl.onclick = () => { const m = myMatch(cur); if (m) playMatch(cur, m); };
  }
  function myMatch(st) {
    const id = pid();
    return st && st.status === 'running' && st.matches.find(m => m.status === 'pending' && (m.a === id || m.b === id) && !(m.a === id ? m.ar : m.br));
  }
  function bracket(st) {
    const id = pid(), rounds = Math.log2(st.size), cols = [];
    for (let r = 1; r <= rounds; r++) {
      const ms = st.matches.filter(m => m.round === r).sort((a, b) => a.n - b.n), need = st.size / Math.pow(2, r);
      const cells = [];
      for (let i = 0; i < need; i++) {
        const m = ms[i];
        if (!m) { cells.push('<div class="tm"><div>—</div><div>—</div></div>'); continue; }
        const line = p => `<div class="${m.winner === p ? 'w' : ''}"><span>${escH(nameOf(st, p))}${p === id ? ' (ты)' : ''}</span><span>${m.winner === p ? '✓' : ''}</span></div>`;
        cells.push(`<div class="tm${m.a === id || m.b === id ? ' me' : ''}">${line(m.a)}${line(m.b)}</div>`);
      }
      cols.push(`<div class="tcol"><h4>${r === rounds ? 'Финал' : r === rounds - 1 && rounds > 1 ? 'Полуфинал' : 'Раунд ' + r}</h4>${cells.join('')}</div>`);
    }
    const mine = myMatch(st), waiting = st.status === 'open';
    const wait = waiting ? `<p class="tnote">Ждём игроков: ${st.players.length} из ${st.size}. ${st.players.map(p => escH(p.nick)).join(', ')}</p>` : '';
    const champ = st.status === 'done' ? `<div class="tchamp">👑 Чемпион: ${escH(nameOf(st, st.winner))}</div>` : '';
    const mineM = st.matches.find(m => m.status === 'pending' && (m.a === id || m.b === id));
    const pend = mineM && !mine ? '<p class="tnote">Ждём, пока соперник подтвердит итог матча.</p>' : '';
    return `<h3>${escH(st.name)} · ${escH(st.code.toUpperCase())}</h3>${wait}${champ}
      ${st.matches.length ? `<div class="tbr">${cols.join('')}</div>` : ''}
      ${mine ? `<button type="button" class="tb g" id="tPlay" style="width:100%">⚔️ Играть мой матч — против ${escH(nameOf(st, mine.a === id ? mine.b : mine.a))}</button>` : ''}${pend}
      <div class="tjoin"><button type="button" class="tb" id="tShare">Позвать в турнир</button><button type="button" class="tb s" id="tBack">Назад</button></div>`;
  }
  function inviteURL(code) {
    if (typeof TG_LINK !== 'undefined' && TG_LINK) return TG_LINK + '?startapp=tj_' + code;
    const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('tj', code); return u.toString();
  }
  function share(st) {
    const link = inviteURL(st.code), text = `Го в турнир ДурКер «${st.name}»! Код ${st.code.toUpperCase()}`;
    const tga = typeof TGA !== 'undefined' && TGA;
    if (tga && tga.openTelegramLink) { tga.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text)); return; }
    if (navigator.share) { navigator.share({ title: 'ДурКер', text, url: link }).catch(() => {}); return; }
    if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + link).then(() => { msg = 'Ссылка скопирована'; render(); }, () => {});
  }
  async function create(size, name) {
    msg = 'Создаём турнир…'; render();
    const r = await call('t_create', { size, name: String(name || '').trim().slice(0, 24) });
    msg = r && r.ok ? '' : 'Не получилось создать турнир — попробуй ещё раз.';
    if (r && r.state) saveTour(r.state);
    render();
  }
  async function join(code) {
    code = String(code || '').trim().toLowerCase();
    if (!/^[a-z0-9]{4}$/.test(code)) { msg = 'Код турнира — 4 символа'; render(); return; }
    msg = 'Вступаем…'; render();
    const r = await call('t_join', { code });
    const why = { full: 'В турнире уже нет мест', started: 'Турнир уже начался', 'no tournament': 'Такого турнира нет' };
    msg = r && r.ok ? '' : (r && why[r.error]) || 'Не получилось вступить — попробуй ещё раз.';
    if (r && r.state) saveTour(r.state);
    render();
  }
  async function view(code) {
    msg = 'Загружаем…'; render();
    const r = await req('GET', null, { a: 't_state', code });
    msg = r && r.state ? '' : 'Турнир не найден';
    if (r && r.state) saveTour(r.state);
    render();
  }
  function open(joinCode) {
    css(); openNow = true; msg = '';
    if (typeof sheet === 'function') sheet('page', ''); else { const p = $('page'); if (p) p.hidden = false; }
    render();
    if (joinCode) join(joinCode);
    clearInterval(pollT);
    pollT = setInterval(() => {
      const p = $('page');
      if (!p || p.hidden || !openNow) { openNow = false; clearInterval(pollT); return; }
      if (cur && cur.status !== 'done' && on()) req('GET', null, { a: 't_state', code: cur.code }).then(r => { if (r && r.state && openNow) { saveTour(r.state); render(); } });
    }, 8000);
  }

  /* ---------- встраивание ---------- */
  function hook() {
    if (typeof openMenu === 'function') {
      const _om = openMenu;
      openMenu = function () {
        const r = _om.apply(this, arguments);
        try {
          const g = document.querySelector('#menuIn .menugrid');
          if (g && !g.querySelector('[data-go="tourney"]')) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'mi'; b.dataset.go = 'tourney';
            b.innerHTML = `<b>Турнир 🏆</b><small>${on() ? 'Сетка на 4 или 8, матчи до 2 побед' : 'Скоро — через облако'}</small>`;
            const after = g.querySelector('[data-go="leaders"]') || g.querySelector('[data-go="online"]');
            if (after && after.nextSibling) g.insertBefore(b, after.nextSibling); else g.appendChild(b);
          }
        } catch (e) {}
        return r;
      };
    }
    if (typeof menuGo === 'function') {
      const _mg = menuGo;
      menuGo = function (k) {
        if (k === 'tourney') { try { closeSheets(); } catch (e) {} open(); return; }
        return _mg.apply(this, arguments);
      };
    }
    if (typeof onGameOver === 'function') {
      const _go = onGameOver;
      onGameOver = function () { const r = _go.apply(this, arguments); try { reportGame(); } catch (e) {} return r; };
    }
    if (typeof showOver === 'function') {
      const _so = showOver;
      showOver = function () { const r = _so.apply(this, arguments); try { reportMatch(); } catch (e) {} return r; };
    }
    /* вход в турнир по ссылке: ?tj=код или startapp=tj_код */
    addEventListener('load', () => setTimeout(() => {
      const sp = typeof TGA !== 'undefined' && TGA && TGA.initDataUnsafe && TGA.initDataUnsafe.start_param;
      const c = (sp && /^tj_[a-z0-9]{4}$/.test(sp) ? sp.slice(3) : null) || new URLSearchParams(location.search).get('tj');
      if (c && /^[a-z0-9]{4}$/.test(c)) { try { closeSheets(); } catch (e) {} open(c); }
    }, 2500));
  }
  hook();
  return {
    on, board, call, ensure, pid, me: () => me, lastBoard: () => lastBoard, open, view, tableCode,
    setUrl(u) { url = String(u || ''); down = 0; },
    _flush: flush, _reportGame: reportGame, _reportMatch: reportMatch, _hostWithCode: hostWithCode,
  };
})();
