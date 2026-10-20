/* ДурКер — «Повтор лучшего момента»: короткая анимация розыгрыша на canvas и видео для чата.
   Запоминаем розыгрыши партии (атака → защита), лучший — твой «могнул» старшим типом,
   иначе последнее твоё покрытие перед победой. Видео пишем MediaRecorder-ом прямо с canvas. */
'use strict';

const REPLAY = (() => {
  const W = 720, DUR = 5200, FPS = 30;
  /* в кадрах t — время, поэтому перевод зовём как tt; имена/фразы хранятся русскими, переводим при показе */
  const tt = (s, v) => I18N.t(s, v), L = s => I18N.tr(String(s || '')), nmT = s => tt(String(s || ''));
  let moments = [], forG = null, lastHype = null;

  const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
  const fresh = () => { if (G !== forG) { forG = G; moments = []; } };

  /* портрет соперника: тот же ключ, что у аватара в шапке (js/portraits.js кладёт его в data-id) */
  function oppFaceKey() {
    try { const el = document.querySelector('#oppAva svg.pt'); if (el && el.dataset.id && el.dataset.id !== 'gen') return el.dataset.id; } catch (e) {}
    try { return 'nick:' + oppName(); } catch (e) { return 'nick:?'; }
  }

  /* ---------- запись розыгрышей ---------- */
  function record(o) {
    if (!G || !G.table || (typeof MODE !== 'undefined' && MODE.kind === 'tutorial')) return;
    fresh();
    if (o.what === 'defend') {
      const b = G.table.filter(x => x.d && !x.d.shield && x.d.cards && x.a && x.a.cards).pop();
      if (!b) return;
      moments.push({
        mine: o.actor === 'p', att: b.a.cards.map(c => c.n), attName: b.a.name, def: b.d.cards.map(c => c.n), defName: b.d.name,
        t: b.d.t, T: G.T, phrase: null, mognul: false, me: myNick(), opp: oppName(), ok: oppFaceKey(),
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
    x.fillText(`${nmT(m.opp)}: ${nmT(m.attName).toLowerCase()}`, W / 2, 112); x.globalAlpha = 1;
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
    if (ln > 0) { x.globalAlpha = ln; x.font = '900 34px "Arial Black", Arial, sans-serif'; x.fillStyle = '#ffe14a'; x.fillText(nmT(m.defName).toUpperCase(), W / 2, 538); x.globalAlpha = 1; }
    /* вспышка */
    const fl = t - 1.9;
    if (fl > 0 && fl < 0.35) { x.fillStyle = `rgba(255,248,220,${0.55 * (1 - fl / 0.35)})`; x.fillRect(-20, -20, W + 40, W + 40); }
    /* хайп-фраза */
    const hp = t - 2.5;
    if (hp > 0 && m.phrase) {
      const s = hp < 0.35 ? 0.4 + 0.9 * back(hp / 0.35) : 1 + Math.sin((hp - 0.35) * 5) * 0.02;
      title(x, L(m.phrase), 604, 56, -0.1, s, Math.min(1, hp / 0.15));
    }
    /* подпись */
    x.font = '700 22px Arial, sans-serif'; x.fillStyle = 'rgba(248,241,223,.9)'; x.fillText(`${nmT(m.me)} vs ${nmT(m.opp)}`, W / 2, 664);
    x.font = '600 19px Arial, sans-serif'; x.fillStyle = '#eab54b'; x.fillText(tt('ДурКер · t.me/durocker_bot'), W / 2, 692);
    x.restore();
  }
  /* drawCardOn смотрит на G.T для козырной рамки — на время кадра подставляем козырь момента */
  function draw(x, m, ms) {
    const keep = G && G.T;
    if (G) G.T = m.T;
    try { frame(x, m, ms); } finally { if (G) G.T = keep; }
  }


  /* ---------- «кружок»: квадрат 480×480 в круге, 8 секунд, с портретами ---------- */
  const CW = 480, CDUR = 8200;
  const faceCache = new Map();
  /* портрет → картинка для canvas: стили вшиваем в сам SVG, эмоция — атрибутом data-e */
  function faceImg(key, emo) {
    const k = key + '|' + emo;
    if (faceCache.has(k)) return faceCache.get(k);
    const p = new Promise(res => {
      try {
        if (typeof PORTRAITS === 'undefined') { res(null); return; }
        let sv = PORTRAITS.svg(key, { emo });
        sv = sv.replace('<svg class="pt"', '<svg xmlns="http://www.w3.org/2000/svg" class="pt" width="200" height="200"').replace(/>/, '><style>' + (PORTRAITS.CSS || '').replace(/var\(--pt-k,1\)/g, '1') + '</style>');
        const img = new Image();
        img.onload = () => res(img); img.onerror = () => res(null);
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sv);
      } catch (e) { res(null); }
    });
    faceCache.set(k, p);
    return p;
  }
  async function loadFaces(m) {
    const me = 'nick:' + (m.me || 'Игрок'), op = m.ok || ('nick:' + m.opp);
    const [a, b, c, d] = await Promise.all([faceImg(me, 'neutral'), faceImg(me, 'smug'), faceImg(op, 'neutral'), faceImg(op, 'shock')]);
    return { meN: a, meS: b, opN: c, opS: d };
  }
  function drawFace(x, img, cx, cy, size, ring, pop) {
    x.save(); x.translate(cx, cy); if (pop !== 1) x.scale(pop, pop);
    x.beginPath(); x.arc(0, 0, size / 2, 0, Math.PI * 2); x.save(); x.clip();
    if (img) x.drawImage(img, -size / 2, -size / 2, size, size); else { x.fillStyle = '#244'; x.fillRect(-size / 2, -size / 2, size, size); }
    x.restore();
    x.lineWidth = 5; x.strokeStyle = ring; x.beginPath(); x.arc(0, 0, size / 2, 0, Math.PI * 2); x.stroke();
    x.restore();
  }
  function circleFrame(x, m, ms, F) {
    const t = ms / 1000, R = CW / 2, HIT = 3.6;
    const hit = t - HIT, sh = hit > 0 && hit < 0.4 ? (1 - hit / 0.4) * 9 : 0;
    x.save();
    x.clearRect(0, 0, CW, CW);
    x.beginPath(); x.arc(R, R, R, 0, Math.PI * 2); x.clip();
    x.setTransform(1, 0, 0, 1, sh ? (Math.random() - 0.5) * sh : 0, sh ? (Math.random() - 0.5) * sh : 0);
    const g = x.createRadialGradient(R, R * 0.8, 20, R, R, R * 1.05);
    g.addColorStop(0, '#2a8a5f'); g.addColorStop(1, '#0b3324'); x.fillStyle = g; x.fillRect(-20, -20, CW + 40, CW + 40);
    x.lineWidth = 3; x.setLineDash([10, 9]); x.strokeStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.arc(R, R, R - 34, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    /* портреты: я слева, соперник справа; после удара он в шоке, я ухмыляюсь */
    const pi = ease(t / 0.6), after = t > HIT;
    drawFace(x, after && m.mognul !== false ? F.meS : F.meN, 156, 88, 84, '#eab54b', 0.4 + 0.6 * back(pi));
    drawFace(x, after ? F.opS : F.opN, 324, 88, 84, '#d9362f', 0.4 + 0.6 * back(pi));
    x.font = '900 24px "Arial Black", Arial, sans-serif'; x.fillStyle = '#ffe14a'; x.globalAlpha = Math.min(1, pi); x.fillText('VS', R, 88);
    x.font = '700 15px Arial, sans-serif'; x.fillStyle = 'rgba(248,241,223,.92)';
    x.fillText(nmT(m.me).slice(0, 12), 156, 142); x.fillText(nmT(m.opp).slice(0, 12), 324, 142); x.globalAlpha = 1;
    /* атака влетает сверху */
    const aw = m.att.length > 3 ? 54 : 64;
    m.att.forEach((n, i) => {
      const p = back((t - 0.9 - i * 0.1) / 0.55); if (p <= 0) return;
      drawCardOn(x, rowC(m.att.length, aw, 8, i), -90 + (215 + 90) * p, aw, n, (i - (m.att.length - 1) / 2) * 0.06 + (1 - p) * 0.5);
    });
    /* защита накрывает снизу */
    const dw = m.def.length > 3 ? 62 : 76;
    m.def.forEach((n, i) => {
      const p = back((t - 2.7 - i * 0.1) / 0.55); if (p <= 0) return;
      drawCardOn(x, rowC(m.def.length, dw, 8, i), CW + 110 - (CW + 110 - 300) * p, dw, n, (i - (m.def.length - 1) / 2) * 0.08 - (1 - p) * 0.4);
    });
    if (hit > 0 && hit < 0.35) { x.fillStyle = `rgba(255,248,220,${0.55 * (1 - hit / 0.35)})`; x.fillRect(-20, -20, CW + 40, CW + 40); }
    /* название комбинации и фраза */
    const nm = ease((t - 3.8) / 0.4);
    if (nm > 0) { x.globalAlpha = nm; let sz = 30; const txt = nmT(m.defName).toUpperCase(); do { x.font = `900 ${sz}px "Arial Black", Arial, sans-serif`; sz -= 2; } while (x.measureText(txt).width > 330 && sz > 14); x.fillStyle = '#ffe14a'; x.fillText(txt, R, 392); x.globalAlpha = 1; }
    const hp = t - 5.0;
    if (hp > 0 && m.phrase) {
      const sc = hp < 0.35 ? 0.4 + 0.9 * back(hp / 0.35) : 1 + Math.sin((hp - 0.35) * 5) * 0.02;
      x.save(); x.globalAlpha = Math.min(1, hp / 0.15); x.translate(R, 426); x.rotate(-0.06); x.scale(sc, sc);
      const ph = L(m.phrase);
      let sz = 32; do { x.font = `900 ${sz}px "Arial Black", Arial, sans-serif`; sz -= 2; } while (x.measureText(ph).width > 280 && sz > 14);
      x.lineJoin = 'round'; x.lineWidth = 8; x.strokeStyle = '#000'; x.strokeText(ph, 0, 0); x.fillStyle = '#ffe14a'; x.fillText(ph, 0, 0); x.restore();
    }
    x.font = '800 17px Arial, sans-serif'; x.fillStyle = '#eab54b'; x.fillText(tt('ДурКер'), R, 458);
    /* золотое кольцо по краю круга */
    x.setTransform(1, 0, 0, 1, 0, 0); x.lineWidth = 8; x.strokeStyle = '#eab54b'; x.beginPath(); x.arc(R, R, R - 4, 0, Math.PI * 2); x.stroke();
    x.restore();
  }
  const rowC = (n, w, gap, i) => CW / 2 - (n * (w + gap) - gap) / 2 + w / 2 + i * (w + gap);
  function drawCircle(x, m, ms, F) {
    const keep = G && G.T;
    if (G) G.T = m.T;
    try { circleFrame(x, m, ms, F); } finally { if (G) G.T = keep; }
  }

  /* ---------- видео ---------- */
  function pickType() {
    if (typeof MediaRecorder === 'undefined') return null;
    const list = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    for (const t of list) { try { if (MediaRecorder.isTypeSupported(t)) return t; } catch (e) {} }
    return '';
  }
  /* cfg: {size, dur, draw(x, ms)}; по умолчанию — квадратный повтор 720×720 */
  function makeVideo(m, cfg) {
    const SZ = (cfg && cfg.size) || W, DU = (cfg && cfg.dur) || DUR, DR = (cfg && cfg.draw) || ((x, mm, ms) => draw(x, mm, ms));
    return new Promise((res, rej) => {
      const type = pickType();
      const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
      if (type === null || !cv.captureStream) { rej(new Error('no recorder')); return; }
      const x = cv.getContext('2d');
      DR(x, m, 0);
      let rec;
      try { rec = new MediaRecorder(cv.captureStream(FPS), type ? { mimeType: type, videoBitsPerSecond: SZ <= 480 ? 1500000 : 2500000 } : undefined); } catch (e) { rej(e); return; }
      const parts = [];
      rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
      rec.onstop = () => { const b = new Blob(parts, { type: (rec.mimeType || type || 'video/webm').split(';')[0] }); b.size ? res(b) : rej(new Error('empty')); };
      rec.start(250);
      const t0 = performance.now();
      /* rAF не идёт в фоне — дублируем таймером, чтобы запись не встала */
      const step = () => {
        const ms = performance.now() - t0;
        DR(x, m, Math.min(ms, DU));
        if (ms >= DU + 300) { clearInterval(iv); try { rec.stop(); } catch (e) { rej(e); } return; }
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
.replay.circle canvas,.replay.circle video{border-radius:50%;width:min(80vw,52vh);box-shadow:0 10px 40px rgba(0,0,0,.6),0 0 0 4px rgba(234,181,75,.6)}
.snapbtn.rp{margin-left:0;bottom:calc(6% + 40px)}`;
    document.head.appendChild(s);
  }
  /* в сборке для Claude (нет ссылки/скачивания) видео можно только посмотреть */
  const canExport = () => { try { return !(typeof TR !== 'undefined' && TR && TR.linkable === undefined); } catch (e) { return true; } };
  function sendFile(blob, name, text, btn) {
    if (typeof SHARE !== 'undefined' && SHARE.sendFile) return SHARE.sendFile(blob, name, text, btn);
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare && navigator.canShare({ files: [file] })) navigator.share({ files: [file], text }).catch(() => {});
    else if (navigator.share) navigator.share({ text }).catch(() => {});
    else { if (typeof copyText === 'function') copyText(text, btn); toast('Текст скопирован — видео сохрани кнопкой «Сохранить»'); }
  }
  function open(m, mode) {
    m = m || best();
    if (!m) { toast('Нечего показать — могни кого-нибудь 😏'); return; }
    const circle = mode === 'circle', SZ = circle ? CW : W, DU = circle ? CDUR : DUR;
    style();
    if (typeof AU !== 'undefined') AU.play('snap');
    const box = document.createElement('div'); box.className = 'replay' + (circle ? ' circle' : '');
    const exp = canExport();
    box.innerHTML = `<canvas width="${SZ}" height="${SZ}"></canvas><p class="st">Готовим видео…</p><div class="row">
      ${exp ? '<button class="btn gold" type="button" data-rp="share" disabled>Поделиться</button><button class="btn blue" type="button" data-rp="save" disabled>Сохранить</button>' : ''}
      <button class="btn ${circle ? 'grey' : 'orange'}" type="button" data-rp="${circle ? 'plain' : 'circle'}">${circle ? '🎬 Квадрат' : '🎞 Кружок'}</button>
      <button class="btn grey" type="button" data-rp="close">Закрыть</button></div>`;
    document.body.appendChild(box);
    const cv = box.querySelector('canvas'), x = cv.getContext('2d'), st = box.querySelector('.st');
    let raf = 0, alive = true, blob = null, url = null, F = null;
    const DR = circle ? ((xx, mm, ms) => drawCircle(xx, mm, ms, F || {})) : ((xx, mm, ms) => draw(xx, mm, ms));
    const run = () => {
      if (reduced()) DR(x, m, DU);
      else {
        const t0 = performance.now();
        const loop = () => { if (!alive) return; DR(x, m, (performance.now() - t0) % (DU + 900)); raf = requestAnimationFrame(loop); };
        loop();
      }
    };
    const text = tt('{p} — играю в ДурКер: https://t.me/durocker_bot', { p: L(m.phrase) || tt('Мой лучший момент') });
    const ext = () => (blob && /mp4/.test(blob.type) ? 'mp4' : 'webm');
    const fname = () => (circle ? 'durker-krug.' : 'durocker.') + ext();
    const start = async () => {
      if (circle) { F = await loadFaces(m); if (!alive) return; }
      run();
      makeVideo(m, { size: SZ, dur: DU, draw: DR }).then(b => {
        if (!alive) return;
        blob = b; url = URL.createObjectURL(b);
        box.querySelectorAll('[data-rp="share"],[data-rp="save"]').forEach(e => { e.disabled = false; });
        /* на телефоне видео удобнее сохранить долгим нажатием — показываем готовое видео вместо canvas */
        if (/mp4/.test(b.type) || !/iPhone|iPad/.test(navigator.userAgent)) {
          const v = document.createElement('video');
          Object.assign(v, { src: url, loop: true, muted: true, autoplay: true, playsInline: true });
          v.setAttribute('playsinline', '');
          cancelAnimationFrame(raf); cv.replaceWith(v); v.play().catch(() => {});
        }
        st.textContent = !exp ? 'Сохранить и поделиться — на сайте и в Telegram' : circle ? 'Кружок готов: долгое нажатие на видео — сохранить, в Telegram прикрепи как видео' : 'Долгое нажатие на видео — сохранить';
        REPLAY.lastBlob = b;
      }).catch(() => {
        if (!alive) return;
        st.textContent = 'Видео здесь не записать — сохрани картинку-открытку';
        const sv = box.querySelector('[data-rp="save"]');
        if (sv) { sv.disabled = false; sv.textContent = '📸 Открытка'; sv.dataset.rp = 'card'; }
      });
    };
    start();
    const close = () => { alive = false; cancelAnimationFrame(raf); if (url) setTimeout(() => URL.revokeObjectURL(url), 1000); box.remove(); };
    box.onclick = e => {
      const k = e.target.closest('[data-rp]');
      if (!k) { if (e.target === box) close(); return; }
      const a = k.dataset.rp;
      if (a === 'close') close();
      else if (a === 'circle') { close(); open(m, 'circle'); }
      else if (a === 'plain') { close(); open(m); }
      else if (a === 'card') { close(); if (typeof openPostcard === 'function') openPostcard({ title: tt(m.mognul ? 'МОГНУЛ!' : 'ТЫ НЕ ДУРАК!'), phrase: L(m.phrase), m: { name: nmT(m.defName), cards: m.def, vs: m.att, vsName: nmT(m.attName) } }); }
      else if (a === 'save' && blob) {
        const l = document.createElement('a'); l.href = url; l.download = fname(); document.body.appendChild(l); l.click(); l.remove();
      } else if (a === 'share' && blob) sendFile(blob, fname(), text, k);
    };
    return box;
  }

  /* ---------- встраивание: события шины ---------- */
  BUS.on('fx', d => { try { if (d.o) record(d.o); } catch (e) {} });
  /* экран итога: рядом с «📸 Открытка» — «🎬 Повтор» */
  BUS.on('over', () => {
    try {
      const so = $('snapOver');
      if (so && !$('replayOver') && best()) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn gold'; b.id = 'replayOver'; b.textContent = '🎬 Повтор';
        b.onclick = () => open();
        so.after(b);
        const c = document.createElement('button');
        c.type = 'button'; c.className = 'btn orange'; c.id = 'circleOver'; c.textContent = '🎞 Кружок';
        c.onclick = () => open(null, 'circle');
        b.after(c);
      }
    } catch (e) {}
  });
  /* 5-секундная кнопка после своего «могнул» — вторая рядом с «📸 Поделиться» */
  BUS.on('snap:button', () => {
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
  });

  return { open, best, makeVideo, draw, drawCircle, loadFaces, CW, CDUR, get moments() { return moments; }, lastBlob: null };
})();
