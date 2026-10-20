/* ДурКер — праздничные темы.
   Новый год (20.12–10.01), Хэллоуин (25.10–02.11), 1 апреля, 23 февраля и 8 марта — по Москве.
   Класс на <html> (ev-ny / ev-halloween / ev-april / ev-feb23 / ev-mar8), стили вставляются отсюда,
   лёгкие canvas-частицы над столом (выключены при reduced-motion и «Без анимаций»).
   Особые боссы: «Дед Мороз» и «Граф Козырула» — бой из меню, победа открывает рубашку.
   Проверка вручную: ?event=ny | halloween | april | feb23 | mar8. Выключатель — Настройки → «Праздничные темы». */
'use strict';

const EVENTS = (() => {
  const MSK = 3 * 3600000;
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const escH = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  const LIST = {
    ny: { cls: 'ev-ny', name: 'Новый год', boss: { id: 'ev-ded', ai: 'valera', style: 'mihalych', name: 'Дед Мороз', face: 'ДМ', color: '#1e88e5',
      short: 'новогодний босс', desc: 'Дед Мороз пришёл с мешком подарков и колодой в рукаве. Обыграешь — рубашка «Новогодняя» твоя.',
      back: { id: 'ev-ny', name: 'Новогодняя', css: 'radial-gradient(circle at 50% 50%,#fff 0 7%,transparent 8%) 0 0/16px 16px,repeating-linear-gradient(45deg,#c62828 0 8px,#1b5e20 8px 16px)' } } },
    halloween: { cls: 'ev-halloween', name: 'Хэллоуин', boss: { id: 'ev-graf', ai: 'sharper', style: 'lite', name: 'Граф Козырула', face: 'ГК', color: '#6a1b9a',
      short: 'хэллоуинский босс', desc: 'Граф Козырула пьёт только козырей. Обыграй его до рассвета — получишь рубашку «Тыквенная ночь».',
      back: { id: 'ev-halloween', name: 'Тыквенная ночь', css: 'radial-gradient(circle at 50% 50%,#ff9800 0 22%,transparent 23%) 0 0/18px 18px,#2a0a3d' } } },
    april: { cls: 'ev-april', name: '1 апреля' },
    feb23: { cls: 'ev-feb23', name: '23 февраля' },
    mar8: { cls: 'ev-mar8', name: '8 марта' },
  };
  const APRIL_HYPE = {
    gg: ['ГГ, ПЕРВОАПРЕЛЬСКИЙ ВП', 'ШУТКА, ДУРАК ЧЁ'], dry: ['ВСУХУЮ! (НЕ ШУТКА)', 'РАЗМАЗАЛИ, С ПРАЗДНИКОМ'],
    legend: ['ЛЕГЕНДА (ПО ВЕРСИИ КАРТ)', 'ДА ЛАДНО?! 1 АПРЕЛЯ ЖЕ'], mognul: ['МОГНУЛ! ИЛИ ПОКАЗАЛОСЬ?', 'ТЕБЯ МОГНУЛИ. ШУТКА. НЕТ'],
  };

  const params = () => { try { return new URLSearchParams(location.search); } catch (e) { return new URLSearchParams(''); } };
  const forced = () => { const e = params().get('event'); return e && LIST[e] ? e : null; };
  function byDate(now = Date.now()) {
    const d = new Date(now + MSK), m = d.getUTCMonth() + 1, day = d.getUTCDate();
    if ((m === 12 && day >= 20) || (m === 1 && day <= 10)) return 'ny';
    if ((m === 10 && day >= 25) || (m === 11 && day <= 2)) return 'halloween';
    if (m === 4 && day === 1) return 'april';
    if (m === 2 && day === 23) return 'feb23';
    if (m === 3 && day === 8) return 'mar8';
    return null;
  }
  const enabled = () => rd('durocker-events') !== '0';
  const current = () => forced() || (enabled() ? byDate() : null);
  let cur = null, fight = false;

  const reducedNow = () => {
    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return true; } catch (e) {}
    try { return typeof speedMode === 'function' && speedMode() === 'off'; } catch (e) { return false; }
  };

  /* ---------- стили ---------- */
  function css() {
    if (document.getElementById('evcss')) return;
    const st = document.createElement('style'); st.id = 'evcss';
    st.textContent = `
html[data-back="ev-ny"]{--backbg:${LIST.ny.boss.back.css}}
html[data-back="ev-halloween"]{--backbg:${LIST.halloween.boss.back.css}}
.evcv{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:6;border-radius:inherit}
.evdeco{position:absolute;left:0;right:0;top:0;height:26px;pointer-events:none;z-index:5;display:flex;justify-content:space-around;align-items:flex-start;overflow:hidden;border-radius:26px 26px 0 0}
.evdeco i{display:block;width:9px;height:13px;border-radius:50% 50% 55% 55%;margin-top:7px;box-shadow:0 0 8px 2px currentColor;background:currentColor;animation:evblink 1.6s infinite}
.evdeco::before{content:"";position:absolute;left:0;right:0;top:4px;height:2px;background:#1b3a1b;opacity:.8}
.evdeco i:nth-child(3n){color:#ff5252}.evdeco i:nth-child(3n+1){color:#ffd54a;animation-delay:.5s}.evdeco i:nth-child(3n+2){color:#4fc3f7;animation-delay:1s}
@keyframes evblink{0%,100%{opacity:1}50%{opacity:.35}}
.evpump{position:absolute;pointer-events:none;z-index:5;font-size:26px;line-height:1;filter:drop-shadow(0 0 6px #ff9800)}
.evfog{position:absolute;inset:0;pointer-events:none;z-index:4;border-radius:inherit;
  background:radial-gradient(ellipse at 20% 100%,rgba(140,60,200,.45),transparent 55%),radial-gradient(ellipse at 85% 90%,rgba(110,40,170,.4),transparent 50%);animation:evfog 9s ease-in-out infinite alternate}
@keyframes evfog{from{opacity:.55;transform:translateX(-2%)}to{opacity:1;transform:translateX(2%)}}
html.ev-ny .felt{box-shadow:inset 0 0 0 3px rgba(255,255,255,.18),inset 0 0 40px rgba(120,190,255,.18)}
html.ev-halloween .felt{box-shadow:inset 0 0 0 3px rgba(255,152,0,.3),inset 0 0 50px rgba(106,27,154,.5)}
html.ev-halloween body{background-image:radial-gradient(ellipse at 50% 0,rgba(106,27,154,.35),transparent 60%)}
html.ev-feb23 .felt{box-shadow:inset 0 0 0 3px rgba(198,40,40,.4),inset 0 0 40px rgba(255,235,59,.12)}
html.ev-mar8 .felt{box-shadow:inset 0 0 0 3px rgba(244,143,177,.55),inset 0 0 44px rgba(255,235,59,.14)}
html.ev-feb23 body{background-image:linear-gradient(180deg,rgba(76,110,60,.28),transparent 40%)}
html.ev-mar8 body{background-image:linear-gradient(180deg,rgba(240,98,146,.25),transparent 40%)}
html.ev-april .hand.ev-flip{transform:rotate(180deg);transition:transform .35s}
html.ev-april .hand{transition:transform .35s}
.mi.ev b{color:var(--gold,#eab54b)}
@media (prefers-reduced-motion:reduce){.evdeco i,.evfog{animation:none}}`;
    document.head.appendChild(st);
  }

  /* ---------- декор стола и частицы ---------- */
  let cv = null, raf = 0, parts = [], lastT = 0;
  function felt() { return document.getElementById('felt'); }
  function clearDeco() {
    cancelAnimationFrame(raf); raf = 0; cv = null; parts = [];
    document.querySelectorAll('.evcv,.evdeco,.evpump,.evfog').forEach(e => e.remove());
  }
  function deco(id) {
    const f = felt(); if (!f) return;
    if (id === 'ny') {
      const g = document.createElement('div'); g.className = 'evdeco'; g.innerHTML = '<i></i>'.repeat(14); f.appendChild(g);
    } else if (id === 'halloween') {
      const fog = document.createElement('div'); fog.className = 'evfog'; f.appendChild(fog);
      [['left:8px;bottom:6px'], ['right:8px;bottom:6px'], ['left:46%;top:4px']].forEach(([s], i) => {
        const p = document.createElement('div'); p.className = 'evpump'; p.style.cssText = s; p.textContent = i === 2 ? '🦇' : '🎃'; f.appendChild(p);
      });
    }
  }
  function spawn(id, w, h, fromTop) {
    if (id === 'ny') return { x: Math.random() * w, y: fromTop ? -6 : Math.random() * h, r: 1 + Math.random() * 2.2, vy: 14 + Math.random() * 26, vx: -6 + Math.random() * 12, ph: Math.random() * 6 };
    if (id === 'halloween') return { x: Math.random() * w, y: fromTop ? h + 6 : Math.random() * h, r: 1 + Math.random() * 2, vy: -(8 + Math.random() * 16), vx: -5 + Math.random() * 10, ph: Math.random() * 6 };
    return { x: Math.random() * w, y: fromTop ? -6 : Math.random() * h, r: 2 + Math.random() * 2, vy: 12 + Math.random() * 18, vx: -8 + Math.random() * 16, ph: Math.random() * 6 };
  }
  function particles(id) {
    const f = felt(); if (!f || reducedNow()) return;
    cv = document.createElement('canvas'); cv.className = 'evcv'; f.appendChild(cv);
    const ctx = cv.getContext('2d'); if (!ctx) return;
    const size = () => { const r = f.getBoundingClientRect(); cv.width = Math.max(1, r.width | 0); cv.height = Math.max(1, r.height | 0); };
    size();
    const n = id === 'ny' ? 46 : id === 'halloween' ? 22 : 16;
    parts = Array.from({ length: n }, () => spawn(id, cv.width, cv.height, false));
    const col = { ny: 'rgba(255,255,255,.85)', halloween: 'rgba(190,120,255,.5)', feb23: 'rgba(255,235,59,.7)', mar8: 'rgba(244,143,177,.75)', april: 'rgba(255,255,255,.6)' }[id];
    lastT = 0; let tick = 0;
    const frame = t => {
      raf = requestAnimationFrame(frame);
      if (!cv || !cv.isConnected) return;
      if (document.hidden) { lastT = 0; return; }
      if ((tick++ & 31) === 0 && reducedNow()) { clearDeco(); deco(id); return; }
      const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016; lastT = t;
      if (cv.width !== (f.clientWidth | 0) || cv.height !== (f.clientHeight | 0)) size();
      ctx.clearRect(0, 0, cv.width, cv.height); ctx.fillStyle = col;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]; p.ph += dt * 1.5; p.x += (p.vx + Math.sin(p.ph) * 8) * dt; p.y += p.vy * dt;
        if (p.y > cv.height + 8 || p.y < -8 || p.x < -8 || p.x > cv.width + 8) { parts[i] = spawn(id, cv.width, cv.height, true); continue; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.2832); ctx.fill();
      }
    };
    raf = requestAnimationFrame(frame);
  }

  /* ---------- включение темы ---------- */
  function apply() {
    const id = current(), de = document.documentElement;
    Object.values(LIST).forEach(v => de.classList.remove(v.cls));
    clearDeco(); cur = id;
    if (!id) return;
    css(); de.classList.add(LIST[id].cls); de.dataset.event = id;
    deco(id); particles(id);
    if (id === 'april' && typeof HYPE !== 'undefined') Object.entries(APRIL_HYPE).forEach(([k, v]) => { if (HYPE[k]) { HYPE[k].rude = v.slice(); HYPE[k].clean = v.slice(); } });
    registerBacks();
  }
  function registerBacks() {
    try { ['ny', 'halloween'].forEach(k => { const b = LIST[k].boss.back; if (!BACKS.some(x => x.id === b.id)) BACKS.push({ id: b.id, name: b.name }); }); } catch (e) {}
  }

  /* ---------- боссы ---------- */
  const boss = () => (cur && LIST[cur] && LIST[cur].boss) || null;
  function startFight() {
    const b = boss(); if (!b) return;
    try { closeSheets(); } catch (e) {}
    fight = true;
    setMode({ kind: 'free' });
  }

  function hook() {
    css(); registerBacks();
    if (typeof currentBot === 'function') {
      const _cb = currentBot;
      currentBot = function () { const b = boss(); if (fight && b && MODE && MODE.kind === 'free' && !(typeof NET !== 'undefined' && NET)) return { ...b, boss: 'event', level: 'праздничный босс' }; return _cb.apply(this, arguments); };
    }
    if (typeof setMode === 'function') {
      const _sm = setMode;
      setMode = function (m) { if (!(m && m.kind === 'free' && fight)) fight = false; return _sm.apply(this, arguments); };
      /* setMode выше уже вызван из startFight с fight=true; любой другой вызов сбросит флаг */
    }
    if (typeof onGameOver === 'function') {
      const _go = onGameOver;
      onGameOver = function () {
        const r = _go.apply(this, arguments);
        try {
          const b = boss();
          if (fight && b && G && G.over === 'p' && unlock('back', b.back.id)) setTimeout(() => { try { toast(`🎁 Рубашка «${b.back.name}» — твоя!`, 3500); } catch (e) {} }, 3000);
        } catch (e) {}
        return r;
      };
    }
    if (typeof newGame === 'function') {
      const _ng = newGame;
      newGame = function () {
        const r = _ng.apply(this, arguments);
        if (cur === 'april') flip();
        return r;
      };
    }
    if (typeof openMenu === 'function') {
      const _om = openMenu;
      openMenu = function () {
        const r = _om.apply(this, arguments);
        try {
          const b = boss(), g = document.querySelector('#menuIn .menugrid');
          if (b && g && !g.querySelector('[data-go="event"]')) {
            const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'mi ev'; bt.dataset.go = 'event';
            bt.innerHTML = `<b>${escH(LIST[cur].name)}: ${escH(b.name)}</b><small>${escH(b.short)} · награда — рубашка «${escH(b.back.name)}»</small>`;
            const after = g.querySelector('[data-go="daily"]');
            if (after && after.nextSibling) g.insertBefore(bt, after.nextSibling); else g.appendChild(bt);
          }
        } catch (e) {}
        return r;
      };
    }
    if (typeof menuGo === 'function') {
      const _mg = menuGo;
      menuGo = function (k) { if (k === 'event') { startFight(); return; } return _mg.apply(this, arguments); };
    }
    if (typeof openSettings === 'function') {
      const _os = openSettings;
      openSettings = function () { const r = _os.apply(this, arguments); try { settingsRow(); } catch (e) {} return r; };
    } else {
      /* openSettings нет — следим за окном настроек */
      const pg = document.getElementById('pageIn');
      if (pg) new MutationObserver(() => { try { settingsRow(); } catch (e) {} }).observe(pg, { childList: true });
    }
  }

  function flip() {
    const h = document.getElementById('hand'); if (!h) return;
    h.classList.add('ev-flip');
    setTimeout(() => h.classList.remove('ev-flip'), 3000);
  }

  function settingsRow() {
    const anchor = document.getElementById('stTransfer') || document.getElementById('stBlitz');
    if (!anchor || document.getElementById('stEvents')) return;
    const lab = anchor.closest('label') || anchor.parentElement;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<h3>Праздничные темы</h3>${typeof toggleHTML === 'function' ? toggleHTML('stEvents', 'Новый год, Хэллоуин, 1 апреля, 23 февраля, 8 марта', enabled()) : ''}
      <p class="small">Снег, тыквы, шутки и особые боссы в праздничные даты (по Москве).</p>`;
    lab.parentNode.insertBefore(wrap, lab.nextSibling);
    const t = document.getElementById('stEvents');
    if (t) t.onchange = e => { wr('durocker-events', e.target.checked ? '1' : '0'); apply(); };
  }

  function init() {
    hook();
    apply();
    document.addEventListener('visibilitychange', () => { if (!document.hidden && cur && !raf && !reducedNow()) { clearDeco(); deco(cur); particles(cur); } });
  }
  /* скрипт стоит перед main.js: обёртки надо поставить сейчас, пока обработчики ещё не привязаны к оригиналам */
  init();
  return { current, byDate, apply, LIST };
})();
