/* Дурокер — онлайн по коду стола.
   Соединение напрямую между браузерами (WebRTC через PeerJS), своего сервера не нужно.
   Хозяин стола ведёт партию и отправляет гостю только то, что гостю положено видеть. */
'use strict';

const PEER_PREFIX = 'durocker-v1-';
const CODE_CH = 'abcdefghjkmnpqrstuvwxyz23456789';
const randCode = () => Array.from({ length: 4 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join('');
const peerReady = () => typeof window.Peer === 'function';

function netSend(topic, data) {
  const c = NET && NET.conn;
  if (c && c.open) { try { c.send({ topic, data }); } catch (e) {} }
}

/* вид партии глазами гостя: его рука, число карт хозяина, стол; места меняются местами */
function viewFor() {
  const f = other;
  return {
    T: G.T, tr: G.trump.n, dn: G.deck.length, P: G.B.map(c => c.n), bn: G.P.length,
    tb: G.table.map(b => [b.a.cards.map(c => c.n), b.d ? b.d.cards.map(c => c.n) : null]),
    g: G.grave, at: f(G.attacker), ph: G.phase.who ? { w: f(G.phase.who), k: G.phase.kind } : null,
    lim: G.limit, busy: !!G.busy, over: G.over ? (G.over === 'draw' ? 'draw' : f(G.over)) : null,
    fx: G.fx ? { ...G.fx, actor: f(G.fx.actor) } : null, nick: myNick(),
    sc: NET ? { w: NET.score.l || 0, l: NET.score.w || 0 } : null,
  };
}
function sync() { if (NET && NET.role === 'host' && NET.connected && G) netSend('st', viewFor()); }

/* ---------- хозяин ---------- */
function hostTable() {
  if (!peerReady()) return lobbyStatus('Не загрузилась библиотека онлайна. Проверь интернет и обнови страницу.', true);
  lobbyStatus('Открываем стол…');
  const code = randCode();
  const peer = new Peer(PEER_PREFIX + code);
  NET = { role: 'host', peer, code, conn: null, oppNick: '', score: { w: 0, l: 0 }, connected: false, started: false, ready: false };
  peer.on('open', () => { if (NET && NET.peer === peer) { NET.ready = true; renderLobby(); renderNet(); } });
  peer.on('connection', conn => {
    if (!NET || NET.peer !== peer) return;
    if (NET.conn && NET.conn.open) { conn.on('open', () => { conn.send({ topic: 'full' }); setTimeout(() => conn.close(), 300); }); return; }
    NET.conn = conn;
    conn.on('data', m => {
      if (!m || typeof m !== 'object' || NET.conn !== conn) return;
      if (m.topic === 'hi') onHi(m.data);
      else if (m.topic === 'act') onAct(m.data);
    });
    conn.on('close', () => { if (NET && NET.conn === conn) { NET.connected = false; renderNet(); showOver(); } });
  });
  peer.on('error', e => {
    if (e.type === 'unavailable-id' && NET && NET.peer === peer) { peer.destroy(); NET = null; hostTable(); return; }
    lobbyStatus('Ошибка сети: ' + e.type, true);
  });
  peer.on('disconnected', () => { try { peer.reconnect(); } catch (e) {} });
  renderLobby(); renderNet();
}
function onHi(d) {
  const fresh = !NET.started;
  NET.connected = true;
  NET.oppNick = String((d && d.nick) || 'Соперник').slice(0, 16);
  $('lobby').hidden = true;
  if (fresh) { NET.started = true; G = null; newGame(); } else commit();
  renderNet();
}
function onAct(d) {
  if (!G) return;
  d = d || {};
  const ids = Array.isArray(d.c) ? d.c.slice(0, 5) : [];
  const cards = ids.map(n => G.B.find(c => c.n === n));
  if (cards.some(x => !x)) { sync(); return; }
  if (!act('b', String(d.t), cards)) sync();
}

/* ---------- гость ---------- */
function joinTable() {
  const code = $('codeIn').value.trim().toLowerCase();
  if (!/^[a-z0-9]{4}$/.test(code)) return lobbyStatus('Код — 4 символа, как у хозяина стола.', true);
  if (!peerReady()) return lobbyStatus('Не загрузилась библиотека онлайна. Проверь интернет и обнови страницу.', true);
  TOK++;
  const peer = new Peer();
  NET = { role: 'guest', peer, code, conn: null, oppNick: '', score: { w: 0, l: 0 }, lastFx: null, got: false, connected: false };
  renderLobby();
  peer.on('open', () => {
    if (!NET || NET.peer !== peer) return;
    const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
    NET.conn = conn;
    conn.on('open', () => { NET.connected = true; conn.send({ topic: 'hi', data: { nick: myNick() } }); });
    conn.on('data', m => {
      if (!m || typeof m !== 'object' || !NET) return;
      if (m.topic === 'full') { lobbyStatus('За этим столом уже играют двое.', true); return; }
      if (m.topic === 'st' && m.data && typeof m.data === 'object') {
        if (!NET.got) { NET.got = true; $('lobby').hidden = true; $('over').hidden = true; renderNet(); }
        applyView(m.data);
      }
    });
    conn.on('close', () => { if (NET && NET.conn === conn) { NET.connected = false; renderNet(); showOver(); } });
  });
  peer.on('error', e => lobbyStatus(e.type === 'peer-unavailable' ? 'Стол не найден. Проверь код.' : 'Ошибка сети: ' + e.type, true));
  setTimeout(() => { if (NET && NET.peer === peer && !NET.got) lobbyStatus('Стол не отвечает. Проверь код или попроси друга создать стол заново.', true); }, 10000);
}

let applyChain = Promise.resolve();
function applyView(st) {
  applyChain = applyChain.then(async () => {
    const prev = G;
    if (prev && prev.table && prev.table.length && !st.tb.length && prev.grave < st.g) await flyToGrave();
    const keepSel = prev && prev.sel ? prev.sel : new Set();
    G = {
      guest: true, T: st.T, trump: mkCard(st.tr), deck: new Array(st.dn).fill(0), P: st.P.map(mkCard),
      B: Array.from({ length: st.bn }, (_, i) => ({ id: 'x' + i, r: 2, s: -1, n: -1 })), table: [], grave: st.g,
      attacker: st.at, phase: st.ph ? { who: st.ph.w, kind: st.ph.k } : { who: null }, limit: st.lim, busy: st.busy,
      over: st.over, sel: new Set([...keepSel].filter(id => st.P.some(n => 'c' + n === id))),
      sort: (prev && prev.sort) || 'r', pending: false, fx: null,
    };
    G.table = st.tb.map(([a, d]) => ({ a: ev(a.map(mkCard)), d: d ? ev(d.map(mkCard)) : null }));
    NET.oppNick = String(st.nick || 'Соперник').slice(0, 16);
    if (st.sc) NET.score = st.sc;
    update(!prev || !prev.guest || st.P.length > prev.P.length);
    if (st.fx && st.fx.id !== NET.lastFx) { NET.lastFx = st.fx.id; showFx(st.fx); }
    showOver();
  }).catch(() => {});
}

function leaveTable() {
  if (NET) {
    try { NET.conn && NET.conn.close(); } catch (e) {}
    try { NET.peer.destroy(); } catch (e) {}
    NET = null;
  }
  G = null; renderNet(); newGame();
}

/* кнопки игрока: в игре с ботом и у хозяина — сразу в движок, у гостя — хозяину */
function sendAct(type) {
  if (NET && NET.role === 'guest') {
    if (G.pending) return;
    G.pending = true;
    netSend('act', { t: type, c: selected().map(c => c.n) });
    G.sel.clear(); update();
    setTimeout(() => { if (G && G.pending) { G.pending = false; renderActions(); } }, 4000);
    return;
  }
  const cs = selected();
  if (type === 'play') G.sel.clear();
  if (!act('p', type, cs)) update();
}
