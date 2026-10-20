/* ДурКер — визуальные эффекты: искры, конфетти, вылет карты-действия, наклон карт, скины стола. */
'use strict';

const VFX = (() => {
  let cv, cx, parts = [], running = false, ts = 1; /* ts — масштаб времени для slow-mo */
  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.id = 'fxc'; cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv); cx = cv.getContext('2d'); size();
    addEventListener('resize', size);
  }
  function size() { if (!cv) return; const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); }
  function loop() {
    cx.clearRect(0, 0, innerWidth, innerHeight);
    parts = parts.filter(p => p.life > 0);
    for (const p of parts) {
      p.life -= ts;
      if (p.ring) {
        p.r += p.vr * ts; cx.globalAlpha = Math.max(0, p.life / p.max) * 0.7; cx.strokeStyle = p.c; cx.lineWidth = 2;
        cx.beginPath(); cx.ellipse(p.x, p.y, p.r, p.r * 0.38, 0, 0, Math.PI * 2); cx.stroke();
        continue;
      }
      p.x += p.vx * ts; p.y += p.vy * ts; p.vy += p.g * ts; p.vx *= Math.pow(0.985, ts); p.rot += p.vr * ts;
      const a = Math.min(1, p.life / 25);
      cx.globalAlpha = a; cx.fillStyle = p.c;
      cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot);
      /* квадратные «пиксельные» частицы */
      cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.conf ? p.s * 0.5 : p.s);
      cx.restore();
    }
    cx.globalAlpha = 1;
    if (parts.length) requestAnimationFrame(loop); else running = false;
  }
  function go() { if (!running) { running = true; requestAnimationFrame(loop); } }
  function sparks(x, y, n, colors, power = 1) {
    if (reduced) return; ensure();
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = (2 + Math.random() * 5) * power;
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, g: 0.18, life: 40 + Math.random() * 30, s: 3 + Math.random() * 4, c: colors[i % colors.length], rot: 0, vr: 0 });
    }
    go();
  }
  function confetti() {
    if (reduced) return; ensure();
    const cols = ['#eab54b', '#d9362f', '#2c7fe0', '#62c98a', '#f8f1df', '#c79bff'];
    for (let i = 0; i < 140; i++) parts.push({ x: Math.random() * innerWidth, y: -20 - Math.random() * 200, vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 3, g: 0.05, life: 160 + Math.random() * 60, s: 6 + Math.random() * 5, c: cols[i % cols.length], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, conf: true });
    go();
  }
  /* посадка карты на стол: пыль и искры цвета масти + кольцо-удар. pw — сила, w — ширина карты */
  function land(x, y, s, pw = 1, w = 40) {
    if (reduced) return; ensure();
    const red = s === 1 || s === 2, cols = s === 4 ? ['#c79bff', '#f3d27a', '#fff'] : red ? ['#ff6b5e', '#ffb3a8', '#fff4f0'] : ['#9db8ff', '#e8edff', '#fff'];
    const n = Math.round(9 * pw);
    for (let i = 0; i < n; i++) {
      const side = i % 2 ? 1 : -1, v = (1.2 + Math.random() * 2.6) * pw;
      parts.push({ x: x + side * w * 0.3 * Math.random(), y, vx: side * v, vy: -(0.4 + Math.random() * 1.6) * pw, g: 0.16, life: 22 + Math.random() * 16, s: 2.5 + Math.random() * 3, c: cols[i % cols.length], rot: 0, vr: 0 });
    }
    parts.push({ ring: true, x, y, r: w * 0.25, vr: 1.6 * pw, life: 16, max: 16, c: cols[1] });
    go();
  }
  const setTime = k => { ts = k; };
  /* искры из центра стола */
  function burstFelt(t) {
    const f = $('felt').getBoundingClientRect();
    const strong = t >= 8 || t === 5 || t === 7;
    sparks(f.left + f.width / 2, f.top + f.height / 2, strong ? 70 : 30, strong ? ['#eab54b', '#fff4c2', '#ff8a3d'] : ['#eab54b', '#f8f1df'], strong ? 1.5 : 1);
  }
  /* карта-действие вылетает на весь экран */
  function actionZoom(c, mine) {
    const el = $('actzoom');
    el.innerHTML = `<div class="zcard">${cardHTML(c)}</div><div class="zname">${esc(t(ACTS[c.action].name))} ${SU[c.s]}</div><div class="zwho">${mine ? t('Ты') : esc(oppName())}</div>`;
    el.hidden = false; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    clearTimeout(actionZoom.t); actionZoom.t = setTimeout(() => { el.hidden = true; }, reduced ? 900 : 1500);
    const r = el.getBoundingClientRect();
    sparks(r.left + r.width / 2, r.top + r.height / 2, 60, [suitColor(c.s), '#fff4c2', '#eab54b'], 1.4);
  }
  const suitColor = s => ['#9db8ff', '#ff6b5e', '#ffb347', '#7ee2a0', '#c79bff'][s] || '#eab54b';
  /* наклон карты за мышкой */
  function bindTilt() {
    if (reduced || !matchMedia('(hover:hover)').matches) return;
    $('hand').addEventListener('pointermove', e => {
      const c = e.target.closest('.card'); if (!c) return;
      const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      c.style.setProperty('--rx', (-y * 18).toFixed(1) + 'deg'); c.style.setProperty('--ry', (x * 18).toFixed(1) + 'deg');
    });
    $('hand').addEventListener('pointerout', e => { const c = e.target.closest('.card'); if (c) { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); } });
  }
  /* скины стола */
  const SKINS = [{ id: 'felt', name: 'Сукно' }, { id: 'kitchen', name: 'Кухня' }, { id: 'neon', name: 'Ночной клуб' }, { id: 'gold', name: 'Казино' }];
  function skin(id) {
    if (id) store('durocker-skin', id);
    let cur = load('durocker-skin') || 'felt';
    if (typeof prog === 'function' && !prog().unlocked.table.includes(cur)) cur = 'felt';
    document.documentElement.dataset.skin = cur;
    return cur;
  }
  return { sparks, confetti, burstFelt, actionZoom, suitColor, bindTilt, SKINS, skin, land, setTime };
})();
