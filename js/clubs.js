/* ДурКер — клубы: команда друзей с общим рейтингом недели.
   Без сервера: каждый участник держит на публичном MQTT-брокере одно закреплённое (retained) сообщение
   durocker/club1/<код>/m/<id> со своим ником и очками недели. Таблица клуба — это все такие сообщения.
   Глобальной таблицы клубов нет: турнир недели считается среди клубов, которые ты видишь (свой, открытые по коду,
   приглашённые). Очки недели берутся из таблицы лидеров (LB.weekPoints), по москов­скому времени, смена в понедельник. */
'use strict';
(() => {
  if (typeof BUS === 'undefined') return;
  const ROOT = 'durocker/club1/';
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const DAY = 86400000, KEY = 'durocker-clubs';
  const EMOJI = ['🃏', '♠️', '♥️', '♦️', '♣️', '👑', '🔥', '⚡', '🐺', '🦊', '🐻', '🦅', '🐉', '🚂', '🎲', '💎', '🌙', '⭐', '🧿', '🍀', '🎯', '🛡️', '🐍', '🦈'];
  const COLORS = ['#d9362f', '#eab54b', '#2e9d5b', '#4f8fd8', '#9a7bd9', '#e57aa8', '#00a6a6', '#f08a3c'];
  const CODE_CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const CODE_RE = /^[A-Z2-9]{6}$/;
  const $c = id => document.getElementById(id);
  const E = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const say = (t, ms) => { try { toast(t, ms); } catch (e) {} };
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const has = () => typeof window.mqtt === 'object' || typeof window.mqtt === 'function';
  const lb = () => (typeof LB !== 'undefined' ? LB : null);
  const pid = () => { const l = lb(); return l && l.pid ? l.pid() : (rd('durocker-pid') || 'anon0000'); };
  const nick = () => { const l = lb(); return l && l.nick ? l.nick() : ((typeof myNick === 'function' ? myNick() : 'Игрок') || 'Игрок').slice(0, 16); };
  const weekNow = () => { const l = lb(); return l && l.weekKey ? l.weekKey() : 0; };
  const myWeekPts = () => { const l = lb(); return l && l.weekPoints ? l.weekPoints() : 0; };
  const myTotal = () => { const l = lb(); try { return l ? l.local().r | 0 : 0; } catch (e) { return 0; } };
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
  const int = (x, max) => Number.isInteger(x) && x >= 0 && x <= max;
  const newCode = () => { let s = ''; try { const a = new Uint8Array(6); crypto.getRandomValues(a); a.forEach(x => { s += CODE_CH[x % CODE_CH.length]; }); } catch (e) {} while (s.length < 6) s += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; return s; };

  /* ---------- локальное состояние ---------- */
  let st = (() => {
    try { const d = JSON.parse(rd(KEY) || '{}'); return { mine: CODE_RE.test(d.mine || '') ? d.mine : null, club: d.club || null, seen: Array.isArray(d.seen) ? d.seen.filter(x => x && CODE_RE.test(x.code)).slice(0, 12) : [], snap: d.snap || null, cups: d.cups | 0, week: d.week | 0 }; }
    catch (e) { return { mine: null, club: null, seen: [], snap: null, cups: 0, week: 0 }; }
  })();
  const save = () => wr(KEY, JSON.stringify(st));
  /* club: {nm, em, co, ct} — то, что клуб о себе сообщает */
  const mkClub = (nm, em, co) => ({ nm: clean(nm, 16) || 'Клуб', em: EMOJI.includes(em) ? em : EMOJI[0], co: int(co, 7) ? co : 0, ct: Date.now() });

  /* ---------- проверка чужого сообщения ---------- */
  function cleanMember(id, e) {
    if (!/^[a-z0-9]{8,16}$/.test(id) || !e || typeof e !== 'object') return null;
    const now = Date.now();
    if (typeof e.n !== 'string' || typeof e.cn !== 'string' || !EMOJI.includes(e.em) || !int(e.co, 7)) return null;
    if (!int(e.w, 3000) || !int(e.wk, 100000) || !int(e.r, 1e6)) return null;
    if (typeof e.t !== 'number' || e.t < now - 60 * DAY || e.t > now + DAY) return null;
    if (typeof e.ct !== 'number' || e.ct < 1.6e12 || e.ct > now + DAY) return null;
    return { id, n: clean(e.n, 16) || 'Игрок', cn: clean(e.cn, 16) || 'Клуб', em: e.em, co: e.co, ct: e.ct, w: e.w, wk: e.wk, r: e.r, t: e.t };
  }
  /* счёт клуба: сумма лучших 5 участников недели; название и эмблема — от самого раннего участника */
  function scoreClub(code, rows) {
    const wk = weekNow();
    const by = new Map(rows.map(r => [r.id, r]));
    const mine = st.mine === code && st.club ? { id: pid(), n: nick(), cn: st.club.nm, em: st.club.em, co: st.club.co, ct: st.club.ct, w: myWeekPts(), wk, r: myTotal(), t: Date.now() } : null;
    if (mine) by.set(mine.id, mine);
    const all = [...by.values()];
    const members = all.map(r => ({ ...r, pts: r.wk === wk ? r.w : 0 })).sort((a, b) => b.pts - a.pts || b.r - a.r || (a.n < b.n ? -1 : 1));
    const top = members.slice(0, 5);
    const src = all.slice().sort((a, b) => a.ct - b.ct || (a.id < b.id ? -1 : 1))[0];
    return { code, nm: src ? src.cn : (st.club ? st.club.nm : 'Клуб'), em: src ? src.em : EMOJI[0], co: src ? src.co : 0, ct: src ? src.ct : 0, members, score: top.reduce((s, m) => s + m.pts, 0), n: members.length };
  }

  /* ---------- связь ---------- */
  let cl = null, connecting = null, idleT = 0, busy = 0;
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
        try { c = mqtt.connect(url, { clientId: 'dkcl_' + pid() + '_' + Math.random().toString(36).slice(2, 6), connectTimeout: 6000, reconnectPeriod: 0, clean: true, keepalive: 30 }); }
        catch (e) { next(); return; }
        const t = setTimeout(() => { if (!ok) { try { c.end(true); } catch (e) {} next(); } }, 7000);
        c.on('error', () => {});
        c.once('connect', () => { ok = true; clearTimeout(t); cl = c; connecting = null; res(c); });
      };
      next();
    });
    return connecting;
  }
  const idle = ms => { clearTimeout(idleT); idleT = setTimeout(() => { if (cl && !busy) { try { cl.end(true); } catch (e) {} cl = null; } }, ms || 4000); };
  async function publish(clear) {
    if (!st.mine || !st.club) return false;
    const c = await conn(); if (!c) return false;
    const topic = ROOT + st.mine + '/m/' + pid();
    try {
      if (clear) c.publish(topic, '', { qos: 1, retain: true });
      else c.publish(topic, JSON.stringify({ n: nick(), cn: st.club.nm, em: st.club.em, co: st.club.co, ct: st.club.ct, w: myWeekPts(), wk: weekNow(), r: myTotal(), t: Date.now() }), { qos: 1, retain: true });
    } catch (e) { return false; }
    idle(3000); return true;
  }
  let pubT = 0, lastPub = 0;
  function publishSoon() {
    if (!st.mine) return;
    clearTimeout(pubT);
    pubT = setTimeout(() => { lastPub = Date.now(); publish(); }, Math.max(1500, 8000 - (Date.now() - lastPub)));
  }
  /* собрать участников нескольких клубов: код → [строки] */
  async function fetchClubs(codes, ms) {
    const out = new Map(codes.map(c => [c, []]));
    const c = await conn(); if (!c) return null;
    busy++;
    const seen = new Map(), subs = codes.map(code => ROOT + code + '/m/+');
    const onMsg = (topic, payload) => {
      if (!topic.startsWith(ROOT)) return;
      const m = topic.slice(ROOT.length).split('/');
      if (m.length !== 3 || m[1] !== 'm' || !out.has(m[0])) return;
      const list = out.get(m[0]); if (list.length >= 60) return;
      let e; try { const s = payload.toString(); if (!s || s.length > 600) return; e = JSON.parse(s); } catch (x) { return; }
      const r = cleanMember(m[2], e); if (!r) return;
      const k = m[0] + '/' + r.id; if (seen.has(k)) return; seen.set(k, 1); list.push(r);
    };
    c.on('message', onMsg);
    subs.forEach(t => { try { c.subscribe(t, { qos: 0 }); } catch (e) {} });
    await new Promise(r => setTimeout(r, ms || 2500));
    subs.forEach(t => { try { c.unsubscribe(t); } catch (e) {} });
    if (c.removeListener) c.removeListener('message', onMsg);
    busy--; idle(1500);
    return out;
  }

  /* ---------- вход, создание, выход ---------- */
  function remember(sc) {
    if (!sc || !sc.code) return;
    st.seen = [{ code: sc.code, nm: sc.nm, em: sc.em, co: sc.co, t: Date.now() }, ...st.seen.filter(x => x.code !== sc.code)].slice(0, 12);
    save();
  }
  async function create(nm, em, co) {
    if (st.mine) return false;
    st.mine = newCode(); st.club = mkClub(nm, em, co); save();
    remember({ code: st.mine, nm: st.club.nm, em: st.club.em, co: st.club.co });
    await publish();
    return true;
  }
  async function join(code, silent) {
    code = String(code || '').toUpperCase().trim();
    if (!CODE_RE.test(code)) { if (!silent) say('Код клуба — 6 символов', 3000); return false; }
    if (st.mine === code) return true;
    if (st.mine) { say('Сначала выйди из своего клуба', 3000); return false; }
    if (!has()) { say('Клубы доступны на сайте и в Telegram', 3500); return false; }
    const got = await fetchClubs([code], 2500);
    const rows = got && got.get(code) || [];
    if (!rows.length) { say('Клуб с таким кодом не нашли — проверь код', 3500); return false; }
    if (rows.length >= 60) { say('В клубе уже много участников', 3500); return false; }
    const sc = scoreClub(code, rows);
    st.mine = code; st.club = { nm: sc.nm, em: sc.em, co: sc.co, ct: sc.ct }; save();
    remember(sc);
    await publish();
    say(t('{e} Ты в клубе «{n}»', { e: sc.em, n: sc.nm }), 3500);
    return true;
  }
  async function leave() {
    if (!st.mine) return;
    await publish(true);
    st.mine = null; st.club = null; save();
  }
  const inviteLink = code => {
    if (typeof TG_LINK === 'string' && TG_LINK && typeof TGA !== 'undefined' && TGA) return TG_LINK + '?startapp=c_' + code;
    try { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('club', code); return u.toString(); } catch (e) { return TG_LINK + '?startapp=c_' + code; }
  };
  function shareClub(btn) {
    if (!st.mine) return;
    const link = inviteLink(st.mine), text = t('Го в мой клуб «{n}» в ДурКере! Код {c}', { n: st.club.nm, c: st.mine });
    const tga = typeof TGA !== 'undefined' && TGA;
    if (tga && tga.openTelegramLink) { tga.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text)); return; }
    if (navigator.share) { navigator.share({ title: t('ДурКер'), text, url: link }).catch(() => {}); return; }
    if (typeof copyText === 'function') copyText(link, btn);
  }

  /* свой «confirm»: системные окна в Telegram и песочницах капризничают */
  function ask(text, okLabel, onYes, onNo) {
    const w = document.createElement('div'); w.className = 'chdw'; w.id = 'clAsk';
    w.innerHTML = `<div class="chdbl" role="dialog"><p>${E(text)}</p><div class="row"><button class="btn gold" type="button" id="clAskY">${E(okLabel)}</button><button class="btn grey" type="button" id="clAskN">Отмена</button></div></div>`;
    document.body.appendChild(w);
    $c('clAskY').onclick = () => { w.remove(); onYes(); };
    $c('clAskN').onclick = () => { w.remove(); if (onNo) onNo(); };
  }

  /* ---------- окно ---------- */
  function css() {
    if ($c('clubcss')) return;
    const s = document.createElement('style'); s.id = 'clubcss';
    s.textContent = `.clhero{display:flex;align-items:center;gap:12px;border:2px solid var(--cc,#eab54b);background:linear-gradient(135deg,color-mix(in srgb,var(--cc,#eab54b) 28%,#0b1511),#0b1511);border-radius:14px;padding:10px 12px}
.clhero .em{font-size:40px;line-height:1}.clhero b{display:block;font-size:18px}.clhero small{opacity:.8}
.clcode{font-family:var(--f-hard,monospace);letter-spacing:.18em;font-size:20px;color:#ffe9a6}
.clmem{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
.clmem li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;gap:8px;align-items:center;background:rgba(0,0,0,.28);border-radius:8px;padding:6px 10px;font-size:14px}
.clmem li.off{opacity:.55}.clmem li.me{outline:2px solid var(--gold,#eab54b);background:rgba(234,181,75,.18)}
.clmem .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}.clmem .pl{font-family:var(--f-hard,monospace);font-size:11px;text-align:center;color:var(--gold,#eab54b)}
.clmem .sc{font-family:var(--f-hard,monospace);font-size:12px}
.clemo,.clcol{display:flex;flex-wrap:wrap;gap:6px}.clemo button,.clcol button{font:inherit;width:40px;height:40px;border-radius:10px;border:2px solid var(--line,#2a4a3d);background:rgba(0,0,0,.35);cursor:pointer;color:inherit}
.clcol button{width:32px;height:32px;border-radius:50%}.clemo button.on,.clcol button.on{border-color:#ffe9a6;box-shadow:0 0 0 2px rgba(234,181,75,.5)}
.cltabs{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.cltabs button{background:rgba(255,255,255,.06);border:1px solid var(--line,rgba(255,255,255,.15));border-radius:8px;padding:8px 4px;font-weight:800;font-size:13px;color:inherit}.cltabs button.on{background:var(--gold,#eab54b);color:#3a2306;border-color:transparent}
.clrow{display:grid;grid-template-columns:30px 34px minmax(0,1fr) auto;gap:8px;align-items:center;background:rgba(0,0,0,.28);border-radius:8px;padding:7px 10px}
.clrow.me{outline:2px solid var(--gold,#eab54b)}.clrow .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
.cltxt{width:100%;box-sizing:border-box;background:rgba(0,0,0,.35);border:1px solid var(--line,rgba(255,255,255,.2));border-radius:8px;color:inherit;padding:9px 10px;font-size:15px}`;
    document.head.appendChild(s);
  }
  let openNow = false, tab = 'club', data = null, status = '', draft = { nm: '', em: EMOJI[0], co: 0 };
  const left = ms => { const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 3600e3); return d ? t('{d} д {h} ч', { d, h }) : t('{h} ч', { h }); };
  const weekEnd = () => { try { return WEEKLY && WEEKLY.weekEnds ? WEEKLY.weekEnds(weekNow()) : 0; } catch (e) { return 0; } };

  async function refresh() {
    if (!has()) { status = 'Клубы работают на сайте и в Telegram (@durocker_bot). Здесь — только предпросмотр.'; render(); return; }
    status = 'Загружаем…'; render();
    const codes = [...new Set([st.mine, ...st.seen.map(x => x.code)].filter(Boolean))].slice(0, 12);
    if (!codes.length) { status = ''; render(); return; }
    if (st.mine) { lastPub = 0; await publish(); }
    const got = await fetchClubs(codes, 2800);
    if (!openNow) return;
    if (!got) { status = 'Не удалось связаться с сервером — показываю то, что знаю.'; render(); return; }
    data = new Map(); codes.forEach(c => { const sc = scoreClub(c, got.get(c) || []); if (sc.n) { data.set(c, sc); if (c !== st.mine) remember(sc); } });
    /* итог прошлой недели: если мой клуб был первым в снимке, дарим кубок */
    const wk = weekNow();
    if (st.snap && st.snap.wk < wk && st.snap.first && st.snap.first === st.mine && st.week !== wk) { st.cups++; st.week = wk; save(); say('🏆 Твой клуб был первым на прошлой неделе — кубок!', 5000); }
    const ranked = [...data.values()].sort((a, b) => b.score - a.score || b.n - a.n);
    if (ranked.length) { st.snap = { wk, first: ranked[0].score > 0 ? ranked[0].code : null }; save(); }
    status = ''; render();
  }

  function renderNone() {
    const emo = EMOJI.map(e => `<button type="button" data-em="${e}" class="${e === draft.em ? 'on' : ''}" aria-label="Эмблема ${e}">${e}</button>`).join('');
    const col = COLORS.map((c, i) => `<button type="button" data-co="${i}" class="${i === draft.co ? 'on' : ''}" style="background:${c}" aria-label="Цвет ${i + 1}"></button>`).join('');
    const seen = st.seen.length ? `<div class="cbox"><b>Клубы, которые ты видишь</b><div class="small">Нажми, чтобы посмотреть таблицу.</div><div style="display:flex;flex-direction:column;gap:6px;margin-top:6px">${st.seen.map(x => `<button type="button" class="btn grey" data-peek="${x.code}">${E(x.em)} ${E(x.nm)} · ${x.code}</button>`).join('')}</div></div>` : '';
    return `<div class="cbox"><b>Свой клуб</b><div class="small">Команда друзей: сумма очков пятёрки лучших за неделю — рейтинг клуба.</div>
        <input class="cltxt" id="clName" maxlength="16" placeholder="Название клуба" value="${E(draft.nm)}" autocomplete="off" style="margin:8px 0">
        <div class="clemo" id="clEmo">${emo}</div><div class="clcol" id="clCol" style="margin:8px 0">${col}</div>
        <button type="button" class="btn blue" id="clCreate" style="width:100%">Создать клуб</button></div>
      <div class="cbox"><b>Вступить по коду</b>
        <div style="display:flex;gap:6px;margin-top:6px"><input class="cltxt" id="clCode" maxlength="6" placeholder="КОД" autocomplete="off" style="text-transform:uppercase;letter-spacing:.18em"><button type="button" class="btn orange" id="clJoin">Войти</button></div></div>${seen}`;
  }
  function renderIn() {
    const me = pid(), sc = data && data.get(st.mine) || scoreClub(st.mine, []);
    const color = COLORS[(st.club && st.club.co) || 0];
    const mem = sc.members.map((m, i) => `<li class="${m.id === me ? 'me' : ''}${i >= 5 ? ' off' : ''}"><span class="pl">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="nm">${E(t(m.n))}${m.id === me ? ' ' + t('(ты)') : ''}</span><span class="sc">${t('{n} оч.', { n: m.pts })}${i >= 5 ? ' · ' + t('вне зачёта') : ''}</span></li>`).join('');
    const rank = data ? [...data.values()].sort((a, b) => b.score - a.score || b.n - a.n) : [];
    const lines = rank.map((c, i) => `<div class="clrow${c.code === st.mine ? ' me' : ''}"><span style="text-align:center">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span style="font-size:22px">${E(c.em)}</span><span class="nm">${E(c.nm)}<small style="display:block;font-weight:500;opacity:.7">${t('{n} уч.', { n: c.n })} · ${c.code}</small></span><b>${c.score}</b></div>`).join('');
    const body = tab === 'club'
      ? `<ul class="clmem">${mem}</ul><div class="small">В зачёте — 5 лучших за неделю. Очки: победы над ботами и друзьями (как в «Лидерах»).</div>`
      : `<div style="display:flex;flex-direction:column;gap:5px">${lines || '<p class="small">Клубов пока нет в списке.</p>'}</div><div class="small">Турнир недели — среди клубов, которые ты видишь: свой, открытые по коду и приглашённые. Общей таблицы всех клубов без сервера нет.</div>`;
    return `<div class="clhero" style="--cc:${color}"><span class="em">${E(sc.em)}</span><div><b>${E(sc.nm)}</b><small>${sc.n} ${t(sc.n === 1 ? 'участник' : 'участников')} · ${t('на неделе {s} оч.', { s: sc.score })}${st.cups ? ` · 🏆 ${st.cups}` : ''}</small></div></div>
      <div class="cbox" style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div><div class="small">Код клуба</div><div class="clcode">${st.mine}</div></div>
        <div style="display:flex;gap:6px"><button type="button" class="btn green" id="clShare">Позвать</button><button type="button" class="btn grey" id="clCopy">Код</button></div></div>
      <div class="cltabs"><button type="button" data-cltab="club" class="${tab === 'club' ? 'on' : ''}">Участники</button><button type="button" data-cltab="week" class="${tab === 'week' ? 'on' : ''}">Клубы недели</button></div>
      ${weekEnd() ? `<div class="small">${t('Неделя закончится через {x}', { x: left(weekEnd() - Date.now()) })}</div>` : ''}${body}
      <div style="display:flex;gap:6px"><button type="button" class="btn blue" id="clRef" style="flex:1">Обновить</button><button type="button" class="btn grey" id="clLeave" style="flex:1">Выйти из клуба</button></div>`;
  }
  function render() {
    if (!openNow) return;
    const el = $c('pageIn'); if (!el) return;
    el.innerHTML = `${head('Клуб 👥')}${status ? `<p class="small" style="text-align:center">${E(status)}</p>` : ''}${st.mine ? renderIn() : renderNone()}`;
    const g = id => $c(id);
    if (st.mine) {
      el.querySelectorAll('[data-cltab]').forEach(b => { b.onclick = () => { tab = b.dataset.cltab; render(); }; });
      g('clShare').onclick = () => shareClub(g('clShare'));
      g('clCopy').onclick = () => { if (typeof copyText === 'function') copyText(st.mine, g('clCopy')); };
      g('clRef').onclick = () => refresh();
      g('clLeave').onclick = () => ask('Выйти из клуба? Твои очки уйдут из его таблицы.', 'Выйти', async () => { await leave(); data = null; render(); });
    } else {
      g('clName').oninput = e => { draft.nm = e.target.value; };
      g('clEmo').onclick = e => { const b = e.target.closest('[data-em]'); if (!b) return; draft.em = b.dataset.em; g('clEmo').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
      g('clCol').onclick = e => { const b = e.target.closest('[data-co]'); if (!b) return; draft.co = +b.dataset.co; g('clCol').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
      g('clCreate').onclick = async () => {
        if (!clean(draft.nm, 16)) { say('Назови клуб', 2500); return; }
        if (!has()) { say('Клубы доступны на сайте и в Telegram', 3500); return; }
        await create(draft.nm, draft.em, draft.co); data = null; render(); refresh();
      };
      g('clJoin').onclick = async () => { const v = g('clCode').value; status = 'Ищем клуб…'; render(); const ok = await join(v); status = ''; if (ok) { data = null; render(); refresh(); } else render(); };
      el.querySelectorAll('[data-peek]').forEach(b => { b.onclick = async () => { status = 'Загружаем…'; render(); const got = await fetchClubs([b.dataset.peek], 2500); status = ''; const rows = got && got.get(b.dataset.peek) || []; if (!rows.length) { say('Клуб пока пуст или не отвечает', 3000); render(); return; } const sc = scoreClub(b.dataset.peek, rows); peekWin(sc); }; });
    }
  }
  /* просмотр чужого клуба: таблица и кнопка «Вступить» */
  function peekWin(sc) {
    const el = $c('pageIn'); if (!el) return;
    const me = pid();
    el.innerHTML = `${head('Клуб 👥')}<div class="clhero" style="--cc:${COLORS[sc.co] || COLORS[0]}"><span class="em">${E(sc.em)}</span><div><b>${E(sc.nm)}</b><small>${t('{n} уч. · на неделе {s} оч. · код {c}', { n: sc.n, s: sc.score, c: sc.code })}</small></div></div>
      <ul class="clmem">${sc.members.map((m, i) => `<li class="${m.id === me ? 'me' : ''}${i >= 5 ? ' off' : ''}"><span class="pl">${['🥇', '🥈', '🥉'][i] || i + 1}</span><span class="nm">${E(t(m.n))}</span><span class="sc">${t('{n} оч.', { n: m.pts })}</span></li>`).join('')}</ul>
      <div style="display:flex;gap:6px"><button type="button" class="btn blue" id="clGo" style="flex:1">Вступить</button><button type="button" class="btn grey" id="clBack" style="flex:1">Назад</button></div>`;
    $c('clGo').onclick = async () => { const ok = await join(sc.code); if (ok) { data = null; render(); refresh(); } };
    $c('clBack').onclick = () => render();
  }
  function open() {
    css(); openNow = true; tab = 'club'; status = '';
    try { closeSheets(); } catch (e) {}
    sheet('page', ''); render();
    if (st.mine || st.seen.length) refresh();
    watchClose();
  }
  let watched = false;
  function watchClose() {
    const p = $c('page');
    if (watched || !p || !window.MutationObserver) return; watched = true;
    new MutationObserver(() => { if (p.hidden && openNow) { openNow = false; idle(1000); } }).observe(p, { attributes: true, attributeFilter: ['hidden'] });
  }

  /* ---------- приглашение по ссылке: ?club=КОД или startapp=c_КОД ---------- */
  function inviteCode() {
    try {
      const tga = typeof TGA !== 'undefined' && TGA, sp = tga && tga.initDataUnsafe && tga.initDataUnsafe.start_param;
      if (sp && /^c_[A-Za-z2-9]{6}$/.test(sp)) return sp.slice(2).toUpperCase();
      const c = new URLSearchParams(location.search).get('club');
      return c && CODE_RE.test(c.toUpperCase()) ? c.toUpperCase() : null;
    } catch (e) { return null; }
  }
  async function handleInvite() {
    const code = inviteCode(); if (!code || st.mine === code) return;
    try { const u = new URL(location.href); u.searchParams.delete('club'); history.replaceState(null, '', u); } catch (e) {}
    if (st.mine) { say('Тебя зовут в клуб, но ты уже в своём — выйди из него, чтобы вступить', 5000); return; }
    const got = await fetchClubs([code], 2500);
    const rows = got && got.get(code) || [];
    if (!rows.length) { say('Клуб из приглашения не нашли', 4000); return; }
    const sc = scoreClub(code, rows);
    ask(t('Тебя зовут в клуб {e} «{nm}» ({n} уч.). Вступить?', { e: sc.em, nm: sc.nm, n: sc.n }), 'Вступить', async () => { await join(code); open(); }, () => remember(sc));
  }

  /* ---------- встраивание ---------- */
  BUS.menuKey('club', open);
  BUS.on('menu:open', () => {
    try {
      const g = document.querySelector('#menuIn .menugrid'); if (!g || g.querySelector('[data-go="club"]')) return;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mi'; b.dataset.go = 'club';
      b.innerHTML = st.mine && st.club ? `<b>${t('Клуб {e} {n}', { e: E(st.club.em), n: E(st.club.nm) })}</b><small>${t('неделя: {p} оч. · код {c}', { p: myWeekPts(), c: st.mine })}</small>` : '<b>Клуб 👥</b><small>команда друзей, общий рейтинг</small>';
      const ref = g.querySelector('[data-go="leaders"]');
      g.insertBefore(b, ref ? ref.nextSibling : null);
    } catch (e) {}
  });
  BUS.on('lb:record', () => { try { publishSoon(); } catch (e) {} });
  const boot = () => { setTimeout(() => { try { handleInvite(); } catch (e) {} }, 2500); if (st.mine) setTimeout(() => { try { publishSoon(); } catch (e) {} }, 6000); };
  if (document.readyState === 'complete') boot(); else addEventListener('load', boot);
  window.CLUBS = { open, state: () => st, create, join, leave, fetchClubs, scoreClub, cleanMember, publish, inviteLink, _EMOJI: EMOJI };
})();
