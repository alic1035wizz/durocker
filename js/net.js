/* Дурокер — онлайн-стол по коду. Хозяин ведёт партию и отправляет гостю только то, что гостю положено видеть.
   Сам канал связи — в transport-*.js: на сайте PeerJS (WebRTC), на странице в Claude — комната Claude. */
'use strict';

const CODE_CH = 'abcdefghjkmnpqrstuvwxyz23456789';
const randCode = () => Array.from({ length: 4 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');

/* вид партии глазами гостя: его рука, число карт хозяина, стол; места меняются местами */
function viewFor() {
  const f = other;
  return {
    T: G.T, tr: G.trump.n, dn: G.deck.length, P: G.B.map(c => c.n), bn: G.P.length,
    v: VERSION, tb: G.table.map(b => [b.a.cards.map(c => c.n), b.d ? b.d.cards.map(c => c.n) : null]),
    g: G.grave, at: f(G.attacker), ph: G.phase.who ? { w: f(G.phase.who), k: G.phase.kind } : null,
    lim: G.limit, busy: !!G.busy, over: G.over ? (G.over === 'draw' ? 'draw' : f(G.over)) : null, pen: G.penalty || 0,
    fx: G.fx ? { ...G.fx, actor: f(G.fx.actor) } : null, fxl: (G.fxList || []).map(o => ({ ...o, actor: f(o.actor) })), nick: myNick(),
    ch: { p: G.charge.b, b: G.charge.p }, of: G.offer.b, oof: G.offer.p ? 1 : 0, tm: G.turnMs || 30000,
    se: { p: SERIES.b, b: SERIES.p, games: SERIES.games, done: SERIES.done },
    rt: G.rules.transfer ? 1 : 0, ro: G.rules.over === false ? 0 : 1, ru: G.rules, up: G.upgraded ? 1 : 0, bz: G.rules.blitz ? 1 : 0, ex: { p: G.extra.b, b: G.extra.p }, ck: G.clock ? { p: clockLeft('b'), b: clockLeft('p'), run: G.clock.run ? f(G.clock.run) : null } : null, ow: G.overWhy || null, tl: G.deadline ? Math.max(0, G.deadline - Date.now()) : 0,
  };
}
function sync() {
  if (NET && NET.role === 'host' && G) {
    if (NET.connected) TR.send('st', viewFor());
    saveHost();
  }
}
/* хозяин держит партию у себя: сохраняем её в вкладке, чтобы после обновления страницы стол продолжился */
function saveHost() {
  if (!NET || NET.role !== 'host' || !NET.started || !TR.linkable) return;
  try {
    const g = { ...G, sel: [], known: [...(G.known || [])], fxList: (G.fxList || []).slice(-3) };
    sessionStorage.setItem('durocker-host', JSON.stringify({ code: NET.code, nick: NET.oppNick, G: g, S: SERIES, at: Date.now() }));
  } catch (e) {}
}
function loadHost(code) {
  try {
    const d = JSON.parse(sessionStorage.getItem('durocker-host'));
    if (!d || d.code !== code || Date.now() - d.at > 3 * 3600e3) return null;
    d.G.known = new Set(d.G.known || []);
    return d;
  } catch (e) { return null; }
}
/* адрес страницы помнит стол: обновил страницу — вернулся за него */
function setUrl(q) {
  try {
    const u = new URL(location.href);
    ['t', 'h'].forEach(k => u.searchParams.delete(k));
    if (q) Object.entries(q).forEach(([k, v]) => u.searchParams.set(k, v));
    history.replaceState(null, '', u);
  } catch (e) {}
}
function inviteLink(code) {
  if (TG_LINK) return TG_LINK + '?startapp=t_' + code;
  const u = new URL(location.href);
  u.search = ''; u.hash = ''; u.searchParams.set('t', code);
  return u.toString();
}
let verWarned = false;
function checkVersion(v) {
  if (verWarned || v === VERSION) return;
  verWarned = true;
  const mineOld = v && v > VERSION;
  toast(mineOld ? 'У тебя старая версия игры — обнови страницу' : 'У друга старая версия игры — пусть обновит страницу', 8000);
}

/* ---------- хозяин ---------- */
function hostTable(restore) {
  if (!TR.available()) return lobbyStatus(TR.unavailableText, true);
  const code = restore ? restore.code : randCode();
  NET = { role: 'host', code, oppNick: restore ? restore.nick : '', connected: false, started: !!restore, ready: false, series: { p: 0, b: 0, games: 0, done: false } };
  if (restore) { G = restore.G; SERIES = restore.S; G.busy = false; G.sel = new Set(); G.pending = false; }
  setUrl(TR.linkable ? { h: code } : null);
  renderLobby(); renderNet();
  if (restore) { $('lobby').hidden = true; update(true); showOver(); }
  TR.host(code, {
    ready() { if (!NET) return; NET.ready = true; renderLobby(); renderNet(); },
    msg(topic, data) {
      if (!NET) return;
      if (topic === 'hi') onHi(data);
      else if (topic === 'act') onAct(data);
      else if (topic === 'react') showReact(data && data.i);
      else if (topic === 'rematch') { toast(`${oppName()} хочет реванш`); if (G && G.over) { if (SERIES.done) newSeries(); newGame(); } }
    },
    gone() { if (!NET) return; NET.connected = false; armTimer(); renderNet(); showOver(); },
    error(t) { lobbyStatus(t, true); },
  });
}
function onHi(d) {
  checkVersion(d && d.v);
  const fresh = !NET.started;
  NET.connected = true;
  NET.oppNick = String((d && d.nick) || 'Соперник').slice(0, 16);
  $('lobby').hidden = true;
  if (fresh) { NET.started = true; G = null; newSeries(); newGame(); } else commit();
  renderNet();
}
function onAct(d) {
  if (!G) return;
  d = d || {};
  if (d.t === 'pick') { act('b', 'pick', String(d.k)); return; }
  const ids = Array.isArray(d.c) ? d.c.slice(0, 5) : [];
  const cards = ids.map(n => G.B.find(c => c.n === n));
  if (cards.some(x => !x)) { sync(); return; }
  if (!act('b', String(d.t), cards)) sync();
}

/* ---------- гость ---------- */
function joinTable() {
  const code = $('codeIn').value.trim().toLowerCase();
  if (!/^[a-z0-9]{4}$/.test(code)) return lobbyStatus('Код — 4 символа, как у хозяина стола.', true);
  if (!TR.available()) return lobbyStatus(TR.unavailableText, true);
  TOK++;
  NET = { role: 'guest', code, oppNick: '', lastFx: null, got: false, connected: false, series: { p: 0, b: 0, games: 0, done: false } };
  setUrl(TR.linkable ? { t: code } : null);
  renderLobby();
  TR.join(code, myNick(), {
    open() { if (NET) NET.connected = true; },
    msg(topic, data) {
      if (!NET) return;
      if (topic === 'full') { lobbyStatus('За этим столом уже играют двое.', true); return; }
      if (topic === 'react') { showReact(data && data.i); return; }
      if (topic === 'st' && data && typeof data === 'object') {
        if (!NET.got) { NET.got = true; $('lobby').hidden = true; $('over').hidden = true; }
        if (!NET.connected) { NET.connected = true; renderNet(); }
        applyView(data);
      }
    },
    gone() { if (!NET) return; NET.connected = false; renderNet(); showOver(); },
    error(t) { lobbyStatus(t, true); },
  });
  setTimeout(() => { if (NET && NET.role === 'guest' && !NET.got) lobbyStatus('Стол не отвечает. Проверь код или попроси друга создать стол заново.', true); }, 10000);
}

let applyChain = Promise.resolve();
function applyView(st) {
  applyChain = applyChain.then(async () => {
    checkVersion(st.v);
    const prev = G;
    if (prev && prev.table && prev.table.length && !st.tb.length && prev.grave < st.g) await flyToGrave();
    const keepSel = prev && prev.sel ? prev.sel : new Set();
    G = {
      guest: true, T: st.T, trump: mkCard(st.tr), deck: new Array(st.dn).fill(0), P: st.P.map(mkCard),
      B: Array.from({ length: st.bn }, (_, i) => ({ id: 'x' + i, r: 2, s: -1, n: -1 })), table: [], grave: st.g,
      attacker: st.at, phase: st.ph ? { who: st.ph.w, kind: st.ph.k } : { who: null }, limit: st.lim, busy: st.busy,
      over: st.over, penalty: st.pen, sel: new Set([...keepSel].filter(id => st.P.some(n => 'c' + n === id))),
      sort: (prev && prev.sort) || 'r', pending: false, fx: null, rules: (HAND = (st.ru && st.ru.hand) || 8, st.ru ? { ...st.ru } : { transfer: !!st.rt, over: st.ro !== 0, blitz: !!st.bz }),
      upgraded: !!st.up, clock: st.ck ? { p: st.ck.p, b: st.ck.b, run: st.ck.run, since: Date.now() } : null, overWhy: st.ow || null, deadline: st.tl ? Date.now() + st.tl : 0, extra: st.ex || { p: 0, b: 0 }, turnMs: st.tm || 30000,
      charge: st.ch || { p: 0, b: 0 }, offer: { p: st.of || null, b: st.oof ? {} : null }, offerLater: prev && prev.offerLater,
    };
    G.table = st.tb.map(([a, d]) => ({ a: ev(a.map(mkCard)), d: d ? ev(d.map(mkCard)) : null }));
    NET.oppNick = String(st.nick || 'Соперник').slice(0, 16);
    if (st.se) { NET.series = st.se; SERIES = st.se; }
    update(!prev || !prev.guest || st.P.length > prev.P.length);
    const fl = st.fxl || (st.fx ? [st.fx] : []);
    if (fl.length && fl[fl.length - 1].id < (NET.lastFx || 0)) NET.lastFx = 0;
    fl.forEach(o => { if (o.id > (NET.lastFx || 0)) { NET.lastFx = o.id; showFx(o); } });
    showOver();
  }).catch(() => {});
}

function leaveTable() {
  if (NET) { TR.close(); NET = null; }
  setUrl(null); try { sessionStorage.removeItem('durocker-host'); } catch (e) {}
  clearTimeout(turnTimer);
  G = null; renderNet(); newGame();
}

/* кнопки игрока: в игре с ботом и у хозяина — сразу в движок, у гостя — хозяину */
function sendAct(type) {
  if (NET && NET.role === 'guest') {
    if (G.pending) return;
    G.pending = true;
    TR.send('act', { t: type, c: selected().map(c => c.n) });
    G.sel.clear(); update();
    setTimeout(() => { if (G && G.pending) { G.pending = false; renderActions(); } }, 4000);
    return;
  }
  const cs = selected();
  if (type === 'play' || type === 'transfer' || type === 'action' || type === 'upgrade') G.sel.clear();
  if (!act('p', type, cs)) update();
}
