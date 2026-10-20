/* ДурКер — музыка и звуки. Всё синтезируется в браузере (Web Audio), файлов и чужих треков нет.
   Музыка — ленивый казино-лаунж с джазовыми аккордами; к концу колоды добавляются барабаны и мелодия.
   Волна 7: у каждого района своя музыка (подъезд, двор, рынок, вокзал, казино, «Ночь»), слои нарастают с напряжением
   партии (мало карт, матч-пойнт, заряд), отдельные ползунки громкости, больше звуков: фишки, подлог, сундук, стинги комбо. */
'use strict';

const AU = (() => {
  let ctx = null, out, music, sfx, lp, noise, echoIn, started = false, step = 0, nextT = 0, level = 1, timer = null;
  const num = (k, d) => { const v = parseFloat(load(k)); return isFinite(v) ? Math.max(0, Math.min(1, v)) : d; };
  let musicOn = load('durocker-music') !== '0', sfxOn = load('durocker-sfx') !== '0';
  let mVol = num('durocker-mvol', 1), sVol = num('durocker-svol', 1);
  const MBASE = 0.3, SBASE = 0.55;
  let tens = 0;          /* напряжение партии 0..3: добавляет слои музыки */
  let scene = null;      /* район стола: podyezd | dvor | rynok | vokzal | kazino | night | boss */
  let userTrack = 'lounge';
  /* треки: казино-лаунж, ночной рынок, гараж — как раньше; плюс по району */
  const TRACKS = {
    lounge: { bpm: 94, chords: [[57, 60, 64, 67], [50, 57, 60, 65], [55, 59, 62, 65], [48, 55, 59, 64], [53, 57, 60, 64], [47, 53, 57, 62], [52, 56, 59, 62], [57, 60, 64, 67]], drive: 0 },
    night: { bpm: 108, chords: [[52, 55, 59, 62], [48, 52, 55, 59], [57, 60, 64, 67], [47, 51, 54, 57], [52, 55, 59, 62], [45, 48, 52, 55], [50, 54, 57, 60], [47, 51, 54, 59]], drive: 1 },
    garage: { bpm: 126, chords: [[52, 59, 64, 67], [52, 59, 64, 67], [55, 62, 67, 71], [57, 64, 69, 72], [52, 59, 64, 67], [60, 67, 72, 76], [59, 66, 71, 74], [57, 64, 69, 72]], drive: 2 },
    /* подъезд: гулкое эхо, редкие «капли» и колокольчики */
    echo: { bpm: 78, style: 'echo', sw: 0.1, chords: [[57, 60, 64, 71], [53, 57, 60, 67], [48, 55, 59, 64], [52, 55, 59, 66], [57, 60, 64, 71], [53, 57, 60, 67], [50, 57, 60, 65], [52, 55, 59, 66]], drive: 0 },
    /* двор: гитарный перебор, бас и хлопок */
    pluck: { bpm: 102, style: 'pluck', sw: 0.18, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62], [57, 60, 64], [53, 57, 60], [55, 59, 62], [52, 56, 59]], drive: 1 },
    /* рынок: «ум-па», аккордеонные аккорды и мелодия гармонического минора */
    oompah: { bpm: 118, style: 'oompah', sw: 0.04, chords: [[57, 60, 64], [52, 56, 59], [57, 60, 64], [50, 53, 57], [52, 56, 59], [57, 60, 64], [50, 53, 57], [52, 56, 59]], drive: 1 },
    /* вокзал: стук колёс, гул, «динь-дон» табло */
    rail: { bpm: 92, style: 'rail', sw: 0.05, chords: [[50, 57, 62], [55, 62, 67], [48, 55, 60], [53, 60, 65], [50, 57, 62], [55, 62, 67], [57, 64, 69], [53, 60, 65]], drive: 0 },
    /* «Ночь в казино»: минорный неон — бас-пульс, арпеджио, прямая бочка */
    neon: { bpm: 100, style: 'neon', sw: 0, chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65], [50, 53, 57, 62], [52, 56, 59, 64]], drive: 1 },
  };
  const SCENE = { podyezd: 'echo', dvor: 'pluck', rynok: 'oompah', vokzal: 'rail', kazino: 'lounge', night: 'neon', boss: 'garage' };
  let TR_ = TRACKS.lounge, STEP = 60 / TR_.bpm / 4;
  const N = m => 440 * Math.pow(2, (m - 69) / 12);
  /* Am7 Dm7 G7 Cmaj7 Fmaj7 Bm7b5 E7 Am7 — по такту на аккорд */
  const SCALE = [69, 72, 74, 76, 79, 81, 84];
  const HARM = [69, 71, 72, 74, 76, 77, 80];   /* гармонический минор от ля */

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    out = ctx.createDynamicsCompressor(); out.connect(ctx.destination);
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.7; lp.connect(out);
    music = ctx.createGain(); music.gain.value = musicOn ? MBASE * mVol : 0; music.connect(lp);
    sfx = ctx.createGain(); sfx.gain.value = sfxOn ? SBASE * sVol : 0; sfx.connect(out);
    /* общее эхо для подъезда: задержка с обратной связью (один набор узлов на всю игру) */
    echoIn = ctx.createGain();
    const dly = ctx.createDelay(1.0), fb = ctx.createGain(), wet = ctx.createGain();
    dly.delayTime.value = 0.34; fb.gain.value = 0.38; wet.gain.value = 0.55;
    echoIn.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(lp);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  /* iPhone: без этого Web Audio молчит при включённом беззвучном режиме (переключатель сбоку).
     Новый Safari понимает audioSession; для старых играем полсекунды тишины через <audio>. */
  let kicked = false;
  function kickIOS() {
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
    if (kicked) return;
    kicked = true;
    try {
      const n = 4410, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
      const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8820, true); v.setUint32(28, 17640, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      const a = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
      a.setAttribute('playsinline', ''); a.play().catch(() => { kicked = false; });
    } catch (e) { kicked = false; }
  }
  /* браузер разрешает звук только в обработчике касания или клика — включаемся на каждом, пока не заработает */
  function unlock() {
    if (!init()) return;
    kickIOS();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (!started) { started = true; nextT = ctx.currentTime + 0.1; timer = setInterval(schedule, 25); }
  }
  /* после сворачивания iOS ставит звук на паузу — оживляем, как только вернулись */
  document.addEventListener('visibilitychange', () => { if (!document.hidden && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });

  function tone(dest, type, freq, t, dur, vol, opts = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.a || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function hiss(dest, t, dur, vol, f1, f2, type = 'bandpass') {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noise; f.type = type; f.frequency.setValueAtTime(f1, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest); s.start(t); s.stop(t + dur + 0.05);
  }
  const kick = (t, v = 0.5) => tone(music, 'sine', 120, t, 0.18, v, { to: 45 });
  const snare = (t, v = 0.2) => { hiss(music, t, 0.12, v, 1800); tone(music, 'triangle', 210, t, 0.08, v * 0.5, { to: 140 }); };
  const hat = (t, v = 0.05) => hiss(music, t, 0.035, v, 8000, 0, 'highpass');

  /* ---------- музыка ---------- */
  function schedule() {
    if (!ctx) return;
    const sw = TR_.sw == null ? 0.12 : TR_.sw, fast = (level >= 2 ? 0.9 : 1) * (tens >= 3 ? 0.94 : 1);
    while (nextT < ctx.currentTime + 0.12) {
      playStep(step, nextT);
      step = (step + 1) % (16 * TR_.chords.length);
      nextT += STEP * fast * (step % 2 ? 1 + sw : 1 - sw);
    }
  }
  function playStep(s, t) {
    const st = TR_.style && STYLES[TR_.style];
    if (st) st(s, t); else legacy(s, t);
    layers(s, t);
  }
  function legacy(s, t) {
    const bar = Math.floor(s / 16), i = s % 16, ch = TR_.chords[bar % TR_.chords.length], root = ch[0] - 12;
    const L2 = level >= 2 || tens >= 2, lv = Math.max(L2 ? 2 : 1, TR_.drive >= 2 ? 2 : 1);
    /* бас: шагающий, с проходящими нотами */
    if (i === 0 || i === 6 || i === 8 || i === 14) {
      const note = i === 0 ? root : i === 8 ? root + 7 : i === 6 ? root + 12 : root + (bar % 2 ? 5 : 3);
      tone(music, 'triangle', N(note), t, STEP * 3, 0.42);
      tone(music, 'square', N(note), t, STEP * 1.5, 0.05);
    }
    /* аккорды-«стабы» на слабые доли, как электропиано */
    if (i === 4 || i === 12 || (i === 10 && bar % 2)) ch.forEach((m, k) => tone(music, 'sawtooth', N(m), t, STEP * 2.6, 0.035, { detune: (k - 1.5) * 7, a: 0.01 }));
    /* мягкий пэд на весь такт */
    if (i === 0) ch.forEach(m => tone(music, 'sine', N(m + 12), t, STEP * 15, 0.03, { a: 0.4 }));
    /* барабаны: щётки в спокойной игре, плотнее в конце колоды */
    if (i === 0 || (lv >= 2 && i === 8) || (i === 10 && bar % 4 === 3)) tone(music, 'sine', 120, t, 0.18, 0.5, { to: 45 });
    if (i === 4 || i === 12) hiss(music, t, lv >= 2 ? 0.16 : 0.1, lv >= 2 ? 0.25 : 0.12, 1800);
    if (i % 2 === 0 || lv >= 2) hiss(music, t, 0.035, lv >= 2 ? 0.08 : 0.045, 8000, 0, 'highpass');
    /* последний круг: бегущее арпеджио поверх — музыка нарастает */
    if (L2 && i % 2 === 1) tone(music, 'triangle', N(ch[(i >> 1) % ch.length] + 12), t, STEP * 0.9, 0.05);
    if (L2 && i === 15) hiss(music, t, STEP * 2, 0.08, 400, 5000);
    /* мелодия появляется, когда колода кончилась */
    if ((L2 || TR_.drive >= 1) && (i === 2 || i === 7 || i === 11 || (i === 14 && Math.random() < 0.5))) {
      const pool = SCALE.filter(m => ch.some(c => (m - c) % 12 === 0) || Math.random() < 0.3);
      tone(music, 'square', N(pool[Math.floor(Math.random() * pool.length)] || 76), t, STEP * 1.8, 0.06, { detune: 4 });
    }
  }
  /* стили районов: каждый — отдельный набор «инструментов» на тех же 16 шагах */
  const STYLES = {
    echo(s, t) {
      const bar = s >> 4, i = s & 15, ch = TR_.chords[bar % 8], root = ch[0] - 12;
      if (i === 0) {
        tone(music, 'sine', N(root), t, STEP * 12, 0.5, { a: 0.02 });
        ch.forEach((m, k) => tone(echoIn, 'sine', N(m + 12), t + k * STEP * 0.5, STEP * 9, 0.035, { a: 0.08 }));
      }
      if ((i === 3 || i === 7 || i === 10 || i === 14) && Math.random() < 0.7) {
        const m = ch[(i + bar) % ch.length] + 12 + (Math.random() < 0.3 ? 12 : 0);
        tone(echoIn, 'triangle', N(m), t, STEP * 3, 0.06, { a: 0.004 }); tone(music, 'sine', N(m), t, STEP * 2, 0.03);
      }
      if (i === 0 || i === 8) tone(music, 'sine', 90, t, 0.14, 0.3, { to: 40 });
      if (i === 12 && bar % 2 === 0) tone(echoIn, 'sine', 1900, t, 0.06, 0.04, { to: 900 }); /* капля с потолка */
      if (i % 4 === 2) hat(t, 0.025);
    },
    pluck(s, t) {
      const bar = s >> 4, i = s & 15, ch = TR_.chords[bar % 8], root = ch[0] - 12;
      if (i % 2 === 0) {
        const m = ch[[0, 2, 1, 2][(i >> 1) % 4]];
        tone(music, 'triangle', N(m), t, STEP * 3, 0.09); tone(music, 'sawtooth', N(m), t, STEP * 1.2, 0.02);
      }
      if (i === 0 || i === 6 || i === 8 || i === 14) tone(music, 'triangle', N(i === 8 ? root + 7 : root), t, STEP * 2.5, 0.45);
      if (i === 0 || i === 8) kick(t, 0.45);
      if (i === 4 || i === 12) hiss(music, t, 0.1, 0.18, 1500);
      if (i % 4 === 2) hat(t, 0.045);
    },
    oompah(s, t) {
      const bar = s >> 4, i = s & 15, ch = TR_.chords[bar % 8], root = ch[0] - 12;
      if (i === 0 || i === 8) tone(music, 'triangle', N(root), t, STEP * 3, 0.5);                       /* ум */
      if (i === 4 || i === 12) ch.forEach((m, k) => tone(music, 'sawtooth', N(m), t, STEP * 1.5, 0.045, { detune: (k - 1) * 9 })); /* па */
      if (i === 10 && bar % 2) ch.forEach(m => tone(music, 'sawtooth', N(m), t, STEP * 1.2, 0.03));
      if ([2, 6, 10, 13].includes(i)) {
        const m = HARM[(bar * 3 + i) % HARM.length];
        tone(music, 'sawtooth', N(m), t, STEP * 1.6, 0.04, { detune: -8 }); tone(music, 'sawtooth', N(m), t, STEP * 1.6, 0.04, { detune: 8 });
      }
      if (i === 4 || i === 12) hiss(music, t, 0.07, 0.1, 2200);
      if (i % 2 === 0) hat(t, 0.03);
    },
    rail(s, t) {
      const bar = s >> 4, i = s & 15, ch = TR_.chords[bar % 8], root = ch[0] - 12;
      if (i === 0 || i === 3 || i === 6 || i === 8 || i === 11 || i === 14) hiss(music, t, 0.05, 0.14, 700, 300);  /* стук колёс */
      if (i === 0) {
        tone(music, 'sine', N(root), t, STEP * 16, 0.3, { a: 0.5 });
        ch.forEach(m => tone(music, 'sine', N(m), t, STEP * 15, 0.03, { a: 0.6 }));
      }
      if (i === 0 && bar % 4 === 2) { tone(music, 'sine', N(84), t, 0.35, 0.07); tone(music, 'sine', N(79), t + 0.3, 0.45, 0.07); } /* «динь-дон» табло */
      if (i === 8) tone(music, 'sine', 100, t, 0.12, 0.25, { to: 50 });
      if (i === 4 || i === 12) hiss(music, t, 0.12, 0.06, 1200);
    },
    neon(s, t) {
      const bar = s >> 4, i = s & 15, ch = TR_.chords[bar % 8], root = ch[0] - 12;
      if (i % 2 === 0) tone(music, 'sawtooth', N(root), t, STEP * 1.8, 0.14);
      if (i % 4 === 0) kick(t, 0.42);
      if (i === 4 || i === 12) snare(t, 0.16);
      if (i % 4 === 2) hat(t, 0.045);
      tone(music, 'square', N(ch[i % ch.length] + (i >= 8 ? 24 : 12)), t, STEP * 0.8, 0.035);
      if (i === 0) ch.forEach((m, k) => tone(music, 'sawtooth', N(m), t, STEP * 15, 0.02, { detune: (k - 1.5) * 9, a: 0.3 }));
    },
  };
  /* слои напряжения поверх любого стиля */
  function layers(s, t) {
    if (tens < 1) return;
    const i = s & 15, bar = s >> 4, ch = TR_.chords[bar % TR_.chords.length], own = TR_.style === 'neon';
    if (i % 2 === 0) hat(t, 0.035);
    if (tens >= 2) {
      if ((i === 0 || i === 8) && !own) kick(t, 0.28);
      if (i === 15 && bar % 2) hiss(music, t, STEP * 3, 0.07, 300, 6000);
    }
    if (tens >= 3) {
      if (i === 0 || i === 2) tone(music, 'sine', 70, t, 0.12, 0.4, { to: 38 });  /* сердцебиение */
      if (i === 0) ch.forEach(m => tone(music, 'sine', N(m + 12), t, STEP * 15, 0.025, { a: 0.5, detune: 6 }));
    }
  }
  function refreshFilter() {
    if (!ctx) return;
    const f = (level >= 2 || tens >= 2) ? 4200 : tens === 1 ? 2600 : 1800;
    lp.frequency.setTargetAtTime(f, ctx.currentTime, 0.6);
  }
  function setLevel(l) {
    if (l === level) return;
    level = l;
    refreshFilter();
  }
  function setTension(n) {
    n = Math.max(0, Math.min(3, n | 0));
    if (n === tens) return;
    tens = n; refreshFilter();
  }
  /* трек: выбранный игроком не «лаунж» важнее района; иначе играет музыка района */
  function applyTrack() {
    const id = scene && userTrack === 'lounge' ? (SCENE[scene] || 'lounge') : userTrack;
    const tr = TRACKS[id] || TRACKS.lounge;
    if (tr === TR_) return;
    TR_ = tr; STEP = 60 / TR_.bpm / 4; step = 0;
    if (ctx) { lp.frequency.cancelScheduledValues(ctx.currentTime); lp.frequency.setValueAtTime(900, ctx.currentTime); refreshFilter(); }
  }
  function setTrack(id) { userTrack = TRACKS[id] ? id : 'lounge'; applyTrack(); }
  function setScene(s) { s = s && SCENE[s] ? s : null; if (s === scene) return; scene = s; applyTrack(); }

  /* ---------- звуки ---------- */
  const at = () => ctx.currentTime + 0.01;
  /* аккорды комбинаций по индексу типа (см. TYPES в rules.js) */
  const COMBO_V = [
    { n: [72], w: 'triangle', gap: 0, len: 0.12, vol: 0.08 },                       // одиночка
    { n: [72, 76], w: 'square', gap: 0.05, len: 0.15, vol: 0.06 },                  // пара
    { n: [69, 72, 76], w: 'triangle', gap: 0.05, len: 0.18, vol: 0.08 },            // мини-флеш
    { n: [67, 71, 74], w: 'square', gap: 0.045, len: 0.18, vol: 0.06 },             // мини-стрит
    { n: [72, 72, 79], w: 'sawtooth', gap: 0.06, len: 0.2, vol: 0.05, sub: 1 },     // сет
    { n: [67, 71, 74, 79], w: 'square', gap: 0.04, len: 0.22, vol: 0.06, shine: 1 },// мини-стрит-флеш
    { n: [70, 74, 77, 82], w: 'square', gap: 0.05, len: 0.2, vol: 0.06 },           // две пары
    { n: [72, 72, 72, 84], w: 'sawtooth', gap: 0.07, len: 0.25, vol: 0.05, sub: 1 },// каре
    { n: [67, 69, 71, 72, 74], w: 'square', gap: 0.04, len: 0.2, vol: 0.06 },       // стрит
    { n: [65, 69, 72, 76, 79], w: 'triangle', gap: 0.05, len: 0.28, vol: 0.09 },    // флеш
    { n: [72, 76, 79, 84, 88], w: 'square', gap: 0.05, len: 0.28, vol: 0.06, sub: 1 }, // фулл-хаус
    { n: [72, 76, 79, 83, 86, 91], w: 'square', gap: 0.045, len: 0.32, vol: 0.06, sub: 1, shine: 1 }, // стрит-флеш
  ];
  /* стинг: бегущее вверх арпеджио после аккорда комбо; чем сильнее комбинация, тем длиннее и быстрее */
  const ST_N = [0, 0, 1, 1, 2, 3, 2, 3, 4, 5, 5, 7];
  const ST_SCALE = [72, 76, 79, 84, 88, 91, 96, 100];
  let dl = 0, dlT = 0, tk = 0;
  const S = {
    /* раздача: подряд идущие карты звучат всё выше, как перелив колоды */
    deal() {
      const t = at(), now = performance.now();
      if (now - dlT > 500) dl = 0;
      dlT = now; dl = Math.min(dl + 1, 14);
      hiss(sfx, t, 0.07, 0.35, 3500 + dl * 180, 1200);
      tone(sfx, 'triangle', 700 + dl * 55 + Math.random() * 80, t, 0.04, 0.08);
    },
    select() { tone(sfx, 'square', 620 + Math.random() * 80, at(), 0.05, 0.06); },
    click() { tone(sfx, 'triangle', 520, at(), 0.06, 0.12); },
    place() { const t = at(), f = 150 + Math.random() * 50; tone(sfx, 'sine', f, t, 0.16, 0.6, { to: 55 }); hiss(sfx, t, 0.08, 0.25, 2500); },
    /* глухой удар по столу для сильных комбинаций */
    thud(p) { const t = at(); tone(sfx, 'sine', 95, t, 0.3, 0.35 + 0.35 * p, { to: 32 }); hiss(sfx, t, 0.12, 0.15 + 0.15 * p, 500, 150, 'lowpass'); },
    /* звон комбинации: чем сильнее комбинация, тем выше и длиннее, как подсчёт в Balatro */
    combo(t0) {
      /* у каждого из 12 типов свой аккорд: от сухой ноты одиночки до сверкающего стрит-флеша */
      const ti = Math.max(0, Math.min(11, t0 | 0)), V = COMBO_V[ti], t = at();
      V.n.forEach((m, k) => {
        tone(sfx, V.w, N(m), t + k * V.gap, V.len, V.vol);
        tone(sfx, 'triangle', N(m + 12), t + k * V.gap, V.len * 1.3, V.vol * 1.1);
      });
      if (V.sub) tone(sfx, 'sine', N(V.n[0] - 24), t, 0.35, 0.35, { to: N(V.n[0] - 36) });
      if (V.shine) for (let k = 0; k < 6; k++) tone(sfx, 'sine', N(V.n[V.n.length - 1] + 12 + k * 2), t + V.n.length * V.gap + k * 0.035, 0.2, 0.05);
      const t0v = t + V.n.length * V.gap + 0.03, cnt = ST_N[ti], gap = Math.max(0.03, 0.06 - ti * 0.003);
      for (let k = 0; k < cnt; k++) tone(sfx, 'triangle', N(ST_SCALE[k]), t0v + k * gap, 0.14 + k * 0.01, 0.045 + k * 0.004);
      if (ti >= 9) { tone(sfx, 'sine', N(ST_SCALE[Math.min(cnt, 7)] + 12), t0v + cnt * gap, 0.5, 0.06); hiss(sfx, t0v + cnt * gap, 0.4, 0.08, 5000, 9000, 'highpass'); }
      if (ti >= 7) S.thud(Math.min(1, (ti - 6) / 5));
    },
    /* подсчёт штрафа: тик растёт по высоте с каждой картой, «бах» в конце */
    count(k) { const t = at(); tone(sfx, 'square', N(64 + (k | 0) * 2), t, 0.06, 0.07); hiss(sfx, t, 0.04, 0.12, 4000); },
    bang() { const t = at(); tone(sfx, 'sine', 110, t, 0.45, 0.7, { to: 38 }); hiss(sfx, t, 0.25, 0.3, 700, 3000); },
    snap() { const t = at(); hiss(sfx, t, 0.09, 0.5, 6000, 1500, 'highpass'); tone(sfx, 'square', 1800, t, 0.03, 0.05); },
    cover() { const t = at(); tone(sfx, 'triangle', N(72), t, 0.12, 0.14); tone(sfx, 'triangle', N(79), t + 0.08, 0.2, 0.14); },
    take() { tone(sfx, 'sawtooth', 300, at(), 0.45, 0.08, { to: 90 }); },
    bito() { const t = at(); hiss(sfx, t, 0.35, 0.3, 600, 4000); tone(sfx, 'sine', N(60), t + 0.05, 0.3, 0.12); },
    transfer() { const t = at(); hiss(sfx, t, 0.3, 0.25, 500, 6000); tone(sfx, 'square', 300, t, 0.3, 0.07, { to: 1200 }); },
    action() {
      const t = at();
      [76, 79, 83, 88, 91].forEach((m, k) => tone(sfx, 'triangle', N(m), t + k * 0.045, 0.3, 0.1));
      tone(sfx, 'sine', 80, t, 0.4, 0.4, { to: 40 });
    },
    trump() { const t = at(); [55, 59, 62, 67, 71, 74].forEach((m, k) => tone(sfx, 'sawtooth', N(m), t + k * 0.05, 0.4, 0.05)); },
    win() { const t = at(); [60, 64, 67, 72, 76, 79, 84].forEach((m, k) => { tone(sfx, 'square', N(m), t + k * 0.09, 0.35, 0.08); tone(sfx, 'triangle', N(m - 12), t + k * 0.09, 0.4, 0.1); }); },
    lose() { const t = at(); [67, 66, 65, 61].forEach((m, k) => tone(sfx, 'sawtooth', N(m - 12), t + k * 0.32, k === 3 ? 0.9 : 0.3, 0.1)); },
    /* часы блица и последние секунды: «тик» и «так» разной высоты */
    tick() { const t = at(); tk ^= 1; tone(sfx, 'square', tk ? 1500 : 1100, t, 0.03, 0.06); tone(sfx, 'sine', tk ? 300 : 220, t, 0.05, 0.12, { to: 120 }); },
    /* хайп «могнул»: гулкий бум в стол, трещина стекла и аккорд вверх; по тебе — провал вниз */
    hype() {
      const t = at();
      tone(sfx, 'sine', 90, t, 0.55, 0.75, { to: 30 }); tone(sfx, 'sine', 52, t, 0.7, 0.55, { to: 28 });
      hiss(sfx, t, 0.3, 0.35, 900, 5000); hiss(sfx, t, 0.07, 0.18, 6500, 0, 'highpass');
      [72, 76, 79, 84].forEach((m, k) => tone(sfx, 'square', N(m), t + 0.05 + k * 0.05, 0.3, 0.07));
    },
    hypeBad() {
      const t = at();
      tone(sfx, 'sawtooth', 220, t, 0.7, 0.12, { to: 55 }); tone(sfx, 'sine', 70, t, 0.6, 0.6, { to: 30 });
      hiss(sfx, t, 0.4, 0.3, 3000, 400); tone(sfx, 'sine', 48, t + 0.05, 0.5, 0.5, { to: 28 });
      tone(sfx, 'triangle', N(63), t + 0.12, 0.35, 0.07, { to: N(60) });
    },
    /* Шулер подменил карту, и ты это заметил: тритон и «скользкая» нота вниз */
    devil() {
      const t = at();
      tone(sfx, 'sawtooth', N(52), t, 0.55, 0.09, { to: N(51) }); tone(sfx, 'sawtooth', N(58), t + 0.02, 0.55, 0.07, { to: N(57) });
      tone(sfx, 'square', N(64), t + 0.18, 0.28, 0.05, { to: N(63) }); hiss(sfx, t, 0.3, 0.12, 500, 200, 'lowpass');
    },
    /* звон фишек: горсть монет, чем больше выигрыш, тем длиннее */
    chips(n) {
      const t = at(), k = Math.min(10, 4 + ((n || 0) / 50 | 0));
      for (let i = 0; i < k; i++) {
        const tt = t + i * 0.045 + Math.random() * 0.02, f = 2200 + Math.random() * 1800;
        tone(sfx, 'sine', f, tt, 0.09, 0.07); tone(sfx, 'triangle', f * 1.52, tt, 0.06, 0.04); hiss(sfx, tt, 0.02, 0.1, 6000, 0, 'highpass');
      }
    },
    /* сундук: нарастание перед открытием и взрыв с блеском */
    chestBuild() {
      const t = at();
      hiss(sfx, t, 1.2, 0.25, 200, 4500); tone(sfx, 'sawtooth', 70, t, 1.25, 0.12, { to: 280, a: 0.6 });
      for (let i = 0; i < 8; i++) tone(sfx, 'square', N(60 + i * 2), t + i * 0.14, 0.12, 0.04);
    },
    chestBoom() {
      const t = at();
      tone(sfx, 'sine', 90, t, 0.6, 0.8, { to: 30 }); hiss(sfx, t, 0.5, 0.3, 1000, 6000);
      [72, 76, 79, 84, 88, 91].forEach((m, k) => tone(sfx, 'triangle', N(m), t + 0.03 + k * 0.05, 0.3, 0.09));
      for (let k = 0; k < 7; k++) tone(sfx, 'sine', N(96 + k * 2), t + 0.3 + k * 0.04, 0.2, 0.04);
    },
  };
  function play(name, arg) { if (!ctx || !sfxOn || ctx.state !== 'running') return; try { S[name](arg); } catch (e) {} }

  function setMusic(on) { musicOn = on; store('durocker-music', on ? '1' : '0'); if (ctx) music.gain.setTargetAtTime(on ? MBASE * mVol : 0, ctx.currentTime, 0.2); }
  function setSfx(on) { sfxOn = on; store('durocker-sfx', on ? '1' : '0'); if (ctx) sfx.gain.setTargetAtTime(on ? SBASE * sVol : 0, ctx.currentTime, 0.05); }
  function setMusicVol(v) { mVol = Math.max(0, Math.min(1, +v || 0)); store('durocker-mvol', String(mVol)); if (ctx && musicOn) music.gain.setTargetAtTime(MBASE * mVol, ctx.currentTime, 0.1); }
  function setSfxVol(v) { sVol = Math.max(0, Math.min(1, +v || 0)); store('durocker-svol', String(sVol)); if (ctx && sfxOn) sfx.gain.setTargetAtTime(SBASE * sVol, ctx.currentTime, 0.05); }
  return {
    unlock, play, setLevel, setMusic, setSfx, setTrack, setScene, setTension, setMusicVol, setSfxVol,
    get state() { return ctx ? ctx.state : 'none'; }, get music() { return musicOn; }, get sfx() { return sfxOn; },
    get mvol() { return mVol; }, get svol() { return sVol; }, get scene() { return scene; }, get tension() { return tens; },
    _S: S, _ctx: () => ctx, _step: (s, t) => playStep(s, t),
    get track() { return TR_ === TRACKS.lounge ? 'lounge' : Object.keys(TRACKS).find(k => TRACKS[k] === TR_); },
  };
})();

