/* ДурКер — «🌙 Ночь в казино»: рогалик на восемь боссов подряд.
   Забег: 8 боссов по нарастающей, каждый бой — одна партия (bo1) с особым правилом босса.
   Проиграл — ночь окончена. Выиграл — выбираешь 1 из 3 фишек-модификаторов, они копятся до конца забега.
   Правила босса — флаги G.rules (как у босса недели), эффекты фишек — правка G после раздачи и обёртки вокруг
   addCharge / act / judgeCover. Ни rules.js, ни engine.js не правим: всё встраивается обёртками. */
'use strict';

const ROGUE = (() => {
  const KEY = 'durocker-rogue';
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const escH = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const TOTAL = 8;

  /* ---------- восемь боссов: берём героев из карьеры и босса недели, правила — флаги движка ---------- */
  const fromCareer = id => (typeof CAREER_OPS !== 'undefined' ? CAREER_OPS : []).find(o => o.id === id);
  const fromWeekly = id => (typeof WEEKLY !== 'undefined' && WEEKLY.BOSSES ? WEEKLY.BOSSES : []).find(o => o.id === id);
  const FALLBACK = { ai: 'valera', style: 'valera', color: '#888', face: '?' };
  const mkBoss = (src, name, extra) => {
    const b = { ...FALLBACK, ...(src || {}), ...extra };
    b.name = b.name || name; b.level = 'ночь';
    if (b.boss !== 'major' && b.boss !== 'sharper') delete b.boss; /* своих «боссов» у режима нет: рейтинг считается по уровню бота */
    return b;
  };
  /* flags — то, что уходит в G.rules; rule — текст для игрока */
  const BOSS_DEFS = [
    ['c-tolik', 'Сосед Толик', { rule: 'Козырь меняется каждый ход', short: 'козырь каждый ход', flags: { trumpEvery: true },
      info: 'Разминка. Толик играет в тапках, а козырь тасуется сам собой.' }],
    ['c-mihalych', 'Дворник Михалыч', { rule: 'На руке 10 карт', short: 'рука 10 карт', flags: { hand: 10 },
      info: 'Метёт всё со стола. Рук много — комбинаций тоже.' }],
    ['c-torgash', 'Торгаш', { rule: 'Без перевода, подкидывать можно одиночками', short: 'без перевода', flags: { transfer: false, singleThrow: true },
      info: 'Переводить нельзя, зато подкидывать можно любой картой с номиналом со стола.' }],
    ['c-dembel', 'Дембель', { rule: 'Каждая отбитая атака — +1 заряда', short: 'заряд за каждую защиту', flags: { chargeCover: true },
      info: 'Копит заряд на каждой защите — следи, что он тебе достаёт.' }],
    ['c-provod', 'Проводница', { rule: '4 джокера в колоде', short: '4 джокера', flags: { jokers: 4 },
      info: 'Добавила в колоду ещё двух шутов. Комбинации с джокерами сыплются градом.' }],
    ['w-prof', 'Профессор Козырев', { rule: 'Козырей нет — козыри только джокеры', short: 'без козырей', flags: { noTrump: true },
      info: 'Отменил козырную масть: решает только старшинство, бить чужую масть умеют лишь джокеры.' }],
    ['c-major', 'Мажор', { rule: 'Только пары и крупнее, старт с полным зарядом', short: 'без одиночек', flags: { noSingles: true },
      info: 'Ходит минимум парой и начинает с полным зарядом. Папа купил.' }],
    ['c-sharper', 'Шулер', { rule: 'Видит твою руку, заряд за каждую защиту', short: 'шулер подглядывает', flags: { chargeCover: true },
      info: 'ФИНАЛ. Подглядывает в твои карты, считает ходы вперёд и копит заряд. Честно играть не умеет.' }],
  ];
  const BOSSES = BOSS_DEFS.map(([id, name, extra]) => mkBoss(fromCareer(id) || fromWeekly(id), name, { ...extra, id }));

  /* ---------- пул фишек ---------- */
  const RAR = { c: { n: 'Обычная', w: 60, col: '#8fb3a6' }, r: { n: 'Редкая', w: 30, col: '#5aa2ff' }, l: { n: 'Легендарная', w: 10, col: '#eab54b' } };
  const CHIPS = [
    { id: 'joker', r: 'r', ico: '🃏', name: 'Джокер в рукаве', desc: 'В начале каждого боя на твоей руке лишний джокер.' },
    { id: 'extra', r: 'c', ico: '➕', name: 'Лишняя карта', desc: 'Рука 9 карт у обоих: больше комбинаций, бой длиннее.', flags: { hand: 9 } },
    { id: 'over', r: 'r', ico: '🪜', name: '+1 к перекрытию', desc: 'Перекрывать можно на любое большее число карт (бот это тоже умеет).', flags: { overAny: true } },
    { id: 'eye', r: 'c', ico: '👁', name: 'Глаз', desc: 'В начале боя видишь две карты соперника.' },
    { id: 'trumps', r: 'c', ico: '♠️', name: 'Козырный старт', desc: 'В начале боя на руке два козыря.' },
    { id: 'shield', r: 'c', ico: '🛡', name: 'Щит в кармане', desc: 'Старт боя с картой действия «Щит».' },
    { id: 'rev', r: 'c', ico: '↺', name: 'Запас разворота', desc: 'Старт боя с картой действия «Разворот».' },
    { id: 'trumpact', r: 'r', ico: '↻', name: 'Козырь про запас', desc: 'Старт боя с картой «Смена козыря»: выбери масть в нужный момент.' },
    { id: 'fast', r: 'r', ico: '⚡', name: 'Быстрый заряд', desc: 'Весь заряд, который ты получаешь, удваивается.' },
    { id: 'count', r: 'c', ico: '🔋', name: 'Счётчик', desc: 'Бой начинается с зарядом 2 из 3.' },
    { id: 'ins', r: 'l', ico: '🧷', name: 'Страховка', desc: 'Одно поражение прощается: бой переигрывается, страховка сгорает.' },
    { id: 'xfer', r: 'r', ico: '🔁', name: 'Перевод-мастер', desc: 'Каждый твой перевод даёт +1 заряда.' },
    { id: 'anti', r: 'c', ico: '🧱', name: 'Анти-могнул', desc: 'Когда тебя могнули — получаешь +1 заряда.' },
    { id: 'ace', r: 'c', ico: '🅰️', name: 'Карманный туз', desc: 'В начале боя на руке есть туз.' },
    { id: 'aces', r: 'r', ico: '🎴', name: 'Тузы на руках', desc: 'В начале боя на руке два туза.' },
    { id: 'kings', r: 'c', ico: '👑', name: 'Пара королей', desc: 'В начале боя на руке пара королей.' },
    { id: 'burden', r: 'r', ico: '🎒', name: 'Груз на соперника', desc: 'Сопернику в начале боя достаётся лишняя карта.' },
    { id: 'rig', r: 'l', ico: '🎲', name: 'Подтасовка', desc: 'Козырем становится самая частая масть на твоей руке.' },
    { id: 'twin', r: 'l', ico: '🎭', name: 'Джокер-близнец', desc: 'В начале боя на твоей руке два джокера.' },
  ];
  const chipOf = id => CHIPS.find(c => c.id === id);

  /* ---------- сохранение ---------- */
  function store() {
    let s = null; try { s = JSON.parse(rd(KEY)); } catch (e) {}
    s = Object.assign({ best: 0, runs: 0, clears: 0, run: null }, s || {});
    if (s.run && (!Array.isArray(s.run.chips) || !Number.isInteger(s.run.i) || s.run.i < 0 || s.run.i >= TOTAL)) s.run = null;
    return s;
  }
  const save = s => wr(KEY, JSON.stringify(s));
  const getRun = () => store().run;
  const has = id => { const r = getRun(); return !!(r && r.chips.includes(id)); };
  const newRun = () => ({ i: 0, chips: [], pending: null, fighting: false });

  /* ---------- логика без интерфейса ---------- */
  /* три разные фишки из тех, что ещё не взяты; шанс по редкости. rng — для тестов */
  function roll3(owned, rng) {
    rng = rng || Math.random;
    const pool = CHIPS.filter(c => !owned.includes(c.id)), out = [];
    while (out.length < 3 && pool.length) {
      const sum = pool.reduce((a, c) => a + RAR[c.r].w, 0);
      let x = rng() * sum, k = 0;
      for (; k < pool.length - 1; k++) { x -= RAR[pool[k].r].w; if (x < 0) break; }
      out.push(pool.splice(k, 1)[0].id);
    }
    return out;
  }
  /* флаги правил: «Полные» + правило босса + флаги фишек (рука — большая из двух) */
  function flagsFor(bossIdx, chips) {
    const f = { ...(BOSSES[bossIdx].flags || {}) };
    chips.forEach(id => {
      const c = chipOf(id);
      if (c && c.flags) Object.entries(c.flags).forEach(([k, v]) => { f[k] = k === 'hand' ? Math.max(f.hand || 8, v) : v; });
    });
    return f;
  }

  /* ---------- эффекты фишек на только что раздатую партию ---------- */
  function applyChips(chips) {
    const keep = new Set();
    const junk = want => {
      const ok = c => !keep.has(c.id) && !want(c);
      return G.P.filter(c => ok(c) && !c.action && !c.joker && c.s !== G.T).sort((a, b) => a.r - b.r)[0]
        || G.P.filter(c => ok(c) && !c.action && !c.joker).sort((a, b) => a.r - b.r)[0]
        || G.P.filter(ok)[0];
    };
    /* ненужную карту уводим в колоду (под верх, не трогая карту козыря на дне), нужную берём из колоды или руки соперника */
    const swapIn = want => {
      let zone = null, idx = -1;
      for (let k = G.deck.length - 1; k >= 1; k--) if (want(G.deck[k])) { zone = G.deck; idx = k; break; }
      if (idx < 0) for (let k = 0; k < G.B.length; k++) if (want(G.B[k])) { zone = G.B; idx = k; break; }
      const j = junk(want);
      if (!j) return null;
      let card;
      if (idx >= 0) { card = zone.splice(idx, 1)[0]; if (zone === G.B) G.B.push(j); else G.deck.splice(1, 0, j); }
      else return null;
      G.P.splice(G.P.indexOf(j), 1);
      G.P.push(card); return card;
    };
    const ensure = (n, want) => {
      let have = G.P.filter(want);
      while (have.length < n) { if (!swapIn(want)) break; have = G.P.filter(want); }
      G.P.filter(want).forEach(c => keep.add(c.id));
    };
    const mint = card => {
      const j = junk(() => false);
      if (!j) return;
      G.P.splice(G.P.indexOf(j), 1); G.deck.splice(1, 0, j);
      G.P.push(card); keep.add(card.id);
    };
    const joker = n => {
      ensure(n, c => c.joker);
      for (let guard = 0; G.P.filter(c => c.joker).length < n && guard < 4; guard++) {
        let k = 52; const all = () => [...G.deck, ...G.P, ...G.B];
        while (all().some(c => c.n === k)) k++;
        mint(mkCard(k));
      }
    };
    const action = kind => mint(mkCard(1000 + (++G.actSerial) * 16 + ACT_KEYS.indexOf(kind) * 4 + (G.T < 4 ? G.T : G.lastSuit.p)));
    const has_ = id => chips.includes(id);
    const real = c => !c.joker && !c.action;

    if (has_('rig') && !wrule('noTrump') && !wrule('trumpEvery')) {
      const sum = [0, 0, 0, 0];
      G.P.filter(real).forEach(c => { sum[c.s] += 100 + c.r; });
      const best = sum.indexOf(Math.max(...sum));
      if (Math.max(...sum) > 0) { G.T = best; G.lastSuit.p = best; G.lastSuit.b = best; }
    }
    if (has_('twin')) joker(2); else if (has_('joker')) joker(1);
    if (has_('trumps') && !wrule('noTrump')) ensure(2, c => real(c) && c.s === G.T);
    if (has_('aces')) ensure(2, c => real(c) && c.r === 14);
    else if (has_('ace')) ensure(1, c => real(c) && c.r === 14);
    if (has_('kings')) ensure(2, c => real(c) && c.r === 13);
    if (has_('shield')) action('shield');
    if (has_('rev')) action('reverse');
    if (has_('trumpact')) action('trump');
    if (has_('count')) G.charge.p = Math.max(G.charge.p, 2);
    if (has_('burden') && G.deck.length > 1) G.B.push(G.deck.pop());
    if (has_('eye')) {
      const pool = G.B.slice().sort(() => Math.random() - 0.5).slice(0, 2);
      G.rgEye = pool.map(c => c.id);
    }
    return G;
  }

  /* ---------- оформление ---------- */
  const BACKS_R = [
    { id: 'rg4', name: 'Ночная смена', css: 'radial-gradient(circle at 50% 50%,#ffe9a6 0 2px,transparent 3px) 0 0/12px 12px,linear-gradient(160deg,#0b1030,#3a1a5e)' },
    { id: 'rg8', name: 'Король ночи', css: 'repeating-conic-gradient(#e8b33c 0 25%,#3a2306 0 50%) 0 0/14px 14px' },
  ];
  function looks() {
    try { BACKS_R.forEach(b => { if (!BACKS.some(x => x.id === b.id)) BACKS.push({ id: b.id, name: b.name }); }); } catch (e) {}
    if (typeof document === 'undefined' || document.getElementById('rgcss')) return;
    const st = document.createElement('style');
    st.id = 'rgcss';
    st.textContent = BACKS_R.map(b => `html[data-back="${b.id}"]{--backbg:${b.css}}`).join('\n') + `
.mi.rg b{color:var(--gold,#eab54b)}
.rgsub{margin:0;font-size:14px;line-height:1.45;opacity:.9}
.rgbest{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;text-align:center}
.rgbest div{background:rgba(0,0,0,.3);border-radius:8px;padding:7px 4px;min-width:0}
.rgbest b{display:block;font-family:var(--f-hard,monospace);font-size:13px;color:var(--gold,#eab54b);line-height:1.7}
.rgbest span{font-size:11px;opacity:.75}
.rgpath{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0;padding:0;list-style:none}
.rgnode{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(0,0,0,.28);border-radius:10px;padding:8px 2px 6px;min-width:0;text-align:center;border:2px solid transparent}
.rgnode .rgn{position:absolute;top:3px;left:6px;font-family:var(--f-hard,monospace);font-size:9px;opacity:.7}
.rgnode small{font-size:10px;line-height:1.15;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px}
.rgnode.done{opacity:.6}
.rgnode.done::after{content:"✓";position:absolute;top:2px;right:6px;color:var(--gold,#eab54b);font-weight:900;font-size:13px}
.rgnode.cur{border-color:var(--gold,#eab54b);background:rgba(234,181,75,.18);box-shadow:0 0 14px rgba(234,181,75,.35)}
.rgnode.lock{opacity:.8}
.rgava{width:44px;height:44px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-family:var(--f-hard,monospace);font-size:13px;color:#fff;box-shadow:0 3px 0 rgba(0,0,0,.4);overflow:hidden;flex:none}
.rgava img,.rgava svg{width:100%;height:100%;object-fit:cover;display:block}
.rgava.big{width:64px;height:64px;font-size:16px;border-radius:14px}
.rgcur{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:center;background:rgba(0,0,0,.3);border-radius:12px;padding:12px}
.rgcur h3{margin:0 0 2px;font-size:17px}
.rgcur .rgrule{color:var(--gold,#eab54b);font-weight:800;font-size:15px;line-height:1.3}
.rgcur p{grid-column:1/-1;margin:0;font-size:13px;line-height:1.4;opacity:.9}
.rgchips{display:flex;flex-wrap:wrap;gap:6px;margin:0}
.rgchip{border:2px solid var(--rc,#8fb3a6);background:rgba(0,0,0,.3);border-radius:10px;padding:5px 9px;font-size:13px;color:inherit;font-weight:700;display:flex;align-items:center;gap:5px;min-width:0}
.rgchip.on{background:rgba(255,255,255,.14)}
.rgnone{font-size:13px;opacity:.7;margin:0}
.rgtip{min-height:36px;font-size:13px;line-height:1.4;background:rgba(0,0,0,.22);border-radius:8px;padding:8px 10px;margin:0}
.rgghost{width:100%;border:1px solid var(--line,rgba(255,255,255,.2));background:transparent;color:inherit;border-radius:10px;padding:10px;font-weight:700;font-size:14px}
.rgcards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;perspective:900px}
.rgcard{--rc:#8fb3a6;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;background:linear-gradient(180deg,rgba(255,255,255,.1),rgba(0,0,0,.35));border:2px solid var(--rc);border-radius:12px;padding:12px 5px 10px;color:inherit;min-width:0;min-height:196px;box-shadow:0 0 16px color-mix(in srgb,var(--rc) 35%,transparent);animation:rgflip .6s cubic-bezier(.2,.9,.3,1.2) both;animation-delay:calc(var(--k,0)*.14s)}
.rgcard .ico{font-size:34px;line-height:1.1}
.rgcard b{font-size:14px;line-height:1.2;overflow-wrap:anywhere}
.rgcard em{font-style:normal;font-size:10px;font-weight:900;color:var(--rc);text-transform:uppercase;letter-spacing:.04em}
.rgcard span{font-size:11.5px;line-height:1.35;opacity:.9}
.rgcard.picked{animation:rgpick .5s ease forwards}
.rgcards.done .rgcard:not(.picked){opacity:.25;transform:scale(.94);transition:.3s}
@keyframes rgflip{from{transform:rotateY(90deg) translateY(16px);opacity:0}to{transform:none;opacity:1}}
@keyframes rgpick{to{transform:scale(1.08) translateY(-6px);box-shadow:0 0 28px var(--rc)}}
@media (prefers-reduced-motion:reduce){.rgcard,.rgcard.picked{animation:none}}
.rgico{font-size:13px}
.rgeye{font-weight:800}
.rgovr{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin:6px 0}
`;
    document.head.appendChild(st);
  }

  /* портрет: PORTRAITS.svg(id) из portraits.js, иначе буквы */
  function ava(b, big) {
    let inner = escH(b.face);
    try {
      const P = typeof PORTRAITS !== 'undefined' ? PORTRAITS : window.PORTRAITS;
      if (P && typeof P.svg === 'function') { const v = P.svg(b.id); if (typeof v === 'string' && v.trim().startsWith('<')) inner = v; }
    } catch (e) {}
    return `<span class="rgava${big ? ' big' : ''}" style="background:${b.color}">${inner}</span>`;
  }

  /* ---------- экраны ---------- */
  let last = null, tipId = '';
  const chipBtn = (id, on) => {
    const c = chipOf(id), r = RAR[c.r];
    return `<button type="button" class="rgchip${on ? ' on' : ''}" style="--rc:${r.col}" data-rgchip="${id}" title="${escH(t(c.name) + ' — ' + t(c.desc))}"><span>${c.ico}</span>${escH(t(c.name))}</button>`;
  };
  function body(html) {
    if (typeof sheet === 'function') sheet('page', html);
    const el = document.getElementById('pageIn');
    if (el) el.querySelectorAll('[data-close]').forEach(x => { x.onclick = () => { try { closeSheets(); } catch (e) {} }; });
    return el;
  }
  function open() {
    looks();
    const s = store(), R = s.run;
    if (R && R.pending && R.pending.length) return openPick();
    const idx = R ? R.i : 0;
    const path = BOSSES.map((b, k) => {
      const st = R && k < R.i ? 'done' : R && k === R.i ? 'cur' : 'lock';
      return `<li class="rgnode ${st}"><span class="rgn">${k + 1}</span>${ava(b)}<small>${escH(t(b.name).split(' ').pop())}</small></li>`;
    }).join('');
    const b = BOSSES[idx];
    const chipsHTML = R && R.chips.length ? `<div class="rgchips">${R.chips.map(id => chipBtn(id, id === tipId)).join('')}</div>` : `<p class="rgnone">${R ? t('Фишек пока нет — первая будет после первого босса.') : ''}</p>`;
    const el = body(`${typeof head === 'function' ? head(t('🌙 Ночь в казино')) : ''}
      <p class="rgsub">${t('Восемь боссов подряд, по одной партии на каждого. Проиграл бой — ночь окончена. После каждой победы выбираешь одну из трёх фишек, и она остаётся до конца ночи.')}</p>
      <div class="rgbest"><div><b>${s.best}/${TOTAL}</b><span>${t('рекорд')}</span></div><div><b>${s.clears}</b><span>${t('пройдено ночей')}</span></div><div><b>${s.runs}</b><span>${t('ночей сыграно')}</span></div></div>
      <ol class="rgpath">${path}</ol>
      <div class="rgcur">${ava(b, true)}<div><h3>${R ? t('Бой {i}/{n}: ', { i: idx + 1, n: TOTAL }) : t('Первый бой: ')}${escH(t(b.name))}</h3><div class="rgrule">${escH(t(b.rule))}</div></div><p>${escH(t(b.info))}</p></div>
      ${chipsHTML}
      <p class="rgtip" id="rgTip">${R && R.chips.length ? t('Нажми на фишку — увидишь, что она делает.') : t('Награды: за 4/8 — рубашка «Ночная смена», за 8/8 — «Король ночи».')}</p>
      <button type="button" class="wkgo" id="rgGo">${R ? t('В бой') : t('Начать ночь')}</button>
      ${R ? '<button type="button" class="rgghost" id="rgQuit">' + t('Сдаться') + '</button>' : ''}`);
    if (!el) return;
    el.querySelectorAll('[data-rgchip]').forEach(x => {
      x.onclick = () => {
        const c = chipOf(x.dataset.rgchip), tip = document.getElementById('rgTip');
        tipId = c.id;
        el.querySelectorAll('[data-rgchip]').forEach(y => y.classList.toggle('on', y === x));
        if (tip) tip.innerHTML = `<b>${c.ico} ${escH(t(c.name))}</b> · ${t(RAR[c.r].n).toLowerCase()}<br>${escH(t(c.desc))}`;
      };
    });
    const go = document.getElementById('rgGo');
    if (go) go.onclick = () => { if (!R) { const s2 = store(); s2.run = newRun(); save(s2); } fight(); };
    const q = document.getElementById('rgQuit');
    if (q) q.onclick = () => {
      if (!q.dataset.sure) { q.dataset.sure = '1'; q.textContent = t('Точно сдаться? Фишки пропадут'); return; }
      const s2 = store(); s2.best = Math.max(s2.best, s2.run ? s2.run.i : 0); s2.runs++; s2.run = null; save(s2); open();
    };
  }
  function openPick() {
    looks();
    const s = store(), R = s.run;
    if (!R || !R.pending || !R.pending.length) return open();
    const cards = R.pending.map((id, k) => {
      const c = chipOf(id), r = RAR[c.r];
      return `<button type="button" class="rgcard" style="--rc:${r.col};--k:${k}" data-rgpick="${id}"><em>${t(r.n)}</em><span class="ico">${c.ico}</span><b>${escH(t(c.name))}</b><span>${escH(t(c.desc))}</span></button>`;
    }).join('');
    const el = body(`${typeof head === 'function' ? head(t('Фишка на ночь')) : ''}
      <p class="rgsub">${t('Бой {i}/{n} выигран. Выбери одну фишку — она будет работать до конца забега.', { i: R.i, n: TOTAL })}${R.chips.length ? ' ' + t('Уже есть: {x}', { x: R.chips.map(id => chipOf(id).ico).join(' ') }) : ''}</p>
      <div class="rgcards" id="rgCards">${cards}</div>`);
    if (!el) return;
    el.querySelectorAll('[data-rgpick]').forEach(x => {
      x.onclick = () => {
        const s2 = store(), R2 = s2.run, id = x.dataset.rgpick;
        if (!R2 || !R2.pending || !R2.pending.includes(id)) return;
        R2.chips.push(id); R2.pending = null; save(s2);
        x.classList.add('picked');
        const box = document.getElementById('rgCards'); if (box) box.classList.add('done');
        setTimeout(() => { if (!document.getElementById('page').hidden) open(); }, reduced ? 0 : 650);
      };
    });
  }

  /* экран после боя: подменяет итоги обычной партии */
  function overScreen() {
    const o = document.getElementById('over');
    if (!o || o.hidden || !last) return;
    const key = last.kind + ':' + (last.beaten || last.reached || 0) + ':' + (G && G.penalty);
    if (o.dataset.rg === key) return;
    o.dataset.rg = key;
    const s = store();
    const chips = (last.chips || []).map(id => chipOf(id).ico).join(' ');
    const t_ = window.t;
    let h, t, btns;
    const menu = '<button class="btn grey" type="button" id="rgMenu">' + t_('Меню') + '</button>';
    if (last.kind === 'win') {
      h = t_('БОСС ПОВЕРЖЕН!');
      t = t_('Бой {i}/{n} за тобой. Дальше — {name}: {short}. Выбери фишку.', { i: last.beaten, n: TOTAL, name: t_(BOSSES[last.beaten].name), short: t_(BOSSES[last.beaten].short) });
      btns = '<button class="btn gold" type="button" id="rgNext">' + t_('Выбрать фишку') + '</button>' + menu;
    } else if (last.kind === 'clear') {
      h = t_('НОЧЬ ПРОЙДЕНА 8/8');
      t = t_('Шулер повержен, казино твоё. Рубашки «Ночная смена» и «Король ночи» — в коллекции.');
      btns = '<button class="btn gold" type="button" id="rgNext">' + t_('Новая ночь') + '</button>' + menu;
    } else if (last.kind === 'saved') {
      h = t_('СТРАХОВКА СРАБОТАЛА');
      t = t_('🧷 Поражение прощено, фишка сгорела. Переигрываем бой {i}/{n} с тем же боссом.', { i: last.reached, n: TOTAL });
      btns = '<button class="btn gold" type="button" id="rgNext">' + t_('Переиграть бой') + '</button>' + menu;
    } else if (last.kind === 'draw') {
      h = t_('НИЧЬЯ');
      t = t_('Оба скинули карты разом. Бой не засчитан — переигрываем.');
      btns = '<button class="btn gold" type="button" id="rgNext">' + t_('Переиграть бой') + '</button>' + menu;
    } else {
      h = t_('НОЧЬ ОКОНЧЕНА');
      t = t_('Дошёл до {i}/{n}: {name} оказался сильнее. Лучший результат — {best}/{n}.', { i: last.reached, n: TOTAL, name: t_(BOSSES[last.reached - 1].name), best: s.best });
      btns = '<button class="btn gold" type="button" id="rgNext">' + t_('Новая ночь') + '</button>' + menu;
    }
    o.innerHTML = `<h2>${h}</h2><p>${escH(t)}</p>${chips ? `<div class="rgovr">${escH(chips)}</div>` : ''}<div class="row">${btns}</div>`;
    const nx = document.getElementById('rgNext');
    if (nx) nx.onclick = () => {
      if (last.kind === 'win') { o.hidden = true; delete o.dataset.rg; openPick(); }
      else if (last.kind === 'saved' || last.kind === 'draw') fight();
      else { const s2 = store(); s2.run = newRun(); save(s2); fight(); }
    };
    const mn = document.getElementById('rgMenu');
    if (mn) mn.onclick = () => { try { openMenu(); } catch (e) {} };
  }

  /* ---------- бой ---------- */
  let allowStart = false;
  function fight() {
    const s = store();
    if (!s.run) { s.run = newRun(); }
    s.run.fighting = true; save(s);
    allowStart = true;
    last = null;
    const o = document.getElementById('over'); if (o) { o.hidden = true; delete o.dataset.rg; }
    try { closeSheets(); } catch (e) {}
    allowStart = true;
    setMode({ kind: 'rogue', i: s.run.i });
  }
  /* итог боя: победа, поражение, страховка, ничья */
  function resolve(res) {
    const s = store(), R = s.run;
    if (!R || !R.fighting) return;
    R.fighting = false;
    if (res === 'draw') { last = { kind: 'draw', reached: R.i + 1 }; save(s); return; }
    if (res === 'win') {
      R.i++;
      const late = msg => setTimeout(() => { try { toast(msg, 3500); } catch (e) {} }, 3000);
      if (R.i === 4 && unlock('back', 'rg4')) late(t('🎁 Рубашка «{n}» — твоя!', { n: t('Ночная смена') }));
      if (R.i >= TOTAL) {
        s.best = TOTAL; s.clears++; s.runs++;
        const chips = R.chips.slice(); s.run = null; last = { kind: 'clear', chips };
        if (unlock('back', 'rg4')) late(t('🎁 Рубашка «{n}» — твоя!', { n: t('Ночная смена') }));
        if (unlock('back', 'rg8')) late(t('🎁 Рубашка «{n}» — твоя!', { n: t('Король ночи') }));
      } else {
        s.best = Math.max(s.best, R.i);
        R.pending = roll3(R.chips); last = { kind: 'win', beaten: R.i, chips: R.chips.slice() };
      }
      save(s); return;
    }
    if (R.chips.includes('ins')) {
      R.chips = R.chips.filter(x => x !== 'ins'); last = { kind: 'saved', reached: R.i + 1, chips: R.chips.slice() }; save(s); return;
    }
    s.best = Math.max(s.best, R.i + 1); s.runs++;
    last = { kind: 'lose', reached: R.i + 1, chips: R.chips.slice() };
    s.run = null; save(s);
  }

  /* ---------- встраивание в игру без правки чужих файлов ---------- */
  const isRogue = () => typeof MODE !== 'undefined' && MODE && MODE.kind === 'rogue' && !(typeof NET !== 'undefined' && NET);
  const myChips = () => { const r = getRun(); return r ? r.chips : []; };
  function hook() {
    looks();
    BUS.hook('matchTo', (next) => (isRogue() ? 1 : next()));
    BUS.hook('seriesKey', (next) => (isRogue() ? null : next()));
    BUS.hook('currentBot', (next) => (isRogue() ? (BOSSES[MODE.i] || BOSSES[0]) : next()));
    BUS.hook('tableRules', (next) => {
      if (!isRogue()) return next();
      return { ...RULESETS.full, ...flagsFor(Math.min(MODE.i | 0, TOTAL - 1), myChips()), set: 'rogue', blitz: false };
    });
    BUS.hook('newGame', (next) => {
      if (MODE && MODE.kind === 'rogue' && !(typeof NET !== 'undefined' && NET)) {
        /* перезагрузка или «Ещё раз» без забега — не пускаем в бой мимо экрана забега */
        if (!allowStart || !getRun()) { MODE = { kind: 'free' }; try { loadSeries(); toast(t('Ночь в казино — в меню. Это «Своя игра»')); } catch (e) {} }
        allowStart = false;
      }
      const r = next();
      if (isRogue()) {
        try { applyChips(myChips()); update(true); sync(); } catch (e) { console.error(e); }
      }
      return r;
    });
    /* нижняя кнопка «Ещё раз» в бою ночи ведёт туда же, куда кнопка на экране итогов */
    BUS.hook('nextGame', (next) => {
      if (isRogue() && G && G.over && last) { const b = document.getElementById('rgNext'); if (b) { b.click(); return; } }
      return next();
    });
    /* фишки заряда и перевода */
    BUS.hook('addCharge', (next, a) => next([a[0], isRogue() && a[0] === 'p' && has('fast') ? a[1] * 2 : a[1]]));
    BUS.hook('act', (next, a) => {
      const r = next();
      try { if (r && isRogue() && a[1] === 'transfer' && a[0] === 'p' && has('xfer')) addCharge('p', 1); } catch (e) {}
      return r;
    });
    BUS.hook('judgeCover', (next, a) => {
      const r = next(), seat = a[0], e = a[1], x = a[2];
      try { if (isRogue() && seat === 'b' && has('anti') && e.n >= 2 && x.n >= 2 && e.n <= x.n && e.t > x.t && rule('mognul')) addCharge('p', 1); } catch (err) {}
      return r;
    });
    BUS.on('game:over', () => {
      try { if (isRogue() && G && G.over) resolve(G.over === 'p' ? 'win' : G.over === 'b' ? 'lose' : 'draw'); } catch (e) { console.error(e); }
    });
    BUS.on('over', () => {
      try { if (isRogue() && G && G.over) overScreen(); } catch (e) { console.error(e); }
    });
    /* шапка боя: «Ночь · бой 3/8», правило босса, значки фишек, глаз */
    BUS.on('hud:render', () => {
      try {
        if (isRogue()) {
          const to = document.getElementById('scTo'); if (to) to.textContent = t('одна партия');
          const mb = document.getElementById('modeBox'), b = BOSSES[MODE.i] || BOSSES[0];
          if (mb) {
            const ico = myChips().map(id => { const c = chipOf(id); return `<span class="rgico" title="${escH(t(c.name) + ' — ' + t(c.desc))}">${c.ico}</span>`; }).join('');
            const eye = (G && G.rgEye ? G.B.filter(c => G.rgEye.includes(c.id)) : []).map(cardName).join(' ');
            mb.innerHTML = `<span>${t('🌙 Ночь · бой {i}/{n}', { i: (MODE.i | 0) + 1, n: TOTAL })}</span><span class="boss">${escH(t(b.short))}</span>${ico}${eye ? `<span class="rgeye">👁 ${escH(eye)}</span>` : ''}`;
          }
        }
      } catch (e) {}
    });
    BUS.on('menu:open', () => {
      try {
        const g = document.querySelector('#menuIn .menugrid');
        if (g && !g.querySelector('[data-go="rogue"]')) {
          const s = store(), R = s.run, bt = document.createElement('button');
          bt.type = 'button'; bt.className = 'mi rg'; bt.dataset.go = 'rogue';
          bt.innerHTML = `<b>${t('🌙 Ночь в казино')}</b><small>${R ? (R.pending && R.pending.length ? t('выбери фишку') : t('бой {i}/{n} · фишек {c}', { i: R.i + 1, n: TOTAL, c: R.chips.length })) : t('8 боссов подряд')} · ${t('рекорд {b}/{n}', { b: s.best, n: TOTAL })}</small>`;
          const after = g.querySelector('[data-go="weekly"]') || g.querySelector('[data-go="daily"]');
          if (after && after.nextSibling) g.insertBefore(bt, after.nextSibling); else g.appendChild(bt);
        }
      } catch (e) {}
    });
    BUS.menuKey('rogue', () => { try { closeSheets(); } catch (e) {} open(); });
  }
  if (typeof document !== 'undefined' && typeof window !== 'undefined') hook();
  return { CHIPS, BOSSES, RAR, open, openPick, fight, store, roll3, flagsFor, applyChips, resolve, chipOf, _last: () => last };
})();
