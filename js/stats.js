/* ДурКер — профиль игрока: история партий (последние 200), винрейт по соперникам и режимам,
   серии побед, любимые комбинации, график последних матчей. Всё хранится локально.
   Встраивается обёртками showFx (считаем ходы — работает и у гостя онлайна) и showOver (итог партии). */
'use strict';

const STATS = (() => {
  const KEY = 'durocker-stats';
  const empty = () => ({ games: [], matches: [], tot: { n: 0, w: 0, mog: 0, caught: 0, takes: 0, transfers: 0, five: 0, types: {}, byOpp: {}, byMode: {}, turbo: 0, bossLoss: 0, bossWins: {} }, streak: { cur: 0, best: 0 } });
  let S = null;
  function st() {
    if (S) return S;
    try { S = JSON.parse(load(KEY)) || empty(); } catch (e) { S = empty(); }
    const e = empty();
    S.tot = Object.assign(e.tot, S.tot || {}); S.streak = Object.assign(e.streak, S.streak || {});
    S.games = S.games || []; S.matches = S.matches || [];
    return S;
  }
  const save = () => { try { store(KEY, JSON.stringify(st())); } catch (e) {} };

  /* счётчики текущей партии */
  let cur = null;
  const fresh = () => ({ types: {}, best: -1, mog: 0, takes: 0, transfers: 0, five: 0, turns: 0, lastMyDef: -1, botFive: false, mogSF: false });
  function track(o) {
    if (!o || !G) return;
    if (!cur || cur.g !== G) cur = Object.assign(fresh(), { g: G });
    const me = o.actor === 'p';
    if (o.what === 'trump') cur.turns = 0;
    if (o.what === 'bito' || o.what === 'takes') cur.turns++;
    if (me && typeof o.t === 'number' && ['attack', 'throw', 'defend', 'addtake', 'transfer'].includes(o.what)) {
      cur.types[o.t] = (cur.types[o.t] || 0) + 1;
      if (o.t > cur.best) cur.best = o.t;
    }
    if (!me && (o.what === 'attack' || o.what === 'throw') && typeof o.t === 'number') cur.botFive = o.t >= 8;
    if (me && o.what === 'defend') { cur.lastMyDef = o.t; if (cur.botFive && o.t >= 8) cur.five++; }
    if (me && o.what === 'takes') cur.takes++;
    if (me && o.what === 'transfer') cur.transfers++;
    if (o.what === 'hype' && o.key === 'mognul' && me) { cur.mog++; if (cur.lastMyDef === 11) cur.mogSF = true; }
  }

  /* итог партии: один раз на объект партии */
  const listeners = [];
  function record() {
    if (!G || !G.over || G._statsRec) return;
    if (typeof MODE !== 'undefined' && MODE.kind === 'tutorial') return;
    G._statsRec = true;
    const s = st(), c = (cur && cur.g === G) ? cur : Object.assign(fresh(), { g: G });
    const online = typeof NET !== 'undefined' && !!NET;
    const bot = !online && typeof currentBot === 'function' ? currentBot() : null;
    const mode = online ? (NET.quick ? 'quick' : 'online') : (MODE && MODE.kind) || 'free';
    const opp = online ? String(NET.oppNick || 'Соперник').slice(0, 16) : bot ? bot.name : '?';
    const oppId = online ? 'net:' + opp : bot ? bot.id : '?';
    const res = G.over === 'p' ? 'w' : G.over === 'b' ? 'l' : 'd';
    const turns = (G.stats && G.stats.turns) || c.turns;
    const clockLeftMe = G.clock && typeof clockLeft === 'function' ? clockLeft('p') : null;
    const rec = { t: Date.now(), mode, opp, oppId, ai: bot ? bot.ai : null, boss: bot ? bot.boss || null : null, res, pen: G.penalty || 0, turns,
      best: c.best, mog: c.mog, takes: c.takes, transfers: c.transfers, caught: G.caught || 0, five: c.five, mogSF: c.mogSF,
      blitz: !!G.clock, clock: clockLeftMe, turbo: speedMode() !== 'normal', hour: new Date().getHours() };
    s.games.push(rec); if (s.games.length > 200) s.games.splice(0, s.games.length - 200);
    const T = s.tot;
    T.n++; if (res === 'w') T.w++;
    T.mog += c.mog; T.caught += rec.caught; T.takes += c.takes; T.transfers += c.transfers; T.five += c.five;
    if (rec.turbo) T.turbo++;
    Object.entries(c.types).forEach(([k, v]) => { T.types[k] = (T.types[k] || 0) + v; });
    const bo = T.byOpp[oppId] || (T.byOpp[oppId] = { n: 0, w: 0, name: opp });
    bo.n++; if (res === 'w') bo.w++; bo.name = opp;
    const bm = T.byMode[mode] || (T.byMode[mode] = { n: 0, w: 0 });
    bm.n++; if (res === 'w') bm.w++;
    if (rec.boss && res === 'l' && mode === 'career') T.bossLoss++;
    if (rec.boss && res === 'w') T.bossWins[rec.boss] = 1;
    if (res === 'w') { s.streak.cur++; s.streak.best = Math.max(s.streak.best, s.streak.cur); } else if (res === 'l') s.streak.cur = 0;
    /* конец матча */
    let match = null;
    const se = typeof SERIES !== 'undefined' ? SERIES : null;
    if (se && se.done && se.w) {
      const win = se.w.p > se.w.b;
      match = { t: Date.now(), r: win ? 'W' : 'L', score: `${se.w.p}:${se.w.b}`, opp, mode, to: se.to || 0, first: (rec.firstLost = s.games.length >= 2) };
      s.matches.push(match); if (s.matches.length > 60) s.matches.splice(0, s.matches.length - 60);
    }
    save();
    listeners.forEach(f => { try { f(rec, match, s); } catch (e) { console.error(e); } });
  }

  const wr = (o) => (o && o.n ? Math.round(o.w / o.n * 100) : 0);
  const MODE_NAMES = { free: 'Своя игра', career: 'Карьера', daily: 'Ежедневная', weekly: 'Босс недели', online: 'Онлайн', quick: 'Быстрая игра' };

  function chart(ms) {
    const W = 300, H = 90, n = ms.length;
    if (!n) return '<p class="small">Сыграй хотя бы один матч — здесь появится график.</p>';
    let y = 0; const pts = [[0, 0]];
    ms.forEach((m, i) => { y += m.r === 'W' ? 1 : -1; pts.push([i + 1, y]); });
    const ys = pts.map(p => p[1]), lo = Math.min(0, ...ys), hi = Math.max(1, ...ys), sx = W / Math.max(1, n), sy = (H - 16) / (hi - lo || 1);
    const P = p => `${(p[0] * sx).toFixed(1)},${(H - 8 - (p[1] - lo) * sy).toFixed(1)}`;
    const zero = (H - 8 - (0 - lo) * sy).toFixed(1);
    const dots = ms.map((m, i) => `<circle cx="${((i + 1) * sx).toFixed(1)}" cy="${P(pts[i + 1]).split(',')[1]}" r="3" fill="${m.r === 'W' ? '#2e9d5b' : '#d9362f'}"><title>${esc(m.opp)} ${m.score}</title></circle>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Победы минус поражения за последние ${n} матчей">
      <line x1="0" x2="${W}" y1="${zero}" y2="${zero}" stroke="rgba(255,255,255,.18)" stroke-dasharray="3 3"/>
      <polyline points="${pts.map(P).join(' ')}" fill="none" stroke="#e8b33c" stroke-width="2"/>${dots}</svg>
      <p class="small">Линия — победы минус поражения за последние ${n} матчей (зелёная точка — выигран, красная — проигран).</p>`;
  }
  const bar = (name, o) => `<div class="bar"><span>${esc(name)}</span><u><i style="width:${wr(o)}%"></i></u><em>${wr(o)}% · ${o.n}</em></div>`;

  function open() {
    const s = st(), T = s.tot;
    const opps = Object.entries(T.byOpp).sort((a, b) => b[1].n - a[1].n).slice(0, 12);
    const modes = Object.entries(T.byMode).sort((a, b) => b[1].n - a[1].n);
    const favs = Object.entries(T.types).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const last = s.games.slice(-15).reverse();
    const ms = s.matches.slice(-30);
    const mw = s.matches.filter(m => m.r === 'W').length;
    const titles = typeof ACH_TITLES === 'function' ? ACH_TITLES() : [];
    sheet('page', `${head('Профиль')}<div class="prof">
      <div class="statrow"><div><b>${T.n}</b><span>партий</span></div><div><b>${wr(T)}%</b><span>побед</span></div><div><b>${s.streak.cur}</b><span>серия</span></div><div><b>${s.streak.best}</b><span>лучшая</span></div></div>
      <div class="statrow"><div><b>${s.matches.length ? Math.round(mw / s.matches.length * 100) + '%' : '—'}</b><span>матчей</span></div><div><b>${T.mog}</b><span>могнул</span></div><div><b>${T.caught}</b><span>шулеров</span></div><div><b>${T.five}</b><span>пятёрок отбито</span></div></div>
      ${titles.length ? `<h3>Титулы за достижения</h3><div class="chips">${titles.map(t => `<span>🏷 ${esc(t)}</span>`).join('')}</div>` : ''}
      <h3>Последние матчи</h3>${chart(ms)}
      <h3>Против кого</h3><div class="bars">${opps.length ? opps.map(([, o]) => bar(o.name, o)).join('') : '<p class="small">Пока пусто.</p>'}</div>
      <h3>Режимы</h3><div class="bars">${modes.map(([k, o]) => bar(MODE_NAMES[k] || k, o)).join('') || '<p class="small">Пока пусто.</p>'}</div>
      <h3>Любимые комбинации</h3><div class="chips">${favs.length ? favs.map(([t, n]) => `<span>${esc(TN[t] || '?')} × ${n}</span>`).join('') : '<span>ещё не играл</span>'}</div>
      <h3>История</h3><div class="hist">${last.map(g => `<div><b>${g.res === 'w' ? '✅' : g.res === 'l' ? '🃏' : '🤝'}</b><span>${new Date(g.t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span><span>${esc(MODE_NAMES[g.mode] || g.mode)} · ${esc(g.opp)}</span><span>${g.best >= 0 ? esc(TN[g.best] || '') : ''}${g.mog ? ` · могнул ×${g.mog}` : ''}</span></div>`).join('') || 'Пока пусто.'}</div>
    </div>`);
  }

  /* встраивание */
  if (typeof showFx === 'function') {
    const _sf = showFx;
    showFx = function (o) { try { track(o); } catch (e) {} return _sf.apply(this, arguments); };
  }
  if (typeof showOver === 'function') {
    const _so = showOver;
    showOver = function () { const r = _so.apply(this, arguments); try { record(); } catch (e) { console.error(e); } return r; };
  }
  return { st, open, onRecord: f => listeners.push(f), get cur() { return cur; }, _record: record };
})();
function openProfile() { STATS.open(); }
