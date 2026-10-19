/* ДурКер — «Повтор лучшего момента»: короткая анимация розыгрыша на canvas и видео для чата.
   Запоминаем розыгрыши партии (атака → защита), лучший — твой «могнул» старшим типом,
   иначе последнее твоё покрытие перед победой. Видео пишем MediaRecorder-ом прямо с canvas. */
'use strict';

const REPLAY = (() => {
  const W = 720, DUR = 5200, FPS = 30;
  let moments = [], forG = null, lastHype = null;

  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const fresh = () => { if (G !== forG) { forG = G; moments = []; } };

  /* ---------- запись розыгрышей ---------- */
  function record(o) {
    if (!G || !G.table || (typeof MODE !== 'undefined' && MODE.kind === 'tutorial')) return;
    fresh();
    if (o.what === 'defend') {
      const b = G.table.filter(x => x.d && !x.d.shield && x.d.cards && x.a && x.a.cards).pop();
      if (!b) return;
      moments.push({
        mine: o.actor === 'p', att: b.a.cards.map(c => c.n), attName: b.a.name, def: b.d.cards.map(c => c.n), defName: b.d.name,
        t: b.d.t, T: G.T, phrase: null, mognul: false, me: myNick(), opp: oppName(),
      });
      if (moments.length > 30) moments.shift();
    }
    if (o.what === 'hype' && (o.key === 'mognul' || o.key === 'over' || o.key === 'legend')) {
      const m = moments[moments.length - 1];
      if (m && m.mine === (o.actor === 'p')) { m.mognul = m.mognul || o.key === 'mognul'; m.hype = o.key; m.phrase = hypeText(o.key, m.mine); }
    }
  }
  /* лучший момент: твой «могнул» с самым старшим типом, иначе последнее твоё покрытие, иначе последний розыгрыш */
  function best() {
    if (!G || G !== forG) return null;
    const mine = moments.filter(m => m.mine);
    const mg = mine.filter(m => m.mognul || m.hype).sort((a, b) => b.t - a.t || (b.mognul ? 1 : 0) - (a.mognul ? 1 : 0))[0];
    if (mg) return mg;
    const last = mine[mine.length - 1];
    if (last && G.over === 'p') return { ...last, phrase: 'ТЫ НЕ ДУРАК!' };
    return null;
  }
  const lastMine = () => { if (!G || G !== forG) return null; const m = moments.filter(x => x.mine && x.phrase).pop(); return m || null; };

  /* ---------- кадр ---------- */
  const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const back = t => { t = Math.min(1, Math.max(0, t)); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  function rowX(n, w, gap, i) { const tot = n * (w + gap) - gap; return W / 2 - tot / 2 + w / 2 + i * (w + gap); }
  function title(x, txt, y, size, rot, scale, alpha) {
    x.save(); x.globalAlpha = alpha; x.translate(W / 2, y); x.rotate(rot); x.scale(scale, scale);
    let s = size; do { x.font = `900 ${s}px "Arial Black", Arial, sans-serif`; s -= 3; } while (x.measureText(txt).width > W - 90 && s > 16);
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = 12; x.strokeStyle = '#000'; x.strokeText(txt, 0, 0);
    x.fillStyle = '#b3202a'; x.fillText(txt, 6, 6); x.fillStyle = '#ffe14a'; x.fillText(txt, 0, 0);
    x.restore();
  }
  function frame(x, m, ms) {
    const t = ms / 1000;
    /* тряска в момент удара защиты */
    const hit = t - 1.9, sh = hit > 0 && hit < 0.45 ? (1 - hit / 0.45) * 14 : 0;
    x.save();
    x.setTransform(1, 0, 0, 1, sh ? (Math.random() - 0.5) * sh : 0, sh ? (Math.random() - 0.5) * sh : 0);
    const g = x.createRadialGradient(W / 2, W * 0.42, 40, W / 2, W / 2, W * 0.75);
    g.addColorStop(0, '#2a8a5f'); g.addColorStop(1, '#0b3324'); x.fillStyle = g; x.fillRect(-20, -20, W + 40, W + 40);
    x.lineWidth = 18; x.strokeStyle = '#6b3d1c'; roundRect(x, 16, 16, W - 32, W - 32, 40); x.stroke();
    x.lineWidth = 3; x.setLineDash([12, 10]); x.strokeStyle = 'rgba(255,255,255,.18)'; roundRect(x, 44, 44, W - 88, W - 88, 26); x.stroke(); x.setLineDash([]);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    /* подпись атаки */
    const la = ease((t - 0.15) / 0.5);
    x.globalAlpha = la; x.font = '600 24px Arial, sans-serif'; x.fillStyle = 'rgba(248,241,223,.85)';
    x.fillText(`${m.opp}: ${String(m.attName || '').toLowerCase()}`, W / 2, 112); x.globalAlpha = 1;
    /* карты атаки влетают сверху */
    const aw = m.att.length > 3 ? 92 : 110;
    m.att.forEach((n, i) => {
      const p = back((t - 0.1 - i * 0.12) / 0.55);
      if (p <= 0) return;
      const tx = rowX(m.att.length, aw, 10, i), ty = 270;
      drawCardOn(x, tx, -120 + (ty + 120) * p, aw, n, (i - (m.att.length - 1) / 2) * 0.06 + (1 - p) * 0.5);
    });
    /* карты защиты накрывают снизу */
    const dw = m.def.length > 3 ? 100 : 124;
    m.def.forEach((n, i) => {
      const p = back((t - 1.35 - i * 0.1) / 0.55);
      if (p <= 0) return;
      const tx = rowX(m.def.length, dw, 10, i), ty = 400;
      drawCardOn(x, tx, W + 160 - (W + 160 - ty) * p, dw, n, (i - (m.def.length - 1) / 2) * 0.08 - (1 - p) * 0.4);
    });
    /* название комбинации защиты */
    const ln = ease((t - 2.0) / 0.4);
    if (ln > 0) { x.globalAlpha = ln; x.font = '900 34px "Arial Black", Arial, sans-serif'; x.fillStyle = '#ffe14a'; x.fillText(String(m.defName || '').toUpperCase(), W / 2, 538); x.globalAlpha = 1; }
    /* вспышка */
    const fl = t - 1.9;
    if (fl > 0 && fl < 0.35) { x.fillStyle = `rgba(255,248,220,${0.55 * (1 - fl / 0.35)})`; x.fillRect(-20, -20, W + 40, W + 40); }
    /* хайп-фраза */
    const hp = t - 2.5;
    if (hp > 0 && m.phrase) {
      const s = hp < 0.35 ? 0.4 + 0.9 * back(hp / 0.35) : 1 + Math.sin((hp - 0.35) * 5) * 0.02;
      title(x, m.phrase, 604, 56, -0.1, s, Math.min(1, hp / 0.15));
    }
    /* подпись */
    x.font = '700 22px Arial, sans-serif'; x.fillStyle = 'rgba(248,241,223,.9)'; x.fillText(`${m.me} vs ${m.opp}`, W / 2, 664);
    x.font = '600 19px Arial, sans-serif'; x.fillStyle = '#eab54b'; x.fillText('ДурКер · t.me/durocker_bot', W / 2, 692);
    x.restore();
  }
  /* drawCardOn смотрит на G.T для козырной рамки — на время кадра подставляем козырь момента */
  function draw(x, m, ms) {
    const keep = G && G.T;
    if (G) G.T = m.T;
    try { frame(x, m, ms); } finally { if (G) G.T = keep; }
  }

  /* ---------- видео ---------- */
  function pickType() {
    if (typeof MediaRecorder === 'undefined') return null;
    const list = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const t of list) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) {} }
    return '';
  }
  function makeVideo(m) {
    return new Promise((res, rej) => {
      const type = pickType();
      const cv = document.createElement('canvas'); cv.width = cv.height = W;
      if (type === null || !cv.captureStream) { rej(new Error('no recorder')); return; }
      const x = cv.getContext('2d');
      draw(x, m, 0);
      let rec;
      try { rec = new MediaRecorder(cv.captureStream(FPS), type ? { mimeType: type, videoBitsPerSecond: 2500000 } : undefined); } catch (e) { rej(e); return; }
      const parts = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      rec.onstop = () => { const b = new Blob(parts, { type: (rec.mimeType || type || 'video/webm').split(';')[0] }); b.size ? res(b) : rej(new Error('empty')); };
      rec.start(250);
      const t0 = performance.now();
      /* rAF не идёт в фоне — дублируем таймером, чтобы запись не встала */
      const step = () => {
        const ms = performance.now() - t0;
        draw(x, m, Math.min(ms, DUR));
        if (ms >= DUR + 300) { clearInterval(iv); try { rec.stop(); } catch (e) { rej(e); } return; }
      };
      const iv = setInterval(step, 1000 / FPS);
    });
  }

  /* ---------- окно ---------- */
  let css = false;
  function style() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `.replay{position:fixed;inset:0;z-index:91;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(3,14,10,.9);padding:16px}
.replay canvas,.replay video{width:min(88vw,60vh);height:auto;aspect-ratio:1;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.6);background:#0b3324}
.replay p{margin:0;font-size:13px;color:var(--muted,#9fb5ab);text-align:center;min-height:1.3em}
.replay .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.replay .btn[disabled]{opacity:.45}
.snapbtn.rp{margin-left:0;bottom:calc(6% + 40px)}`;
    document.head.appendChild(s);
  }
  function open(m) {
    m = m || best();
    if (!m) { toast('Нечего показать — могни кого-нибудь 😏'); return; }
    style();
    if (typeof AU !== 'undefined') AU.play('snap');
    const box = document.createElement('div'); box.className = 'replay';
    box.innerHTML = `<canvas width="${W}" height="${W}"></canvas><p class="st">Готовим видео…</p><div class="row">
      <button class="btn gold" type="button" data-rp="share" disabled>Поделиться</button>
      <button class="btn blue" type="button" data-rp="save" disabled>Сохранить</button>
      <button class="btn grey" type="button" data-rp="close">Закрыть</button></div>`;
    document.body.appendChild(box);
    const cv = box.querySelector('canvas'), x = cv.getContext('2d'), st = box.querySelector('.st');
    let raf = 0, alive = true, blob = null, url = null;
    if (reduced()) draw(x, m, DUR);
    else {
      const t0 = performance.now();
      const loop = () => { if (!alive) return; draw(x, m, (performance.now() - t0) % (DUR + 900)); raf = requestAnimationFrame(loop); };
      loop();
    }
    const text = `${m.phrase || 'Мой лучший момент'} — играю в ДурКер: https://t.me/durocker_bot`;
    const ext = () => (blob && /mp4/.test(blob.type) ? 'mp4' : 'webm');
    makeVideo(m).then(b => {
      if (!alive) return;
      blob = b; url = URL.createObjectURL(b);
      box.querySelectorAll('[data-rp]').forEach(e => { e.disabled = false; });
      /* на телефоне видео удобнее сохранить долгим нажатием — показываем готовое видео вместо canvas */
      if (/mp4/.test(b.type) || !/iPhone|iPad/.test(navigator.userAgent)) {
        const v = document.createElement('video');
        Object.assign(v, { src: url, loop: true, muted: true, autoplay: true, playsInline: true });
        v.setAttribute('playsinline', '');
        cancelAnimationFrame(raf); cv.replaceWith(v); v.play().catch(() => {});
      }
      st.textContent = 'Долгое нажатие на видео — сохранить';
      REPLAY.lastBlob = b;
    }).catch(() => {
      if (!alive) return;
      st.textContent = 'Видео здесь не записать — сохрани картинку-открытку';
      const sv = box.querySelector('[data-rp="save"]'); sv.disabled = false; sv.textContent = '📸 Открытка';
      sv.dataset.rp = 'card';
    });
    const close = () => { alive = false; cancelAnimationFrame(raf); if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); box.remove(); };
    box.onclick = e => {
      const k = e.target.closest('[data-rp]');
      if (!k) { if (e.target === box) close(); return; }
      const a = k.dataset.rp;
      if (a === 'close') close();
      else if (a === 'card') { close(); if (typeof openPostcard === 'function') openPostcard({ title: m.mognul ? 'МОГНУЛ!' : 'ТЫ НЕ ДУРАК!', phrase: m.phrase, m: { name: m.defName, cards: m.def, vs: m.att, vsName: m.attName } }); }
      else if (a === 'save' && blob) {
        const l = document.createElement('a'); l.href = url; l.download = 'durocker.' + ext(); document.body.appendChild(l); l.click(); l.remove();
      } else if (a === 'share' && blob) {
        const file = new File([blob], 'durocker.' + ext(), { type: blob.type });
        if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], text }).catch(() => {});
        else if (navigator.share) navigator.share({ text }).catch(() => {});
        else { if (typeof copyText === 'function') copyText(text, k); toast('Текст скопирован — видео сохрани кнопкой «Сохранить»'); }
      }
    };
  }

  /* ---------- встраивание обёртками ---------- */
  const wrap = (name, fn) => { if (typeof window[name] !== 'function') return; const o = window[name]; window[name] = function (...a) { return fn(o, this, a); }; };
  wrap('showFx', (o, t, a) => { const r = o.apply(t, a); try { if (a[0]) record(a[0]); } catch (e) {} return r; });
  /* экран итога: рядом с «📸 Открытка» — «🎬 Повтор» */
  wrap('showOver', (o, t, a) => {
    const r = o.apply(t, a);
    try {
      const so = $('snapOver');
      if (so && !$('replayOver') && best()) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn gold'; b.id = 'replayOver'; b.textContent = '🎬 Повтор';
        b.onclick = () => open();
        so.after(b);
      }
    } catch (e) {}
    return r;
  });
  /* 5-секундная кнопка после своего «могнул» — вторая рядом с «📸 Поделиться» */
  wrap('snapButton', (o, t, a) => {
    const r = o.apply(t, a);
    try {
      const felt = $('felt'), old = felt.querySelector('.snapbtn.rp'); if (old) old.remove();
      const m = lastMine();
      if (m) {
        style();
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'snapbtn rp'; b.textContent = '🎬 Повтор';
        b.onclick = e => { e.stopPropagation(); b.remove(); const s = felt.querySelector('.snapbtn'); if (s) s.remove(); open(m); };
        felt.appendChild(b);
        setTimeout(() => b.remove(), 5000);
      }
    } catch (e) {}
    return r;
  });

  return { open, best, makeVideo, draw, get moments() { return moments; }, lastBlob: null };
})();
