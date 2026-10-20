/* ДурКер — обучение на 2–3 минуты: четыре подстроенные раздачи против Учителя (пара, перекрытие, подкидывание, «пятёрка поштучно»),
   плюс «Подбор» и фишки. Учитель с портретом, уровень подсказок на выбор, обучение можно пропустить.
   Работает на обычном движке: раздача выставляется вручную, ходы Учителя — по сценарию.
   Результаты обучения не идут ни в серию, ни в статистику, ни в таблицу лидеров (до конца партии дело не доходит). */
'use strict';

const TUT = (() => {
  const C = (r, s) => mkCard(s * 13 + r - 2);          // масть: 0♠ 1♥ 2♦ 3♣
  const ids = cs => cs.map(c => c.id);
  const TEACHER = { id: 'teacher', ai: 'student', name: 'Учитель', face: 'УЧ', color: '#2e9d5b', level: 'обучение', desc: '' };
  let lesson = -1, prevMode = null, msg = null, moveKey = null;

  /* три урока: раздача, подсказки по фазам, условие успеха */
  const LESSONS = [
    {
      title: 'Урок 1 из 4 · Покрой пару',
      deal() {
        return {
          T: 0, attacker: 'b',
          P: [C(9, 1), C(9, 3), C(3, 1), C(5, 2), C(11, 3), C(2, 2), C(12, 1), C(4, 3)],
          B: [C(6, 1), C(8, 2), C(10, 3), C(13, 1), C(3, 2), C(5, 3)],
          table: [[C(7, 3), C(7, 2)]], phase: { who: 'p', kind: 'defend' },
        };
      },
      hint(k) {
        if (k === 'p_defend') return { t: 'Учитель зашёл <b>парой семёрок</b>. Пару бьют парой старше. Выбери <b>9♥ и 9♣</b> и жми «Покрыть». Не знаешь, чем бить, — жми <b>⟳ Подбор</b>: он сам покажет ход.', hi: [C(9, 1), C(9, 3)], pick: true };
        return { t: 'Покрыто! Учитель говорит «Бито» — карты уходят в отбой.' };
      },
      win: who => who === 'p',
      done: 'Пара на пару, старше — и ты отбился. Так кроется любая комбинация: <b>тем же числом карт, но старше</b>. Козырь внутри комбинации делает её сильнее.',
    },
    {
      title: 'Урок 2 из 4 · Перекрой стритом',
      deal() {
        return {
          T: 0, attacker: 'b',
          P: [C(5, 1), C(6, 3), C(7, 2), C(8, 1), C(9, 3), C(2, 1), C(3, 2), C(13, 3)],
          B: [C(12, 2), C(14, 1), C(11, 1), C(2, 3)],
          table: [[C(10, 3), C(10, 2), C(4, 3), C(4, 2)]], phase: { who: 'p', kind: 'defend' },
        };
      },
      hint(k) {
        if (k === 'p_defend') return { t: 'Две пары! Старших двух пар у тебя нет — зато есть <b>стрит 5-6-7-8-9</b>. <b>Перекрытие:</b> на атаку можно лечь старшей комбинацией ровно на <b>одну карту больше</b>. Выбери пять карт подряд и жми «Покрыть». Не видишь ход — жми «⟳ Подбор».', hi: [C(5, 1), C(6, 3), C(7, 2), C(8, 1), C(9, 3)], pick: true };
        return { t: 'Перекрыл! Учитель сдаётся — «Бито».' };
      },
      win: who => who === 'p',
      done: 'Перекрытие спасает, когда нечем крыть тем же числом: на 2 карты — тройкой, на 3 — четвёркой, на 4 — пятёркой. Только <b>старшим типом</b>.',
    },
    {
      title: 'Урок 3 из 4 · Подкинь',
      deal() {
        return {
          T: 0, attacker: 'p',
          P: [C(8, 1), C(8, 3), C(3, 1), C(3, 3), C(13, 2), C(2, 2), C(5, 3), C(12, 1)],
          B: [C(11, 2), C(11, 3), C(6, 0), C(6, 2), C(14, 1), C(4, 2), C(9, 3), C(10, 1)],
          table: [], phase: { who: 'p', kind: 'attack' },
        };
      },
      hint(k) {
        if (k === 'p_attack') return { t: 'Теперь ты атакуешь. Зайди <b>парой восьмёрок</b> — жми «Ходить».', hi: [C(8, 1), C(8, 3)] };
        if (k === 'p_throw' && G.table.length === 1) return { t: 'Учитель покрыл вальтами. На столе уже <b>две пары</b> — восьмёрки и вальты. Раз пара сложилась на столе, подкинуть можно <b>любую пару</b>. Подкинь тройки.', hi: [C(3, 1), C(3, 3)] };
        if (k === 'p_throw') return { t: 'Учитель отбился козырной парой (козырь — ♠). Подкинуть больше нечего — жми «Бито».' };
        return { t: 'Учитель думает…' };
      },
      win: who => who === 'b',
      done: 'Подкидывают комбинацией с номиналом со стола — или любой, если такая комбинация уже сложилась из карт на столе. Одиночкой не подкидывают.',
    },
    {
      title: 'Урок 4 из 4 · Пятёрка поштучно',
      deal() {
        return {
          T: 0, attacker: 'b',
          P: [C(11, 1), C(13, 1), C(12, 3), C(14, 3), C(13, 2), C(2, 2), C(4, 3), C(3, 1)],
          B: [C(14, 2), C(10, 0), C(2, 0), C(9, 0)],
          table: [[C(5, 1), C(6, 3), C(7, 2), C(8, 1), C(9, 3)]], phase: { who: 'p', kind: 'defend' },
        };
      },
      hint(k) {
        if (k === 'p_defend') {
          const n = G.sel ? G.sel.size : 0;
          if (n === 5) return { t: 'Это <b>поштучный ответ</b>: у каждой карты стрита — своя, старшая той же масти. Жми «Покрыть».', hi: [C(11, 1), C(13, 1), C(12, 3), C(14, 3), C(13, 2)] };
          return { t: 'Учитель зашёл <b>стритом 5-6-7-8-9</b> разных мастей. Стрита старше и флеша у тебя нет, но пятёрку можно побить <b>поштучно</b>: каждую карту — своей, <b>старшей той же масти</b> (или козырем). Жми <b>⟳ Подбор</b> — он найдёт такой ход.', hi: [C(11, 1), C(13, 1), C(12, 3), C(14, 3), C(13, 2)], pick: true };
        }
        return { t: 'Отбился поштучно! Учитель говорит «Бито».' };
      },
      win: who => who === 'p',
      done: 'Пятёрку нечем побить комбинацией — бей <b>каждую карту своей</b>: старшей той же масти или козырем. Джокера бьёт только козырной туз, а перекрыть пятёрку шестью картами нельзя.',
    },
  ];

  /* портрет Учителя (из portraits.js); без него остаётся пустое место */
  function face(host, emo) {
    if (!host || typeof PORTRAITS === 'undefined' || !PORTRAITS.mount) return;
    try { PORTRAITS.mount(host, 'teacher', { emo: emo || 'neutral' }); } catch (e) {}
  }

  /* ---------- раздача урока ---------- */
  function start(i) {
    if (lesson < 0 || MODE.kind !== 'tutorial') prevMode = MODE.kind === 'tutorial' ? prevMode : MODE;
    lesson = i; moveKey = null;
    if (NET) { TR.close(); NET = null; }
    MODE = { kind: 'tutorial' };
    closeSheets();
    TOK++;
    const d = LESSONS[i].deal();
    const used = new Set([...d.P, ...d.B, ...d.table.flat()].map(c => c.n));
    const trump = C(13, d.T);
    used.add(trump.n);
    const rest = [];
    for (let n = 0; n < 52; n++) if (!used.has(n)) rest.push(mkCard(n));
    rest.sort(() => Math.random() - 0.5);
    const deck = [trump, ...rest.slice(0, 18)];
    G = {
      deck, T: d.T, trump, P: d.P, B: d.B, table: [], grave: 0, attacker: d.attacker,
      phase: d.phase, limit: HAND, sel: new Set(), sort: (G && G.sort) || 'r', over: null, busy: false, fx: null, fxList: [], online: false,
      rules: { set: 'full', transfer: false, mognul: false, charge: false, over: true, upgrade: false, typeThrow: true, blitz: false },
      known: new Set(), deadline: 0, extra: { p: 0, b: 0 }, clock: null, tutorial: true,
      charge: { p: 0, b: 0 }, offer: { p: null, b: null }, lastSuit: { p: d.T, b: d.T },
      turnNo: 1, turnCovers: 0, chained: false, actSerial: 0, upgraded: false,
      stats: { mognul: { p: 0, b: 0 }, transfer: { p: 0, b: 0 }, chain: { p: 0, b: 0 }, best: { p: -1, b: -1 }, turns: 1 },
    };
    /* оцениваем комбинации на столе уже при нашем козыре */
    G.table = d.table.map(cs => ({ a: ev(cs), d: null }));
    G.limit = Math.min(HAND, H(other(G.attacker)).length);
    $('over').hidden = true;
    msg = null;
    update(true);
    commit();
  }

  /* ходы Учителя по сценарию: кроет самым дешёвым, после покрытия говорит «Бито» */
  function teacher() {
    if (!G || G.over || G.busy || G.phase.who !== 'b') return;
    const key = lesson + ':' + G.phase.kind + ':' + G.table.length + ':' + G.table.filter(b => b.d).length;
    if (key === moveKey) return;
    moveKey = key;
    const t = TOK;
    setTimeout(() => {
      if (t !== TOK || !G || G.phase.who !== 'b' || G.busy) return;
      const k = G.phase.kind;
      if (k === 'defend') {
        const c = defenseOptions('b').cover[0];
        if (!c || !act('b', 'play', c.cards)) act('b', 'take');
      } else if (k === 'throw') act('b', 'bito');
      else if (k === 'addtake') act('b', 'enough');
      else if (k === 'attack') act('b', 'play', [G.B.slice().sort((a, b) => val(a) - val(b))[0]]);
    }, reduced ? 200 : 1100);
  }

  /* ход закончился: урок пройден или повторяем */
  function turnOver(who) {
    const L = LESSONS[lesson];
    G.phase = { who: null }; G.busy = true; update();
    if (L.win(who)) { store('durocker-tut-' + lesson, '1'); showDone(); }
    else card('Не вышло 🙂', 'Ничего страшного — давай ещё раз. Подсвеченные карты подскажут, что выбрать.', [['Ещё раз', () => start(lesson)]]);
  }
  function showDone() {
    const L = LESSONS[lesson], last = lesson === LESSONS.length - 1;
    if (!last) { card('Готово! ✅', L.done, [['Дальше', () => start(lesson + 1)]]); return; }
    store('durocker-tut', 'done');
    card('Ты готов! 🃏', L.done + '<br><br>Если растерялся — <b>⟳ Подбор</b> всегда покажет следующий допустимый ход. В карьере откроются <b>перевод</b>, <b>«могнул»</b> (покрыл старшим типом — сопернику штраф) и <b>заряд</b> с картами-действиями.<br><br>🪙 <b>Фишки:</b> перед матчем с ботом можно поставить фишки, серия побед умножает награду, каждый 3-й матч — сундук. Ставки только внутриигровые: купить фишки нельзя.',
      [['В карьеру', () => finish('career')], ['Своя игра', () => finish('free')]]);
  }
  function card(h, text, btns) {
    sheet('page', `<div class="rulecard tutcard"><span class="tag">ОБУЧЕНИЕ</span><div class="tface lg" data-face="1"></div><h2>${h}</h2><p>${text}</p>
      <div class="row">${btns.map((b, i) => `<button class="btn ${i ? 'grey' : 'blue'}" type="button" data-tutbtn="${i}">${b[0]}</button>`).join('')}</div>
      <button class="skipall" type="button" id="tutSkipAll">Пропустить обучение</button></div>`);
    btns.forEach((b, i) => { document.querySelector(`[data-tutbtn="${i}"]`).onclick = () => { $('page').hidden = true; b[1](); }; });
    $('tutSkipAll').onclick = () => { $('page').hidden = true; store('durocker-tut', load('durocker-tut') || 'skip'); finish('back'); };
    face(document.querySelector('#pageIn .tface'), /^Не вышло/.test(h) ? 'think' : 'smug');
  }
  function finish(where) {
    lesson = -1;
    const back = prevMode && prevMode.kind !== 'tutorial' ? prevMode : { kind: 'free' };
    prevMode = null;
    if (where === 'career') setMode({ kind: 'career', stage: Math.min(prog().career, CAREER_OPS.length - 1) });
    else if (where === 'free') { setMode({ kind: 'free' }); openBots(); }
    else setMode(back);
  }

  /* ---------- подсказка над столом и подсветка карт ---------- */
  function paint() {
    let el = $('tutBubble');
    const on = !!(G && G.tutorial && MODE.kind === 'tutorial' && lesson >= 0);
    document.documentElement.classList.toggle('tut', on);
    if (!on) { if (el) el.hidden = true; document.querySelectorAll('#hand .slot.tut').forEach(s => s.classList.remove('tut')); const pb0 = $('pickBtn'); if (pb0) pb0.classList.remove('tutpick'); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'tutBubble'; el.className = 'tutbubble';
      $('felt').appendChild(el);
    }
    const L = LESSONS[lesson], h = L.hint(uiPhase()) || { t: '' };
    const html = `<span class="tface" data-face="1"></span><div class="tbody"><div class="tt">${L.title}</div><div class="tx">${h.t}</div></div><button type="button" class="skip" id="tutSkip">Пропустить</button>`;
    if (el.dataset.k !== html) { el.innerHTML = html; el.dataset.k = html; $('tutSkip').onclick = () => finish('back'); face(el.querySelector('.tface'), 'neutral'); }
    const pb = $('pickBtn'); if (pb) pb.classList.toggle('tutpick', !!h.pick && uiPhase() === 'p_defend');
    el.hidden = !!G.busy && !G.phase.who;
    const hi = new Set(ids(h.hi || []));
    document.querySelectorAll('#hand .slot').forEach(s => { const c = s.querySelector('.card'); s.classList.toggle('tut', !!c && hi.has(c.dataset.id) && !G.sel.has(c.dataset.id)); });
  }

  /* ---------- встраивание: оборачиваем функции движка только на время обучения ---------- */
  function hook() {
    const wrap = (name, fn) => { const orig = window[name]; if (typeof orig !== 'function') return; window[name] = function () { return fn(orig, this, arguments); }; };
    wrap('currentBot', (o, t, a) => (MODE.kind === 'tutorial' ? TEACHER : o.apply(t, a)));
    wrap('drive', (o, t, a) => (MODE.kind === 'tutorial' ? teacher() : o.apply(t, a)));
    wrap('startTurn', (o, t, a) => (MODE.kind === 'tutorial' && G && G.tutorial ? turnOver(a[0]) : o.apply(t, a)));
    wrap('newGame', (o, t, a) => (MODE.kind === 'tutorial' ? start(Math.max(0, lesson)) : o.apply(t, a)));
    wrap('update', (o, t, a) => { const r = o.apply(t, a); try { paint(); } catch (e) {} return r; });
    wrap('openMenu', (o, t, a) => {
      const r = o.apply(t, a);
      try {
        const g = document.querySelector('#menuIn .menugrid');
        if (g && !g.querySelector('[data-go="tutorial"]')) {
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'mi'; b.dataset.go = 'tutorial';
          b.innerHTML = `<b>Обучение</b><small>${load('durocker-tut') ? 'Пройдено · повторить за 3 минуты' : '4 урока за 3 минуты'}</small>`;
          const rules = g.querySelector('[data-go="rules"]');
          g.insertBefore(b, rules || null);
        }
      } catch (e) {}
      return r;
    });
    wrap('menuGo', (o, t, a) => { if (a[0] === 'tutorial') { closeSheets(); start(0); return; } return o.apply(t, a); });
    wrap('setMode', (o, t, a) => { if (a[0] && a[0].kind !== 'tutorial') { lesson = -1; paint(); } return o.apply(t, a); });
  }

  /* первый запуск: спрашиваем уровень (он же — уровень подсказок) и предлагаем обучение */
  function offer() {
    if (load('durocker-tut') || prog().games > 0) { openMenu(); return; }
    sheet('page', `<div class="rulecard tutcard tutoffer"><span class="tag">ДУРКЕР</span><div class="tface xl" data-face="1"></div><h2>Впервые за столом?</h2>
      <p>Это дурак, где отбиваются <b>покерными комбинациями</b>. Как давно ты играешь в дурака? От ответа зависят подсказки в игре — их можно поменять в настройках.</p>
      <div class="lvl">
        <button class="btn blue" type="button" data-lvl="novice"><b>🙂 Новичок</b><small>покажи всё: 4 урока, подсвечу ходы</small></button>
        <button class="btn orange" type="button" data-lvl="player"><b>🃏 Играл раньше</b><small>уроки коротко, только подсветка</small></button>
        <button class="btn grey" type="button" data-lvl="pro"><b>😎 Профи</b><small>без обучения, подсказок почти нет</small></button>
      </div>
      <button class="skipall" type="button" id="tutNo">Пропустить</button></div>`);
    face(document.querySelector('#pageIn .tface'), 'smug');
    document.querySelectorAll('#pageIn [data-lvl]').forEach(b => {
      b.onclick = () => {
        const v = b.dataset.lvl;
        store('durocker-hints', v === 'novice' ? 'auto' : v);
        $('page').hidden = true;
        if (v === 'pro') { store('durocker-tut', 'skip'); openMenu(); } else start(0);
      };
    });
    $('tutNo').onclick = () => { $('page').hidden = true; store('durocker-tut', 'skip'); openMenu(); };
  }

  const css = document.createElement('style');
  css.textContent = `
.tutbubble{position:absolute;left:8px;right:8px;top:8px;z-index:24;background:rgba(10,24,20,.94);border:2px solid var(--gold);border-radius:12px;padding:8px 10px 8px;box-shadow:0 6px 0 rgba(0,0,0,.4);font-size:13.5px;line-height:1.35;color:var(--paper);pointer-events:auto}
.tutbubble .tt{font-family:var(--f-hard);font-size:10px;color:var(--gold);margin-bottom:4px;letter-spacing:.04em}
.tutbubble .tx b{color:#ffe14a}
.tutbubble .skip{position:absolute;right:6px;top:4px;background:none;border:none;color:var(--muted);font-size:11px;text-decoration:underline;cursor:pointer}
#hand .slot.tut .card{box-shadow:0 0 0 3px #ffe14a,0 0 18px 4px rgba(255,225,74,.75);animation:tutp 1s ease-in-out infinite}
@keyframes tutp{50%{box-shadow:0 0 0 3px #ffe14a,0 0 6px 1px rgba(255,225,74,.4)}}
.tutcard .row{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px}
.tutcard{text-align:center}
.tutcard .tface{margin:6px auto 2px}
.tface{display:inline-block;flex:none;width:44px;height:44px;border-radius:12px;overflow:hidden;border:2px solid var(--gold);background:#1b4a36}
.tface.lg{width:72px;height:72px}.tface.xl{width:104px;height:104px;border-radius:16px}
.tface svg{display:block;width:100%;height:100%}
.tutbubble{display:flex;gap:8px;align-items:flex-start}
.tutbubble .tbody{flex:1;min-width:0;padding-right:46px}
.tutbubble .tface{width:40px;height:40px;margin-top:2px}
.tutoffer .lvl{display:flex;flex-direction:column;gap:8px;margin:12px 0 4px}
.tutoffer .lvl .btn{flex-direction:column;gap:2px;text-align:center}
.tutoffer .lvl .btn small{font-size:12px;font-weight:600;opacity:.95;color:inherit}
.skipall{display:block;margin:10px auto 0;background:none;border:none;color:var(--muted);font-size:13px;text-decoration:underline;cursor:pointer}
#pickBtn.tutpick{animation:tutp 1s ease-in-out infinite;box-shadow:0 0 0 3px #ffe14a,0 0 18px 4px rgba(255,225,74,.75)}
html.tut #ruleHint,html.tut .siderules{display:none!important}
@media (orientation:landscape) and (max-height:520px){.tutbubble{position:fixed;left:8px;top:auto;bottom:8px;right:auto;width:min(254px,30vw);font-size:12px;padding:6px 8px}}`;
  document.head.appendChild(css);
  hook();
  return { start, offer, get lesson() { return lesson; } };
})();
