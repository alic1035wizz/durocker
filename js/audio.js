/* Дурокер — музыка и звуки. Всё синтезируется в браузере (Web Audio), файлов и чужих треков нет.
   Музыка — ленивый казино-лаунж с джазовыми аккордами; к концу колоды добавляются барабаны и мелодия. */
'use strict';

const AU = (() => {
  let ctx = null, out, music, sfx, lp, noise, started = false, step = 0, nextT = 0, level = 1, timer = null;
  let musicOn = load('durocker-music') !== '0', sfxOn = load('durocker-sfx') !== '0';
  /* три трека: казино-лаунж, ночной рынок (быстрее, минор), гараж (драйв) */
  const TRACKS = {
    lounge: { bpm: 94, chords: [[57, 60, 64, 67], [50, 57, 60, 65], [55, 59, 62, 65], [48, 55, 59, 64], [53, 57, 60, 64], [47, 53, 57, 62], [52, 56, 59, 62], [57, 60, 64, 67]], drive: 0 },
    night: { bpm: 108, chords: [[52, 55, 59, 62], [48, 52, 55, 59], [57, 60, 64, 67], [47, 51, 54, 57], [52, 55, 59, 62], [45, 48, 52, 55], [50, 54, 57, 60], [47, 51, 54, 59]], drive: 1 },
    garage: { bpm: 126, chords: [[52, 59, 64, 67], [52, 59, 64, 67], [55, 62, 67, 71], [57, 64, 69, 72], [52, 59, 64, 67], [60, 67, 72, 76], [59, 66, 71, 74], [57, 64, 69, 72]], drive: 2 },
  };
  let TR_ = TRACKS.lounge, STEP = 60 / TR_.bpm / 4;
  const N = m => 440 * Math.pow(2, (m - 69) / 12);
  /* Am7 Dm7 G7 Cmaj7 Fmaj7 Bm7b5 E7 Am7 — по такту на аккорд */
  const SCALE = [69, 72, 74, 76, 79, 81, 84];

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    out = ctx.createDynamicsCompressor(); out.connect(ctx.destination);
    lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.7; lp.connect(out);
    music = ctx.createGain(); music.gain.value = musicOn ? 0.3 : 0; music.connect(lp);
    sfx = ctx.createGain(); sfx.gain.value = sfxOn ? 0.55 : 0; sfx.connect(out);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  /* браузер разрешает звук только после касания — включаемся на первом */
  function unlock() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
    if (!started) { started = true; nextT = ctx.currentTime + 0.1; timer = setInterval(schedule, 25); }
  }

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

  /* ---------- музыка ---------- */
  function schedule() {
    if (!ctx) return;
    while (nextT < ctx.currentTime + 0.12) { playStep(step, nextT); step = (step + 1) % (16 * TR_.chords.length); nextT += STEP * (step % 2 ? 1.12 : 0.88); }
  }
  function playStep(s, t) {
    const bar = Math.floor(s / 16), i = s % 16, ch = TR_.chords[bar % TR_.chords.length], root = ch[0] - 12, lv = Math.max(level, TR_.drive >= 2 ? 2 : 1);
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
    /* мелодия появляется, когда колода кончилась */
    if ((level >= 2 || TR_.drive >= 1) && (i === 2 || i === 7 || i === 11 || (i === 14 && Math.random() < 0.5))) {
      const pool = SCALE.filter(m => ch.some(c => (m - c) % 12 === 0) || Math.random() < 0.3);
      tone(music, 'square', N(pool[Math.floor(Math.random() * pool.length)] || 76), t, STEP * 1.8, 0.06, { detune: 4 });
    }
  }
  function setLevel(l) {
    if (l === level || !ctx) { level = l; return; }
    level = l;
    lp.frequency.setTargetAtTime(l >= 2 ? 4200 : 1800, ctx.currentTime, 0.6);
  }

  /* ---------- звуки ---------- */
  const at = () => ctx.currentTime + 0.01;
  const S = {
    deal() { const t = at(); hiss(sfx, t, 0.07, 0.35, 3500, 1200); tone(sfx, 'triangle', 900 + Math.random() * 300, t, 0.04, 0.08); },
    select() { tone(sfx, 'square', 620 + Math.random() * 80, at(), 0.05, 0.06); },
    click() { tone(sfx, 'triangle', 520, at(), 0.06, 0.12); },
    place() { const t = at(); tone(sfx, 'sine', 170, t, 0.16, 0.6, { to: 60 }); hiss(sfx, t, 0.08, 0.25, 2500); },
    /* звон комбинации: чем сильнее комбинация, тем выше и длиннее, как подсчёт в Balatro */
    combo(t0) {
      const t = at(), n = 2 + Math.min(5, Math.floor(t0 / 2)), base = 64 + t0;
      for (let k = 0; k < n; k++) {
        tone(sfx, 'square', N(base + [0, 4, 7, 12, 16, 19, 24][k]), t + k * 0.06, 0.18, 0.07);
        tone(sfx, 'triangle', N(base + 12 + [0, 4, 7, 12, 16, 19, 24][k]), t + k * 0.06, 0.25, 0.08);
      }
    },
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
    tick() { tone(sfx, 'square', 1400, at(), 0.03, 0.06); },
    /* хайп: удар баса и аккорд вверх; по тебе — провал вниз */
    hype() { const t = at(); tone(sfx, 'sine', 90, t, 0.5, 0.7, { to: 35 }); hiss(sfx, t, 0.3, 0.35, 900, 5000); [72, 76, 79, 84].forEach((m, k) => tone(sfx, 'square', N(m), t + 0.05 + k * 0.05, 0.3, 0.07)); },
    hypeBad() { const t = at(); tone(sfx, 'sawtooth', 220, t, 0.7, 0.12, { to: 55 }); tone(sfx, 'sine', 70, t, 0.6, 0.6, { to: 30 }); hiss(sfx, t, 0.4, 0.3, 3000, 400); },
  };
  function play(name, arg) { if (!ctx || !sfxOn || ctx.state !== 'running') return; try { S[name](arg); } catch (e) {} }

  function setMusic(on) { musicOn = on; store('durocker-music', on ? '1' : '0'); if (ctx) music.gain.setTargetAtTime(on ? 0.3 : 0, ctx.currentTime, 0.2); }
  function setSfx(on) { sfxOn = on; store('durocker-sfx', on ? '1' : '0'); if (ctx) sfx.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, 0.05); }
  function setTrack(id) { TR_ = TRACKS[id] || TRACKS.lounge; STEP = 60 / TR_.bpm / 4; }
  return { unlock, play, setLevel, setMusic, setSfx, setTrack, get music() { return musicOn; }, get sfx() { return sfxOn; } };
})();
