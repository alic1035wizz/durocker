/* ДурКер — боевой пропуск сезона (бесплатный). Сезон — календарный месяц по Москве, как в js/weekly.js.
   30 уровней, опыт за партии, победы, «могнул», поимку шулера, дейли, босса недели, онлайн.
   В новом месяце уровень с нуля, полученные награды остаются навсегда.
   Встраивается обёртками глобальных функций: onGameOver, showOver, showHype, openMenu, menuGo, openCollection. */
'use strict';

const PASS = (() => {
  const MSK = 3 * 3600e3, KEY = 'durocker-pass';
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_N = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const monthKey = (now = Date.now()) => new Date(now + MSK).toISOString().slice(0, 7);
  const monthEnd = k => { const y = +k.slice(0, 4), m = +k.slice(5, 7); return Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) - MSK; };
  const ls = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const e_ = s => (typeof esc === 'function' ? esc(s) : String(s));

  /* ---------- опыт ---------- */
  const XP = { game: 10, win: 15, match: 25, mognul: 5, caught: 10, daily: 20, weekly: 40, online: 10 };
  /* стоимость уровня: 200 XP в начале → 360 XP в конце, всего ≈8400 XP.
     Партия с соперником среднего уровня даёт ≈25–30 XP, а за ботов в день — не больше 400 XP:
     активный игрок (~15 партий в день) закрывает 30 уровней примерно за 3 недели */
  const cost = L => Math.round((200 + 160 * (L - 1) / 29) / 5) * 5;
  /* множитель за силу соперника и дневной потолок за ботов */
  const BOT_CAP = 400;
  function oppMult() {
    try {
      if (typeof NET !== 'undefined' && NET) return 1.5;
      if (MODE && MODE.kind === 'weekly') return 2;
      const b = currentBot();
      if (b.boss) return 2;
      if (b.ai === 'student') return 0.5;
      if (b.ai === 'sharper') return 1.5;
    } catch (e) {}
    return 1;
  }
  /* опыт от ботов (своя игра, карьера, компания с ботами) упирается в потолок; онлайн, дейли и неделя — нет */
  const capped = () => !(typeof NET !== 'undefined' && NET) && !(MODE && (MODE.kind === 'daily' || MODE.kind === 'weekly'));
  const mskDay = () => new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  function capLeft() {
    let d; try { d = JSON.parse(localStorage.getItem('durocker-pass-day')); } catch (e) {}
    if (!d || d.d !== mskDay()) d = { d: mskDay(), xp: 0 };
    return { d, left: Math.max(0, BOT_CAP - d.xp) };
  }
  function capUse(n) {
    const c = capLeft(); c.d.xp += n;
    try { localStorage.setItem('durocker-pass-day', JSON.stringify(c.d)); } catch (e) {}
  }
  const TOTAL = Array.from({ length: 30 }, (_, i) => cost(i + 1)).reduce((a, b) => a + b, 0);

  /* ---------- награды ---------- */
  const BACKS_P = [
    { id: 'p-chess', name: 'Шахматка', css: 'repeating-conic-gradient(#f8f1df 0 25%,#1f2b26 0 50%) 0 0/10px 10px' },
    { id: 'p-ripple', name: 'Рябь', css: 'repeating-radial-gradient(circle at 50% 50%,#2c7fe0 0 3px,#163f73 3px 6px)' },
    { id: 'p-rhomb', name: 'Ромбы', css: 'linear-gradient(45deg,#d9362f 25%,transparent 25% 75%,#d9362f 75%) 0 0/12px 12px,linear-gradient(-45deg,#d9362f 25%,transparent 25% 75%,#d9362f 75%) 0 0/12px 12px,#f3d9a8' },
    { id: 'p-carpet', name: 'Ковёр', css: 'radial-gradient(circle at 50% 50%,#e8b33c 0 3px,transparent 4px) 0 0/14px 14px,repeating-linear-gradient(45deg,#7a1424 0 4px,#a3243a 4px 8px),#5a0f1b' },
    { id: 'p-stars', name: 'Звёзды', css: 'radial-gradient(circle at 20% 30%,#fff 0 1px,transparent 2px) 0 0/11px 13px,radial-gradient(circle at 70% 60%,#ffe9a6 0 1.5px,transparent 2.5px) 0 0/17px 15px,linear-gradient(160deg,#0b1030,#25124a)' },
    { id: 'p-retro', name: 'Ретро-волна', css: 'repeating-linear-gradient(0deg,#ff3df2 0 2px,transparent 2px 9px),linear-gradient(180deg,#ff8a3d,#c7246e 55%,#2a0f4a)' },
    { id: 'p-holo', name: 'Голограмма', css: 'linear-gradient(120deg,#9df 0%,#c9f 25%,#fc9 50%,#9fc 75%,#9df 100%) 0 0/200% 200%' },
  ];
  const TABLES_P = [
    { id: 'p-podezd', name: 'Подъезд', felt: 'radial-gradient(ellipse at 50% 40%,#5f7a6b 0%,#3f5248 60%,#25312a 100%)', border: '#8a9a7a', print: '#d8e3c5', prev: 'linear-gradient(135deg,#5f7a6b,#25312a)' },
    { id: 'p-wagon', name: 'Вагон-ресторан', felt: 'radial-gradient(ellipse at 50% 40%,#7a2a2a 0%,#521a1a 60%,#2e0d0d 100%)', border: '#c9a24a', print: '#f0d9a0', prev: 'linear-gradient(135deg,#7a2a2a,#2e0d0d)' },
    { id: 'p-roof', name: 'Крыша ночью', felt: 'radial-gradient(ellipse at 50% 30%,#1d3150 0%,#111d33 60%,#070c18 100%)', border: '#5c7bb0', print: '#9ec3ff', prev: 'linear-gradient(135deg,#1d3150,#070c18)' },
  ];
  const FRAMES = [
    { id: 'spark', name: 'Искры' }, { id: 'flame', name: 'Пламя' }, { id: 'neon', name: 'Неон' }, { id: 'crown', name: 'Корона' },
  ];
  const TITLES = {
    t1: 'Дворовый', t6: 'Картёжник', t11: 'Гроза двора', t15: 'Шулер на минималках', t19: 'Король подкидного',
    t23: 'Могильщик', t24: 'Легенда района', t26: 'Барон', t27: 'Без пяти минут чемпион', t29: 'ДурКер месяца',
  };
  const seasonBack = k => ({ id: 'ps-' + k, name: `Сезон: ${MONTHS_N[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}` });

  /* 30 уровней: [вид, id] */
  function levels(k) {
    const sb = seasonBack(k);
    return [
      ['title', 't1'], ['back', 'p-chess'], ['mog', 'pacan'], ['frame', 'spark'], ['back', 'p-ripple'],
      ['title', 't6'], ['table', 'p-podezd'], ['back', 'p-rhomb'], ['frame', 'flame'], ['mog', 'intel'],
      ['title', 't11'], ['back', 'p-carpet'], ['table', 'p-wagon'], ['frame', 'neon'], ['title', 't15'],
      ['back', 'p-stars'], ['mog', 'kosmos'], ['table', 'p-roof'], ['title', 't19'], ['back', 'p-retro'],
      ['frame', 'crown'], ['mog', 'strim'], ['title', 't23'], ['title', 't24'], ['back', 'p-holo'],
      ['title', 't26'], ['title', 't27'], ['track', 'night'], ['title', 't29'], ['back', sb.id],
    ];
  }
  const KIND = { back: 'Рубашка', table: 'Стол', frame: 'Рамка аватара', mog: 'Фраза «могнул»', title: 'Титул', track: 'Музыка' };
  const ICON = { back: '🂠', table: '🟩', frame: '✨', mog: '💬', title: '🏷', track: '🎵' };
  function rewardName(kind, id) {
    if (kind === 'back') return ([...BACKS_P, seasonBack(state().k)].find(b => b.id === id) || { name: id }).name;
    if (kind === 'table') return (TABLES_P.find(t => t.id === id) || { name: id }).name;
    if (kind === 'frame') return (FRAMES.find(f => f.id === id) || { name: id }).name;
    if (kind === 'mog') { const m = (typeof MOGNUL_SETS !== 'undefined' ? MOGNUL_SETS : []).find(x => x.id === id); return m ? m.name : id; }
    if (kind === 'title') return TITLES[id] || id;
    if (kind === 'track') { const t = (typeof TRACKS !== 'undefined' ? TRACKS : []).find(x => x.id === id); return t ? t.name : id; }
    return id;
  }

  /* ---------- состояние ---------- */
  function state() {
    const k = monthKey();
    let s = ls(KEY);
    if (!s || typeof s !== 'object' || s.k !== k) {
      s = { k, xp: 0, lvl: 0, hist: s && s.k && s.k !== k ? { k: s.k, lvl: s.lvl || 0 } : (s && s.hist) || null };
      wr(KEY, JSON.stringify(s));
    }
    if (typeof s.xp !== 'number' || !(s.xp >= 0)) s.xp = 0;
    return s;
  }
  const save = s => wr(KEY, JSON.stringify(s));
  function levelOf(xp) {
    let L = 0, need = 0;
    while (L < 30 && xp >= need + cost(L + 1)) { need += cost(L + 1); L++; }
    return { L, into: xp - need, next: L < 30 ? cost(L + 1) : 0 };
  }

  /* ---------- внешний вид наград ---------- */
  function looks() {
    try {
      BACKS_P.forEach(b => { if (!BACKS.some(x => x.id === b.id)) BACKS.push({ id: b.id, name: b.name }); });
      const sb = seasonBack(state().k);
      if (!BACKS.some(x => x.id === sb.id)) BACKS.push({ id: sb.id, name: sb.name });
      /* сезонные рубашки прошлых месяцев, которые уже есть у игрока, тоже в списке */
      (prog().unlocked.back || []).filter(id => id.startsWith('ps-')).forEach(id => {
        if (!BACKS.some(x => x.id === id)) BACKS.push(seasonBack(id.slice(3)));
      });
      if (typeof VFX !== 'undefined' && VFX.SKINS) TABLES_P.forEach(t => { if (!VFX.SKINS.some(x => x.id === t.id)) VFX.SKINS.push({ id: t.id, name: t.name }); });
    } catch (e) {}
    if (document.getElementById('passcss')) return;
    const st = document.createElement('style');
    st.id = 'passcss';
    st.textContent = BACKS_P.map(b => `html[data-back="${b.id}"]{--backbg:${b.css}}`).join('\n') + '\n'
      + TABLES_P.map(t => `html[data-skin="${t.id}"] .felt{background:${t.felt};border-color:${t.border}}
html[data-skin="${t.id}"] .felt::before{border-color:${t.border}66}
html[data-skin="${t.id}"] .print text{fill:${t.print}}
.sk-${t.id} i{background:${t.prev};box-shadow:inset 0 0 0 2px ${t.border}}`).join('\n') + `
/* рубашка сезона — анимированная; оттенок свой у каждого месяца */
html[data-back^="ps-"]{--backbg:radial-gradient(circle at 50% 50%,#fff6c9 0 14%,transparent 15%),repeating-linear-gradient(115deg,hsl(var(--psh,45) 90% 55%) 0 6px,hsl(var(--psh,45) 80% 30%) 6px 12px,hsl(calc(var(--psh,45) + 40) 90% 60%) 12px 18px) 0 0/200% 200%}
html[data-back^="ps-"] .back,html[data-back^="ps-"] .deck .stack,html[data-back^="ps-"] .grave i,.ci i.psprev,.pass-cell .psprev{animation:psmove 4s linear infinite}
html[data-back="p-holo"] .back,html[data-back="p-holo"] .deck .stack,html[data-back="p-holo"] .grave i{animation:psmove 6s linear infinite}
@keyframes psmove{from{background-position:0 0}to{background-position:200% 200%}}
@media (prefers-reduced-motion:reduce){html[data-back^="ps-"] .back,html[data-back^="ps-"] .deck .stack,html[data-back="p-holo"] .back,.ci i.psprev,.pass-cell .psprev{animation:none}}
/* аватар игрока с рамкой */
.pava{position:relative;width:42px;height:42px;border-radius:50%;flex:none;display:inline-flex;align-items:center;justify-content:center;font-family:var(--f-hard,monospace);font-size:12px;color:#3a2306;background:var(--gold,#eab54b);box-shadow:0 3px 0 rgba(0,0,0,.4)}
.pava.sm{width:28px;height:28px;font-size:9px}
.pava.fr-spark::after,.pava.fr-flame::after,.pava.fr-neon::after,.pava.fr-crown::after{content:'';position:absolute;inset:-5px;border-radius:50%;pointer-events:none}
.pava.fr-spark::after{border:3px dotted #fff4c2;animation:pspin 3s linear infinite}
.pava.fr-flame::after{background:conic-gradient(#ff3d00,#ffb347,#ff3d00,#ffd166,#ff3d00);-webkit-mask:radial-gradient(circle,transparent 58%,#000 60%);mask:radial-gradient(circle,transparent 58%,#000 60%);animation:pspin 1.6s linear infinite}
.pava.fr-neon::after{border:3px solid #3ddcff;box-shadow:0 0 8px #3ddcff,0 0 14px #ff3df2,inset 0 0 6px #ff3df2;animation:pglow 1.4s ease-in-out infinite alternate}
.pava.fr-crown::after{border:3px solid #eab54b;box-shadow:0 0 10px #eab54b}
.pava.fr-crown::before{content:'👑';position:absolute;top:-17px;left:50%;transform:translateX(-50%);font-size:16px;animation:pbob 1.8s ease-in-out infinite}
.pava.sm.fr-crown::before{font-size:11px;top:-12px}
@keyframes pspin{to{transform:rotate(360deg)}}
@keyframes pglow{from{opacity:.6}to{opacity:1}}
@keyframes pbob{50%{transform:translateX(-50%) translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.pava::after,.pava::before{animation:none!important}}
.pbadge{display:flex;align-items:center;gap:10px;justify-content:center;margin:0 auto 8px;max-width:100%}
.pbadge .pn{display:flex;flex-direction:column;align-items:flex-start;min-width:0;text-align:left}
.pbadge b{font-size:15px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pbadge small,.ptitle{font-size:11px;color:var(--gold,#eab54b);font-weight:800;letter-spacing:.02em}
.lbrow .pava{margin-right:6px;vertical-align:middle}
.lbrow .nm.pdeco{display:flex;align-items:center}
.lbrow .nm.pdeco>span{min-width:0;overflow:hidden;text-overflow:ellipsis}
/* лист пропуска */
.pass-top{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:center;background:rgba(0,0,0,.3);border-radius:12px;padding:12px}
.pass-lv{width:64px;height:64px;border-radius:14px;background:var(--gold,#eab54b);color:#3a2306;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:var(--f-hard,monospace);box-shadow:0 4px 0 rgba(0,0,0,.4)}
.pass-lv b{font-size:20px;line-height:1.2}.pass-lv span{font-size:8px}
.pass-bar{height:14px;border-radius:7px;background:rgba(0,0,0,.45);overflow:hidden;margin:6px 0 4px;border:1px solid var(--line,rgba(255,255,255,.15))}
.pass-bar i{display:block;height:100%;background:linear-gradient(90deg,#eab54b,#ffd166);border-radius:7px;transition:width .6s}
.pass-meta{font-size:12px;opacity:.85;display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.pass-strip{display:flex;gap:8px;overflow-x:auto;padding:6px 2px 10px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;max-width:100%}
.pass-cell{flex:none;width:84px;scroll-snap-align:center;background:rgba(0,0,0,.3);border:2px solid var(--line,rgba(255,255,255,.15));border-radius:10px;padding:6px 4px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;position:relative}
.pass-cell .n{font-family:var(--f-hard,monospace);font-size:10px;color:var(--gold,#eab54b)}
.pass-cell .ic{width:40px;height:52px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;background:rgba(255,255,255,.06);border:2px solid rgba(255,255,255,.15)}
.pass-cell .ic.bk{border-color:#f8f1df}
.pass-cell .nm{font-size:11px;font-weight:700;line-height:1.2;min-height:26px}
.pass-cell .kd{font-size:9px;opacity:.65;text-transform:uppercase;letter-spacing:.04em}
.pass-cell.got{border-color:rgba(98,201,138,.7)}
.pass-cell.got::after{content:'✓';position:absolute;top:3px;right:6px;color:#62c98a;font-weight:900;font-size:13px}
.pass-cell.cur{border-color:var(--gold,#eab54b);box-shadow:0 0 0 2px rgba(234,181,75,.35)}
.pass-cell.lock{opacity:.5}
.pass-cell.lock .ic{filter:grayscale(.8) brightness(.7)}
.pass-cell.top{background:linear-gradient(160deg,rgba(234,181,75,.25),rgba(0,0,0,.35))}
.pass-how{display:grid;grid-template-columns:1fr auto;gap:4px 10px;font-size:13px;background:rgba(0,0,0,.25);border-radius:10px;padding:10px 12px}
.pass-how b{color:var(--gold,#eab54b);font-family:var(--f-hard,monospace);font-size:11px;text-align:right}
.pass-note{font-size:12px;opacity:.7;text-align:center;margin:0}
.mi.pass b{color:var(--gold,#eab54b)}
/* всплывашка опыта и окно нового уровня */
.pxp{position:fixed;left:50%;bottom:calc(140px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:80;background:#1b2a23;border:2px solid var(--gold,#eab54b);color:#ffe9a6;font-family:var(--f-hard,monospace);font-size:12px;padding:8px 12px;border-radius:10px;box-shadow:0 4px 0 rgba(0,0,0,.45);pointer-events:none;white-space:nowrap;animation:pxpin 2.6s ease forwards}
.pxp small{display:block;font-family:inherit;font-size:9px;color:#cfd8cc;margin-top:3px}
@keyframes pxpin{0%{opacity:0;transform:translate(-50%,16px)}12%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-10px)}}
.plvl{position:fixed;inset:0;z-index:90;display:flex;align-items:center;justify-content:center;background:rgba(3,10,7,.72);padding:16px}
.plvl .box{width:min(360px,100%);background:radial-gradient(ellipse at 50% 0%,#2d5a45,#12251c 70%);border:3px solid var(--gold,#eab54b);border-radius:16px;padding:18px 16px;text-align:center;box-shadow:0 8px 0 rgba(0,0,0,.5);animation:plvlin .55s cubic-bezier(.2,1.6,.4,1)}
.plvl h2{margin:0;font-family:var(--f-hard,monospace);font-size:22px;color:#ffe14a;-webkit-text-stroke:1px #000;paint-order:stroke fill;text-shadow:3px 3px 0 #b3202a;line-height:1.4}
.plvl .rw{display:flex;align-items:center;gap:12px;justify-content:center;margin:14px 0;text-align:left}
.plvl .rw .ic{width:52px;height:70px;border-radius:8px;border:3px solid #f8f1df;display:flex;align-items:center;justify-content:center;font-size:28px;background:rgba(255,255,255,.08);flex:none}
.plvl .rw b{display:block;font-size:17px}.plvl .rw small{font-size:12px;opacity:.75}
.plvl .btns{display:flex;gap:8px;justify-content:center}
.plvl button{border:none;border-radius:10px;padding:12px 16px;font-weight:900;font-size:15px;color:#fff;box-shadow:0 4px 0 rgba(0,0,0,.45)}
.plvl .wear{background:var(--green,#2e9d5b)}.plvl .ok{background:var(--grey,#5b6d68)}
@keyframes plvlin{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.plvl .box,.pxp{animation:none}}
.pcoll{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px}
.pcoll button{display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(0,0,0,.3);border:2px solid var(--line,rgba(255,255,255,.15));border-radius:10px;padding:10px 4px 8px;font-size:12px;font-weight:700;color:inherit;text-align:center;min-width:0}
.pcoll button.on{border-color:var(--gold,#eab54b)}
.pcoll button:disabled{opacity:.35}
.pcoll .ph{font-size:11px;font-weight:600;opacity:.8;line-height:1.25;word-break:break-word}
`;
    document.head.appendChild(st);
    seasonHue();
  }
  /* оттенок рубашки сезона по месяцу */
  function seasonHue() {
    const id = (prog().back || '');
    if (!id.startsWith('ps-')) return;
    const m = +id.slice(8, 10) || 10;
    document.documentElement.style.setProperty('--psh', String((m * 37 + 10) % 360));
  }

  /* ---------- аватар ---------- */
  function initials(n) {
    const w = String(n || 'Игрок').trim().split(/\s+/);
    return (w.length > 1 ? w[0][0] + w[1][0] : w[0].slice(0, 2)).toUpperCase();
  }
  function avaHTML(sm) {
    const p = prog(), fr = p.frame && (p.unlocked.frame || []).includes(p.frame) ? ' fr-' + p.frame : '';
    return `<span class="pava${sm ? ' sm' : ''}${fr}" aria-hidden="true">${e_(initials(myNick()))}</span>`;
  }
  const myTitle = () => { const p = prog(); return p.title && (p.unlocked.title || []).includes(p.title) ? TITLES[p.title] || '' : ''; };

  /* ---------- начисление ---------- */
  let pend = { xp: 0, why: [] };
  function add(n, why, raw) {
    if (!n) return;
    if (typeof MODE !== 'undefined' && MODE && MODE.kind === 'tutorial') return;
    if (!raw) n = Math.round(n * oppMult());
    if (capped()) {
      const c = capLeft();
      if (c.left <= 0) { pend.cap = true; return; }
      n = Math.min(n, c.left); capUse(n);
    }
    if (n <= 0) return;
    const s = state(), before = levelOf(s.xp).L;
    s.xp += n;
    const after = levelOf(s.xp).L;
    const got = [];
    const lv = levels(s.k);
    for (let L = Math.max(before, s.lvl || 0) + 1; L <= after; L++) {
      const [kind, id] = lv[L - 1];
      try { unlock(kind, id); } catch (e) {}
      got.push({ L, kind, id });
    }
    if (after > (s.lvl || 0)) s.lvl = after;
    save(s);
    pend.xp += n; if (why) pend.why.push(why);
    if (got.length) setTimeout(() => levelUp(got), 900);
    return got;
  }
  /* итог партии: одна всплывашка «+35 XP» */
  function flush() {
    if (!pend.xp) {
      if (pend.cap) { pend.cap = false; try { toast('🎟 Дневной лимит опыта за ботов — 400 XP. Онлайн, дейли и босс недели — без лимита'); } catch (e) {} }
      return;
    }
    const n = pend.xp, why = pend.why.slice(0, 4).join(' · ');
    pend = { xp: 0, why: [] };
    const s = state(), lv = levelOf(s.xp);
    const el = document.createElement('div');
    el.className = 'pxp';
    el.innerHTML = `🎟 +${n} XP<small>${e_(why)}${why ? ' · ' : ''}ур. ${lv.L}${lv.L < 30 ? ` · ${lv.into}/${lv.next}` : ' · максимум'}</small>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2700);
  }
  function gameXP(won, matchWon, extra) {
    let n = XP.game; const why = [];
    if (won) { n += XP.win; why.push('победа'); }
    if (matchWon) { n += XP.match; why.push('матч'); }
    if (extra) { n += extra.n; why.push(extra.why); }
    add(n, why.join(' + ') || 'партия');
    setTimeout(flush, 600);
  }
  const isOnline = () => typeof NET !== 'undefined' && !!NET;
  function modeExtra(won) {
    const k = typeof MODE !== 'undefined' && MODE ? MODE.kind : '';
    if (isOnline()) return { n: XP.online, why: NET.quick ? 'быстрая игра' : 'онлайн' };
    if (k === 'daily') return { n: XP.daily, why: 'дейли' };
    if (k === 'weekly') return won ? { n: XP.weekly, why: 'босс недели' } : { n: 10, why: 'бой с боссом' };
    return null;
  }
  /* бонус «матч» — только за настоящий матч (до 2 или 3 побед); одна партия — не матч */
  function matchWonNow() {
    try { return !!(SERIES && SERIES.done && SERIES.w && SERIES.w.p >= seriesTo() && seriesTo() >= 2); } catch (e) { return false; }
  }

  /* ---------- окно нового уровня ---------- */
  let queue = [];
  function levelUp(got) {
    queue.push(...got);
    if (document.querySelector('.plvl')) return;
    showNext();
  }
  function cellIcon(kind, id, big) {
    if (kind === 'back') {
      const st = id.startsWith('ps-') ? '' : `style="background:${(BACKS_P.find(b => b.id === id) || {}).css || 'var(--backbg)'}"`;
      return `<div class="ic bk ${id.startsWith('ps-') ? 'psprev' : ''}" ${st} data-psback="${id.startsWith('ps-') ? id : ''}"></div>`;
    }
    if (kind === 'table') { const t = TABLES_P.find(x => x.id === id); return `<div class="ic" style="background:${t ? t.prev : '#234'}"></div>`; }
    if (kind === 'frame') return `<div class="ic" style="border:none;background:none">${`<span class="pava${big ? '' : ' sm'} fr-${id}">${e_(initials(myNick()))}</span>`}</div>`;
    return `<div class="ic">${ICON[kind] || '🎁'}</div>`;
  }
  function paintSeasonPrev(root) {
    root.querySelectorAll('[data-psback]').forEach(el => {
      const id = el.dataset.psback; if (!id) return;
      const prev = document.documentElement.dataset.back;
      document.documentElement.dataset.back = id;
      el.style.background = getComputedStyle(document.documentElement).getPropertyValue('--backbg');
      document.documentElement.dataset.back = prev;
    });
  }
  function showNext() {
    const g = queue.shift();
    if (!g) return;
    const el = document.createElement('div');
    el.className = 'plvl';
    const name = rewardName(g.kind, g.id), canWear = g.kind !== 'track' || true;
    el.innerHTML = `<div class="box" role="dialog" aria-label="Новый уровень пропуска">
      <h2>УРОВЕНЬ ${g.L}!</h2>
      <div class="rw">${cellIcon(g.kind, g.id, true)}<div><small>${KIND[g.kind] || 'Награда'}</small><b>${e_(name)}</b>${g.kind === 'mog' ? `<small>«${e_(mogText(g.id))}»</small>` : ''}</div></div>
      <div class="btns">${canWear ? '<button type="button" class="wear">Надеть</button>' : ''}<button type="button" class="ok">${queue.length ? 'Дальше' : 'Круто'}</button></div></div>`;
    document.body.appendChild(el);
    paintSeasonPrev(el);
    try { AU.play('win'); } catch (e) {}
    try { VFX.confetti(); } catch (e) {}
    const done = () => { el.remove(); if (queue.length) setTimeout(showNext, 200); };
    el.querySelector('.ok').onclick = done;
    const w = el.querySelector('.wear'); if (w) w.onclick = () => { wear(g.kind, g.id); done(); };
  }
  function mogText(id) {
    const m = (typeof MOGNUL_SETS !== 'undefined' ? MOGNUL_SETS : []).find(x => x.id === id);
    return m ? (typeof rudeOn === 'function' && rudeOn() ? m.rude : m.clean) : '';
  }
  function wear(kind, id) {
    const p = prog();
    if (!(p.unlocked[kind] || []).includes(id)) return;
    if (kind === 'back') p.back = id;
    else if (kind === 'track') p.track = id;
    else if (kind === 'table') { try { VFX.skin(id); } catch (e) {} }
    else if (kind === 'frame') p.frame = id;
    else if (kind === 'title') p.title = id;
    else if (kind === 'mog') p.mog = id;
    saveProg();
    try { applyLooks(); } catch (e) {}
    seasonHue();
    try { toast(`Надето: ${rewardName(kind, id)}`); } catch (e) {}
  }

  /* ---------- лист пропуска ---------- */
  function left(ms) {
    if (ms <= 0) return 'вот-вот';
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
    return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m} мин`;
  }
  let tick = null;
  function open() {
    looks();
    const s = state(), lv = levelOf(s.xp), list = levels(s.k), mName = MONTHS_N[+s.k.slice(5, 7) - 1];
    const cells = list.map(([kind, id], i) => {
      const L = i + 1, cls = L <= lv.L ? 'got' : L === lv.L + 1 ? 'cur' : 'lock';
      return `<div class="pass-cell ${cls}${L === 30 ? ' top' : ''}"><span class="n">${L}</span>${cellIcon(kind, id)}<span class="nm">${e_(rewardName(kind, id))}</span><span class="kd">${KIND[kind]}</span></div>`;
    }).join('');
    const pct = lv.L >= 30 ? 100 : Math.round(100 * lv.into / lv.next);
    sheet('page', `${head('Пропуск сезона 🎟')}
      <div class="pass-top"><div class="pass-lv"><b>${lv.L}</b><span>УРОВЕНЬ</span></div>
        <div><b>Сезон: ${mName}</b>
          <div class="pass-bar"><i style="width:${pct}%"></i></div>
          <div class="pass-meta"><span>${lv.L >= 30 ? 'Все 30 уровней!' : `${lv.into} / ${lv.next} XP до ур. ${lv.L + 1}`}</span><span id="passLeft">до конца сезона: ${left(monthEnd(s.k) - Date.now())}</span></div></div></div>
      <div class="pass-strip" id="passStrip">${cells}</div>
      <h3>Как получать опыт</h3>
      <div class="pass-how">
        <span>Сыграть партию (и в компании)</span><b>+${XP.game}</b>
        <span>Победить в партии</span><b>+${XP.win}</b>
        <span>Выиграть матч</span><b>+${XP.match}</b>
        <span>«Могнул»</span><b>+${XP.mognul}</b>
        <span>Поймать шулера</span><b>+${XP.caught}</b>
        <span>Ежедневная раздача</span><b>+${XP.daily}</b>
        <span>Победить босса недели</span><b>+${XP.weekly}</b>
        <span>Онлайн и быстрая игра</span><b>+${XP.online}</b>
        <span>Сила соперника</span><b>Студент ×0.5 · Валера ×1 · Шулер ×1.5 · боссы ×2 · онлайн ×1.5</b>
        <span>Лимит за ботов</span><b>${BOT_CAP} XP в день (сегодня осталось ${capLeft().left})</b>
      </div>
      <p class="pass-note">Пропуск бесплатный. В новом месяце уровень начинается с нуля, всё полученное остаётся навсегда — надевай в «Коллекции». На 30 уровне — анимированная рубашка этого сезона, в другом месяце её уже не получить.${s.hist ? ` Прошлый сезон: ${s.hist.lvl} ур.` : ''}</p>`);
    paintSeasonPrev($('pageIn'));
    const strip = $('passStrip'), cur = strip && strip.querySelector('.cur, .got:last-of-type');
    if (cur && strip) strip.scrollLeft = Math.max(0, cur.offsetLeft - strip.clientWidth / 2 + cur.clientWidth / 2);
    clearInterval(tick);
    tick = setInterval(() => { const el = $('passLeft'); if (!el || $('page').hidden) { clearInterval(tick); return; } el.textContent = 'до конца сезона: ' + left(monthEnd(state().k) - Date.now()); }, 30000);
  }

  /* ---------- коллекция: рамки, титулы, фразы ---------- */
  function collExtra() {
    const p = prog(), u = p.unlocked;
    const frames = [{ id: '', name: 'Без рамки' }, ...FRAMES].map(f => {
      const has = !f.id || (u.frame || []).includes(f.id);
      return `<button type="button" class="${p.frame === f.id ? 'on' : ''}" data-pfr="${f.id}" ${has ? '' : 'disabled'}><span class="pava sm${f.id ? ' fr-' + f.id : ''}">${e_(initials(myNick()))}</span>${has ? f.name : '???'}</button>`;
    }).join('');
    const titles = [['', 'Без титула'], ...Object.entries(TITLES)].map(([id, n]) => {
      const has = !id || (u.title || []).includes(id);
      return `<button type="button" class="${p.title === id ? 'on' : ''}" data-pti="${id}" ${has ? '' : 'disabled'}>${has ? e_(n) : '???'}</button>`;
    }).join('');
    const mogs = (typeof MOGNUL_SETS !== 'undefined' ? MOGNUL_SETS : []).map(m => {
      const has = (u.mog || []).includes(m.id);
      return `<button type="button" class="${p.mog === m.id ? 'on' : ''}" data-pmg="${m.id}" ${has ? '' : 'disabled'}>${has ? e_(m.name) : '???'}${has ? `<span class="ph">«${e_(mogText(m.id))}»</span>` : ''}</button>`;
    }).join('');
    return `<h3>Рамки аватара</h3><div class="pcoll">${frames}</div>
      <h3>Титул</h3><div class="pcoll">${titles}</div>
      <h3>Фраза «могнул»</h3><div class="pcoll">${mogs}</div>
      <p class="pass-note">Новые рубашки, столы, рамки, титулы и фразы — в пропуске сезона 🎟</p>`;
  }
  function onCollClick(e) {
    const t = e.target.closest('button[data-pfr],button[data-pti],button[data-pmg]');
    if (!t || t.disabled) return;
    const p = prog();
    if (t.dataset.pfr !== undefined) p.frame = t.dataset.pfr;
    else if (t.dataset.pti !== undefined) p.title = t.dataset.pti;
    else if (t.dataset.pmg !== undefined) p.mog = t.dataset.pmg;
    saveProg();
    try { applyLooks(); } catch (e2) {}
    try { openCollection(); } catch (e2) {}
  }

  /* ---------- значок игрока на экране итога и в таблице лидеров ---------- */
  function badge() {
    const o = $('over');
    if (!o || o.hidden || o.querySelector('.pbadge')) return;
    const t = myTitle();
    o.insertAdjacentHTML('afterbegin', `<div class="pbadge">${avaHTML(false)}<div class="pn"><b>${e_(myNick())}</b>${t ? `<small>${e_(t)}</small>` : ''}</div></div>`);
  }
  function decorateLeaders(root) {
    root.querySelectorAll('.lbrow.me .nm:not(.pdeco)').forEach(nm => {
      nm.classList.add('pdeco');
      const t = myTitle();
      nm.innerHTML = `${avaHTML(true)}<span>${nm.innerHTML}${t && !nm.querySelector('small') ? `<small>${e_(t)}</small>` : ''}</span>`;
    });
  }

  /* ---------- встраивание ---------- */
  let guestSeen = '';
  function hook() {
    looks();
    if (typeof showHype === 'function') {
      const _sh = showHype;
      showHype = function (key, mine) {
        try {
          if (mine && key === 'mognul') add(XP.mognul, 'могнул');
          if (mine && key === 'caught') add(XP.caught, 'шулер пойман');
        } catch (e) {}
        return _sh.apply(this, arguments);
      };
    }
    /* хозяин и игра с ботом */
    if (typeof onGameOver === 'function') {
      const _go = onGameOver;
      onGameOver = function () {
        const r = _go.apply(this, arguments);
        try {
          if (G && G.over && !(isOnline() && NET.role === 'guest') && MODE.kind !== 'tutorial') {
            const won = G.over === 'p';
            gameXP(won, won && matchWonNow(), modeExtra(won));
          }
        } catch (e) {}
        return r;
      };
    }
    /* гость: движок не крутится — ловим экран итога один раз на партию; плюс значок игрока на итоге */
    if (typeof showOver === 'function') {
      const _so = showOver;
      showOver = function () {
        const r = _so.apply(this, arguments);
        try {
          if (isOnline() && NET.role === 'guest' && G && G.over) {
            const key = NET.code + '|' + (SERIES && SERIES.games) + '|' + G.over;
            let seen = guestSeen; try { seen = sessionStorage.getItem('durocker-pass-seen') || guestSeen; } catch (e) {}
            if (seen !== key) {
              guestSeen = key; try { sessionStorage.setItem('durocker-pass-seen', key); } catch (e) {}
              const won = G.over === 'p';
              gameXP(won, won && !!(SERIES && SERIES.done && SERIES.w && (SERIES.to || 2) >= 2 && SERIES.w.p >= (SERIES.to || 2)), modeExtra(won));
            }
          }
          if (G && G.over) badge();
        } catch (e) {}
        return r;
      };
    }
    if (typeof openMenu === 'function') {
      const _om = openMenu;
      openMenu = function () {
        const r = _om.apply(this, arguments);
        try {
          const g = document.querySelector('#menuIn .menugrid');
          if (g && !g.querySelector('[data-go="pass"]')) {
            const s = state(), lv = levelOf(s.xp);
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'mi pass'; b.dataset.go = 'pass';
            b.innerHTML = `<b>Пропуск 🎟 ур. ${lv.L}</b><small>${lv.L >= 30 ? 'Сезон закрыт на максимум!' : `${lv.into}/${lv.next} XP · след.: ${e_(rewardName(...levels(s.k)[lv.L]))}`}</small>`;
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
        if (k === 'pass') { try { closeSheets(); } catch (e) {} open(); return; }
        return _mg.apply(this, arguments);
      };
    }
    if (typeof openCollection === 'function') {
      const _oc = openCollection;
      openCollection = function () {
        looks();
        const r = _oc.apply(this, arguments);
        try {
          const pi = $('pageIn');
          const ach = [...pi.querySelectorAll('h3')].find(h => /Достижения/.test(h.textContent));
          const html = collExtra();
          if (ach) ach.insertAdjacentHTML('beforebegin', html); else pi.insertAdjacentHTML('beforeend', html);
          paintSeasonPrev(pi);
          pi.querySelectorAll('.ci i').forEach(i => { if (i.className.includes('bk-ps-')) i.classList.add('psprev'); });
        } catch (e) {}
        return r;
      };
    }
    /* клики в коллекции и украшение своей строки в таблице лидеров */
    const pi = $('pageIn');
    if (pi) {
      pi.addEventListener('click', onCollClick);
      new MutationObserver(() => { try { decorateLeaders(pi); } catch (e) {} }).observe(pi, { childList: true, subtree: true });
    }
    /* компания на 3–4: свой экран итога — считаем каждое его появление */
    let m4last = false;
    new MutationObserver(() => {
      const box = document.querySelector('.m4over h2');
      if (box && !m4last) {
        m4last = true;
        const won = /НЕ ДУРАК/.test(box.textContent);
        gameXP(won, false, null);
      } else if (!box) m4last = false;
    }).observe(document.body, { childList: true, subtree: true });
  }
  hook();
  return { open, add, state, levelOf, cost, TOTAL, levels, wear, XP, _flush: flush, rewardName };
})();
