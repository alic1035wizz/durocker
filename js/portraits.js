/* ДурКер — портреты персонажей.
   Каждый портрет — inline SVG, который собирается кодом из параметров (голова, кожа, причёска, головной убор,
   очки, усы/борода, одежда, аксессуар). Плоский мультяшный стиль с тёмным контуром.
   Шесть эмоций: neutral, smug (ухмылка), angry (злость), shock (шок), think (думает), cheat (прищур шулера).
   Смена эмоции — плавная (кросс-фейд слоёв + наклон головы), через ~1,5 с возврат к базовой; «дыхание» и моргание.
   В игровой код ничего не правим: подмена идёт обёртками showFx / showOver / cheatSeen / say / renderHUD
   и MutationObserver по аватарам (.ava, .wkava, .pava, #oppAva). Файлов, кроме этого, не трогаем. */
'use strict';

const PORTRAITS = (() => {
  const INK = '#2b1b12';
  const EMOS = ['neutral', 'smug', 'angry', 'shock', 'think', 'cheat'];
  const SKIN = { pale: '#f6d5b8', fair: '#efc19a', tan: '#d9a070', brown: '#b0764a', dark: '#80502f', ruddy: '#e2a07e', old: '#ecc8a8', paint: '#fbf3ea' };
  const HAIR = { black: '#241812', dbrown: '#3f2a1d', brown: '#6b4528', chest: '#8a4b25', blond: '#d9a441', ginger: '#c1561f', gray: '#9d9d9d', white: '#e9e5dc' };
  const GOLD = '#f0b429';

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const t = k < 0 ? 0 : 255, a = Math.abs(k);
    r = Math.round(r + (t - r) * a); g = Math.round(g + (t - g) * a); b = Math.round(b + (t - b) * a);
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  const P = (d, fill, sw = 2, stroke = INK) => `<path d="${d}" fill="${fill}" stroke="${sw ? stroke : 'none'}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const F = (d, fill) => `<path d="${d}" fill="${fill}"/>`;
  const L = (d, stroke, sw = 1.6) => `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const C = (x, y, r, fill, sw = 0, stroke = INK) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"${sw ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
  const E = (x, y, rx, ry, fill, sw = 0, stroke = INK) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${sw ? ` stroke="${stroke}" stroke-width="${sw}"` : ''}/>`;
  const mir = s => `<g transform="translate(100 0) scale(-1 1)">${s}</g>`;
  const both = s => s + mir(s);

  /* ---------------- головы ---------------- */
  const HEADS = {
    round: { w: 19, d: 'M50 20C63 20 69 31 69 44C69 58 62 68 50 68C38 68 31 58 31 44C31 31 37 20 50 20Z' },
    square: { w: 18, d: 'M32 26Q32 20 40 20H60Q68 20 68 26V52Q68 68 56 68H44Q32 68 32 52Z' },
    long: { w: 17, d: 'M50 17C62 17 67 28 67 43C67 60 60 72 50 72C40 72 33 60 33 43C33 28 38 17 50 17Z' },
    wide: { w: 22, d: 'M50 21C67 21 72 33 72 46C72 60 63 68 50 68C37 68 28 60 28 46C28 33 33 21 50 21Z' },
    pear: { w: 18, d: 'M36 28Q36 19 50 19Q64 19 64 28Q70 44 68 55Q64 69 50 69Q36 69 32 55Q30 44 36 28Z' },
    kid: { w: 17, d: 'M50 24C62 24 67 34 67 46C67 59 60 67 50 67C40 67 33 59 33 46C33 34 38 24 50 24Z' }
  };

  /* ---------------- причёски: [сзади, спереди] (под ширину 19) ---------------- */
  function hairParts(h, col) {
    const f = d => P(d, col, 2);
    switch (h.s) {
      case 'short': return ['', f('M31 41Q28 16 50 15.5Q72 16 69 41Q67 31 60 29.5Q51 33 41 29Q34 31 31 41Z')];
      case 'messy': return ['', f('M30 42L28 27L34 29L35 15L42 24L48 12L54 24L62 14L64 27L72 25L70 42Q66 31 58 30Q50 34 42 30Q34 31 30 42Z')];
      case 'slick': return ['', f('M31 40Q27 16 50 15Q73 16 69 40Q68 28 57 24Q40 22 31 40Z') + L('M38 21Q50 17 62 21', 'rgba(255,255,255,.4)', 1.6)];
      case 'combover': return ['', f('M31 44Q28 33 33 27L36 33Q33 38 33 46Z') + mir(f('M31 44Q28 33 33 27L36 33Q33 38 33 46Z'))
        + L('M34 28Q50 16 66 27', col, 1.8) + L('M34 31Q50 20 66 30', col, 1.8) + L('M35 25Q50 15 65 25', col, 1.4)];
      case 'bald': return ['', f('M31 47Q28 38 32 30L35 36Q33 42 33 48Z') + mir(f('M31 47Q28 38 32 30L35 36Q33 42 33 48Z')) + E(42, 25, 4.4, 2, 'rgba(255,255,255,.5)')];
      case 'long': return [P('M27 44Q24 16 50 14Q76 16 73 44L75 76Q62 82 50 77Q38 82 25 76Z', col, 2), f('M31 41Q30 18 50 17Q70 18 69 41Q64 25 50 29Q36 25 31 41Z')];
      case 'bob': return [P('M28 46Q25 15 50 14Q75 15 72 46L72 61Q64 59 66 52L34 52Q36 59 28 61Z', col, 2), f('M31 41Q30 18 50 17Q70 18 69 41Q62 26 50 29Q38 26 31 41Z')];
      case 'bun': return [C(50, 13, 7, col, 2), f('M31 41Q28 17 50 16.5Q72 17 69 41Q67 31 60 29.5Q51 33 41 29Q34 31 31 41Z') + L('M44 9.5Q50 14 56 9.5', 'rgba(0,0,0,.25)', 1.2)];
      case 'curly': {
        const cs = [[31, 31, 7], [38, 24, 8], [47, 21, 8], [56, 21, 8], [64, 25, 8], [70, 32, 7], [28, 42, 6], [72, 42, 6]];
        return [cs.map(([x, y, r]) => C(x, y, r, col, 2)).join('') + cs.map(([x, y, r]) => C(x, y, r - 1, col)).join(''), ''];
      }
      case 'buzz': return ['', F('M31 40Q28 18 50 17.5Q72 18 69 40Q66 29 50 28Q34 29 31 40Z', col + 'b0') + L('M31 40Q28 18 50 17.5Q72 18 69 40', 'rgba(0,0,0,.35)', 1.2)];
      case 'mullet': return [P('M31 46L26 72L40 64L60 64L74 72L69 46Z', col, 2), f('M31 41Q28 16 50 15.5Q72 16 69 41Q67 31 60 29.5Q51 33 41 29Q34 31 31 41Z')];
      case 'afro': return [C(50, 28, 27, col, 2), ''];
      case 'wild': {
        const cs = [[26, 38, 8], [74, 38, 8], [30, 24, 8], [70, 24, 8], [40, 15, 8], [60, 15, 8], [50, 12, 7]];
        return [cs.map(([x, y, r]) => C(x, y, r, col, 2)).join('') + cs.map(([x, y, r]) => C(x, y, r - 1, col)).join(''), f('M33 34Q40 27 50 28Q60 27 67 34Q60 24 50 24Q40 24 33 34Z')];
      }
      case 'rainbow': {
        const cols = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#ec407a', '#26c6da'];
        const cs = [[26, 40, 8], [74, 40, 8], [27, 27, 9], [73, 27, 9], [37, 17, 9], [63, 17, 9], [50, 13, 9], [24, 52, 6], [76, 52, 6]];
        return [cs.map(([x, y, r], i) => C(x, y, r, cols[i % cols.length], 2)).join(''), ''];
      }
      default: return ['', ''];
    }
  }

  /* ---------------- головные уборы ---------------- */
  function hatSVG(h) {
    const c = h.c, c2 = h.c2 || shade(c, -0.25);
    switch (h.k) {
      case 'kepka': return P('M27 34Q26 20 42 18H62Q76 20 73 34Z', c, 2) + L('M28 31Q50 27 72 31', c2, 2) + C(50, 18, 2, c2) + P('M24 34Q50 29 76 34Q80 41 64 40Q50 38 36 40Q20 41 24 34Z', c2, 2);
      case 'aerodrom': return P('M20 34L33 16H67L80 34Z', c, 2) + L('M24 31H76', c2, 2) + P('M24 34H76Q80 42 62 40H38Q20 42 24 34Z', c2, 2) + C(50, 25, 2.5, c2);
      case 'furazhka': return P('M28 32Q28 18 50 17Q72 18 72 32Z', c, 2) + P('M23 21Q50 11 77 21Q50 26 23 21Z', c, 2) + P('M28 30H72V36H28Z', c2, 2) + C(50, 33, 3.4, GOLD, 1.2) + P('M34 36H66Q65 43 50 43Q35 43 34 36Z', shade(c2, -0.3), 2);
      case 'pill': return P('M33 29Q33 15 52 15Q70 16 67 29Q50 25 33 29Z', c, 2) + P('M33 27Q50 23 67 27L67 31Q50 27 33 31Z', h.c2 || '#f7e9c8', 1.6) + C(50, 24.5, 2.2, GOLD, 1);
      case 'ushanka': return P('M27 38L23 60Q31 66 36 58L36 40Z', c2, 2) + mir(P('M27 38L23 60Q31 66 36 58L36 40Z', c2, 2))
        + P('M28 36Q27 12 50 12Q73 12 72 36Z', c, 2) + P('M26 34Q50 26 74 34L74 41Q50 33 26 41Z', c2, 2) + F('M48 26L50 21L52 26L57 27L53 30L54 35L50 32L46 35L47 30L43 27Z', '#d9362b');
      case 'platok': return P('M28 44Q26 15 50 14Q74 15 72 44Q72 28 50 25Q28 28 28 44Z', c, 2)
        + P('M28 38Q26 58 36 68L42 63Q33 56 33 40Z', c, 2) + mir(P('M28 38Q26 58 36 68L42 63Q33 56 33 40Z', c, 2))
        + [[40, 20], [50, 17], [60, 20], [34, 28], [66, 28], [44, 25], [56, 25]].map(([x, y]) => C(x, y, 1.5, h.c2)).join('')
        + P('M44 68L50 64L56 68L50 72Z', c, 1.8);
      case 'beret': return P('M29 31Q29 14 52 14Q77 16 74 30Q60 24 29 31Z', c, 2) + L('M33 28Q48 22 70 26', shade(c, -0.25), 1.4) + C(52, 13, 2, c2, 1.4);
      case 'helmet': return P('M28 35Q28 12 50 12Q72 12 72 35Z', c, 2) + P('M45 12H55V33H45Z', shade(c, -0.12), 1.8) + P('M23 35H77Q79 40 71 40H29Q21 40 23 35Z', c, 2) + L('M33 24Q36 17 42 15', 'rgba(255,255,255,.6)', 2);
      case 'fedora': return `<g transform="rotate(-7 50 30)">${P('M20 33Q50 23 80 33Q82 39 70 37Q50 41 30 37Q18 39 20 33Z', c, 2)}${P('M33 31Q32 12 50 12Q68 12 67 31Z', c, 2)}${L('M42 13Q50 19 58 13', shade(c, -0.25), 1.6)}${P('M33 27H67V32H33Z', c2, 1.6)}</g>`;
      case 'tophat': return P('M34 30L36 3H64L66 30Z', c, 2) + P('M33 24H67V29H33Z', c2, 1.6) + P('M25 31Q50 24 75 31Q50 38 25 31Z', c, 2);
      case 'beanie': return P('M29 35Q28 14 50 14Q72 15 71 35Z', c, 2) + P('M27 33H73V41H27Z', shade(c, 0.12), 2) + [33, 39, 45, 51, 57, 63, 69].map(x => L(`M${x} 34V40`, 'rgba(0,0,0,.3)', 1)).join('') + C(50, 12, 3, c2, 1.6);
      case 'visor': return P('M27 29Q50 21 73 29L77 35Q50 29 23 35Z', c, 2) + P('M24 33Q50 27 76 33L76 36Q50 31 24 36Z', shade(c, -0.25), 1.2);
      default: return '';
    }
  }

  /* ---------------- очки ---------------- */
  function glassesSVG(g, ex, ey) {
    const lx = 50 - ex, rx = 50 + ex, c = g.c || INK;
    switch (g.k) {
      case 'round': return `<g>${C(lx, ey, 6.2, 'rgba(255,255,255,.22)', 1.9, c)}${C(rx, ey, 6.2, 'rgba(255,255,255,.22)', 1.9, c)}${L(`M${lx + 6} ${ey - 1}Q50 ${ey - 3} ${rx - 6} ${ey - 1}`, c, 1.8)}${L(`M${lx - 6.2} ${ey}L${lx - 10} ${ey - 1}`, c, 1.6)}${L(`M${rx + 6.2} ${ey}L${rx + 10} ${ey - 1}`, c, 1.6)}</g>`;
      case 'thick': return `<g>${C(lx, ey, 7, 'rgba(255,255,255,.3)', 2.8, c)}${C(rx, ey, 7, 'rgba(255,255,255,.3)', 2.8, c)}${L(`M${lx + 7} ${ey}Q50 ${ey - 2.5} ${rx - 7} ${ey}`, c, 2.6)}</g>`;
      case 'square': return `<g><rect x="${lx - 6.2}" y="${ey - 4.6}" width="12.4" height="9.4" rx="2" fill="rgba(255,255,255,.22)" stroke="${c}" stroke-width="1.9"/><rect x="${rx - 6.2}" y="${ey - 4.6}" width="12.4" height="9.4" rx="2" fill="rgba(255,255,255,.22)" stroke="${c}" stroke-width="1.9"/>${L(`M${lx + 6.2} ${ey - 1.5}H${rx - 6.2}`, c, 1.8)}</g>`;
      case 'sun': return `<g>${P(`M${lx - 6.6} ${ey - 4.5}H${lx + 6.2}V${ey + 1}Q${lx + 5} ${ey + 5.6} ${lx} ${ey + 5.6}Q${lx - 6.6} ${ey + 5.6} ${lx - 6.6} ${ey + 1}Z`, '#15151a', 1.6)}${P(`M${rx - 6.2} ${ey - 4.5}H${rx + 6.6}V${ey + 1}Q${rx + 6.6} ${ey + 5.6} ${rx} ${ey + 5.6}Q${rx - 5} ${ey + 5.6} ${rx - 6.2} ${ey + 1}Z`, '#15151a', 1.6)}${L(`M${lx + 6} ${ey - 3}H${rx - 6}`, INK, 2)}${L(`M${lx - 4} ${ey - 2.5}l3 -0.6M${rx + 1} ${ey - 2.5}l3 -0.6`, 'rgba(255,255,255,.55)', 1.2)}</g>`;
      case 'monocle': return `<g>${C(rx, ey, 6.6, 'rgba(255,255,255,.25)', 1.8, GOLD)}${L(`M${rx + 3} ${ey + 6.4}Q${rx + 8} ${ey + 16} ${rx + 4} ${ey + 28}`, GOLD, 1)}</g>`;
      default: return '';
    }
  }

  /* ---------------- усы и борода ---------------- */
  function stacheSVG(s) {
    const c = s.c;
    switch (s.k) {
      case 'handle': return P('M50 54Q44 51 37 55Q41 60 49 56.5Q50 56 51 56.5Q59 60 63 55Q56 51 50 54Z', c, 1.6);
      case 'brush': return P('M41 53Q50 51 59 53L58.5 57.5Q50 55 41.5 57.5Z', c, 1.6);
      case 'thick': return P('M39 53Q50 50 61 53Q62 59 56 58Q50 55.5 44 58Q38 59 39 53Z', c, 1.6);
      case 'pencil': return L('M42 55.4Q50 52.2 58 55.4', c, 1.7) + L('M42 55.4l-1.2 1.2M58 55.4l1.2 1.2', c, 1.3);
      default: return '';
    }
  }
  function beardSVG(b) {
    const c = b.c;
    switch (b.k) {
      case 'full': return P('M31 48L32 56Q36 72 50 72Q64 72 68 56L69 48Q66 58 58 59Q50 56 42 59Q34 58 31 48Z', c, 2);
      case 'goatee': return P('M45 63Q50 61.5 55 63Q56 69 50 70Q44 69 45 63Z', c, 1.8);
      case 'stubble': return F('M32 51Q33 68 50 69Q67 68 68 51Q62 60 50 60Q38 60 32 51Z', c + '55') + [[38, 63], [43, 66], [50, 67.5], [57, 66], [62, 63], [36, 58], [64, 58], [47, 63], [53, 63]].map(([x, y]) => C(x, y, 0.55, c + 'aa')).join('');
      default: return '';
    }
  }

  /* ---------------- тело / одежда ---------------- */
  const BODY = 'M10 101Q12 78 36 73L64 73Q88 78 90 101Z';
  const BODYW = 'M-2 101Q2 76 34 73L66 73Q98 76 102 101Z';
  let clipN = 0;
  function bodySVG(c) {
    const cl = c.cl, a = cl.c1, b = cl.c2 || '#ffffff', sk = c.skin, w = c.broad ? BODYW : BODY;
    const neck = c.broad ? P('M36 60H64V77Q50 84 36 77Z', shade(sk, -0.08), 2) : P('M42 60H58V77Q50 83 42 77Z', shade(sk, -0.08), 2);
    let s = neck;
    switch (cl.k) {
      case 'tee': s += P(w, a, 2) + P('M40 73Q50 86 60 73Z', sk, 2); break;
      case 'collar': s += P(w, a, 2) + P('M41 73L50 90L59 73Z', sk, 2) + P('M41 72L51 82L36 82Z', b, 1.8) + mir(P('M41 72L51 82L36 82Z', b, 1.8)); break;
      case 'tank': s += P(w, sk, 2) + P('M33 101L35 79Q50 92 65 79L67 101Z', a, 2) + L('M41 76Q50 85 59 76', shade(sk, -0.3), 0); break;
      case 'hoodie': s += P(w, a, 2) + P('M32 73Q50 98 68 73L63 70Q50 84 37 70Z', shade(a, -0.18), 2) + L('M44 84V95M56 84V95', b, 1.6) + C(44, 96, 1.5, b) + C(56, 96, 1.5, b); break;
      case 'track': s += P(w, a, 2) + L('M16 98Q17 83 33 76', b, 3) + L('M84 98Q83 83 67 76', b, 3) + P('M38 73L43 83H57L62 73Z', shade(a, -0.15), 2) + L('M50 83V101', INK, 1.6); break;
      case 'vest': s += P(w, b, 2) + P('M41 72L50 84L38 82Z', '#ffffff', 1.6) + mir(P('M41 72L50 84L38 82Z', '#ffffff', 1.6))
        + P('M10 101Q12 78 36 73L47 98L36 101Z', a, 2) + mir(P('M10 101Q12 78 36 73L47 98L36 101Z', a, 2)); break;
      case 'suit': s += P(w, a, 2) + P('M40 73L50 94L60 73Z', b, 1.8) + P('M36 73L46 75L50 94L38 86Z', shade(a, 0.14), 1.8) + mir(P('M36 73L46 75L50 94L38 86Z', shade(a, 0.14), 1.8))
        + (cl.tie ? P('M50 82L46.5 87L50 100L53.5 87Z', cl.tie, 1.6) + P('M47 80H53L52 83H48Z', cl.tie, 1.4) : ''); break;
      case 'tux': s += P(w, a, 2) + P('M40 73L50 94L60 73Z', '#ffffff', 1.8) + P('M35 73L45 75L50 94L37 88Z', shade(a, 0.2), 1.8) + mir(P('M35 73L45 75L50 94L37 88Z', shade(a, 0.2), 1.8)); break;
      case 'uniform': s += P(w, a, 2) + P('M40 73L50 80L60 73Z', '#ffffff', 1.6) + P('M42 72L50 82L38 78Z', shade(a, -0.15), 1.6) + mir(P('M42 72L50 82L38 78Z', shade(a, -0.15), 1.6))
        + P('M22 79L36 74L39 80L25 85Z', b, 1.6) + mir(P('M22 79L36 74L39 80L25 85Z', b, 1.6)) + C(50, 88, 1.8, GOLD, 0.8) + C(50, 95, 1.8, GOLD, 0.8); break;
      case 'coat': s += P(w, '#f4f4ef', 2) + P('M40 73L50 96L60 73Z', a, 1.8) + P('M36 73L46 75L50 98L34 90Z', '#e3e3dc', 1.8) + mir(P('M36 73L46 75L50 98L34 90Z', '#e3e3dc', 1.8))
        + (cl.tie ? P('M50 80L47 85L50 97L53 85Z', cl.tie, 1.5) : ''); break;
      case 'apron': s += P(w, a, 2) + P('M40 73Q50 84 60 73Z', sk, 1.8) + P('M35 82H65L69 101H31Z', b, 2) + L('M38 82L41 73M62 82L59 73', b, 2) + F('M44 90h12v7h-12z', 'rgba(0,0,0,.08)'); break;
      case 'ruff': {
        let r = '';
        for (let i = 0; i < 8; i++) { const x = 30 + i * 5.7; r += C(x, 76 + Math.sin(i * 0.8) * 1.2, 5.2, i % 2 ? b : a, 1.6); }
        s += P(w, a, 2) + r; break;
      }
      case 'sailor': {
        const id = 'ptc' + (++clipN);
        s += `<clipPath id="${id}"><path d="${w}"/></clipPath>` + P(w, '#ffffff', 2)
          + `<g clip-path="url(#${id})">${[77, 83, 89, 95].map(y => `<rect x="0" y="${y}" width="100" height="3" fill="${b}"/>`).join('')}</g>`
          + P('M10 101Q12 78 36 73L45 75L37 101Z', cl.c3 || '#4f6a2e', 2) + mir(P('M10 101Q12 78 36 73L45 75L37 101Z', cl.c3 || '#4f6a2e', 2)) + P('M43 73Q50 85 57 73Z', sk, 1.6); break;
      }
      default: s += P(w, a, 2);
    }
    return s;
  }

  /* ---------------- аксессуары: возвращают {body, head} ---------------- */
  function accSVG(list, c) {
    let body = '', head = '', beforeHead = '';
    for (const raw of list || []) {
      const [k, arg] = raw.split(':');
      switch (k) {
        case 'chain': body += L('M37 75Q50 98 63 75', arg || GOLD, 3) + C(50, 92, 2.6, arg || GOLD, 1.2); break;
        case 'bowtie': body += P('M50 79L40 74V84Z', arg || '#c8402f', 1.6) + P('M50 79L60 74V84Z', arg || '#c8402f', 1.6) + C(50, 79, 2.3, shade(arg || '#c8402f', -0.2), 1.4); break;
        case 'phones': body += L('M31 72Q50 98 69 72', '#2b2b33', 3.4) + P('M26 68H33V80H26Z', '#3a3a46', 1.6) + P('M67 68H74V80H67Z', '#3a3a46', 1.6) + L('M28.5 71V77M71.5 71V77', '#7fd3ff', 1.2); break;
        case 'whistle': body += L('M40 76Q50 92 58 82', '#cfd6dd', 1.2) + P('M56 80H64V86H56Z', '#cfd6dd', 1.2) + C(60, 83, 1.4, INK); break;
        case 'pearls': body += [0, 1, 2, 3, 4, 5, 6].map(i => { const t = i / 6, x = 38 + t * 24, y = 76 + Math.sin(t * Math.PI) * 10; return C(x, y, 2.1, '#fff8ee', 1); }).join(''); break;
        case 'beads': body += [0, 1, 2, 3, 4, 5, 6, 7].map(i => { const t = i / 7, x = 36 + t * 28, y = 76 + Math.sin(t * Math.PI) * 11; return C(x, y, 2.3, ['#ffd54f', '#e53935', '#43a047', '#1e88e5'][i % 4], 1); }).join(''); break;
        case 'scarf': body += P('M40 73L50 90L60 73L56 71L50 77L44 71Z', arg || '#f6d36a', 1.8); break;
        case 'stripes': body += L('M22 90Q36 80 50 90Q64 80 78 90', '#f4f4ef', 3.4); break;
        case 'checker': body += [0, 1, 2, 3].map(i => `<rect x="${37 + i * 6.5}" y="88" width="3.2" height="3.2" fill="${INK}"/><rect x="${40.2 + i * 6.5}" y="91.2" width="3.2" height="3.2" fill="${INK}"/>`).join(''); break;
        case 'card': body += P('M31 90L37 90L37 99L31 99Z', '#ffffff', 1.4) + F('M34 93.5l1.4 1.6l-1.4 1.6l-1.4-1.6z', '#d9362b'); break;
        case 'aiguillette': body += L('M30 76Q24 86 34 92Q40 84 32 78', GOLD, 1.8) + L('M32 92L31 99M34 92L36 99', GOLD, 1.8); break;
        case 'baby': body += C(81, 72, 10, SKIN.fair, 2) + P('M71 71Q72 59 83 60Q92 62 91 71Q81 67 71 71Z', '#fff6c8', 1.8) + C(78, 73, 1.4, INK) + C(85, 73, 1.4, INK) + C(81.5, 77, 2.3, '#f48fb1', 1) + P('M70 82Q81 92 92 82L94 100H68Z', '#9ad0f0', 1.8); break;
        case 'hoops': head += [29.5, 70.5].map(x => `<circle cx="${x}" cy="55" r="3.6" fill="none" stroke="${GOLD}" stroke-width="1.8"/>`).join(''); break;
        case 'stud': head += [29.5, 70.5].map(x => C(x, 52, 1.6, GOLD, 0.6)).join(''); break;
        case 'coins': head += [34, 39, 44, 50, 56, 61, 66].map((x, i) => C(x, 38 - Math.abs(i - 3) * 0.1 - 4, 1.9, GOLD, 0.8)).join(''); break;
        case 'papirosa': head += `<g class="pt-smoke"><path d="M63 53Q66 47 63 42Q61 37 65 33" class="pt-wisp" fill="none" stroke="rgba(235,235,235,.85)" stroke-width="1.5" stroke-linecap="round"/></g>` + P('M54 60.5L70 56.5', '#fbfbf5', 2.6) + L('M54 60.5L70 56.5', '#fbfbf5', 2.6) + C(70.6, 56.3, 1.7, '#ff6a2b'); break;
        case 'seed': head += E(55.5, 62.5, 2.1, 1.1, '#f3f3f0', 0.9) + L('M54.2 62.5H56.8', INK, 0.8); break;
        case 'cigar': head += P('M54 61L72 57.5', '#7a4a22', 4.4) + L('M54 61L72 57.5', '#9a6232', 3) + C(72.8, 57.3, 2, '#ff7a2b'); break;
        case 'scar': head += L('M57 34L63 52', '#a8322b', 1.8) + L('M55.6 41l3 -1M57.5 46l3 -1', '#a8322b', 1.3); break;
        case 'mole': head += C(61, 56, 1.5, '#4a2a1a'); break;
        case 'cheeks': head += C(37, 54, 3.4, 'rgba(235,90,90,.38)') + C(63, 54, 3.4, 'rgba(235,90,90,.38)'); break;
        case 'freckles': head += [[44, 51], [47, 53], [42, 54], [56, 51], [53, 53], [58, 54], [45, 56], [55, 56]].map(([x, y]) => C(x, y, 0.75, '#a65a2c')).join(''); break;
        case 'bandaid': head += `<g transform="rotate(-24 62 54)"><rect x="56.5" y="51.5" width="11" height="5" rx="2" fill="#f0c9a0" stroke="${INK}" stroke-width="0.9"/><rect x="60.2" y="51.5" width="3.6" height="5" fill="#d89b6a"/></g>`; break;
        case 'flower': body += C(38, 88, 3.2, '#d81b60', 1.2) + C(38, 88, 1.1, '#ffd54f') + L('M38 91V98', '#2e7d32', 1.4); break;
        case 'pencil': head += `<g transform="rotate(-32 33 50)"><rect x="31.6" y="38" width="2.8" height="16" fill="#f5c542" stroke="${INK}" stroke-width="0.9"/><path d="M31.6 54H34.4L33 57.4Z" fill="#f0c9a0" stroke="${INK}" stroke-width="0.6"/></g>`; break;
        case 'headband': head += P('M31 34Q50 28 69 34L69 39Q50 33 31 39Z', arg || '#d9362b', 1.6); break;
        case 'sunhead': head += `<g transform="rotate(-6 50 24)">${P('M35 22Q39 17 44 21L45 28Q40 31 35 28Z', '#15151a', 1.5)}${P('M55 21Q60 17 65 22L65 28Q60 31 55 28Z', '#15151a', 1.5)}${L('M44 22Q50 20 55 22', INK, 1.6)}</g>`; break;
        case 'glasschain': head += L('M27 47Q22 62 34 70', '#d9b84b', 1.1) + L('M73 47Q78 62 66 70', '#d9b84b', 1.1); break;
        case 'bags': break;
        default: break;
      }
    }
    return { body, head, beforeHead };
  }

  /* ---------------- нос ---------------- */
  function noseSVG(c) {
    const sh = shade(c.skin, -0.2);
    switch (c.nose) {
      case 'big': return E(50, 52.6, 3.7, 3.2, shade(c.skin, -0.06), 1.4, shade(c.skin, -0.42));
      case 'button': return E(50, 53, 2.1, 1.7, shade(c.skin, -0.08), 1.2, shade(c.skin, -0.4));
      case 'clown': return C(50, 52, 5.2, '#e53935', 1.6) + C(48.3, 50.4, 1.4, 'rgba(255,255,255,.7)');
      default: return E(50, 52.4, 2.7, 2.2, shade(c.skin, -0.05), 1.3, sh);
    }
  }

  /* ---------------- глаза, брови, рот по эмоциям ---------------- */
  function eyeSVG(cx, cy, side, e, c) {
    const er = c.er || 1, rx = 4.3 * er, ry = 4.7 * er, sk = c.skin;
    const W = (a, b) => `<ellipse cx="${cx}" cy="${cy}" rx="${a}" ry="${b}" fill="#fff" stroke="${INK}" stroke-width="1.4"/>`;
    const pu = (dx, dy, r) => `<circle cx="${cx + dx}" cy="${cy + dy}" r="${r}" fill="${INK}"/><circle cx="${cx + dx - r * 0.35}" cy="${cy + dy - r * 0.4}" r="${r * 0.32}" fill="#fff"/>`;
    const lidTop = f => `<path d="M${cx - rx - 1.2} ${cy - ry - 2.5}H${cx + rx + 1.2}V${(cy - ry + 2 * ry * f).toFixed(2)}H${cx - rx - 1.2}Z" fill="${sk}"/>${L(`M${cx - rx} ${(cy - ry + 2 * ry * f).toFixed(2)}H${cx + rx}`, INK, 1.7)}`;
    switch (e) {
      case 'neutral': return W(rx, ry) + pu(0, 0.5, 2.4 * er) + (c.lid ? lidTop(c.lid) : '');
      case 'smug': return W(rx, ry) + pu(0, 1.3, 2.3 * er) + lidTop(0.5);
      case 'angry': {
        const ox = cx + side * (rx + 1.2), ix = cx - side * (rx + 1.2);
        return W(rx, ry) + pu(0, 1.4, 2.3 * er)
          + `<path d="M${ox} ${cy - ry - 2.5}L${ix} ${cy - ry - 2.5}L${ix} ${cy + 0.4}L${ox} ${cy - ry + 1.2}Z" fill="${sk}"/>` + L(`M${ox} ${cy - ry + 1.2}L${ix} ${cy + 0.4}`, INK, 1.8);
      }
      case 'shock': return W(rx * 1.2, ry * 1.28) + pu(0, 0, 1.35 * er);
      case 'think': return W(rx, ry) + pu(1.7, -1.7, 2.3 * er) + lidTop(0.12);
      case 'cheat': {
        const t = (cy - ry + 2 * ry * 0.52).toFixed(2), bt = (cy + ry - 2 * ry * 0.3).toFixed(2);
        return W(rx, ry) + pu(side * -0.4 + 1.6, 0.6, 2 * er) + lidTop(0.52)
          + `<path d="M${cx - rx - 1.2} ${bt}H${cx + rx + 1.2}V${cy + ry + 2.5}H${cx - rx - 1.2}Z" fill="${sk}"/>` + L(`M${cx - rx} ${bt}H${cx + rx}`, INK, 1.5);
      }
      default: return '';
    }
  }
  function browSVG(cx, cy, side, e, c) {
    const by = cy - 8.6, col = c.bc, sw = c.bt || 2.5;
    const x0 = side < 0 ? cx : 100 - cx; /* центр глаза в «левых» координатах */
    const m = x => (side < 0 ? x : 100 - x);
    const br = (a, b, q) => L(q ? `M${m(a[0])} ${a[1]}Q${m(q[0])} ${q[1]} ${m(b[0])} ${b[1]}` : `M${m(a[0])} ${a[1]}L${m(b[0])} ${b[1]}`, col, sw);
    switch (e) {
      case 'neutral': return br([x0 - 6, by + 0.8], [x0 + 6, by + 0.2], [x0, by - 1.2]);
      case 'smug': return side < 0 ? br([x0 - 6, by + 1.8], [x0 + 6, by + 1.4], [x0, by - 0.2]) : br([x0 - 6, by - 1.2], [x0 + 6, by - 0.4], [x0 + 0.5, by - 4.4]);
      case 'angry': return br([x0 - 6.4, by - 2.6], [x0 + 6.4, by + 3.2]);
      case 'shock': return br([x0 - 5.6, by - 1], [x0 + 5.6, by - 1], [x0, by - 6.2]);
      case 'think': return side < 0 ? br([x0 - 6, by + 2], [x0 + 6, by + 1.2]) : br([x0 - 5, by - 1], [x0 + 6, by - 1.6], [x0 + 1, by - 5.6]);
      case 'cheat': return br([x0 - 6, by - 1.6], [x0 + 6, by + 2]);
      default: return '';
    }
  }
  function mouthSVG(e, c) {
    const y = c.my, col = c.lipc, sw = c.fem ? 2.7 : 2.1;
    const gold = c.goldtooth ? `<rect x="53.2" y="${y + 0.6}" width="2.6" height="2.4" fill="${GOLD}" stroke="${INK}" stroke-width="0.6"/>` : '';
    switch (e) {
      case 'neutral': return L(`M44.5 ${y}Q50 ${y + 1.8} 55.5 ${y}`, col, sw);
      case 'smug': return L(`M43.5 ${y - 0.4}Q50 ${y + 3.4} 58 ${y - 3.4}`, col, sw + 0.2) + L(`M58.6 ${y - 5.2}q1.7 1.5 1.3 3.5`, shade(c.skin, -0.4), 1.2);
      case 'angry': return P(`M43 ${y + 3.6}Q50 ${y - 3.4} 57 ${y + 3.6}Q50 ${y - 0.6} 43 ${y + 3.6}Z`, '#fff', 1.6) + L(`M46.4 ${y + 0.6}V${y + 2}M50 ${y - 0.4}V${y + 1.4}M53.6 ${y + 0.6}V${y + 2}`, INK, 0.9) + gold;
      case 'shock': return E(50, y + 1.8, 4, 5.2, '#5b1c1c', 1.6) + E(50, y + 4.3, 2.5, 1.5, '#e0707a');
      case 'think': return L(`M45 ${y + 1.4}Q48.6 ${y - 0.6} 52 ${y + 0.4}L56 ${y - 1.2}`, col, sw);
      case 'cheat': return P(`M42 ${y - 1.6}Q50 ${y + 6.6} 58 ${y - 1.6}Q50 ${y + 1} 42 ${y - 1.6}Z`, '#fff', 1.7) + L(`M45 ${y + 1.3}Q50 ${y + 3.5} 55 ${y + 1.3}`, 'rgba(0,0,0,.35)', 0.9) + gold;
      default: return '';
    }
  }
  function extrasSVG(e) {
    if (e === 'angry') return L('M60 27l3 2.4M63.6 26.6l-3 3.2', '#d9362b', 1.6);
    if (e === 'shock') return `<path d="M69 34Q72 39 69.4 42Q66.6 39 69 34Z" fill="#7fd3ff" stroke="${INK}" stroke-width="1"/>`;
    return '';
  }

  /* ---------------- персонажи ---------------- */
  const CH = {
    student: { face: 'СТ', bg: '#4f8fd8', head: 'round', skin: 'fair', hair: { s: 'messy', c: HAIR.dbrown }, gl: { k: 'round' }, cl: { k: 'hoodie', c1: '#d0463b', c2: '#fff' }, acc: ['phones'] },
    valera: { face: 'ДВ', bg: '#d9a03c', head: 'wide', skin: 'ruddy', hair: { s: 'combover', c: '#5a4030' }, st: { k: 'handle', c: '#5a4030' }, bd: { k: 'stubble', c: '#5a4a40' }, cl: { k: 'tank', c1: '#f1f1ec' }, nose: 'big', bags: 1 },
    sharper: { face: 'Ш', bg: '#c8402f', head: 'pear', skin: 'pale', hair: { s: 'slick', c: '#17110e' }, hat: { k: 'visor', c: '#2e9d5b' }, st: { k: 'pencil', c: '#17110e' }, cl: { k: 'vest', c1: '#3a1c1c', c2: '#f1f1ec' }, lid: 0.32, acc: ['card'] },
    teacher: { face: 'УЧ', bg: '#2e9d5b', head: 'round', skin: 'fair', hair: { s: 'bun', c: HAIR.gray }, gl: { k: 'round', c: '#6b4a1c' }, cl: { k: 'suit', c1: '#5a3d2b', c2: '#fff', tie: '#d9362b' }, fem: 1, acc: ['glasschain', 'stud'], bc: HAIR.gray },
    'c-tolik': { face: 'Т', bg: '#6d8fb8', head: 'square', skin: 'tan', hat: { k: 'aerodrom', c: '#3b3b44' }, bd: { k: 'stubble', c: '#3f2a1d' }, cl: { k: 'track', c1: '#2a3d7a', c2: '#fff' }, acc: ['seed'], bc: '#2a1d17' },
    'c-vovan': { face: 'В', bg: '#7b6db8', head: 'wide', skin: 'fair', hair: { s: 'buzz', c: '#2a1d17' }, cl: { k: 'track', c1: '#202026', c2: '#f4f4ef' }, acc: ['scar', 'chain:#cfd6dd'], bt: 3.4, bc: '#2a1d17', lid: 0.18, bd: { k: 'stubble', c: '#2a1d17' } },
    'c-babka': { face: 'Б', bg: '#b86d9a', head: 'round', skin: 'old', hat: { k: 'platok', c: '#c8402f', c2: '#f6d36a' }, gl: { k: 'round', c: '#5a3d2b' }, cl: { k: 'collar', c1: '#7a5a8a', c2: '#e9e2d0' }, acc: ['mole'], age: 2, bc: HAIR.gray, fem: 1 },
    'c-mihalych': { face: 'М', bg: '#8a9a5b', head: 'long', skin: 'ruddy', hat: { k: 'ushanka', c: '#7a6048', c2: '#5e4a38' }, st: { k: 'thick', c: '#9a9a9a' }, bd: { k: 'stubble', c: '#808080' }, cl: { k: 'vest', c1: '#e07b1a', c2: '#8a8a8a' }, acc: ['papirosa'], age: 1, bc: '#8a8a8a', nose: 'big' },
    'c-patsan': { face: 'П', bg: '#5b8a8a', head: 'kid', skin: 'fair', hair: { s: 'messy', c: HAIR.brown }, cl: { k: 'hoodie', c1: '#3d6f3d', c2: '#e9e2d0' }, acc: ['freckles', 'bandaid'], er: 1.18, nose: 'button', hy: 4, my: 58 },
    'c-vahter': { face: 'ВХ', bg: '#8a6a3b', head: 'square', skin: 'old', hat: { k: 'furazhka', c: '#2f3a4a', c2: '#1c2430' }, gl: { k: 'square', c: '#3a3a3a' }, st: { k: 'brush', c: '#8a8a8a' }, cl: { k: 'uniform', c1: '#2f3a4a', c2: '#d9b84b' }, acc: ['whistle'], age: 1, bc: '#8a8a8a', lid: 0.22 },
    'c-torgash': { face: 'ТР', bg: '#b8863b', head: 'wide', skin: 'tan', hair: { s: 'bald', c: '#241812' }, st: { k: 'handle', c: '#241812' }, bd: { k: 'stubble', c: '#241812' }, cl: { k: 'apron', c1: '#e9e2d0', c2: '#3b6d3b' }, acc: ['chain'], nose: 'big', bc: '#241812' },
    'c-zina': { face: 'З', bg: '#b85b5b', head: 'round', skin: 'fair', hair: { s: 'curly', c: HAIR.ginger }, cl: { k: 'collar', c1: '#7ab0c8', c2: '#fff' }, acc: ['hoops', 'pearls', 'mole', 'cheeks'], fem: 1, bc: HAIR.ginger },
    'c-taxi': { face: 'ТК', bg: '#d9c23c', head: 'pear', skin: 'tan', hat: { k: 'kepka', c: '#3b3b3b', c2: '#222' }, st: { k: 'thick', c: '#2a1d17' }, bd: { k: 'stubble', c: '#2a1d17' }, cl: { k: 'collar', c1: '#8a5a3a', c2: '#e9e2d0' }, acc: ['checker'], bc: '#2a1d17', lid: 0.15 },
    'c-provod': { face: 'ПР', bg: '#3b6db8', head: 'round', skin: 'fair', hair: { s: 'bob', c: HAIR.brown }, hat: { k: 'pill', c: '#c8402f', c2: '#f7e9c8' }, cl: { k: 'uniform', c1: '#c8402f', c2: '#f7e9c8' }, acc: ['scarf:#f6d36a'], fem: 1, bc: HAIR.brown },
    'c-dembel': { face: 'Д', bg: '#4f7a3b', head: 'square', skin: 'tan', hair: { s: 'buzz', c: '#3f2a1d' }, hat: { k: 'beret', c: '#4aa3e0' }, cl: { k: 'sailor', c1: '#fff', c2: '#2a5fa0', c3: '#4f6a2e' }, acc: ['aiguillette'], bt: 3.2, bc: '#3f2a1d' },
    'c-major': { face: 'МЖ', bg: '#c79bff', head: 'pear', skin: 'fair', hair: { s: 'slick', c: '#e0b25a' }, cl: { k: 'collar', c1: '#2a2a35', c2: '#3c3c4a' }, acc: ['sunhead', 'chain'], lid: 0.3, bc: '#c99a3e' },
    'c-krupie': { face: 'КР', bg: '#2e9d5b', head: 'long', skin: 'fair', hair: { s: 'slick', c: '#15100e' }, st: { k: 'pencil', c: '#15100e' }, cl: { k: 'vest', c1: '#15161c', c2: '#ffffff' }, acc: ['bowtie:#c8402f'], bc: '#15100e', lid: 0.14 },
    'c-valera': { face: 'ДВ', bg: '#d9a03c', head: 'wide', skin: 'ruddy', hair: { s: 'combover', c: '#5a4030' }, st: { k: 'handle', c: '#5a4030' }, cl: { k: 'tux', c1: '#1d1d22' }, acc: ['bowtie:#c8402f'], nose: 'big', bags: 1 },
    'c-sharper': { face: 'Ш', bg: '#c8402f', head: 'pear', skin: 'pale', hair: { s: 'slick', c: '#17110e' }, hat: { k: 'tophat', c: '#18181d', c2: '#c8402f' }, gl: { k: 'monocle' }, st: { k: 'pencil', c: '#17110e' }, bd: { k: 'goatee', c: '#17110e' }, cl: { k: 'suit', c1: '#18181d', c2: '#f1f1ec', tie: '#c8402f' }, acc: ['cigar'], goldtooth: 1, lid: 0.4 },
    'w-roza': { face: 'ЦР', bg: '#c2185b', head: 'round', skin: 'tan', hair: { s: 'long', c: '#17110e' }, hat: { k: 'platok', c: '#f6c24a', c2: '#d81b60' }, cl: { k: 'collar', c1: '#6a1b9a', c2: '#f6c24a' }, acc: ['hoops', 'beads', 'coins'], fem: 1, bc: '#17110e' },
    'w-edik': { face: 'ЭД', bg: '#00897b', head: 'pear', skin: 'fair', hair: { s: 'slick', c: '#3a2a1c' }, hat: { k: 'fedora', c: '#efe6d0', c2: '#00695c' }, st: { k: 'pencil', c: '#3a2a1c' }, cl: { k: 'suit', c1: '#f1e7c6', c2: '#ffffff' }, acc: ['flower', 'bowtie:#d81b60'], nose: 'big', bc: '#3a2a1c', lid: 0.2 },
    'w-zhora': { face: 'КЖ', bg: '#f57c00', head: 'round', skin: 'paint', hair: { s: 'rainbow' }, cl: { k: 'ruff', c1: '#7e57c2', c2: '#ffd54f' }, acc: ['cheeks'], nose: 'clown', clown: 1, bc: '#7e57c2' },
    'w-gosha': { face: 'БГ', bg: '#6d4c41', head: 'wide', skin: 'tan', hat: { k: 'beanie', c: '#2f2f35' }, bd: { k: 'stubble', c: '#2a1d17' }, cl: { k: 'hoodie', c1: '#3a3f47', c2: '#cfd6dd' }, acc: ['chain'], goldtooth: 1, bags: 1, nose: 'big', lid: 0.22, bc: '#2a1d17' },
    'w-stas': { face: 'КС', bg: '#5e35b1', head: 'square', skin: 'tan', hair: { s: 'buzz', c: '#2a1d17' }, bd: { k: 'stubble', c: '#2a1d17' }, cl: { k: 'tank', c1: '#f1f1ec' }, acc: ['headband', 'chain:#cfd6dd'], broad: 1, bt: 3.6, bc: '#2a1d17' },
    'w-luda': { face: 'МЛ', bg: '#e53935', head: 'round', skin: 'ruddy', hair: { s: 'bun', c: HAIR.chest }, cl: { k: 'collar', c1: '#f6d36a', c2: '#ffffff' }, acc: ['baby', 'cheeks'], fem: 1, bags: 1, bc: HAIR.chest },
    'w-petrovich': { face: 'ПП', bg: '#fbc02d', head: 'square', skin: 'ruddy', hat: { k: 'helmet', c: '#f4f4ef' }, st: { k: 'brush', c: '#7a5a3a' }, bd: { k: 'stubble', c: '#7a5a3a' }, cl: { k: 'vest', c1: '#ff6d00', c2: '#555a60' }, acc: ['stripes', 'pencil'], bc: '#7a5a3a', nose: 'big', bt: 3 },
    'w-prof': { face: 'ПК', bg: '#455a64', head: 'long', skin: 'pale', hair: { s: 'wild', c: HAIR.white }, gl: { k: 'thick', c: '#2b2b33' }, cl: { k: 'coat', c1: '#455a64', tie: '#c8402f' }, acc: ['bowtie:#c8402f'], age: 1, bc: HAIR.white, bt: 3.4 }
  };
  /* ключ для поиска по тексту/цвету аватара: «ЦР|194,24,91» */
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };
  const LOOK = {};
  ['student', 'valera', 'sharper', 'teacher', 'c-tolik', 'c-vovan', 'c-babka', 'c-mihalych', 'c-patsan', 'c-vahter', 'c-torgash', 'c-zina', 'c-taxi', 'c-provod', 'c-dembel', 'c-major', 'c-krupie',
    'w-roza', 'w-edik', 'w-zhora', 'w-gosha', 'w-stas', 'w-luda', 'w-petrovich', 'w-prof'].forEach(id => { LOOK[CH[id].face + '|' + hexRgb(CH[id].bg)] = id; });
  const NAMES = {
    student: 'Студент', valera: 'Дядя Валера', sharper: 'Шулер', teacher: 'Учитель', 'c-tolik': 'Сосед Толик', 'c-vovan': 'Вован', 'c-babka': 'Бабка', 'c-mihalych': 'Михалыч', 'c-patsan': 'Пацан',
    'c-vahter': 'Вахтёр', 'c-torgash': 'Торгаш', 'c-zina': 'Тётя Зина', 'c-taxi': 'Таксист', 'c-provod': 'Проводница', 'c-dembel': 'Дембель', 'c-major': 'Мажор', 'c-krupie': 'Крупье',
    'c-valera': 'Валера-казино', 'c-sharper': 'Шулер-босс', 'w-roza': 'Цыганка Роза', 'w-edik': 'Пижон Эдик', 'w-zhora': 'Клоун Жора', 'w-gosha': 'Барыга Гоша', 'w-stas': 'Качок Стас',
    'w-luda': 'Многодетная Люда', 'w-petrovich': 'Прораб Петрович', 'w-prof': 'Профессор Козырев'
  };
  const IDS = Object.keys(CH);

  /* ---------------- генерация из ника ---------------- */
  function hash(s) { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) {
    let a = hash(seed) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function gen(seed) {
    const r = rng(seed), pick = a => a[Math.floor(r() * a.length)];
    const hairS = pick(['short', 'messy', 'slick', 'long', 'bob', 'bun', 'curly', 'buzz', 'mullet', 'bald', 'short', 'messy']);
    const hc = pick(Object.values(HAIR).filter(x => x !== HAIR.white));
    const fem = ['long', 'bob', 'bun'].includes(hairS) && r() < 0.8;
    const c = {
      bg: pick(['#4f8fd8', '#d9a03c', '#7b6db8', '#5b8a8a', '#b86d9a', '#8a9a5b', '#3b6db8', '#c2185b', '#00897b', '#e57373', '#6d8fb8', '#9a7bd9']),
      head: pick(['round', 'square', 'pear', 'wide', 'long', 'round']), skin: pick(['pale', 'fair', 'fair', 'tan', 'brown', 'dark', 'ruddy']),
      hair: { s: hairS, c: hc }, bc: hc, fem: fem ? 1 : 0,
      cl: { k: pick(['tee', 'hoodie', 'collar', 'track', 'vest', 'suit']), c1: pick(['#d0463b', '#3d6f3d', '#2a3d7a', '#7a5a8a', '#e07b1a', '#2f3a4a', '#a8527a', '#2e7d6b']), c2: '#ffffff', tie: '#d9362b' },
      acc: []
    };
    if (r() < 0.3) c.gl = { k: pick(['round', 'square', 'sun']) };
    if (!fem && r() < 0.22) c.st = { k: pick(['handle', 'brush', 'thick', 'pencil']), c: hc };
    if (!fem && r() < 0.18) c.bd = { k: pick(['stubble', 'goatee', 'full']), c: hc };
    if (r() < 0.2) c.hat = { k: pick(['kepka', 'beanie', 'beret', 'aerodrom']), c: pick(['#3b3b44', '#2f2f35', '#4aa3e0', '#7a4b2a']) };
    if (r() < 0.15) c.acc.push('chain');
    if (r() < 0.25) c.acc.push('freckles');
    if (fem && r() < 0.5) c.acc.push('hoops');
    return c;
  }
  function resolve(key) {
    if (key && typeof key === 'object') return key;
    key = String(key || '');
    if (CH[key]) return CH[key];
    return gen(key.replace(/^nick:/, ''));
  }

  /* ---------------- сборка ---------------- */
  function svgFor(key, o) {
    o = o || {};
    const ch = resolve(key), id = typeof key === 'string' ? key : 'gen';
    const hd = HEADS[ch.head || 'round'], skin = SKIN[ch.skin] || ch.skin || SKIN.fair;
    const hairC = ch.hair && ch.hair.c, ex = ch.ex || (hd.w >= 22 ? 10 : hd.w <= 17 ? 8.5 : 9), ey = ch.ey || (ch.head === 'kid' ? 48 : 46);
    const c = Object.assign({ my: 59.5, lipc: INK, bc: hairC || '#3a281c', er: 1 }, ch, { skin, cl: ch.cl || { k: 'tee', c1: '#888' } });
    if (!ch.my) c.my = ch.head === 'long' ? 61.5 : 59.5;
    if (c.fem || (c.bd && c.bd.k !== 'stubble')) c.lipc = c.fem ? '#b3261e' : '#e8a08c';
    if (ch.clown) c.lipc = '#d32f2f';
    const sx = hd.w / 19, hy = ch.hy || 0;
    const tr = inner => `<g transform="translate(50 ${hy}) scale(${sx.toFixed(3)} 1) translate(-50 0)">${inner}</g>`;
    const hair = ch.hair ? hairParts(ch.hair, ch.hair.c || '#444') : ['', ''];
    const acc = accSVG(ch.acc, c);
    const lx = 50 - ex, rx = 50 + ex;
    const bg = ch.bg || '#4f8fd8';
    let s = '';
    /* фон */
    s += `<rect width="100" height="100" fill="${bg}"/><circle cx="50" cy="54" r="42" fill="${shade(bg, 0.13)}"/><path d="M0 0H44L0 44Z" fill="${shade(bg, -0.1)}"/><path d="M100 100H56L100 56Z" fill="${shade(bg, -0.1)}"/>`;
    /* тело */
    s += `<g class="pt-body">${bodySVG(c)}${acc.body}</g>`;
    /* голова */
    let h = '';
    h += `<g class="pt-hairback">${tr(hair[0])}</g>`;
    h += `<g>${[50 - hd.w, 50 + hd.w].map(x => E(x, 48, 4, 5, skin, 1.8) + E(x + (x < 50 ? 0.4 : -0.4), 48, 1.4, 2.4, shade(skin, -0.12))).join('')}</g>`;
    h += P(hd.d, skin, 2.2);
    if (c.head === 'wide' || c.broad) h += '';
    if (c.age) {
      h += L('M41 31Q50 29 59 31', 'rgba(60,30,20,.38)', 1.2) + (c.age > 1 ? L('M43 34Q50 32.6 57 34', 'rgba(60,30,20,.3)', 1.1) : '');
      h += L(`M${lx - 6} ${ey + 1}l-2 1.2M${lx - 6} ${ey + 3}l-2.4 0.4M${rx + 6} ${ey + 1}l2 1.2M${rx + 6} ${ey + 3}l2.4 0.4`, 'rgba(60,30,20,.4)', 1);
      h += L('M39 53Q37.4 58 40 62M61 53Q62.6 58 60 62', 'rgba(60,30,20,.3)', 1.1);
    }
    /* эмоциональные тонировки лица */
    h += `<g class="v v-angry"><path d="${hd.d}" fill="rgba(220,40,30,.28)"/></g><g class="v v-shock"><path d="${hd.d}" fill="rgba(255,255,255,.26)"/></g>`;
    if (c.clown) h += C(36, 53, 4, 'rgba(229,57,53,.75)') + C(64, 53, 4, 'rgba(229,57,53,.75)') + F(`M${lx - 1} ${ey - 9}l2 4l-2 4l-2-4z`, '#1e88e5') + F(`M${rx + 1} ${ey - 9}l2 4l-2 4l-2-4z`, '#1e88e5');
    if (c.bags) h += L(`M${lx - 3.5} ${ey + 6.6}Q${lx} ${ey + 8.4} ${lx + 3.5} ${ey + 6.6}M${rx - 3.5} ${ey + 6.6}Q${rx} ${ey + 8.4} ${rx + 3.5} ${ey + 6.6}`, 'rgba(60,30,20,.4)', 1.1);
    h += noseSVG(c);
    if (c.bd) h += tr(beardSVG(c.bd));
    /* рот */
    h += EMOS.map(e => `<g class="v v-${e}">${mouthSVG(e, c)}</g>`).join('');
    if (c.clown) h += `<g opacity=".55">${L(`M40 ${c.my - 2}Q50 ${c.my + 7} 60 ${c.my - 2}`, '#d32f2f', 3.2)}</g>`;
    if (c.st) h += tr(stacheSVG(c.st));
    /* глаза */
    h += EMOS.map(e => `<g class="v v-${e}">${eyeSVG(lx, ey, -1, e, c)}${eyeSVG(rx, ey, 1, e, c)}</g>`).join('');
    h += `<g class="pt-lids"><ellipse cx="${lx}" cy="${ey}" rx="${5.4 * c.er}" ry="${5.8 * c.er}" fill="${skin}"/><ellipse cx="${rx}" cy="${ey}" rx="${5.4 * c.er}" ry="${5.8 * c.er}" fill="${skin}"/>${L(`M${lx - 4} ${ey + 0.6}Q${lx} ${ey + 2.4} ${lx + 4} ${ey + 0.6}M${rx - 4} ${ey + 0.6}Q${rx} ${ey + 2.4} ${rx + 4} ${ey + 0.6}`, INK, 1.7)}</g>`;
    if (c.fem) h += L(`M${lx - 4} ${ey - 3}l-2.6 -2M${rx + 4} ${ey - 3}l2.6 -2`, INK, 1.5);
    /* брови */
    h += EMOS.map(e => `<g class="v v-${e}">${browSVG(lx, ey, -1, e, c)}${browSVG(rx, ey, 1, e, c)}</g>`).join('');
    if (ch.gl) h += glassesSVG(ch.gl, ex, ey);
    h += tr(hair[1]);
    h += acc.head;
    if (ch.hat) h += `<g class="pt-hat">${tr(hatSVG(ch.hat))}</g>`;
    h += `<g class="v v-angry">${extrasSVG('angry')}</g><g class="v v-shock">${extrasSVG('shock')}</g>`;
    s += `<g class="pt-bob"><g class="pt-head">${h}</g></g>`;
    const delay = -((hash(id + (ch.face || '')) % 3600) / 1000).toFixed(2);
    return `<svg class="pt" viewBox="0 0 100 100" data-e="${EMOS.includes(o.emo) ? o.emo : 'neutral'}" data-id="${esc(id)}" aria-hidden="true" focusable="false" style="--pt-d:${delay}s">${s}</svg>`;
  }
  const svg = (key, o) => svgFor(key, o);
  const nameOf = id => NAMES[id] || id;

  /* ---------------- стили ---------------- */
  const CSS = `
.pt{display:block;width:100%;height:100%;border-radius:inherit}
.pt .v{opacity:0;transition:opacity calc(.2s*var(--pt-k,1))}
.pt[data-e=neutral] .v-neutral,.pt[data-e=smug] .v-smug,.pt[data-e=angry] .v-angry,.pt[data-e=shock] .v-shock,.pt[data-e=think] .v-think,.pt[data-e=cheat] .v-cheat{opacity:1}
.pt .pt-lids{opacity:0}
.pt.bl .pt-lids{opacity:1}
.pt-head{transform-origin:50px 80px;transition:transform calc(.3s*var(--pt-k,1)) cubic-bezier(.3,1.5,.5,1)}
.pt[data-e=smug] .pt-head{transform:rotate(-4deg) translateY(-.6px)}
.pt[data-e=think] .pt-head{transform:rotate(4.5deg)}
.pt[data-e=cheat] .pt-head{transform:rotate(-3deg) translateX(1px)}
.pt[data-e=shock] .pt-head{transform:translateY(-2.4px) scale(1.04);animation:ptjolt .34s ease-out}
.pt[data-e=angry] .pt-head{transform:translateY(1px) scale(1.025);animation:ptshake .1s linear 5}
.pt.talk .pt-head{animation:pttalk .28s ease-in-out 3}
.pt-bob{transform-origin:50px 100px;animation:ptbreath 3.8s ease-in-out infinite;animation-delay:var(--pt-d,0s)}
.pt-wisp{animation:ptsmoke 2.4s ease-in-out infinite}
@keyframes ptbreath{0%,100%{transform:translateY(0) scale(1,1)}50%{transform:translateY(-1px) scale(1.006,1.014)}}
@keyframes ptjolt{0%{transform:translateY(2px) scale(.96)}60%{transform:translateY(-4px) scale(1.07)}100%{transform:translateY(-2.4px) scale(1.04)}}
@keyframes ptshake{0%,100%{translate:0 0}25%{translate:-1.1px 0}75%{translate:1.1px 0}}
@keyframes pttalk{50%{translate:0 -1.2px}}
@keyframes ptsmoke{0%,100%{opacity:.25;transform:translateY(2px)}50%{opacity:.9;transform:translateY(-2px)}}
html.pt-still .pt-bob,html.pt-still .pt-head,html.pt-still .pt-wisp,html.pt-still .pt.talk .pt-head{animation:none!important}
html.pt-still .pt .v,html.pt-still .pt-head{transition:none!important}
@media (prefers-reduced-motion:reduce){.pt-bob,.pt-head,.pt-wisp,.pt.talk .pt-head{animation:none!important}.pt .v,.pt-head{transition:none!important}}
.pt-host{font-size:0!important;color:transparent!important;text-shadow:none!important;line-height:0;padding:0!important}
#oppAva.pt-host{width:48px!important;height:48px!important;border-radius:12px!important}
.botcard .ava.pt-host{width:48px!important;height:48px!important;border-radius:12px!important}
.wkboss{grid-template-columns:96px minmax(0,1fr)!important}
.wkava.pt-host{width:96px!important;height:96px!important;border-radius:18px!important}
.m4opp .ava.pt-host{width:32px!important;height:32px!important;border-radius:9px!important}
.m4lobby .seat .ava.pt-host{width:32px!important;height:32px!important;border-radius:9px!important}
.pava.pt-host>.pt{border-radius:50%}
.pt-over{position:absolute;z-index:3;left:10px;top:8px;width:80px;height:80px;border-radius:18px;overflow:hidden;border:3px solid ${INK};box-shadow:0 4px 0 rgba(0,0,0,.45);pointer-events:none;transition:left .5s cubic-bezier(.3,1.3,.5,1),top .5s cubic-bezier(.3,1.3,.5,1),width .5s,height .5s,transform .5s,box-shadow .5s}
.pt-over.pop{left:50%;top:50%;width:160px;height:160px;border-radius:28px;transform:translate(-50%,-50%);box-shadow:0 0 0 100vmax rgba(4,16,12,.6),0 6px 0 rgba(0,0,0,.5);transition:none;animation:ptpop .35s cubic-bezier(.3,1.5,.5,1)}
@keyframes ptpop{from{transform:translate(-50%,-50%) scale(.5);opacity:0}to{transform:translate(-50%,-50%) scale(1);opacity:1}}
html .pt-over.held{animation:none}
html.pt-still .pt-over{transition:none!important;animation:none!important}
`;
  function injectCSS() {
    if (document.getElementById('portcss')) return;
    const st = document.createElement('style'); st.id = 'portcss'; st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------------- живые портреты ---------------- */
  const meta = new WeakMap();
  const live = new Set();
  const reduceMQ = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const aK = () => { try { return typeof animK === 'function' ? animK() : 1; } catch (e) { return 1; } };
  const still = () => reduceMQ.matches || aK() === 0;
  const holdMs = ms => { try { return typeof holdT === 'function' ? holdT(ms) : ms; } catch (e) { return ms; } };
  const rnd = (a, b) => a + Math.random() * (b - a);

  function register(el, base, role) {
    meta.set(el, { base: base || 'neutral', t: 0, role: role || '', nb: Date.now() + rnd(1200, 4200) });
    live.add(el);
  }
  function emote(el, e, hold) {
    const m = meta.get(el);
    if (!m || !EMOS.includes(e)) return;
    clearTimeout(m.t); m.t = 0;
    el.dataset.e = e;
    if (hold !== 0 && e !== m.base) {
      m.t = setTimeout(() => { m.t = 0; if (el.isConnected) el.dataset.e = m.base; }, hold == null ? holdMs(1500) : hold);
    }
  }
  function setBase(el, b) {
    const m = meta.get(el);
    if (!m) return;
    m.base = b;
    if (!m.t) el.dataset.e = b;
  }
  function mount(host, key, o) {
    o = o || {};
    host.innerHTML = svgFor(key, { emo: o.emo });
    host.classList.add('pt-host');
    const el = host.firstElementChild;
    register(el, o.emo || 'neutral', o.role);
    return el;
  }
  function eachRole(role, fn) {
    for (const el of live) { if (!el.isConnected) { live.delete(el); continue; } if (meta.get(el).role === role) fn(el); }
  }
  const oppEmote = (e, hold) => eachRole('opp', el => emote(el, e, hold));

  /* моргание + проверка «без анимаций» */
  function tick() {
    if (document.hidden) return;
    const st = still(), root = document.documentElement;
    root.classList.toggle('pt-still', st);
    try { root.style.setProperty('--pt-k', String(Math.max(0.2, aK()))); } catch (e) {}
    if (st) return;
    const now = Date.now();
    for (const el of live) {
      if (!el.isConnected) { live.delete(el); continue; }
      const m = meta.get(el);
      if (now < m.nb) continue;
      m.nb = now + rnd(3000, 6000);
      if (el.dataset.e === 'shock') continue;
      el.classList.add('bl');
      setTimeout(() => el.classList.remove('bl'), 120);
    }
  }

  /* ---------------- кто сейчас соперник ---------------- */
  function oppKey() {
    try {
      if (typeof NET !== 'undefined' && NET) return 'nick:' + (NET.oppNick || '?');
      const b = currentBot();
      if (b && CH[b.id]) return b.id;
      if (b) { const k = LOOK[(b.face || '') + '|' + hexRgb(b.color || '#000000')]; if (k) return k; }
      return b ? 'nick:' + (b.name || b.id) : 'sharper';
    } catch (e) { return 'sharper'; }
  }
  function baseNow() {
    try { if (G && G.over === 'b') return 'smug'; if (G && G.over === 'p') return 'angry'; } catch (e) {}
    return 'neutral';
  }

  /* ---------------- подмена аватаров в DOM ---------------- */
  const colorKey = el => {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(el.style.backgroundColor || el.style.background || '');
    if (m) return `${m[1]},${m[2]},${m[3]}`;
    const h = /#([0-9a-f]{6})/i.exec(el.style.background || '');
    return h ? hexRgb('#' + h[1]) : '';
  };
  function adopt(el) {
    if (el.firstElementChild && el.firstElementChild.classList && el.firstElementChild.classList.contains('pt')) return;
    if (el.id === 'oppAva') { mount(el, oppKey(), { emo: baseNow(), role: 'opp' }); return; }
    const face = (el.textContent || '').trim();
    if (!face || face === '?') return;
    let key = null, role = '';
    const card = el.closest('.botcard[data-stage]');
    if (card) { try { const o = CAREER_OPS[+card.dataset.stage]; if (o && CH[o.id]) key = o.id; } catch (e) {} }
    if (!key) key = LOOK[face + '|' + colorKey(el)] || null;
    if (!key && el.classList.contains('pava')) {
      let mine = ''; try { mine = typeof initials === 'function' ? initials(myNick()) : ''; } catch (e) {}
      key = 'nick:' + (mine && face === mine ? myNick() : face); role = 'me';
    }
    if (!key && el.closest('.m4opp,.m4lobby')) key = 'nick:' + face + colorKey(el);
    if (!key) return;
    if (el.closest('.m4opp')) role = 'seat';
    mount(el, key, { role });
  }
  function syncSeats() {
    document.querySelectorAll('.m4opp').forEach(s => {
      const el = s.querySelector('svg.pt'); if (!el || !meta.get(el)) return;
      setBase(el, s.classList.contains('out') ? 'smug' : s.classList.contains('who') ? 'think' : 'neutral');
    });
  }
  const SEL = '.ava,.wkava,.pava';
  function scan(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(SEL)) adopt(root);
    if (root.querySelectorAll) root.querySelectorAll(SEL).forEach(adopt);
  }
  function startObserver() {
    scan(document.body);
    syncSeats();
    const mo = new MutationObserver(list => {
      let seats = false;
      for (const m of list) {
        if (m.type === 'attributes') { if (m.target.classList && m.target.classList.contains('m4opp')) seats = true; continue; }
        const t = m.target;
        if (t.nodeType === 1 && t.matches && t.matches(SEL)) adopt(t);
        for (const n of m.addedNodes) { if (n.nodeType === 1) { scan(n); if (n.matches && n.matches('.m4opp')) seats = true; } }
      }
      if (seats || document.querySelector('.m4opp')) syncSeats();
    });
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  }

  /* ---------------- обёртки игровых функций ---------------- */
  function onFx(o) {
    if (!o) return;
    const me = o.actor === 'p', bot = o.actor === 'b';
    switch (o.what) {
      case 'hype': {
        const k = o.key;
        if (k === 'caught') return oppEmote('angry', holdMs(1900));
        if (k === 'falsecall') return oppEmote('smug', holdMs(1800));
        if (k === 'gg' || k === 'dry') return;
        if (me) return oppEmote(['mognul', 'legend', 'over', 'chain', 'upgrade'].includes(k) ? 'shock' : 'think', holdMs(1800));
        return oppEmote('smug', holdMs(1900));
      }
      case 'takes': return oppEmote(bot ? 'angry' : 'smug');
      case 'defend': return oppEmote(bot ? 'smug' : 'think', holdMs(1100));
      case 'transfer': return oppEmote(bot ? 'smug' : 'think');
      case 'action': return bot && oppEmote('smug');
      case 'charged': return bot && oppEmote('think');
      case 'trump': return oppEmote('think', holdMs(1200));
      default:
    }
  }
  let lastOver = null, popT = 0, popUntil = 0;
  function onOver() {
    let o; try { o = document.getElementById('over'); } catch (e) { return; }
    if (!o || o.hidden || typeof G === 'undefined' || !G || !G.over) return;
    if (o.querySelector('#leaveBtn') || !o.querySelector('.row')) return;
    const target = baseNow(), key = oppKey(), sig = G.over + '|' + (typeof SERIES !== 'undefined' && SERIES ? (SERIES.games || 0) : 0);
    const fresh = lastOver !== sig; lastOver = sig;
    let box = o.querySelector('.pt-over');
    if (!box) { box = document.createElement('div'); box.className = 'pt-over'; o.appendChild(box); }
    /* на самом экране итога места мало: портрет «выскакивает» крупно (160 px), потом уезжает в угол */
    if (fresh) popUntil = still() ? 0 : Date.now() + holdMs(1700);
    const left = popUntil - Date.now();
    if (left > 0) {
      box.classList.add('pop'); if (!fresh) box.classList.add('held');
      clearTimeout(popT); popT = setTimeout(() => box.classList.remove('pop'), left);
    }
    const el = mount(box, key, { emo: fresh ? 'neutral' : target, role: 'opp' });
    if (fresh) { setTimeout(() => { if (el.isConnected) setBase(el, target); }, reduceMQ.matches ? 0 : holdMs(450)); }
    oppEmote(target, 0);
  }
  function wrapAll() {
    try { if (typeof showFx === 'function') { const f = showFx; showFx = function (o) { const r = f.apply(this, arguments); try { onFx(o); } catch (e) {} return r; }; } } catch (e) {}
    try { if (typeof showOver === 'function') { const f = showOver; showOver = function () { const r = f.apply(this, arguments); try { onOver(); } catch (e) {} return r; }; } } catch (e) {}
    try { if (typeof cheatSeen === 'function') { const f = cheatSeen; cheatSeen = function () { const r = f.apply(this, arguments); try { oppEmote('cheat', holdMs(1500)); } catch (e) {} return r; }; } } catch (e) {}
    try {
      if (typeof say === 'function') {
        const f = say;
        say = function (t) { const r = f.apply(this, arguments); try { if (t) eachRole('opp', el => { el.classList.remove('talk'); void el.getBoundingClientRect(); el.classList.add('talk'); setTimeout(() => el.classList.remove('talk'), 900); }); } catch (e) {} return r; };
      }
    } catch (e) {}
    try {
      if (typeof renderHUD === 'function') {
        const f = renderHUD;
        renderHUD = function () {
          const r = f.apply(this, arguments);
          try {
            eachRole('opp', el => { if (!el.closest('.pt-over')) setBase(el, baseNow()); });
            const a = document.getElementById('oppAva'); if (a && !a.querySelector('svg.pt')) adopt(a);
            if (!(G && G.over)) { const b = document.querySelector('#over .pt-over'); if (b) b.remove(); }
          } catch (e) {}
          return r;
        };
      }
    } catch (e) {}
  }

  function init() {
    injectCSS();
    wrapAll();
    startObserver();
    tick();
    setInterval(tick, 400);
    try { const a = document.getElementById('oppAva'); if (a) adopt(a); } catch (e) {}
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }
  return { svg, mount, emote, setBase, oppEmote, IDS, EMOS, NAMES, nameOf, gen, resolve, CSS, injectCSS, adopt };
})();
