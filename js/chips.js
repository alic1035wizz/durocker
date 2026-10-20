/* ДурКер — фишки, ставки, серии побед и сундуки.
   Только внутриигровая валюта: купить её нельзя, платных сундуков нет.
   Подключается обёртками над onGameOver / showOver / openMenu / menuGo / renderHUD / renderLobby / openBots / newGame. */
'use strict';
(() => {
  const K_CHIPS = 'durocker-chips', K_META = 'durocker-chips-meta';
  const BETS = [0, 50, 100, 250, 500];
  const START = 500, LOAN = 200, LOAN_SHARE = 0.5;
  const $c = id => document.getElementById(id);
  const E = s => (typeof esc === 'function' ? esc(String(s)) : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const night = () => { const h = new Date().getHours(); return h >= 23 || h < 6; };
  const say = (t, ms) => { try { toast(t, ms); } catch (e) {} };
  const snd = n => { try { AU.play(n); } catch (e) {} };

  /* ---------- состояние ---------- */
  let chips = (() => { const v = parseInt(load(K_CHIPS), 10); return Number.isFinite(v) && v >= 0 ? v : null; })();
  if (chips === null) { chips = START; store(K_CHIPS, String(chips)); }
  const DEF = { debt: 0, streak: 0, best: 0, lossRun: 0, matches: 0, chestN: 0, chests: [], bet: null, sel: 100, daily: null, last: null, gk: '', gt: 0 };
  let st = (() => { try { return { ...DEF, ...JSON.parse(load(K_META) || '{}') }; } catch (e) { return { ...DEF }; } })();
  if (!Array.isArray(st.chests)) st.chests = [];
  const saveMeta = () => store(K_META, JSON.stringify(st));
  function addChips(n) {
    chips = Math.max(0, Math.round(chips + n));
    store(K_CHIPS, String(chips));
    paint(n > 0 ? 'up' : n < 0 ? 'down' : '');
  }
  /* доход (не возврат ставки): часть уходит на погашение займа Торгаша */
  function income(n) {
    n = Math.round(n);
    if (n <= 0) return { net: 0, paid: 0 };
    let paid = 0;
    if (st.debt > 0) { paid = Math.min(st.debt, Math.ceil(n * LOAN_SHARE)); st.debt -= paid; }
    addChips(n - paid);
    return { net: n - paid, paid };
  }

  /* ---------- экономика ---------- */
  const streakMult = n => (n >= 7 ? 2 : n >= 4 ? 1.5 : n >= 2 ? 1.2 : 1);
  const botTier = () => {
    try { const b = currentBot(); const ai = b.ai || b.id; return { ai, boss: !!b.boss, name: b.name }; } catch (e) { return { ai: 'valera', boss: false, name: '' }; }
  };
  const TIER_GAME = { student: 5, valera: 10, sharper: 15 };
  const TIER_MATCH = { student: 20, valera: 40, sharper: 80 };
  function gameReward() {
    if (NET) return 8;
    return TIER_GAME[botTier().ai] || 8;
  }
  function matchReward(to) {
    if (NET) return 40;
    if (MODE.kind === 'daily') return 30;
    if (MODE.kind === 'weekly') return 50;
    const t = botTier();
    let r = TIER_MATCH[t.ai] || 30;
    if (t.boss) r = Math.round(r * 1.5);
    if (to < 2) r = Math.round(r / 2);
    return r;
  }

  /* ---------- стили ---------- */
  const css = document.createElement('style');
  css.textContent = `
.chbar{order:2;display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;font-size:12px;min-height:26px}
.chpill{font:inherit;display:inline-flex;align-items:center;gap:5px;background:rgba(0,0,0,.5);border:2px solid rgba(234,181,75,.55);color:#ffe9a6;border-radius:999px;padding:2px 10px 2px 8px;cursor:pointer;font-weight:800}
.chpill b{font-variant-numeric:tabular-nums;letter-spacing:.02em}
.chpill.up{animation:chup .7s ease}.chpill.down{animation:chdown .6s ease}
@keyframes chup{30%{transform:scale(1.18);background:rgba(120,200,90,.45)}}
@keyframes chdown{30%{transform:scale(.92);background:rgba(217,54,47,.4)}}
.chtag{background:rgba(0,0,0,.45);border:1px solid var(--line,#2a4a3d);border-radius:999px;padding:1px 8px;color:var(--muted,#9db3a6)}
.chtag.bet{color:#ffd98a;border-color:rgba(234,181,75,.5)}
.chfire{position:relative;display:inline-flex;align-items:center;gap:3px;font-weight:800;color:#ffb347;background:rgba(80,20,0,.5);border:1px solid rgba(255,140,40,.6);border-radius:999px;padding:1px 8px}
.chfire i{font-style:normal;display:inline-block;animation:chflame 1.1s ease-in-out infinite;transform-origin:50% 90%}
.chfire small{font-size:10px;opacity:.85}
@keyframes chflame{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.18) rotate(3deg)}}
.chfire.out i{animation:chout 1.4s ease forwards;filter:grayscale(1)}
.chfire.out{color:#9aa;border-color:#556;background:rgba(0,0,0,.4)}
@keyframes chout{0%{transform:scale(1.3)}40%{transform:scale(.7) translateY(2px);opacity:.8}100%{transform:scale(.5) translateY(-6px);opacity:0}}
.chnote{margin-top:0;background:rgba(9,24,19,.97);border:1px solid rgba(234,181,75,.35);border-radius:10px;padding:6px 10px;font-size:12px;line-height:1.4;text-align:left;width:100%;max-width:380px}
.chnote b{color:#ffe9a6}.chnote .g{color:#8fe08a}.chnote .r{color:#ff9a8f}.chnote .m{color:var(--muted,#9db3a6);font-size:11px}
.chnote .ln{display:flex;justify-content:space-between;gap:10px}
.chdock{position:fixed;left:10px;right:10px;bottom:calc(98px + env(safe-area-inset-bottom,0px));z-index:40;display:flex;flex-direction:column;align-items:center;gap:6px;pointer-events:none;max-width:540px;margin:0 auto}.chdock>*{pointer-events:auto}
.chdw{position:fixed;inset:0;z-index:92;display:flex;align-items:center;justify-content:center;background:rgba(3,8,6,.72);padding:16px}
.chdbl .m{font-size:12px;opacity:.8}
.chdbl{display:flex;flex-direction:column;gap:8px;align-items:center;width:100%;max-width:380px;background:linear-gradient(#2b0f14,#14070a);border:2px solid #eab54b;border-radius:14px;padding:12px;box-shadow:0 0 22px rgba(234,181,75,.35)}
.chdbl h3{margin:0;font-family:var(--f-hard,monospace);font-size:16px;color:#ffd35c;letter-spacing:.06em}
.chdbl p{margin:0;font-size:13px;color:#f1dcc0}
.chdbl .row{display:flex;gap:8px;width:100%}.chdbl .row .btn{flex:1}
.btn.chmore{width:100%;max-width:380px;font-size:17px;font-weight:800;letter-spacing:.03em;box-shadow:0 4px 0 #8a4b00,0 0 18px rgba(255,170,40,.5);background:linear-gradient(#ffb338,#ff7a18);color:#2b1300;border-color:#ffd48a}
.btn.chchest{width:100%;max-width:380px;background:linear-gradient(#7c4dff,#4b2bb8);color:#fff;animation:chpulse 1.4s ease-in-out infinite}
@keyframes chpulse{50%{transform:scale(1.04);box-shadow:0 0 18px rgba(160,120,255,.7)}}
.cbets{display:flex;gap:6px;flex-wrap:wrap}
.cbets button{font:inherit;flex:1;min-width:52px;padding:8px 4px;border-radius:10px;border:2px solid var(--line,#2a4a3d);background:rgba(0,0,0,.35);color:inherit;cursor:pointer;font-weight:700}
.cbets button.on{border-color:#eab54b;background:rgba(234,181,75,.22);color:#ffe9a6}
.cbets button:disabled{opacity:.35;cursor:not-allowed}
.cbox{background:rgba(0,0,0,.3);border:1px solid var(--line,#2a4a3d);border-radius:12px;padding:10px 12px;margin-top:8px}
.cbig{font-family:var(--f-hard,monospace);font-size:22px;color:#ffe9a6;text-align:center;margin:6px 0}
.ctab{width:100%;border-collapse:collapse;font-size:13px}.ctab td{padding:3px 4px;border-bottom:1px solid rgba(255,255,255,.07)}.ctab td:last-child{text-align:right;color:#ffe9a6}
.chov{position:fixed;inset:0;z-index:95;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(3,10,8,.9);text-align:center;padding:20px;color:#fff}
.chrays{position:absolute;width:140vmax;height:140vmax;left:50%;top:50%;margin:-70vmax 0 0 -70vmax;background:repeating-conic-gradient(from 0deg,var(--rc,#8c6dff) 0 6deg,transparent 6deg 18deg);opacity:0;-webkit-mask:radial-gradient(circle,#000 0,transparent 55%);mask:radial-gradient(circle,#000 0,transparent 55%);animation:chspin 14s linear infinite;transition:opacity .5s}
.chov.open .chrays{opacity:.32}
@keyframes chspin{to{transform:rotate(360deg)}}
.chcore{position:relative;z-index:2;font-size:96px;line-height:1;filter:drop-shadow(0 8px 0 rgba(0,0,0,.4))}
.chov.shake .chcore{animation:chshake .22s linear infinite}
@keyframes chshake{0%,100%{transform:rotate(-7deg) translateX(-3px)}50%{transform:rotate(7deg) translateX(3px)}}
.chov.open .chcore{animation:chpop .6s cubic-bezier(.2,1.6,.4,1)}
@keyframes chpop{from{transform:scale(.4)}to{transform:scale(1)}}
.chflash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:3}
.chov.flash .chflash{animation:chfl .55s ease-out}
@keyframes chfl{0%{opacity:.95}100%{opacity:0}}
.chres{position:relative;z-index:2;min-height:110px;opacity:0;transform:translateY(10px);transition:all .4s}
.chov.open .chres{opacity:1;transform:none}
.chres .rar{display:inline-block;font-family:var(--f-hard,monospace);font-size:11px;padding:3px 10px;border-radius:999px;background:var(--rc);color:#10161a;letter-spacing:.08em}
.chres .nm{font-size:22px;font-weight:800;margin-top:8px}.chres .sub{font-size:13px;opacity:.8;margin-top:4px}
.chtake{position:relative;z-index:2;opacity:0;pointer-events:none}.chov.open .chtake{opacity:1;pointer-events:auto}
@media (prefers-reduced-motion:reduce){.chfire i,.chrays,.btn.chchest,.chov.shake .chcore{animation:none!important}}
`;
  document.head.appendChild(css);

  /* ---------- плашка с фишками ---------- */
  function ensureBar() {
    let bar = $c('chBar');
    if (bar) return bar;
    const hud = document.querySelector('.hud'), hb = document.querySelector('.hudbar');
    if (!hud || !hb) return null;
    bar = document.createElement('div');
    bar.className = 'chbar'; bar.id = 'chBar';
    bar.innerHTML = `<button class="chpill" id="chPill" type="button" aria-label="Фишки">🪙 <b id="chNum">0</b></button><span class="chtag bet" id="chBet" hidden></span><span class="chfire" id="chFire" hidden><i>🔥</i><b id="chFireN"></b><small id="chFireM"></small></span>`;
    hb.after(bar);
    $c('chPill').onclick = () => { closeAll(); openChips(); };
    return bar;
  }
  const closeAll = () => { try { closeSheets(); } catch (e) {} };
  let lastShown = null;
  function paint(fx) {
    const bar = ensureBar(); if (!bar) return;
    $c('chNum').textContent = chips.toLocaleString('ru-RU');
    const pill = $c('chPill');
    if (fx && lastShown !== null && lastShown !== chips) { pill.classList.remove('up', 'down'); void pill.offsetWidth; pill.classList.add(fx); }
    lastShown = chips;
    const b = $c('chBet'), live = st.bet && st.bet.amt > 0 && !NET && MODE.kind === 'free' && st.bet.k === safeKey();
    b.hidden = !live; if (live) b.textContent = '🎲 ставка ' + st.bet.amt;
    const f = $c('chFire'), m = streakMult(st.streak);
    f.hidden = st.streak < 1; $c('chFireN').textContent = st.streak; $c('chFireM').textContent = m > 1 ? '×' + String(m).replace('.', ',') : '';
    f.classList.remove('out');
  }
  function safeKey() { try { return seriesKey(); } catch (e) { return null; } }
  function fireOut() {
    const f = $c('chFire'); if (!f) return;
    $c('chFireN').textContent = '0'; f.hidden = false; f.classList.add('out');
    setTimeout(() => { f.hidden = true; f.classList.remove('out'); }, 1500);
  }

  /* ---------- бонус дня ---------- */
  function dayKey() { try { return todayKey(); } catch (e) { return new Date().toISOString().slice(0, 10); } }
  function prevDay(k) { return new Date(Date.parse(k) - 86400000).toISOString().slice(0, 10); }
  const dailyBonus = n => Math.min(300, 100 + (n - 1) * 50);
  function claimDaily() {
    const k = dayKey();
    if (st.daily && st.daily.d === k) return;
    const n = st.daily && st.daily.d === prevDay(k) ? st.daily.n + 1 : 1;
    const b = dailyBonus(n);
    st.daily = { d: k, n };
    addChips(b); saveMeta();
    say(`🪙 Бонус дня: +${b}${n > 1 ? ` · ${n}-й день подряд` : ''}${n < 5 ? '' : ' · максимум'}`, 4200);
  }

  /* ---------- займ у Торгаша ---------- */
  function takeLoan() {
    if (chips > 0 || st.debt > 0) return false;
    st.debt = LOAN; addChips(LOAN); saveMeta();
    say('🧔 Торгаш: «Держи 200. Отдашь с выигрыша — я не тороплюсь».', 4500);
    return true;
  }

  /* ---------- ставки ---------- */
  const clampBet = v => { let r = 0; BETS.forEach(b => { if (b <= v && b <= chips) r = b; }); return r; };
  function lockBet() {
    if (NET || MODE.kind !== 'free' || !SERIES || SERIES.done || SERIES.games > 0) return;
    const k = safeKey(); if (!k) return;
    const b = st.bet;
    if (b) { /* матч не начат: стартовая ставка возвращается, начатый и брошенный — сгорает */
      if (b.seen > 0) say('Матч брошен — ставка сгорела', 3000);
      else addChips(b.amt);
      st.bet = null;
    }
    const amt = clampBet(st.sel);
    if (amt > 0) {
      addChips(-amt);
      st.bet = { k, amt, base: amt, seen: 0, offered: false };
      say(`🎲 Ставка ${amt} 🪙 принята`, 2500);
    }
    saveMeta(); paint();
  }

  /* ---------- конец партии ---------- */
  let lastGuestAt = 0;
  function settle(guest) {
    if (!G || !G.over || (MODE && MODE.kind === 'tutorial')) return;
    if (guest) {
      const key = `${NET.code}:${SERIES.games}:${G.over}:${SERIES.p}:${SERIES.b}`;
      if (st.gk === key && Date.now() - lastGuestAt < 20000) return;
      st.gk = key; lastGuestAt = Date.now();
    }
    const draw = G.over === 'draw', won = G.over === 'p';
    const done = !!(SERIES && SERIES.done), to = seriesTo(), w = SERIES.w || { p: 0, b: 0 };
    const matchWon = done && w.p >= to, matchLost = done && w.b >= to;
    const L = { lines: [], delta: 0, done, won: matchWon, lost: matchLost, chest: null, out: false, streak: st.streak, mult: 1, amt: 0, loanPaid: 0, bot: !NET && MODE.kind === 'free' };
    let gain = 0;
    if (!draw && won && !done) { const g = gameReward(); gain += g; L.lines.push(['Победа в партии', g]); }
    if (done) {
      st.matches++;
      if (matchWon) {
        st.streak++; st.best = Math.max(st.best, st.streak); st.lossRun = 0;
        L.streak = st.streak; L.mult = streakMult(st.streak);
        const base = matchReward(to), r = Math.round(base * L.mult);
        gain += r; L.lines.push([`Победа в матче${L.mult > 1 ? ` ×${String(L.mult).replace('.', ',')} 🔥` : ''}`, r]);
        try { if (L.mult > 1 && typeof PASS !== 'undefined' && PASS.add) PASS.add(Math.round(50 * (L.mult - 1)), 'серия 🔥', true); } catch (e) {}
      } else if (matchLost) {
        if (st.streak > 0) { L.out = true; fireOut(); }
        st.streak = 0; st.lossRun++; L.streak = 0;
      }
      /* сундук за каждый третий матч; каждый 10-й сундук — не ниже редкого */
      if (st.matches % 3 === 0) {
        st.chestN++;
        const r = st.chestN % 10 === 0 ? rollRarity(true) : rollRarity(false);
        st.chests.push(r); L.chest = r;
      }
      /* ставка на матч с ботом */
      const b = st.bet;
      if (b && !NET && MODE.kind === 'free' && b.k === safeKey()) {
        L.amt = b.amt;
        if (matchWon) {
          const bm = botTier().ai === 'sharper' ? 1.5 : 1;
          const prof = Math.round(b.amt * bm * L.mult);
          addChips(b.amt);                       /* ставка возвращается */
          gain += prof; L.lines.push([`Ставка ${b.amt}${bm > 1 ? ' ×1,5 (Шулер)' : ''}`, prof]);
        } else if (matchLost) { L.delta -= b.amt; L.lines.push([`Ставка ${b.amt} проиграна`, -b.amt]); }
        st.bet = null; st.lastBase = b.base;
      }
    } else if (st.bet) st.bet.seen = SERIES.games;
    if (gain > 0) { const r = income(gain); L.delta += r.net; L.loanPaid = r.paid; if (r.paid) L.lines.push(['Торгашу в счёт займа', -r.paid]); }
    st.last = L; saveMeta(); paint();
  }
  function rollRarity(rarePlus) {
    const x = Math.random();
    if (rarePlus) return x < 0.25 ? 'epic' : 'rare';
    return x < 0.05 ? 'epic' : x < 0.30 ? 'rare' : 'common';
  }

  /* ---------- сундук ---------- */
  const RAR = { common: { n: 'ОБЫЧНЫЙ', c: '#8fc7a8', dup: 30, chips: [40, 90] }, rare: { n: 'РЕДКИЙ', c: '#4fa3ff', dup: 80, chips: [120, 250] }, epic: { n: 'ЭПИЧЕСКИЙ', c: '#c46bff', dup: 200, chips: [400, 700] } };
  const POOL = {
    common: [['back', 'blue'], ['back', 'khokh'], ['back', 'neonb'], ['back', 'p-chess'], ['back', 'p-ripple'], ['back', 'p-rhomb'], ['title', 't1']],
    rare: [['back', 'gold'], ['back', 'skull'], ['back', 'p-carpet'], ['back', 'p-stars'], ['frame', 'spark'], ['frame', 'flame'], ['title', 't6'], ['title', 't11']],
    epic: [['frame', 'neon'], ['frame', 'crown'], ['table', 'p-podezd'], ['table', 'p-wagon'], ['table', 'p-roof'], ['back', 'p-retro'], ['back', 'p-holo'], ['title', 't15'], ['title', 't19']],
  };
  const KIND_RU = { back: 'Рубашка', table: 'Стол', frame: 'Рамка аватара', title: 'Титул' };
  const ICON = { back: '🃏', table: '🟩', frame: '✨', title: '🏷' };
  function itemName(kind, id) {
    try { if (typeof PASS !== 'undefined' && PASS.rewardName) { const n = PASS.rewardName(kind, id); if (n) return n; } } catch (e) {}
    if (kind === 'back') { const b = BACKS.find(x => x.id === id); if (b) return b.name; }
    return id;
  }
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  function rollChest(r) {
    const R = RAR[r];
    if (Math.random() < 0.5) {
      const n = Math.round(rnd(R.chips[0], R.chips[1]) / 5) * 5;
      return { type: 'chips', n };
    }
    const pool = POOL[r], [kind, id] = pool[Math.floor(Math.random() * pool.length)];
    let fresh = false;
    try { fresh = unlock(kind, id); } catch (e) {}
    if (fresh) return { type: 'item', kind, id };
    return { type: 'dup', kind, id, n: R.dup };
  }
  function openChest() {
    if (!st.chests.length || $c('chOv')) return;
    const r = st.chests.shift(), res = rollChest(r), R = RAR[r];
    if (res.type === 'chips') income(res.n);
    else if (res.type === 'dup') income(res.n);
    st.chestOpened = (st.chestOpened || 0) + 1; saveMeta(); paint();
    let name, sub;
    if (res.type === 'chips') { name = `+${res.n} 🪙`; sub = 'Фишки в кошелёк'; }
    else if (res.type === 'item') { name = `${ICON[res.kind]} ${itemName(res.kind, res.id)}`; sub = `${KIND_RU[res.kind]} — открыто, смотри в «Коллекции»`; }
    else { name = `+${res.n} 🪙`; sub = `${KIND_RU[res.kind]} «${itemName(res.kind, res.id)}» уже есть — обменяли на фишки`; }
    const ov = document.createElement('div');
    ov.className = 'chov shake'; ov.id = 'chOv'; ov.style.setProperty('--rc', R.c);
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Сундук');
    ov.innerHTML = `<div class="chrays"></div><div class="chcore" aria-hidden="true">🎁</div>
      <div class="chres"><span class="rar">${R.n}</span><div class="nm">${E(name)}</div><div class="sub">${E(sub)}</div></div>
      <button class="btn gold chtake" type="button" id="chTake">Забрать</button><div class="chflash"></div>`;
    document.body.appendChild(ov);
    snd('deal');
    let done = false;
    const reveal = () => {
      if (done) return; done = true;
      ov.classList.remove('shake'); ov.classList.add('flash', 'open');
      ov.querySelector('.chcore').textContent = res.type === 'chips' || res.type === 'dup' ? '🪙' : (ICON[res.kind] || '🎁');
      snd(r === 'common' ? 'combo' : 'win');
      try { if (r !== 'common') VFX.confetti(); } catch (e) {}
    };
    const t = setTimeout(reveal, calm() ? 150 : 1300);
    ov.querySelector('.chcore').onclick = () => { clearTimeout(t); reveal(); };
    $c('chTake').onclick = () => { ov.remove(); try { showOver(); } catch (e) {} const pg = $c('page'); if (pg && !pg.hidden) openChips(); };
  }

  /* ---------- окно «Фишки» ---------- */
  function openChips() {
    const k = dayKey(), n = st.daily ? st.daily.n : 1, claimed = st.daily && st.daily.d === k;
    const next = claimed ? dailyBonus(n + 1) : dailyBonus(n);
    const toChest = 3 - (st.matches % 3);
    const mult = streakMult(st.streak);
    const chestList = st.chests.length ? `<button class="btn chchest" type="button" id="chOpen">🎁 Открыть сундук (${st.chests.length})</button>` : '';
    const loan = chips === 0 && st.debt === 0 ? `<button class="btn orange" type="button" id="chLoan">🧔 Займ у Торгаша: 200 🪙</button><p class="small">Без процентов. Вернёшь с выигрыша — половина каждой победы, пока долг не закроется.</p>` : '';
    sheet('page', `${head('Фишки 🪙')}
      <div class="cbig">${chips.toLocaleString('ru-RU')} 🪙</div>
      ${st.debt ? `<p class="small" style="text-align:center">Долг Торгашу: <b>${st.debt}</b> (возвращается с выигрышей)</p>` : ''}
      ${loan}${chestList}
      <div class="cbox"><b>🔥 Серия побед: ${st.streak}</b>${mult > 1 ? ` — фишки и опыт пропуска ×${String(mult).replace('.', ',')}` : ''}
        <table class="ctab"><tr><td>2 победы подряд</td><td>×1,2</td></tr><tr><td>4 победы подряд</td><td>×1,5</td></tr><tr><td>7 побед подряд</td><td>×2</td></tr></table>
        <div class="m small">Рекорд: ${st.best}. Поражение гасит огонь.</div></div>
      <div class="cbox"><b>Сундуки</b><div class="small">Каждый 3-й матч — сундук. Каждый 10-й сундук — гарантированно редкий или лучше. До следующего: ${toChest} ${toChest === 1 ? 'матч' : 'матча'}.</div></div>
      <div class="cbox"><b>Бонус дня</b><div class="small">${claimed ? `Сегодня получено: ${dailyBonus(n)} 🪙 (${n}-й день подряд). Завтра ${next} 🪙.` : `Сегодня ${dailyBonus(n)} 🪙.`} Растёт до 300 🪙 за каждый день подряд.</div></div>
      <div class="cbox"><b>Сколько платят</b>
        <table class="ctab">
          <tr><td>Партия: Студент / Валера / Шулер</td><td>5 / 10 / 15</td></tr>
          <tr><td>Матч: Студент / Валера / Шулер</td><td>20 / 40 / 80</td></tr>
          <tr><td>Босс карьеры</td><td>×1,5</td></tr>
          <tr><td>Ставка на матч с ботом</td><td>+ставка (×1,5 с Шулером) / −ставка</td></tr></table>
        <div class="small">Фишки — только игровые: купить их нельзя, платных сундуков нет. Ставки — до баланса.</div></div>`);
    const o = $c('chOpen'); if (o) o.onclick = () => { closeAll(); openChest(); };
    const l = $c('chLoan'); if (l) l.onclick = () => { takeLoan(); openChips(); };
  }

  /* ---------- обёртки ---------- */
  BUS.on('game:over', () => {
    try { if (!(NET && NET.role === 'guest')) settle(false); } catch (e) { console.error('[chips]', e); }
  });
  /* «выход посреди партии = поражение» (meta.js) засчитывается внутри newGame; если из-за этого матч с моей ставкой закончился — ставка сгорает */
  function preForfeit() {
    const b = st.bet; if (!b || NET) return;
    let f = null, s = null;
    try { f = JSON.parse(load('durocker-live')); } catch (e) {}
    if (!f || typeof f !== 'object' || f.kind === 'daily' || f.key !== b.k || Date.now() - (f.t || 0) < 1500) return;
    try { s = JSON.parse(load(f.key)); } catch (e) {}
    if (!s || !s.w || s.done) return;
    if (s.w.b + 1 >= (s.to || 2)) {
      st.bet = null; if (st.streak > 0) fireOut(); st.streak = 0; st.lossRun++; saveMeta(); paint();
      say('Выход посреди партии — матч проигран, ставка сгорела', 4500);
    } else b.seen = (s.games || 0) + 1;
  }
  BUS.on('game:start:before', () => { try { preForfeit(); } catch (e) { console.error('[chips]', e); } });
  BUS.on('game:start', () => { try { killDock(); lockBet(); } catch (e) { console.error('[chips]', e); } });
  BUS.on('hud:render', () => { try { paint(); if (!G || !G.over) killDock(); } catch (e) {} });
  BUS.on('menu:open', () => {
    try {
      const g = document.querySelector('#menuIn .menugrid');
      if (g) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'mi'; b.dataset.go = 'chips';
        b.innerHTML = `<b>Фишки 🪙 ${chips.toLocaleString('ru-RU')}</b><small>${st.streak ? '🔥 серия ' + st.streak + ' · ' : ''}${st.chests.length ? '🎁 сундук ждёт · ' : ''}ставки, сундуки, бонус дня</small>`;
        const ref = g.querySelector('[data-go="profile"]');
        g.insertBefore(b, ref || null);
      }
    } catch (e) {}
  });
  BUS.menuKey('chips', () => { closeAll(); openChips(); });
  BUS.on('lobby:render', () => {
    try {
      const L = $c('lobbyIn');
      if (L && $c('hostBtn') && !$c('chLobbyNote')) {
        const p = document.createElement('p'); p.className = 'small'; p.id = 'chLobbyNote';
        p.textContent = '🪙 За онлайн-матч платят фишками (40 за победу в матче). Ставки пока только против ботов.';
        L.appendChild(p);
      }
    } catch (e) {}
  });
  BUS.on('bots:open', () => { try { betPicker(); } catch (e) { console.error('[chips]', e); } });
  BUS.on('over', () => {
    try {
      if (NET && NET.role === 'guest' && G && G.over) settle(true);
      decorateOver();
    } catch (e) { console.error('[chips]', e); }
  });

  function betPicker() {
    const root = $c('botsIn'); if (!root || $c('chBetSeg')) return;
    const sel = clampBet(st.sel);
    const box = document.createElement('div');
    box.innerHTML = `<h3>Ставка 🪙 <span class="small" style="text-transform:none;letter-spacing:0">баланс ${chips}</span></h3>
      <div class="cbets" id="chBetSeg">${BETS.map(b => `<button type="button" data-b="${b}" class="${b === sel ? 'on' : ''}" ${b > chips ? 'disabled' : ''}>${b === 0 ? 'Без' : b}</button>`).join('')}</div>
      <p class="small">Выиграл матч: +ставка (×1,5 против Шулера, плюс бонус серии). Проиграл: −ставка. Ставка делается на новый матч; фишки игровые, купить их нельзя.</p>
      ${chips === 0 && !st.debt ? '<button class="btn orange" type="button" id="chLoan2">🧔 Займ у Торгаша: 200 🪙</button>' : ''}`;
    const rules = root.querySelector('h3:nth-of-type(2)');
    root.appendChild(box);
    box.querySelector('#chBetSeg').onclick = e => {
      const b = e.target.closest('[data-b]'); if (!b || b.disabled) return;
      st.sel = +b.dataset.b; saveMeta();
      box.querySelectorAll('#chBetSeg button').forEach(x => x.classList.toggle('on', x === b));
    };
    const l = box.querySelector('#chLoan2');
    if (l) l.onclick = () => { takeLoan(); const s = $c('chBetSeg'); if (s) { s.parentElement.remove(); } betPicker(); };
  }

  /* итог в фишках, сундук и «Ещё одну» — плавающая плашка над рукой (панель итога у партии и так плотная);
     удвоение — отдельное окно по центру */
  const killDock = () => { ['chDock', 'chDblWrap'].forEach(id => { const d = $c(id); if (d) d.remove(); }); };
  function decorateOver() {
    killDock();
    const o = $c('over');
    if (!o || o.hidden || !G || !G.over || (MODE && MODE.kind === 'tutorial')) return;
    if (NET && NET.role === 'guest' && !NET.connected) return;
    const L = st.last, b = st.bet;
    const botFree = !NET && MODE.kind === 'free';
    const w = SERIES.w || { p: 0, b: 0 }, to = seriesTo();
    /* 1) удвоение на решающей партии */
    const canDouble = botFree && b && b.amt > 0 && !b.offered && !SERIES.done && to >= 2 && w.p === to - 1 && w.b === to - 1 && b.k === safeKey() && chips >= b.amt && !night();
    if (canDouble) {
      const wrap = document.createElement('div');
      wrap.id = 'chDblWrap'; wrap.className = 'chdw';
      const win2 = Math.round(b.amt * 2 * (botTier().ai === 'sharper' ? 1.5 : 1));
      wrap.innerHTML = `<div class="chdbl" role="dialog" aria-label="Удвоить ставку"><h3>🎲 УДВОИТЬ?</h3><p>Счёт ${w.p}:${w.b} — решающая партия.<br>Ставка ${b.amt} → <b>${b.amt * 2}</b> 🪙<br><span class="m">выиграешь +${win2} · проиграешь −${b.amt * 2}</span></p>
        <div class="row"><button class="btn gold" type="button" id="chDbl">Удвоить ×2</button><button class="btn grey" type="button" id="chNo">Как есть</button></div></div>`;
      document.body.appendChild(wrap);
      $c('chDbl').onclick = () => { addChips(-b.amt); b.amt *= 2; b.offered = true; saveMeta(); snd('combo'); paint(); say(`🎲 Ставка удвоена: ${b.amt} 🪙`, 2500); decorateOver(); };
      $c('chNo').onclick = () => { b.offered = true; saveMeta(); decorateOver(); };
      return;
    }
    const dock = document.createElement('div'); dock.id = 'chDock'; dock.className = 'chdock';
    let any = false;
    if (L && (L.lines.length || L.out || L.chest)) {
      const ln = L.lines.map(([t, v]) => `<div class="ln"><span>${E(t)}</span><b class="${v >= 0 ? 'g' : 'r'}">${v >= 0 ? '+' : '−'}${Math.abs(v)} 🪙</b></div>`).join('');
      const tail = (L.out ? '<div class="m">🔥 Огонь погас — серия сброшена.</div>' : '') +
        (L.done && L.won && L.streak >= 2 ? `<div class="m">🔥 Серия: ${L.streak}${L.mult > 1 ? ` (×${String(L.mult).replace('.', ',')})` : ''}</div>` : '') +
        (L.chest ? `<div class="m">🎁 Сундук за матч: ${RAR[L.chest].n.toLowerCase()}</div>` : '');
      const note = document.createElement('div'); note.className = 'chnote';
      note.innerHTML = ln + tail + `<div class="m">Баланс: ${chips.toLocaleString('ru-RU')} 🪙</div>`;
      dock.appendChild(note); any = true;
    }
    if (st.chests.length) {
      const cb = document.createElement('button'); cb.type = 'button'; cb.className = 'btn chchest'; cb.textContent = `🎁 Открыть сундук${st.chests.length > 1 ? ' (' + st.chests.length + ')' : ''}`;
      cb.onclick = openChest; dock.appendChild(cb); any = true;
    }
    /* «Ещё одну» — только бот, только конец матча, без нажима ночью и после череды поражений */
    if (botFree && SERIES.done && L && L.done) {
      any = true;
      if (night() || st.lossRun >= 3) {
        const m = document.createElement('div'); m.className = 'chnote';
        m.innerHTML = night() ? '<div class="m">🌙 Поздно уже. Фишки и серия никуда не денутся — продолжим завтра.</div>' : '<div class="m">Три матча подряд мимо — самое время размяться или попить чаю. Ставки подождут.</div>';
        dock.appendChild(m);
      } else {
        const base = st.lastBase != null ? st.lastBase : st.sel;
        const amt = clampBet(base);
        const m = document.createElement('button'); m.type = 'button'; m.className = 'btn chmore';
        m.innerHTML = `⚡ ЕЩЁ ОДНУ${amt ? ` <small style="font-weight:600">· ставка ${amt}</small>` : ''}`;
        m.onclick = () => { killDock(); st.sel = amt; saveMeta(); newGame(); };
        dock.appendChild(m);
      }
    }
    if (any) { const row = o.querySelector('.row'); if (row) o.insertBefore(dock, row); else document.body.appendChild(dock); }
  }

  /* ---------- запуск ---------- */
  ensureBar(); paint();
  setTimeout(() => { try { claimDaily(); paint(); } catch (e) {} }, 1600);
  window.CHIPS = { get: () => chips, state: () => st, add: n => { addChips(n); saveMeta(); } };
})();
