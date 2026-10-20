/* ДурКер — доступность, вибро-отклик и быстрые ссылки (волна 7).
   · режимы: «для дальтоников» (палитра Окабе–Ито + узор на картах), размер текста, крупные кнопки, высокий контраст,
     «меньше вспышек и тряски», озвучка ходов для скринридера (aria-live);
   · рука с клавиатуры и скринридера: у каждой карты название, Tab заходит в руку, стрелки ходят по картам, Enter/Пробел выбирают;
   · ползунки громкости и тумблер вибрации в настройках; вибро-паттерны на победу, проигрыш и сундук;
   · ярлыки манифеста: ?go=play (ИГРАТЬ) и ?go=rogue («Ночь в казино»).
   Встраивается через шину (BUS), чужие файлы не правит. */
'use strict';

const ACC = (() => {
  const K = 'durocker-acc', DEF = { cb: 0, ts: 0, big: 0, hc: 0, flash: 0, sr: 1 };
  let st = { ...DEF };
  try { st = { ...DEF, ...JSON.parse(load(K) || '{}') }; } catch (e) {}
  const root = document.documentElement;
  const save = () => store(K, JSON.stringify(st));
  function apply() {
    root.dataset.cb = st.cb ? '1' : '0';
    root.dataset.ts = String(st.ts | 0);
    root.dataset.big = st.big ? '1' : '0';
    root.dataset.hc = st.hc ? '1' : '0';
    root.dataset.flash = st.flash ? '1' : '0';
  }
  function set(k, v) { st[k] = v; save(); apply(); }
  apply();

  /* ---------- озвучка для скринридера ---------- */
  let live = null, lastMsg = '', lastT = 0;
  function ensureLive() {
    if (live && live.isConnected) return live;
    live = document.createElement('div');
    live.id = 'srLive'; live.className = 'sr-only';
    live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite'); live.setAttribute('aria-atomic', 'true');
    document.body.appendChild(live);
    return live;
  }
  function announce(msg) {
    if (!st.sr || !msg) return;
    const now = Date.now();
    if (msg === lastMsg && now - lastT < 1500) return;
    lastMsg = msg; lastT = now;
    const el = ensureLive();
    el.textContent = '';
    setTimeout(() => { el.textContent = msg; }, 30);
  }
  const lc = s => String(s || '').toLowerCase();
  const rankWord = r => ({ 11: 'валет', 12: 'дама', 13: 'король', 14: 'туз' })[r] || String(r);
  const suitGen = ['пик', 'червей', 'бубен', 'треф'];
  function spoken(c) {
    if (!c) return '';
    if (c.joker) return 'джокер';
    if (c.action) return `карта-действие «${ACTS[c.action].name}» масти ${suitGen[c.s] || ''}`;
    return `${rankWord(c.r)} ${suitGen[c.s]}`;
  }
  const oppN = () => { try { return oppName(); } catch (e) { return 'Соперник'; } };
  function sayFx(d) {
    const o = d.o || {}, me = o.actor === 'p', who = me ? 'Ты' : oppN(), big = lc(o.big);
    switch (o.what) {
      case 'attack': return `${who} ${me ? 'атакуешь' : 'атакует'}: ${big}`;
      case 'throw': return `${who} ${me ? 'подкидываешь' : 'подкидывает'}: ${big}`;
      case 'addtake': return `${who} ${me ? 'подкидываешь вдогонку' : 'подкидывает вдогонку'}: ${big}`;
      case 'defend': return `${who} ${me ? 'покрыл' : 'покрыл'}: ${big}`;
      case 'takes': return me ? 'Ты берёшь карты' : `${oppN()} берёт карты`;
      case 'bito': return 'Бито';
      case 'transfer': return me ? 'Ты перевёл атаку' : `${oppN()} перевёл атаку тебе`;
      case 'charged': return `${who} ${me ? 'получил' : 'получил'} карту-действие`;
      case 'action': return `${who} ${me ? 'сыграл' : 'сыграл'} карту-действие «${ACTS[o.act] ? ACTS[o.act].name : ''}»`;
      case 'trump': return 'Козырь определён';
      case 'hype': return o.key === 'mognul' ? (me ? 'Могнул! Соперник получает штраф' : 'Тебя могнули: тебе штраф') : '';
    }
    return '';
  }
  function sayTurn(d) {
    try {
      if (!G || G.over || !G.phase) return '';
      const k = G.phase.kind;
      if (G.phase.who === 'p') return ({ attack: 'Твой ход: атакуй', defend: 'Отбивайся', throw: 'Можешь подкинуть или сказать «Бито»', addtake: 'Можно подкинуть вдогонку' })[k] || 'Твой ход';
      if (G.phase.who === 'b') return `${oppN()} думает`;
    } catch (e) {}
    return '';
  }
  BUS.on('fx', d => announce(sayFx(d)));
  BUS.on('turn', d => announce(sayTurn(d)));
  BUS.on('over', d => {
    if (!d || !d.over) return;
    announce(d.over === 'p' ? `Партия окончена. Ты победил. Штраф сопернику ${d.penalty != null ? d.penalty : ''}` : `Партия окончена. Ты проиграл. Штраф тебе ${d.penalty != null ? d.penalty : ''}`);
  });
  BUS.on('say', d => announce(d.text));
  BUS.hook('toast', (next, args) => { try { announce(String(args[0] || '')); } catch (e) {} return next(); });

  /* ---------- «меньше вспышек и тряски»: стола не трясём ---------- */
  BUS.hook('shake', next => (st.flash ? undefined : next()));

  /* ---------- рука: фокус, названия карт, стрелки ---------- */
  let hand = null, rov = 0, raf = 0;
  function labelHand() {
    raf = 0;
    if (!hand) return;
    const slots = [...hand.querySelectorAll('.slot')];
    if (rov >= slots.length) rov = Math.max(0, slots.length - 1);
    slots.forEach((s, i) => {
      const card = s.querySelector('.card'); if (!card) return;
      let c = null;
      try { c = (G && G.P || []).find(x => x.id === card.dataset.id); } catch (e) {}
      s.setAttribute('role', 'button');
      s.setAttribute('tabindex', i === rov ? '0' : '-1');
      s.setAttribute('aria-label', spoken(c) || 'карта');
      s.setAttribute('aria-pressed', s.classList.contains('sel') ? 'true' : 'false');
    });
  }
  const queue = () => { if (!raf) raf = requestAnimationFrame(labelHand); };
  function bindHand() {
    hand = document.getElementById('hand');
    if (!hand) return;
    new MutationObserver(queue).observe(hand, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    hand.addEventListener('focusin', e => { const s = e.target.closest && e.target.closest('.slot'); if (s) { rov = [...hand.querySelectorAll('.slot')].indexOf(s); labelHand(); } });
    hand.addEventListener('keydown', e => {
      const s = e.target.closest && e.target.closest('.slot'); if (!s) return;
      const slots = [...hand.querySelectorAll('.slot')], i = slots.indexOf(s);
      let to = -1;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = Math.min(slots.length - 1, i + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = Math.max(0, i - 1);
      else if (e.key === 'Home') to = 0;
      else if (e.key === 'End') to = slots.length - 1;
      if (to >= 0) { e.preventDefault(); e.stopPropagation(); rov = to; labelHand(); slots[to].focus(); return; }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); e.stopPropagation();
        const card = s.querySelector('.card');
        if (card && typeof toggleCard === 'function') { toggleCard(card.dataset.id); labelHand(); announce(spoken((G.P || []).find(x => x.id === card.dataset.id)) + (s.classList.contains('sel') ? ': выбрана' : ': снята')); }
      }
    });
    queue();
  }

  /* ---------- настройки ---------- */
  const tg = (id, label, on, small) => `<label class="toggle"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span></span>${label}</label>${small ? `<p class="small">${small}</p>` : ''}`;
  const pct = v => Math.round(v * 100);
  function soundBlock() {
    return `<div class="accblock" id="accSound">
      <label class="vol"><span>Громкость музыки</span><input type="range" id="accMV" min="0" max="100" value="${pct(AU.mvol)}" aria-label="Громкость музыки"><output id="accMVo">${pct(AU.mvol)}%</output></label>
      <label class="vol"><span>Громкость эффектов</span><input type="range" id="accSV" min="0" max="100" value="${pct(AU.svol)}" aria-label="Громкость эффектов"><output id="accSVo">${pct(AU.svol)}%</output></label>
    </div>`;
  }
  function accBlock() {
    const canVib = !!(navigator.vibrate || (typeof TGA !== 'undefined' && TGA && TGA.HapticFeedback));
    return `<div class="accblock" id="accBlock">
      <h3>Вибрация</h3>
      ${tg('accBuzz', 'Вибро-отклик на победу, проигрыш, «могнул» и сундук', load('durocker-buzz') !== '0', canVib ? '' : 'На этом устройстве вибрация недоступна: она работает на Android и в Telegram.')}
      <h3>Доступность</h3>
      ${tg('accCb', 'Для дальтоников: масти различаются узором, цвета без красного и зелёного', !!st.cb)}
      <div class="seg" id="accTs" role="group" aria-label="Размер текста">${[[0, 'Текст A'], [1, 'A+'], [2, 'A++']].map(([k, n]) => `<button type="button" data-ts="${k}" class="${(st.ts | 0) === k ? 'on' : ''}" aria-pressed="${(st.ts | 0) === k}">${n}</button>`).join('')}</div>
      ${tg('accBig', 'Крупные кнопки', !!st.big)}
      ${tg('accHc', 'Высокий контраст', !!st.hc)}
      ${tg('accFl', 'Меньше вспышек и тряски', !!st.flash)}
      ${tg('accSr', 'Озвучивать ходы для скринридера', !!st.sr, 'Рука доступна с клавиатуры: Tab, стрелки, Enter или Пробел.')}
    </div>`;
  }
  function paintRange(el) { el.style.setProperty('--p', el.value + '%'); }
  function bindSettings() {
    const mv = document.getElementById('accMV'), sv = document.getElementById('accSV');
    if (mv) {
      paintRange(mv);
      mv.oninput = () => { AU.unlock(); AU.setMusicVol(mv.value / 100); document.getElementById('accMVo').textContent = mv.value + '%'; paintRange(mv); };
    }
    if (sv) {
      paintRange(sv);
      sv.oninput = () => { AU.unlock(); AU.setSfxVol(sv.value / 100); document.getElementById('accSVo').textContent = sv.value + '%'; paintRange(sv); };
      sv.onchange = () => AU.play('chips', 100);
    }
    const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onchange = () => fn(el.checked); };
    bind('accBuzz', v => { store('durocker-buzz', v ? '1' : '0'); if (v && typeof buzz === 'function') buzz('big'); });
    bind('accCb', v => set('cb', v ? 1 : 0));
    bind('accBig', v => set('big', v ? 1 : 0));
    bind('accHc', v => set('hc', v ? 1 : 0));
    bind('accFl', v => set('flash', v ? 1 : 0));
    bind('accSr', v => { set('sr', v ? 1 : 0); if (v) announce('Озвучка ходов включена'); });
    const ts = document.getElementById('accTs');
    if (ts) ts.onclick = e => {
      const b = e.target.closest('[data-ts]'); if (!b) return;
      set('ts', +b.dataset.ts);
      ts.querySelectorAll('button').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
    };
  }
  BUS.on('settings:open', () => {
    const host = document.getElementById('pageIn');
    if (!host || host.querySelector('#accBlock')) return;
    const sfxLabel = document.getElementById('stSfx') && document.getElementById('stSfx').closest('label');
    if (sfxLabel) sfxLabel.insertAdjacentHTML('afterend', soundBlock()); else host.insertAdjacentHTML('beforeend', soundBlock());
    host.insertAdjacentHTML('beforeend', accBlock());
    bindSettings();
  });

  /* ---------- вибро-отклик ---------- */
  /* ui.js зовёт buzz('big' | 'bad') и на «могнул», и в конце партии. В конце партии ('big' — ты выиграл, 'bad' — проиграл)
     заменяем одиночный импульс на узор; сундук и новые виды вибро идут по своим паттернам. */
  const PAT = { win: [25, 40, 25, 40, 25, 40, 120], lose: [140, 70, 140, 70, 220], chest: [8, 25, 8, 25, 8, 25, 8, 25, 8, 25, 90], chestopen: [40, 30, 140] };
  function pulse(kind) {
    if (load('durocker-buzz') === '0') return;
    try {
      const hf = typeof TGA !== 'undefined' && TGA && TGA.HapticFeedback;
      if (hf) {
        if (kind === 'win') hf.notificationOccurred('success');
        else if (kind === 'lose') hf.notificationOccurred('error');
        else { hf.impactOccurred('light'); setTimeout(() => hf.impactOccurred('medium'), 120); setTimeout(() => hf.notificationOccurred('success'), 300); }
        return;
      }
      if (navigator.vibrate) navigator.vibrate(PAT[kind]);
    } catch (e) {}
  }
  BUS.hook('buzz', (next, args) => {
    let k = args[0];
    try { if ((k === 'big' || k === 'bad') && typeof G !== 'undefined' && G && G.over) k = k === 'big' ? 'win' : 'lose'; } catch (e) {}
    if (PAT[k]) { pulse(k); return; }
    return next(k === args[0] ? undefined : [k]);
  });
  /* сундук: дрожь при появлении и всплеск при открытии (узел рисует chips.js) */
  document.addEventListener('DOMContentLoaded', () => {
    try {
      new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
        if (n.id !== 'chOv') return;
        pulse('chest');
        new MutationObserver((_, o) => { if (n.classList.contains('open')) { o.disconnect(); pulse('chestopen'); } }).observe(n, { attributes: true, attributeFilter: ['class'] });
      }))).observe(document.body, { childList: true });
    } catch (e) {}
    ensureLive(); bindHand();
    /* ярлыки установленного приложения: ?go=play и ?go=rogue */
    const go = new URLSearchParams(location.search).get('go');
    if (go) addEventListener('load', () => setTimeout(() => {
      try {
        if (go === 'rogue' && typeof menuGo === 'function') menuGo('rogue');
        else if (go === 'play') { const b = document.querySelector('.lb-play'); if (b) b.click(); }
      } catch (e) {}
    }, 1200));
  });

  return { get: () => ({ ...st }), set, announce, spoken, pulse, PAT };
})();
