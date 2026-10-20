/* ДурКер — волна 6B: стол и карты.
   · умный веер (крупные карты, несколько рядов при большой руке, группировка по мастям, «подъём» под пальцем);
   · полёт карт по дуге с тенью на земле, «вес» посадки, пыль цвета масти;
   · slow-mo на «могнул» с затемнением краёв;
   · тема стола по району карьеры и режиму (рисуется CSS из table.css, здесь только data-district). */
'use strict';

const TABLE = (() => {
  const WIDE_MQ = '(orientation:landscape) and (max-height:520px), (min-width:900px) and (min-height:521px)';
  const isWide = () => matchMedia(WIDE_MQ).matches;
  const isShort = () => matchMedia('(orientation:landscape) and (max-height:520px)').matches;
  const speed = () => (typeof speedMode === 'function' ? speedMode() : 'normal');
  const noMotion = () => (typeof reduced !== 'undefined' && reduced) || speed() === 'off';

  /* ================= веер ================= */
  const LIFT = 16, BOTTOM = 12;
  function splitRows(n, r) {
    const per = Math.ceil(n / r), rows = [];
    for (let i = 0; i < n; i += per) rows.push(Array.from({ length: Math.min(per, n - i) }, (_, k) => i + k));
    return rows;
  }
  /* раскладка под ширину W и ширину карты cw: сколько рядов и какой шаг */
  function plan(n, W, cw, suits, grp, maxRows, opts) {
    const pad = cw * 0.34, GAP = 0.4;
    for (let r = 1; r <= maxRows; r++) {
      const rows = splitRows(n, r);
      let step = Infinity;
      for (const row of rows) {
        let bnd = 0;
        if (grp) for (let k = 1; k < row.length; k++) if (suits[row[k]] !== suits[row[k - 1]]) bnd++;
        const units = row.length - 1 + bnd * GAP;
        step = Math.min(step, units > 0 ? (W - cw - pad * 2) / units : Infinity);
      }
      step = Math.min(step, cw * opts.spread);
      if (step >= cw * 0.5 || r === maxRows) {
        const m = Math.max(...rows.map(x => x.length)), mx = (m - 1) / 2, kk = Math.min(1, 9 / m);
        const arcMax = mx * mx * opts.arc * kk, rowH = cw * 1.4, rowStep = rowH * 0.5;
        return { rows, step, GAP, rowH, rowStep, arcMax, H: rowH + (r - 1) * rowStep + LIFT + BOTTOM + arcMax + 4 };
      }
    }
  }
  function fan(el, opts) {
    const s = [...el.children], n = s.length;
    if (!n) return;
    const isHand = el.id === 'hand';
    if (isHand) el.style.removeProperty('--w');
    const W = el.clientWidth;
    if (W < 20) return;
    const natural = s[0].firstElementChild.offsetWidth;
    if (!natural) return;
    const suits = s.map(sl => sl.dataset.s || '');
    const grp = isHand && typeof G !== 'undefined' && G && G.sort === 's';
    if (isHand) el.classList.toggle('grp', !!grp);
    let cw = natural, p;
    if (isHand) {
      const wide = isWide(), maxRows = wide ? 2 : 3;
      const maxH = wide ? innerHeight * (isShort() ? 0.4 : 0.38) : Infinity;
      p = plan(n, W, cw, suits, grp, maxRows, opts);
      for (let k = 0; k < 6 && p.H > maxH && cw > natural * 0.62; k++) { cw *= 0.93; p = plan(n, W, cw, suits, grp, maxRows, opts); }
      if (Math.abs(cw - natural) > 0.5) el.style.setProperty('--w', cw.toFixed(1) + 'px');
      el.style.height = Math.ceil(p.H) + 'px';
    } else p = plan(n, W, cw, suits, false, 1, opts);
    const R = p.rows.length;
    p.rows.forEach((row, k) => {
      const m = row.length, mx = (m - 1) / 2, kk = Math.min(1, 9 / m);
      let bnd = 0; const before = [0];
      for (let i = 1; i < m; i++) { if (grp && suits[row[i]] !== suits[row[i - 1]]) bnd++; before.push(bnd); }
      const total = p.step * (m - 1 + bnd * p.GAP) + cw, x0 = (W - total) / 2;
      const rowY = -(R - 1 - k) * p.rowStep * opts.dir;
      row.forEach((idx, i) => {
        const sl = s[idx], off = i - mx;
        const rot = off * opts.ang * kk * opts.dir, y = (off * off - mx * mx) * opts.arc * kk * opts.dir + rowY;
        sl.style.left = (x0 + p.step * (i + before[i] * p.GAP)).toFixed(1) + 'px';
        sl.style.zIndex = (sl.classList.contains('sel') ? 1000 : 0) + k * 60 + i;
        sl.style.setProperty('--y', y.toFixed(1) + 'px');
        sl.style.setProperty('--r', rot.toFixed(2) + 'deg');
      });
    });
  }

  /* карта под пальцем приподнимается (на мыши то же делает :hover) */
  function bindPeek() {
    const hand = $('hand');
    let cur = null, down = false;
    const set = el => { if (cur === el) return; if (cur) cur.classList.remove('peek'); cur = el; if (cur) cur.classList.add('peek'); };
    const slotAt = (x, y) => { const e = document.elementFromPoint(x, y); return e && e.closest && e.closest('#hand .slot'); };
    hand.addEventListener('pointerdown', e => { if (e.pointerType === 'mouse') return; down = true; set(slotAt(e.clientX, e.clientY)); });
    addEventListener('pointermove', e => { if (down && e.pointerType !== 'mouse') set(slotAt(e.clientX, e.clientY)); });
    const up = () => { down = false; setTimeout(() => set(null), 90); };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function bindSort() {
    [['sortR', 'r'], ['sortS', 's']].forEach(([id, v]) => { const b = $(id); if (b) b.addEventListener('click', () => { try { store('durocker-sort', v); } catch (e) {} }, true); });
  }

  /* ================= полёт по дуге ================= */
  const ang = (a, b, t) => a + (b - a) * t;
  function suitOf(el) { const f = el.querySelector('.front'); const m = f && /\bs(\d)\b/.exec(f.className); return el.classList.contains('joker') ? 4 : (m ? +m[1] : 0); }
  let shadowCount = 0;
  function shadowFor(r, dx, dy, r0, lift, dur, delay) {
    if (shadowCount > 14) return;
    shadowCount++;
    const sh = document.createElement('div');
    sh.className = 'cshadow';
    sh.style.cssText = `left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px`;
    document.body.appendChild(sh);
    const N = 10, kf = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, e = Math.pow(t, 1.12), h = Math.sin(Math.PI * e);
      const hh = 4 * e * (1 - e) * lift;
      kf.push({
        offset: t * 0.84,
        transform: `translate(${dx * (1 - e) + hh * 0.1}px,${dy * (1 - e) + hh * 0.3}px) rotate(${r0 * (1 - e)}deg) scale(${1 + 0.06 * h})`,
        opacity: 0.5 - 0.22 * h, filter: `blur(${3 + 7 * h}px)`,
      });
    }
    kf.push({ offset: 0.92, transform: 'translate(0,0) scale(.98)', opacity: 0.55, filter: 'blur(3px)' }, { offset: 1, transform: 'translate(0,0)', opacity: 0, filter: 'blur(2px)' });
    const a = sh.animate(kf, { duration: dur, delay, easing: 'linear', fill: 'both' });
    const done = () => { shadowCount = Math.max(0, shadowCount - 1); sh.remove(); };
    a.finished.then(done, done);
  }
  function arcFly(el, o) {
    const { dx, dy, fromDown, toDown, dur, delay = 0, land } = o;
    const dist = Math.hypot(dx, dy), lift = Math.min(96, Math.max(12, dist * 0.2));
    const r0 = o.rot0 != null ? o.rot0 : (dx > 0 ? -1 : 1) * (6 + Math.min(14, dist / 40));
    const arrive = land ? 0.84 : 1, N = 12, kf = [];
    const y0 = fromDown ? 180 : 0, y1 = toDown ? 180 : 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N, e = Math.pow(t, 1.12), h = Math.sin(Math.PI * e);
      const sm = e * e * (3 - 2 * e);
      kf.push({
        offset: t * arrive,
        transform: `translate(${(dx * (1 - e)).toFixed(1)}px,${(dy * (1 - e) - 4 * lift * e * (1 - e)).toFixed(1)}px) rotate(${(ang(r0, 0, e) + h * (dx > 0 ? -4 : 4)).toFixed(2)}deg) scale(${(1 + 0.18 * h).toFixed(3)}) rotateY(${ang(y0, y1, sm).toFixed(1)}deg)`,
      });
    }
    const end = toDown ? 'rotateY(180deg)' : 'rotateY(0deg)';
    if (land) kf.push({ offset: 0.91, transform: `scale(1.08,.92) ${end}` }, { offset: 0.96, transform: `scale(.985,1.02) ${end}` });
    kf.push({ offset: 1, transform: `scale(1) ${end}` });
    el.animate(kf, { duration: dur, delay, easing: 'linear', fill: 'backwards' });
    if (dist > 36 && !o.noShadow && o.rect) shadowFor(o.rect, dx, dy, r0, lift, dur, delay);
  }
  /* FLIP всех карт: старые плывут по дуге, новые вылетают из колоды, на стол — с «ударом» */
  function flights(snap, deal) {
    const d = document.querySelector('.deck') || $('deckcol'), dr = d.getBoundingClientRect();
    const dx0 = dr.left + dr.width / 2, dy0 = dr.top + dr.height / 2;
    const k = speed() === 'turbo' ? 0.9 : 1;
    let kk = 0;
    document.querySelectorAll('.app .card[data-id]').forEach(el => {
      if (el.closest('.trumpcard')) return;
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const down = el.classList.contains('down'), o = snap[el.dataset.id], end = down ? 'rotateY(180deg)' : 'none';
      if (o) {
        const dx = o.x - cx, dy = o.y - cy;
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && o.down === down) return;
        const onTable = !!el.closest('#battles'), dur = 460 * k;
        if (!onTable && Math.hypot(dx, dy) < 90 && o.down === down) {
          /* перестройка веера: короткий скользящий переход без полёта */
          el.animate([{ transform: `translate(${dx}px,${dy}px) ${o.down ? 'rotateY(180deg)' : ''}` }, { transform: end }], { duration: 300 * k, easing: 'cubic-bezier(.2,.9,.25,1.08)' });
          return;
        }
        arcFly(el, { dx, dy, fromDown: o.down, toDown: down, dur, land: onTable, rect: r, noShadow: !onTable });
        if (onTable) {
          const t = Math.round(dur * 0.84 * animK());
          const st = suitOf(el), pw = G && G.fx && G.fx.t >= 5 ? 1.7 : 1;
          setTimeout(() => { if (typeof VFX !== 'undefined' && VFX.land) VFX.land(cx, cy + r.height * 0.3, st, pw, r.width); }, t);
        }
      } else if (deal && el.closest('.hand,.botHand')) {
        if (kk < 12) setTimeout(() => AU.play('deal'), kk * 70);
        arcFly(el, { dx: dx0 - cx, dy: dy0 - cy, fromDown: true, toDown: down, dur: 520 * k, delay: (kk++) * 70, rot0: -25, land: false, noShadow: kk > 8, rect: r });
      } else {
        el.animate([{ transform: `scale(1.4) ${end === 'none' ? '' : end}`, opacity: 0 }, { transform: end, opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      }
    });
  }

  /* ================= slow-mo на «могнул» ================= */
  let vig = null, slowT = null;
  function slowmo(good) {
    if (noMotion() || speed() !== 'normal') return;
    if (!vig) { vig = document.createElement('div'); vig.id = 'vign'; vig.setAttribute('aria-hidden', 'true'); document.body.appendChild(vig); }
    const RATE = 0.4;
    vig.className = good ? 'on good' : 'on bad';
    try { AU.play('snap'); } catch (e) {}
    if (typeof VFX !== 'undefined' && VFX.setTime) VFX.setTime(RATE);
    try { document.getAnimations().forEach(a => { a.playbackRate = RATE; }); } catch (e) {}
    clearTimeout(slowT);
    slowT = setTimeout(() => {
      if (typeof VFX !== 'undefined' && VFX.setTime) VFX.setTime(1);
      try { document.getAnimations().forEach(a => { a.playbackRate = 1; }); } catch (e) {}
      vig.className = '';
    }, 420);
  }

  /* ================= район и режим → тема стола ================= */
  const DISTRICTS = ['podyezd', 'dvor', 'rynok', 'vokzal', 'kazino'];
  function district() {
    try {
      if (typeof NET !== 'undefined' && NET) return '';
      if (typeof MODE === 'undefined' || !MODE) return '';
      if (MODE.kind === 'career') return DISTRICTS[Math.min(DISTRICTS.length - 1, Math.floor((MODE.stage || 0) / 3))];
      if (MODE.kind === 'rogue') return 'night';
      if (MODE.kind === 'weekly') return 'boss';
    } catch (e) {}
    return '';
  }
  function applyDistrict() {
    const d = district(), els = [document.documentElement, document.querySelector('.board'), document.getElementById('felt')];
    els.forEach(el => { if (!el) return; if (d) el.dataset.district = d; else delete el.dataset.district; });
  }

  function init() {
    bindPeek(); bindSort();
    /* render: тема стола + сохранённая группировка */
    let sortApplied = false;
    const r0 = window.render;
    window.render = function () {
      if (!sortApplied && G) { sortApplied = true; const sv = load('durocker-sort'); if (sv === 'r' || sv === 's') G.sort = sv; }
      applyDistrict();
      return r0.apply(this, arguments);
    };
    /* «могнул» — замедление чуть позже: когда карта села на стол */
    const h0 = window.showHype;
    window.showHype = function (key, mine) {
      if (key === 'mognul') setTimeout(() => slowmo(!!mine), typeof holdT === 'function' ? holdT(380) : 380);
      return h0.apply(this, arguments);
    };
  }
  return { fan, flights, slowmo, district, init, isWide };
})();
TABLE.init();
