/* Дурокер — таблица лидеров.
   Свой счёт копится локально, а для общей таблицы каждый игрок держит одно «закреплённое» (retained) сообщение
   на публичном MQTT-брокере: durocker/lb1/p/<id>. Таблица — это все такие сообщения, собранные за пару секунд.
   Своего сервера нет; в сборке для Claude (без mqtt) показываем только свою статистику. */
'use strict';

const LB = (() => {
  const ROOT = 'durocker/lb1/p/';
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const DAY = 86400000;
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const escH = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function pid() {
    let v = rd('durocker-pid');
    if (!v || !/^[a-z0-9]{8,16}$/.test(v)) { v = Math.random().toString(36).slice(2, 12).padEnd(10, '0'); wr('durocker-pid', v); }
    return v;
  }
  function local() {
    let d = null;
    try { d = JSON.parse(rd('durocker-lb')); } catch (e) {}
    return Object.assign({ r: 0, w: 0, g: 0, o: 0 }, d || {});
  }
  const saveLocal = d => wr('durocker-lb', JSON.stringify(d));
  const nick = () => ((typeof myNick === 'function' ? myNick() : rd('durocker-nick')) || 'Игрок').slice(0, 16);
  const pr = () => { try { return typeof prog === 'function' ? prog() : {}; } catch (e) { return {}; } };
  const today = () => (typeof todayKey === 'function' ? todayKey() : new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10));

  /* сколько очков за победу над этим соперником */
  function worth() {
    if (typeof NET !== 'undefined' && NET) return { pts: 5, kind: 'online' };
    if (typeof MODE !== 'undefined' && MODE && MODE.kind === 'daily') return { pts: 3, kind: 'daily' };
    let b = null;
    try { b = currentBot(); } catch (e) {}
    if (!b) return { pts: 1, kind: 'bot' };
    if (b.boss === 'sharper') return { pts: 8, kind: 'bot' };
    if (b.boss) return { pts: 5, kind: 'bot' };
    return { pts: b.ai === 'sharper' ? 4 : b.ai === 'valera' ? 2 : 1, kind: 'bot' };
  }
  function record(won) {
    const d = local(), w = worth();
    d.g++;
    if (won) { d.w++; d.r += w.pts; if (w.kind === 'online') d.o++; }
    saveLocal(d);
    if (won) setTimeout(() => { try { toast(`🏆 +${w.pts} ${w.pts === 1 ? 'очко' : w.pts < 5 ? 'очка' : 'очков'} в таблицу лидеров`, 2600); } catch (e) {} }, 2200);
    publishSoon();
  }

  /* моя запись для таблицы */
  function mine() {
    const d = local(), p = pr(), k = today(), dd = p.daily && p.daily[k];
    const e = { n: nick(), r: d.r, w: d.w, g: d.g, o: d.o, c: p.career | 0, cd: !!p.careerDone, v: typeof VERSION === 'string' ? VERSION : '', t: Date.now() };
    if (dd) e.d = { k, res: dd.won ? 'win' : 'lose', pen: Math.max(0, Math.min(60, dd.penalty | 0)) };
    return e;
  }

  /* ---------- связь ---------- */
  let cl = null, connecting = null, idleT = 0;
  const has = () => typeof window.mqtt === 'object' || typeof window.mqtt === 'function';
  /* облако (js/cloud.js): если подключено — очки и таблицу считает сервер */
  const cloud = () => typeof CLOUD !== 'undefined' && CLOUD.on();
  const online = () => has() || cloud();
  /* свои цифры: из облака, если сервер о нас знает, иначе локальные */
  function stats() {
    const d = local(), m = cloud() && CLOUD.me();
    return m ? { r: m.r, w: m.w, g: m.g, o: m.o } : d;
  }
  function fromBoard(b) {
    const daily = new Map((b.daily || []).map(x => [x.id, x]));
    return (b.players || []).map(p => {
      const e = { id: p.id, n: p.n, r: p.r, w: p.w, g: p.g, o: p.o, c: p.c, cd: !!p.cd, t: p.t, ttl: p.tc || p.ttl || '' };
      const d = daily.get(p.id);
      if (d) e.d = { k: b.day, res: d.res, pen: d.pen };
      return e;
    });
  }
  function conn() {
    if (cl) return Promise.resolve(cl);
    if (!has()) return Promise.resolve(null);
    if (connecting) return connecting;
    connecting = new Promise(res => {
      let i = 0;
      const next = () => {
        if (i >= BROKERS.length) { connecting = null; res(null); return; }
        const url = BROKERS[i++];
        let c, ok = false;
        try { c = mqtt.connect(url, { clientId: 'dklb_' + pid() + '_' + Math.random().toString(36).slice(2, 6), connectTimeout: 6000, reconnectPeriod: 0, clean: true, keepalive: 30 }); }
        catch (e) { next(); return; }
        const t = setTimeout(() => { if (!ok) { try { c.end(true); } catch (e) {} next(); } }, 7000);
        c.on('error', () => {});
        c.once('connect', () => { ok = true; clearTimeout(t); cl = c; connecting = null; res(c); });
      };
      next();
    });
    return connecting;
  }
  /* соединение закрываем, когда оно больше не нужно */
  function idle(ms) {
    clearTimeout(idleT);
    idleT = setTimeout(() => { if (cl && !openNow) { try { cl.end(true); } catch (e) {} cl = null; } }, ms || 4000);
  }
  async function publish() {
    const c = await conn();
    if (!c) return false;
    try { c.publish(ROOT + pid(), JSON.stringify(mine()), { qos: 1, retain: true }); } catch (e) { return false; }
    idle(3000);
    return true;
  }
  let pubT = 0, lastPub = 0;
  function publishSoon() {
    clearTimeout(pubT);
    const wait = Math.max(1500, 8000 - (Date.now() - lastPub));
    pubT = setTimeout(() => { lastPub = Date.now(); publish(); }, wait);
  }

  /* проверка чужой записи: всё, что не похоже на нашу запись, выбрасываем */
  const int = (x, max) => Number.isInteger(x) && x >= 0 && x <= max;
  function clean(id, e) {
    if (!/^[a-z0-9]{8,16}$/.test(id) || !e || typeof e !== 'object') return null;
    if (typeof e.n !== 'string' || !int(e.r, 1e6) || !int(e.w, 1e6) || !int(e.g, 1e6) || e.w > e.g) return null;
    if (typeof e.t !== 'number' || e.t < Date.now() - 60 * DAY || e.t > Date.now() + DAY) return null;
    const n = e.n.replace(/[\u0000-\u001f​-‏‪-‮]/g, '').trim().slice(0, 16) || 'Игрок';
    const out = { id, n, r: e.r, w: e.w, g: e.g, o: int(e.o, 1e6) ? e.o : 0, c: int(e.c, 50) ? e.c : 0, cd: e.cd === true, t: e.t };
    if (e.d && typeof e.d === 'object' && /^\d{4}-\d\d-\d\d$/.test(e.d.k) && (e.d.res === 'win' || e.d.res === 'lose') && int(e.d.pen, 60)) out.d = { k: e.d.k, res: e.d.res, pen: e.d.pen };
    return out;
  }
  async function fetchAll(ms) {
    const c = await conn();
    if (!c) return null;
    const got = new Map();
    const onMsg = (topic, payload) => {
      if (!topic.startsWith(ROOT) || got.size >= 300) return;
      let e; try { e = JSON.parse(payload.toString()); } catch (x) { return; }
      const r = clean(topic.slice(ROOT.length), e);
      if (r) got.set(r.id, r);
    };
    c.on('message', onMsg);
    try { c.subscribe(ROOT + '+', { qos: 0 }); } catch (e) {}
    await new Promise(r => setTimeout(r, ms || 2500));
    try { c.unsubscribe(ROOT + '+'); } catch (e) {}
    if (c.removeListener) c.removeListener('message', onMsg);
    return [...got.values()];
  }

  /* ---------- окно ---------- */
  let openNow = false, tab = 'rate', rows = null, status = '';
  function css() {
    if (document.getElementById('lbcss')) return;
    const s = document.createElement('style');
    s.id = 'lbcss';
    s.textContent = `
.lbtabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.lbtabs button{background:rgba(255,255,255,.06);border:1px solid var(--line,rgba(255,255,255,.15));border-radius:8px;padding:8px 4px;font-weight:800;font-size:13px;color:inherit;min-width:0}
.lbtabs button.on{background:var(--gold,#eab54b);color:#3a2306;border-color:transparent}
.lbme{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center}
.lbme div{background:rgba(0,0,0,.3);border-radius:8px;padding:6px 2px;min-width:0}
.lbme b{display:block;font-family:var(--f-hard,monospace);font-size:13px;color:var(--gold,#eab54b);line-height:1.6}
.lbme span{font-size:11px;opacity:.75}
.lblist{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
.lbrow{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:8px;background:rgba(0,0,0,.28);border-radius:8px;padding:7px 10px;font-size:14px}
.lbrow .pl{font-family:var(--f-hard,monospace);font-size:11px;color:var(--gold,#eab54b);text-align:center}
.lbrow .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.lbrow .nm small{display:block;font-weight:500;font-size:11px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lbrow .sc{font-family:var(--f-hard,monospace);font-size:12px;text-align:right;white-space:nowrap}
.lbrow.me{background:rgba(234,181,75,.22);outline:2px solid var(--gold,#eab54b)}
.lbrow.top1 .pl{font-size:16px}.lbrow.top2 .pl,.lbrow.top3 .pl{font-size:14px}
.lbsep{text-align:center;opacity:.5;font-size:12px;margin:2px 0}
.lbstatus{font-size:13px;opacity:.8;text-align:center}
.lbname{display:flex;gap:6px;align-items:center}
.lbname input{flex:1;min-width:0;background:rgba(0,0,0,.35);border:1px solid var(--line,rgba(255,255,255,.2));border-radius:8px;color:inherit;padding:8px 10px;font-size:15px}
.lbname button,.lbshare{border:none;border-radius:8px;padding:9px 12px;font-weight:800;font-size:14px;background:var(--gold,#eab54b);color:#3a2306}
.lbshare{width:100%;background:var(--green,#2e9d5b);color:#fff;padding:11px}
`;
    document.head.appendChild(s);
  }
  const titleCareer = e => {
    if (e.cd) return 'Прошёл карьеру 🏆';
    try { const st = CAREER_OPS[Math.min(e.c, CAREER_OPS.length - 1)]; return `Район «${CAREER[st.district].name}» · этап ${e.c + 1}`; } catch (x) { return `Этап ${e.c + 1}`; }
  };
  function lists() {
    const me = mine(), s = stats(), my = { ...me, r: s.r, w: s.w, g: s.g, o: s.o, id: pid() };
    const fromCloud = rows && rows.find(r => r.id === my.id);
    if (fromCloud && fromCloud.d && !my.d) my.d = fromCloud.d;
    if (fromCloud && fromCloud.ttl) my.ttl = fromCloud.ttl;
    const all = new Map((rows || []).map(r => [r.id, r]));
    all.set(my.id, my);
    const arr = [...all.values()];
    const k = today();
    return {
      me: my,
      rate: arr.filter(e => e.r > 0 || e.id === my.id).sort((a, b) => b.r - a.r || b.w - a.w || a.g - b.g),
      daily: arr.filter(e => e.d && e.d.k === k).sort((a, b) => (a.d.res === b.d.res ? (a.d.res === 'win' ? b.d.pen - a.d.pen : a.d.pen - b.d.pen) : a.d.res === 'win' ? -1 : 1)),
      career: arr.filter(e => e.c > 0 || e.cd || e.id === my.id).sort((a, b) => (b.cd - a.cd) || b.c - a.c || b.r - a.r),
    };
  }
  function rowHTML(e, i, myId, kind) {
    const medal = ['🥇', '🥈', '🥉'][i] || String(i + 1);
    let sub = '', sc = '';
    if (kind === 'rate') { sub = `${e.ttl ? '👑 ' + e.ttl + ' · ' : ''}побед ${e.w} из ${e.g}${e.o ? ` · онлайн ${e.o}` : ''}`; sc = `${e.r}`; }
    else if (kind === 'daily') { sub = e.d.res === 'win' ? `выиграл · сопернику +${e.d.pen}` : `проиграл · себе +${e.d.pen}`; sc = e.d.res === 'win' ? '✓' : '✗'; }
    else { sub = titleCareer(e); sc = e.cd ? '🏆' : `${e.c + 1}`; }
    return `<li class="lbrow${e.id === myId ? ' me' : ''}${i < 3 ? ' top' + (i + 1) : ''}"><span class="pl">${medal}</span><span class="nm">${escH(e.n)}${e.id === myId ? ' (ты)' : ''}<small>${escH(sub)}</small></span><span class="sc">${sc}</span></li>`;
  }
  function placeOf(list, id) { const i = list.findIndex(e => e.id === id); return i < 0 ? 0 : i + 1; }
  function render() {
    if (!openNow) return;
    const el = document.getElementById('pageIn');
    if (!el) return;
    const L = lists(), d = stats(), list = L[tab], myId = L.me.id;
    const top = list.slice(0, 50), place = placeOf(list, myId);
    const empty = { rate: 'Пока никого — выиграй партию и будь первым.', daily: 'Сегодняшнюю раздачу ещё никто не сыграл.', career: 'Пока никто не продвинулся по карьере.' }[tab];
    let body = top.length ? `<ol class="lblist">${top.map((e, i) => rowHTML(e, i, myId, tab)).join('')}</ol>` : `<p class="lbstatus">${empty}</p>`;
    if (place > 50) body += `<div class="lbsep">…</div><ol class="lblist">${rowHTML(list[place - 1], place - 1, myId, tab)}</ol>`;
    const net = online();
    el.innerHTML = `<div class="sheethead"><h2>Лидеры 🏆</h2><button type="button" class="close" data-close>×</button></div>
      <div class="lbme"><div><b>${place || '—'}</b><span>место</span></div><div><b>${d.r}</b><span>очков</span></div><div><b>${d.w}</b><span>побед</span></div><div><b>${d.g}</b><span>партий</span></div></div>
      <div class="lbname"><input id="lbNick" maxlength="16" value="${escH(nick())}" aria-label="Твоё имя в таблице" autocomplete="off"><button type="button" id="lbNickOk">Сохранить</button></div>
      <div class="lbtabs" role="tablist">
        <button type="button" data-lbtab="rate" class="${tab === 'rate' ? 'on' : ''}">Рейтинг</button>
        <button type="button" data-lbtab="daily" class="${tab === 'daily' ? 'on' : ''}">Дейли</button>
        <button type="button" data-lbtab="career" class="${tab === 'career' ? 'on' : ''}">Карьера</button></div>
      ${net ? (status ? `<p class="lbstatus">${escH(status)}</p>` : cloud() ? '<p class="lbstatus">✅ Очки считает сервер ДурКер — накрутить нельзя.</p>' : '') : '<p class="lbstatus">Общая таблица доступна на сайте и в Telegram (@durocker_bot). Здесь — только твоя статистика.</p>'}
      ${body}
      ${net && place ? `<button type="button" class="lbshare" id="lbShare">Поделиться местом</button>` : ''}
      <p class="lbstatus">Очки за победу: Студент 1 · Валера 2 · Шулер 4 · босс 5 · финальный Шулер 8 · дейли 3 · онлайн 5.</p>`;
    el.querySelectorAll('[data-lbtab]').forEach(b => { b.onclick = () => { tab = b.dataset.lbtab; render(); }; });
    const ok = () => {
      const v = (document.getElementById('lbNick').value.trim() || 'Игрок').slice(0, 16);
      wr('durocker-nick', v);
      lastPub = 0; publish().then(() => render()); render();
      if (cloud()) CLOUD.call('profile').then(() => render());
    };
    document.getElementById('lbNickOk').onclick = ok;
    document.getElementById('lbNick').onkeydown = e => { if (e.key === 'Enter') ok(); };
    const sh = document.getElementById('lbShare');
    if (sh) sh.onclick = () => share(place, tab, sh);
  }
  function share(place, kind, btn) {
    const what = kind === 'daily' ? `в сегодняшней раздаче` : kind === 'career' ? 'в карьере' : `в рейтинге (${local().r} очков)`;
    const text = `Я на ${place} месте ${what} в Дурокере! Сможешь обогнать?`;
    const url = 'https://t.me/durocker_bot';
    const tga = typeof TGA !== 'undefined' && TGA;
    if (tga && tga.openTelegramLink) { tga.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text)); return; }
    if (navigator.share) { navigator.share({ title: 'Дурокер', text, url }).catch(() => {}); return; }
    const t = text + ' ' + url;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { btn.textContent = 'Скопировано'; }, () => {});
  }
  async function open() {
    css();
    openNow = true; status = online() ? 'Загружаем таблицу…' : '';
    if (typeof sheet === 'function') sheet('page', ''); else { const p = document.getElementById('page'); if (p) p.hidden = false; }
    render();
    if (cloud()) {
      await CLOUD.ensure();
      const b = await CLOUD.board();
      if (!openNow) return;
      if (b) { rows = fromBoard(b); status = ''; render(); return; }
      /* облако не ответило — дальше как раньше, через MQTT */
    }
    if (!has()) { status = ''; render(); return; }
    await publish();
    const got = await fetchAll(2500);
    if (!openNow) return;
    if (got) { rows = got; status = ''; } else status = 'Не удалось связаться с сервером таблицы — показываю только тебя.';
    render();
    idle(1500);
  }
  /* окно закрыли — отпускаем соединение */
  function watchClose() {
    const p = document.getElementById('page');
    if (!p || !window.MutationObserver) return;
    new MutationObserver(() => { if (p.hidden && openNow) { openNow = false; idle(1000); } }).observe(p, { attributes: true, attributeFilter: ['hidden'] });
  }

  /* ---------- встраивание в игру без правки чужих файлов ---------- */
  function hook() {
    if (typeof openMenu === 'function') {
      const _om = openMenu;
      openMenu = function () {
        const r = _om.apply(this, arguments);
        try {
          const g = document.querySelector('#menuIn .menugrid');
          if (g && !g.querySelector('[data-go="leaders"]')) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'mi'; b.dataset.go = 'leaders';
            const d = local();
            b.innerHTML = `<b>Лидеры 🏆</b><small>${d.r ? `У тебя ${d.r} очков` : 'Рейтинг, дейли, карьера'}</small>`;
            const after = g.querySelector('[data-go="online"]');
            if (after && after.nextSibling) g.insertBefore(b, after.nextSibling); else g.appendChild(b);
          }
        } catch (e) {}
        return r;
      };
    }
    if (typeof menuGo === 'function') {
      const _mg = menuGo;
      menuGo = function (k) {
        if (k === 'leaders') { try { closeSheets(); } catch (e) {} open(); return; }
        return _mg.apply(this, arguments);
      };
    }
    /* конец партии у хозяина и в игре с ботом */
    if (typeof onGameOver === 'function') {
      const _go = onGameOver;
      onGameOver = function () {
        const r = _go.apply(this, arguments);
        try { if (G && G.over && !(typeof NET !== 'undefined' && NET && NET.role === 'guest')) record(G.over === 'p'); } catch (e) {}
        return r;
      };
    }
    /* у гостя движок не крутится — ловим конец партии по экрану итогов, один раз на партию */
    if (typeof showOver === 'function') {
      const _so = showOver;
      showOver = function () {
        const r = _so.apply(this, arguments);
        try {
          if (typeof NET !== 'undefined' && NET && NET.role === 'guest' && G && G.over) {
            const key = NET.code + '|' + (SERIES && SERIES.games) + '|' + G.over;
            let seen = null; try { seen = sessionStorage.getItem('durocker-lb-seen'); } catch (e) {}
            if (seen !== key) { try { sessionStorage.setItem('durocker-lb-seen', key); } catch (e) {} record(G.over === 'p'); }
          }
        } catch (e) {}
        return r;
      };
    }
    watchClose();
  }
  hook();
  return { open, publish, local, mine, record, _clean: clean, _fetch: fetchAll };
})();