/* ---------- встраивание через шину: музыка района, напряжение партии, звуки событий ---------- */
(() => {
  if (typeof BUS === 'undefined') return;
  const chipBal = () => { const v = parseInt(load('durocker-chips'), 10); return isFinite(v) ? v : 0; };
  /* напряжение: мало карт у кого-то, колода кончилась, заряд, матч-пойнт */
  function tension() {
    try {
      if (typeof G === 'undefined' || !G || G.over || G.tutorial) return 0;
      let t = 0;
      const opp = G.B ? G.B.length : 8, me = G.P ? G.P.length : 8;
      if (opp <= 3 || me <= 3) t++;
      if (opp <= 1 || me <= 1) t++;
      if (G.deck && G.deck.length === 0) t = Math.max(t, 2);
      if (G.charge && (G.charge.p >= 2 || G.charge.b >= 2)) t++;
      if (typeof SERIES !== 'undefined' && SERIES && !SERIES.done) {
        const to = typeof seriesTo === 'function' ? seriesTo() : SERIES.to;
        if (to > 1 && SERIES.w && (SERIES.w.p >= to - 1 || SERIES.w.b >= to - 1)) t++;
      }
      return Math.min(3, t);
    } catch (e) { return 0; }
  }
  let before = 0;
  BUS.on('hud:render', () => {
    AU.setTension(tension());
    const d = document.documentElement.dataset.district;
    AU.setScene(d || null);
  });
  BUS.on('game:start', () => { AU.setTension(0); AU.setScene(document.documentElement.dataset.district || null); });
  BUS.on('over', () => { AU.setTension(0); });
  BUS.on('cheat:seen', () => AU.play('devil'));
  /* выигрыш фишек: сравниваем баланс до и после итога */
  BUS.on('game:over:before', () => { before = chipBal(); });
  BUS.on('over', () => setTimeout(() => { const g = chipBal() - before; if (g > 0) AU.play('chips', g); }, 450));
  /* сундук рисует chips.js: ловим его появление и раскрытие по DOM */
  document.addEventListener('DOMContentLoaded', () => {
    try {
      /* за телом следим только за появлением узла (без subtree-атрибутов: это дорого), класс .open — на самом сундуке */
      new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
        if (n.id !== 'chOv') return;
        AU.play('chestBuild');
        new MutationObserver((_, o) => { if (n.classList.contains('open')) { o.disconnect(); AU.play('chestBoom'); } })
          .observe(n, { attributes: true, attributeFilter: ['class'] });
      }))).observe(document.body, { childList: true });
    } catch (e) {}
  });
})();
