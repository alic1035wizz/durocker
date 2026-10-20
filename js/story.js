/* ДурКер — сюжет карьеры и память соперников (волна 7).
   — у каждого соперника есть досье, а у вас с ним — история: встречи, счёт, отношение (−5…+5);
   — перед матчем карьеры/босса недели — карточка соперника с репликой, зависящей от истории;
   — после партии и матча — реплика соперника на экране итога;
   — сюжетные вставки районов (первый вход, победа над боссом) и финал карьеры;
   — окно «Знакомства» (меню → Ещё) и награды за дружбу (рубашки).
   Геймплей не трогаем: только слова, память и косметика. Подключается через BUS (js/bus.js).
   Данные реплик — js/story-data.js. */
'use strict';
const STORY = (() => {
  const D = STORY_DATA;
  const KEY = 'durker-story';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const lc = s => { s = String(s || ''); return s.charAt(0).toLowerCase() + s.slice(1); };
  const E = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- память ---------- */
  let S = null;
  function state() {
    if (S) return S;
    try { S = JSON.parse(rd(KEY)) || {}; } catch (e) { S = {}; }
    S = Object.assign({ v: 1, opp: {}, intro: {}, cut: {}, off: false, acc: {} }, S);
    return S;
  }
  const save = () => wr(KEY, JSON.stringify(state()));
  function mem(id) {
    const o = state().opp;
    return o[id] || (o[id] = { met: 0, mw: 0, ml: 0, gw: 0, gl: 0, last: '', lastWon: null, lastDry: false, mog: 0, caught: 0, streak: 0, rel: 0 });
  }
  const known = id => !!D.DOSSIER[id];
  const temper = id => (D.DOSSIER[id] && D.DOSSIER[id].temper) || 'warm';

  function relLabel(r) {
    return r <= -4 ? 'Заклятый враг' : r <= -2 ? 'Недруг' : r <= 1 ? 'Знакомый' : r <= 3 ? 'Уважает' : 'Приятель';
  }
  const relTier = r => (r <= -2 ? 'enemy' : r >= 2 ? 'friend' : 'neutral');

  /* как меняется отношение по итогам матча */
  function relDelta(id, m) {
    let d = 0;
    const warm = temper(id) === 'warm';
    if (m.close) d += 1;                    /* упорный матч — взаимное уважение */
    if (m.dry && m.won) d += warm ? 1 : -1; /* разгром: добрые уважают, холодные злятся */
    if (!m.won) d += warm ? 1 : -1;         /* поражение игрока: добрые жалеют, холодные презирают */
    if (m.caught > 0) d -= 1;               /* поймали за руку */
    if (!warm && m.mog >= 3) d -= 1;        /* «могнул» три раза и больше */
    return clamp(d, -2, 2);
  }

  /* игра закончена — обновляем память; matchInfo — только если матч завершён */
  function recordGame(id, won, gameOver) {
    const m = mem(id), a = state().acc[id] || (state().acc[id] = { mog: 0, caught: 0 });
    if (gameOver === 'draw') return null;
    if (won) m.gw++; else m.gl++;
    a.mog += gameOver && gameOver.mog || 0; a.caught += gameOver && gameOver.caught || 0;
    return a;
  }
  function recordMatch(id, info) {
    /* info: {won, w, b, lim, mog, caught} — w/b число побед в матче */
    const m = mem(id), a = state().acc[id] || { mog: 0, caught: 0 };
    const close = info.lim > 1 && info.won && info.b >= info.lim - 1;
    const dry = info.lim > 1 && info.won && info.b === 0;
    const delta = relDelta(id, { won: info.won, dry, close, caught: a.caught, mog: a.mog });
    const prevRel = m.rel;
    m.met++; if (info.won) { m.mw++; m.streak = (m.streak > 0 ? m.streak : 0) + 1; } else { m.ml++; m.streak = 0; }
    m.last = info.w + ':' + info.b; m.lastWon = !!info.won; m.lastDry = dry;
    m.mog += a.mog; m.caught += a.caught;
    m.rel = clamp(m.rel + delta, -5, 5);
    state().acc[id] = { mog: 0, caught: 0 };
    save();
    return { won: !!info.won, dry, close, delta, prevRel, rel: m.rel };
  }

  /* ---------- выбор реплик ---------- */
  const recent = {};
  function sub(t, id) {
    const m = mem(id), d = D.DOSSIER[id] || {};
    return String(t).replace(/\{n\}/g, m.met).replace(/\{w\}/g, m.mw).replace(/\{l\}/g, m.ml).replace(/\{last\}/g, m.last || '—').replace(/\{name\}/g, d.nick || '');
  }
  function pool(id, sit) {
    const d = D.DOSSIER[id]; if (!d) return [];
    const a = D.ARCH[d.arch] || D.ARCH.home;
    const own = (sit === 'meet' || sit === 'grudge' || sit === 'matchWin' || sit === 'matchLose' || sit === 'quip') ? (d[sit] || []) : [];
    const gen = sit === 'meet' || sit === 'quip' ? [] : (a[sit] || []);
    return own.concat(gen);
  }
  /* реплика без повторов подряд (помним последние 5 на соперника) */
  function pickLine(id, sit, rnd) {
    const list = pool(id, sit); if (!list.length) return '';
    const mm = recent[id] || (recent[id] = []);
    const fresh = list.filter(l => !mm.includes(l));
    const from = fresh.length ? fresh : list.filter(l => l !== mm[mm.length - 1]);
    const arr = from.length ? from : list;
    const r = typeof rnd === 'number' ? rnd : Math.random();
    const line = arr[Math.floor(r * arr.length) % arr.length];
    mm.push(line); if (mm.length > 5) mm.shift();
    return sub(line, id);
  }

  /* что сказать перед матчем */
  function sitBefore(id) {
    const m = mem(id);
    if (!m.met) return 'meet';
    if (m.lastWon === false) return 'cocky';
    if (m.lastWon && m.lastDry && m.rel <= 0) return 'revenge';
    if (m.rel <= -2) return 'grudge';
    if (m.rel >= 2) return 'friend';
    if (m.lastWon && m.rel <= 0 && m.streak >= 2) return 'revenge';
    return 'neutral';
  }
  /* что сказать после партии/матча; info — {gameWon, draw, matchDone, match: результат recordMatch, rel} */
  function sitAfter(info) {
    if (info.draw) return null;
    if (!info.matchDone) return info.gameWon ? 'gameWin' : 'gameLose';
    const m = info.match, friendly = info.rel >= 2;
    if (m.won) return m.dry ? 'dry' : m.close ? 'close' : friendly ? 'matchWinFriend' : 'matchWin';
    return friendly ? 'matchLoseFriend' : 'matchLose';
  }

  /* ---------- награды за дружбу ---------- */
  const NEIGHBORS = () => (typeof CAREER_OPS !== 'undefined' ? CAREER_OPS.filter(o => !o.boss).map(o => o.id) : []);
  const friends = () => NEIGHBORS().filter(id => mem(id).rel >= 5).length;
  function checkRewards() {
    try {
      const f = friends(), n = NEIGHBORS().length;
      if (f >= 3 && unlock('back', 'st-friend')) toast('🤝 Друг двора — открыта рубашка');
      if (n && f >= n && unlock('back', 'st-all')) toast('🏠 Свой в каждом дворе — открыта рубашка');
    } catch (e) {}
  }

  /* ---------- вспомогательное для интерфейса ---------- */
  const inNet = () => typeof NET !== 'undefined' && !!NET;
  const modeKind = () => (typeof MODE !== 'undefined' && MODE ? MODE.kind : '');
  const tracked = () => !inNet() && ['career', 'free', 'weekly'].includes(modeKind());
  function botId() {
    try { const b = currentBot(); return b && known(b.id) ? b.id : null; } catch (e) { return null; }
  }
  const lim = () => { try { return typeof seriesTo === 'function' ? seriesTo() : SERIES.to || 2; } catch (e) { return 2; } };
  const por = (id, emo) => (typeof PORTRAITS !== 'undefined' ? PORTRAITS.svg(id, { emo: emo || 'neutral' }) : `<b class="sov-ph">${E((D.DOSSIER[id] || {}).nick || '?')[0]}</b>`);
  const noMotion = () => { try { return matchMedia('(prefers-reduced-motion:reduce)').matches || document.documentElement.dataset.speed === 'off' || !!W.TURBO; } catch (e) { return false; } };

  function relBar(r) {
    let s = '<span class="sovbar" aria-hidden="true">';
    for (let i = -5; i <= 5; i++) {
      if (i === 0) { s += '<i class="mid"></i>'; continue; }
      const on = r > 0 ? (i > 0 && i <= r) : r < 0 ? (i < 0 && i >= r) : false;
      s += `<i class="${on ? (i > 0 ? 'pos' : 'neg') : ''}"></i>`;
    }
    return s + '</span>';
  }

  /* ---------- слои: карточка, сюжетные экраны ---------- */
  let ov = null, onKey = null;
  function closeOv() {
    if (onKey) { document.removeEventListener('keydown', onKey, true); onKey = null; }
    if (ov) { ov.remove(); ov = null; }
  }
  function openOv(html, cls) {
    closeOv();
    ov = document.createElement('div');
    ov.className = 'sheet sov ' + (cls || ''); ov.id = 'storyOv';
    ov.innerHTML = `<div class="in win sov-in">${html}</div>`;
    document.body.appendChild(ov);
    return ov;
  }

  /* карточка соперника перед матчем */
  function duelCard(id, then, extraTag) {
    const d = D.DOSSIER[id], m = mem(id), sit = sitBefore(id);
    const line = pickLine(id, sit);
    const district = (typeof currentBot === 'function' && MODE && MODE.kind === 'career' && typeof CAREER !== 'undefined') ? (() => { try { const b = currentBot(); return `РАЙОН ${b.district + 1} · ${CAREER[b.district].name.toUpperCase()}`; } catch (e) { return ''; } })() : (modeKind() === 'weekly' ? 'БОСС НЕДЕЛИ' : '');
    const first = !m.met;
    const rec = first ? 'первая встреча' : `встреч ${m.met} · ты ${m.mw}:${m.ml} · последний ${m.last}`;
    const emo = sit === 'cocky' || sit === 'grudge' ? 'smug' : sit === 'revenge' ? 'angry' : 'neutral';
    const el = openOv(`
      <span class="sov-tag">${E(extraTag || district)}</span>
      <div class="sov-por">${por(id, emo)}</div>
      <h2 class="sov-name">${E(d.nick)}</h2>
      <div class="sov-sub">${E(d.manner)}</div>
      ${first ? `<p class="sov-bio">${E(d.bio)}</p>` : ''}
      <div class="sov-quote" id="sovQuote"><span class="sov-q"></span><i class="sov-cur"></i></div>
      <div class="sov-meta"><div class="sov-rel">${relBar(m.rel)}<b>${E(relLabel(m.rel))}</b></div><small>${E(rec)}</small></div>
      ${first ? `<div class="sov-chips"><span class="chip">не любит: ${E(lc(d.hates))}</span><span class="chip gold">слабость: ${E(lc(d.weak))}</span></div>` : ''}
      <div class="row sov-row"><button class="btn primary lg" type="button" id="sovGo">В бой</button></div>
      <button class="btn ghost sm sov-off" type="button" id="sovOff">Не показывать карточки</button>`, 'sov-duel');
    let done = false;
    const go = () => { if (done) return; done = true; closeOv(); try { then(); } catch (e) { console.error(e); } };
    el.querySelector('#sovGo').onclick = e => { e.stopPropagation(); go(); };
    el.querySelector('#sovOff').onclick = e => { e.stopPropagation(); state().off = true; save(); try { toast('Карточки выключены — вернуть можно в «Знакомствах»'); } catch (er) {} go(); };
    el.onclick = e => { if (e.target === el) go(); };
    onKey = e => { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); go(); } };
    document.addEventListener('keydown', onKey, true);
    typeInto(el.querySelector('.sov-q'), '«' + line + '»', el.querySelector('.sov-cur'));
  }

  /* печатная машинка (в «Без анимаций»/турбо/reduced-motion — сразу весь текст) */
  let typeT = 0;
  function typeInto(el, text, cur) {
    clearInterval(typeT);
    if (!el) return () => {};
    if (noMotion()) { el.textContent = text; if (cur) cur.style.display = 'none'; return () => {}; }
    let i = 0;
    const fin = () => { clearInterval(typeT); el.textContent = text; if (cur) cur.style.display = 'none'; };
    typeT = setInterval(() => { i += 1; el.textContent = text.slice(0, i); if (i >= text.length) fin(); }, 22);
    return fin;
  }

  /* сюжетные экраны: массив {who, emo, t}; тап — дальше; в конце — then */
  function scenes(list, tag, then, doneLabel) {
    if (!list || !list.length) { then && then(); return; }
    let i = 0, fin = () => {}, typing = false;
    const el = openOv('', 'sov-scene');
    const inn = el.firstElementChild;
    const render = () => {
      const s = list[i], who = s.who === 'narr' ? null : s.who, last = i === list.length - 1;
      const d = who && D.DOSSIER[who];
      inn.innerHTML = `
        <span class="sov-tag">${E(tag)}</span>
        <div class="sov-por ${who ? '' : 'narr'}">${who ? por(who, s.emo || 'neutral') : '<b class="sov-ph">🃏</b>'}</div>
        <h2 class="sov-name">${E(d ? d.nick : 'Рассказчик')}</h2>
        <div class="sov-quote ${who ? '' : 'narrq'}"><span class="sov-q"></span><i class="sov-cur"></i></div>
        <div class="sov-dots">${list.map((_, k) => `<i class="${k === i ? 'on' : k < i ? 'was' : ''}"></i>`).join('')}</div>
        <div class="row sov-row"><button class="btn ${last ? 'primary lg' : 'blue'}" type="button" id="sovNext">${last ? E(doneLabel || 'Дальше') : 'Дальше ▸'}</button></div>
        ${last ? '' : '<button class="btn ghost sm" type="button" id="sovSkip">Пропустить</button>'}`;
      typing = true;
      fin = typeInto(inn.querySelector('.sov-q'), (who ? '«' + s.t + '»' : s.t), inn.querySelector('.sov-cur'));
      const to = setTimeout(() => { typing = false; }, noMotion() ? 0 : Math.min(2500, 22 * s.t.length + 50));
      inn.querySelector('#sovNext').onclick = e => { e.stopPropagation(); adv(); };
      const sk = inn.querySelector('#sovSkip'); if (sk) sk.onclick = e => { e.stopPropagation(); close(); };
      inn._to = to;
    };
    let finished = false;
    const close = () => { if (finished) return; finished = true; closeOv(); try { then && then(); } catch (e) { console.error(e); } };
    const adv = () => {
      if (typing) { typing = false; clearTimeout(inn._to); fin(); return; } /* тап во время печати — показать фразу целиком */
      if (i >= list.length - 1) { close(); return; }
      i++; render();
    };
    el.onclick = e => { if (e.target === el || e.target.closest('.sov-quote') || e.target.closest('.sov-por')) adv(); };
    onKey = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); adv(); } else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey, true);
    render();
  }

  /* ---------- окно «Знакомства» ---------- */
  const allIds = () => {
    const ids = [];
    try { CAREER_OPS.forEach(o => ids.push(o.id)); } catch (e) {}
    ['student', 'valera', 'sharper'].forEach(id => ids.push(id));
    Object.keys(D.DOSSIER).filter(k => k.startsWith('w-')).forEach(id => ids.push(id));
    return ids;
  };
  function openStory(detailId) {
    const s = state();
    const ids = allIds(), seen = id => mem(id).met > 0;
    const body = detailId ? detailHTML(detailId) : listHTML(ids, seen);
    sheet('page', body);
    const pg = document.getElementById('page');
    pg.querySelectorAll('[data-sid]').forEach(b => { b.onclick = () => openStory(b.dataset.sid); });
    const back = pg.querySelector('#stBack'); if (back) back.onclick = () => openStory();
    const tg = pg.querySelector('#stCards'); if (tg) tg.onclick = () => { s.off = !s.off; save(); openStory(); };
  }
  function nameFor(id) {
    try { const o = CAREER_OPS.find(x => x.id === id); if (o) return o.name; } catch (e) {}
    return (D.DOSSIER[id] || {}).nick || id;
  }
  function listHTML(ids, seen) {
    const s = state(), f = friends(), nb = NEIGHBORS().length;
    const metN = ids.filter(seen).length;
    const rows = ids.map(id => {
      const m = mem(id), d = D.DOSSIER[id], ok = seen(id);
      if (!ok) {
        const unlocked = (() => { try { const idx = CAREER_OPS.findIndex(o => o.id === id); return idx >= 0 && idx <= prog().career; } catch (e) { return false; } })();
        if (!unlocked) return '';
        return `<button type="button" class="stp" data-sid="${E(id)}"><span class="stp-p">${por(id, 'neutral')}</span><span class="stp-t"><b>${E(nameFor(id))}</b><small>ещё не играли</small></span></button>`;
      }
      return `<button type="button" class="stp" data-sid="${E(id)}"><span class="stp-p">${por(id, m.rel >= 2 ? 'smug' : m.rel <= -2 ? 'angry' : 'neutral')}</span>
        <span class="stp-t"><b>${E(d.nick)}</b><span class="stp-r">${relBar(m.rel)}<em>${E(relLabel(m.rel))}</em></span><small>матчей ${m.met} · ты ${m.mw}:${m.ml}${m.last ? ' · последний ' + E(m.last) : ''}</small></span></button>`;
    }).join('');
    const rewards = `<div class="sov-rew"><span class="chip ${f >= 3 ? 'gold' : ''}">🤝 Друг двора: ${Math.min(f, 3)}/3 приятелей</span><span class="chip ${nb && f >= nb ? 'gold' : ''}">🏠 Свой в каждом дворе: ${f}/${nb}</span></div>
      <small class="small">Приятель — отношение +5. Оно растёт от упорных матчей и разных сюрпризов, и падает, если поймать шулера за руку.</small>`;
    return `${head('Знакомства')}
      <div class="sov-sum"><span class="chip">Знакомых: ${metN}</span><span class="chip gold">Приятелей: ${ids.filter(id => mem(id).rel >= 2).length}</span><span class="chip">Врагов: ${ids.filter(id => mem(id).rel <= -2).length}</span></div>
      ${rewards}
      <h3>Соперники</h3><div class="stlist">${rows || '<p class="small">Сыграй первый матч в карьере — и соперники начнут запоминать тебя.</p>'}</div>
      <button type="button" class="btn ghost sm" id="stCards">Карточки перед матчем: ${s.off ? 'выкл' : 'вкл'}</button>`;
  }
  function detailHTML(id) {
    const d = D.DOSSIER[id], m = mem(id);
    if (!d) return listHTML(allIds(), x => mem(x).met > 0);
    const emo = m.rel >= 2 ? 'smug' : m.rel <= -2 ? 'angry' : 'neutral';
    return `${head(E(d.nick))}
      <div class="sov-por big">${por(id, emo)}</div>
      <div class="sov-meta"><div class="sov-rel">${relBar(m.rel)}<b>${E(relLabel(m.rel))}</b></div>
        <small>${m.met ? `Матчей: ${m.met} · ты выиграл ${m.mw}, проиграл ${m.ml}${m.last ? ' · последний счёт ' + E(m.last) : ''}` : 'Ещё не играли'}</small></div>
      <p>${E(d.bio)}</p>
      <div class="sov-chips"><span class="chip">манера: ${E(lc(d.manner))}</span><span class="chip">не любит: ${E(lc(d.hates))}</span><span class="chip gold">слабость: ${E(lc(d.weak))}</span></div>
      ${m.met ? `<small class="small">Могнул его: ${m.mog} · поймал шулером: ${m.caught} · партий ${m.gw}:${m.gl}</small>` : ''}
      <button type="button" class="btn blue" id="stBack">◂ К списку</button>`;
  }

  /* ---------- подключение к игре ---------- */
  let bypass = false;
  const rewardCSS = () => {
    if (document.getElementById('storyBackCSS')) return;
    const st = document.createElement('style'); st.id = 'storyBackCSS';
    st.textContent = 'html[data-back="st-friend"]{--backbg:radial-gradient(circle at 50% 50%,#ffe9b0 0 11%,transparent 12%),repeating-linear-gradient(45deg,#8a5a2e 0 7px,#b57a3e 7px 14px)}' +
      'html[data-back="st-all"]{--backbg:radial-gradient(circle at 50% 50%,#fff3c4 0 13%,transparent 14%),repeating-conic-gradient(#c0392b 0 25%,#e6b04b 0 50%) 0 0/18px 18px}' +
      'html[data-back="st-champ"]{--backbg:radial-gradient(circle at 50% 50%,#fff 0 9%,#eab54b 10% 18%,transparent 19%),repeating-linear-gradient(135deg,#2a0e3a 0 6px,#5a1f7a 6px 12px)}';
    document.head.appendChild(st);
  };
  function wire() {
    try { [['st-friend', 'Друг двора'], ['st-all', 'Свой в каждом дворе'], ['st-champ', 'Король казино']].forEach(([id, name]) => { if (!BACKS.some(b => b.id === id)) BACKS.push({ id, name }); }); } catch (e) {}
    rewardCSS();

    /* вход в режим: сюжетная вставка района и карточка соперника перед матчем */
    BUS.hook('setMode', (next, args) => {
      const m = args[0];
      if (bypass || inNet() || !m || (m.kind !== 'career' && m.kind !== 'weekly') || state().off && m.kind !== 'career') return next();
      let id = null, dist = -1;
      try {
        if (m.kind === 'career') { const op = CAREER_OPS[m.stage]; id = op && op.id; dist = op ? op.district : -1; }
        else { const b = WEEKLY.BOSSES[m.rule] || WEEKLY.boss(); id = b && b.id; }
      } catch (e) {}
      if (!id || !known(id)) return next();
      const go = () => { bypass = true; try { next(); } finally { bypass = false; } };
      const afterIntro = () => { if (state().off) go(); else duelCard(id, go); };
      if (m.kind === 'career' && dist >= 0 && !state().intro[dist] && D.DISTRICTS[dist]) {
        state().intro[dist] = 1; save();
        scenes(D.DISTRICTS[dist].intro, `РАЙОН ${dist + 1} · ${D.DISTRICTS[dist].name.toUpperCase()}`, afterIntro, 'Начать');
        return;
      }
      afterIntro();
    });

    /* итог партии: запоминаем и подписываем реплику соперника под заголовком */
    const stats = () => { try { return { mog: G.stats.mognul.p | 0, caught: G.caught | 0 }; } catch (e) { return { mog: 0, caught: 0 }; } };
    function process() {
      if (!tracked() || typeof G === 'undefined' || !G || !G.over) return null;
      const id = botId(); if (!id) return null;
      if (G.storyRes === undefined) {
        const won = G.over === 'p', draw = G.over === 'draw', st = stats();
        let match = null, matchDone = false;
        if (!draw) recordGame(id, won, st);
        try {
          if (SERIES && SERIES.done && !draw) {
            const L = lim(), w = SERIES.w || { p: 0, b: 0 };
            matchDone = true;
            match = recordMatch(id, { won: w.p >= L, w: w.p, b: w.b, lim: L, mog: 0, caught: 0 });
          }
        } catch (e) { console.warn('[STORY]', e); }
        save();
        const m = mem(id);
        const sit = sitAfter({ draw, gameWon: won, matchDone, match, rel: m.rel });
        G.storyRes = { id, sit, line: sit ? pickLine(id, sit) : '', match, relUp: match && match.rel !== match.prevRel ? match.rel - match.prevRel : 0, matchDone };
        if (matchDone) checkRewards();
      }
      return G.storyRes;
    }
    BUS.on('game:over', () => { try { process(); } catch (e) { console.warn('[STORY]', e); } });
    BUS.on('over', () => {
      try {
        const r = process(); const o = document.getElementById('over');
        if (!r || !r.line || !o || o.hidden || o.querySelector('#leaveBtn') || !o.querySelector('.row')) return;
        let el = o.querySelector('.stline');
        const h = o.querySelector('h2');
        if (!el) { el = document.createElement('div'); el.className = 'stline'; if (h && h.parentNode === o) h.after(el); else o.insertBefore(el, o.querySelector('p') || o.firstChild); }
        const d = D.DOSSIER[r.id];
        const rel = r.relUp ? `<span class="stl-rel ${r.relUp > 0 ? 'up' : 'down'}">${r.relUp > 0 ? '▲ отношение растёт' : '▼ отношение падает'}</span>` : '';
        el.innerHTML = `<b>${E(d.nick)}:</b> <span>«${E(r.line)}»</span>${rel}`;
      } catch (e) { console.warn('[STORY]', e); }
    });

    /* победа над боссом района — сюжетная вставка, после Шулера — финал */
    BUS.on('match:over', d => {
      try {
        if (!d.won || modeKind() !== 'career' || inNet()) return;
        const b = d.bot; if (!b || !b.boss) return;
        const dist = b.district, s = state();
        if (s.cut[dist]) return;
        s.cut[dist] = 1; save();
        const dd = D.DISTRICTS[dist];
        const tag = `РАЙОН ${dist + 1} · ${dd.name.toUpperCase()} ПРОЙДЕН`;
        setTimeout(() => {
          const fin = () => { if (dist === D.DISTRICTS.length - 1) {
            try { if (unlock('back', 'st-champ')) toast('👑 Путь пройден — открыта рубашка'); } catch (e) {}
            scenes(D.FINALE, 'ФИНАЛ · С ПОДЪЕЗДА В КАЗИНО', null, 'Конец главы');
          } };
          if (dd.outro && dd.outro.length) scenes(dd.outro, tag, fin, 'Дальше'); else fin();
        }, noMotion() ? 200 : 900);
      } catch (e) { console.warn('[STORY]', e); }
    });

    /* рогалик: короткая реплика босса на старте боя */
    BUS.on('game:start', () => {
      try {
        if (modeKind() !== 'rogue' || inNet()) return;
        const b = currentBot(); if (!b || !known(b.id)) return;
        const line = pickLine(b.id, 'quip');
        if (line) setTimeout(() => { try { say(line); } catch (e) {} }, 700);
      } catch (e) {}
    });

    /* плитка «Знакомства» в меню (лобби подхватит её в «Ещё») */
    BUS.on('menu:open', () => {
      try {
        const g = document.querySelector('#menuIn .menugrid');
        if (!g || g.querySelector('[data-go="story"]')) return;
        const f = friends(), n = allIds().filter(id => mem(id).met > 0).length;
        const bt = document.createElement('button');
        bt.type = 'button'; bt.className = 'mi'; bt.dataset.go = 'story';
        bt.innerHTML = `<b>🤝 Знакомства</b><small>${n ? `знакомых ${n} · приятелей ${f}` : 'соперники запоминают тебя'}</small>`;
        g.appendChild(bt);
      } catch (e) {}
    });
    BUS.menuKey('story', () => { try { openStory(); } catch (e) { console.error(e); } });
  }
  if (typeof document !== 'undefined' && typeof BUS !== 'undefined' && typeof window !== 'undefined') {
    try { wire(); } catch (e) { console.error('[STORY]', e); }
  }

  return { state, mem, save, relLabel, relTier, relDelta, recordGame, recordMatch, pickLine, sitBefore, sitAfter, friends, checkRewards, pool, sub,
    open: openStory, duelCard, scenes, _reset: () => { S = null; Object.keys(recent).forEach(k => delete recent[k]); } };
})();
if (typeof module !== 'undefined') module.exports = STORY;
