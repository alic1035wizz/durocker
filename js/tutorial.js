/* ДурКер — обучение на 2 минуты: три подстроенные раздачи против Учителя.
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
      title: 'Урок 1 из 3 · Покрой пару',
      deal() {
        return {
          T: 0, attacker: 'b',
          P: [C(9, 1), C(9, 3), C(3, 1), C(5, 2), C(11, 3), C(2, 2), C(12, 1), C(4, 3)],
          B: [C(6, 1), C(8, 2), C(10, 3), C(13, 1), C(3, 2), C(5, 3)],
          table: [[C(7, 3), C(7, 2)]], phase: { who: 'p', kind: 'defend' },
        };
      },
      hint(k) {
        if (k === 'p_defend') return { t: 'Учитель зашёл <b>парой семёрок</b>. Пару бьют парой старше. Выбери <b>9♥ и 9♣</b> и жми «Покрыть».', hi: [C(9, 1), C(9, 3)] };
        return { t: 'Покрыто! Учитель говорит «Бито» — карты уходят в отбой.' };
      },
      win: who => who === 'p',
      done: 'Пара на пару, старше — и ты отбился. Так кроется любая комбинация: <b>тем же числом карт, но старше</b>. Козырь внутри комбинации делает её сильнее.',
    },
    {
      title: 'Урок 2 из 3 · Перекрой стритом',
      deal() {
        return {
          T: 0, attacker: 'b',
          P: [C(5, 1), C(6, 3), C(7, 2), C(8, 1), C(9, 3), C(2, 1), C(3, 2), C(13, 3)],
          B: [C(12, 2), C(14, 1), C(11, 1), C(2, 3)],
          table: [[C(10, 3), C(10, 2), C(4, 3), C(4, 2)]], phase: { who: 'p', kind: 'defend' },
        };
      },
      hint(k) {
        if (k === 'p_defend') return { t: 'Две пары! Старших двух пар у тебя нет — зато есть <b>стрит 5-6-7-8-9</b>. <b>Перекрытие:</b> на атаку можно лечь старшей комбинацией ровно на <b>одну карту больше</b>. Выбери пять карт подряд и жми «Покрыть». Не видишь ход — жми «⟳ Подбор».', hi: [C(5, 1), C(6, 3), C(7, 2), C(8, 1), C(9, 3)] };
        return { t: 'Перекрыл! Учитель сдаётся — «Бито».' };
      },
      win: who => who === 'p',
      done: 'Перекрытие спасает, когда нечем крыть тем же числом: на 2 карты — тройкой, на 3 — четвёркой, на 4 — пятёркой. Только <b>старшим типом</b>.',
    },
    {
      title: 'Урок 3 из 3 · Подкинь',
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
  ];

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
    card('Ты готов! 🃏', L.done + '<br><br>Дальше в карьере откроются <b>перевод</b>, <b>«могнул»</b> (покрыл старшим типом — сопернику штраф) и <b>заряд</b> с картами-действиями.',
      [['В карьеру', () => finish('career')], ['Своя игра', () => finish('free')]]);
  }
  function card(h, text, btns) {
    sheet('page', `<div class="rulecard tutcard"><span class="tag">ОБУЧЕНИЕ</span><h2>${h}</h2><p>${text}</p>
      <div class="row">${btns.map((b, i) => `<button class="btn ${i ? 'grey' : 'blue'}" type="button" data-tutbtn="${i}">${b[0]}</button>`).join('')}</div></div>`);
    btns.forEach((b, i) => { document.querySelector(`[data-tutbtn="${i}"]`).onclick = () => { $('page').hidden = true; b[1](); }; });
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
    if (!on) { if (el) el.hidden = true; document.querySelectorAll('#hand .slot.tut').forEach(s => s.classList.remove('tut')); return; }
    if (!el) {
      el = document.createElement('div'); el.id = 'tutBubble'; el.className = 'tutbubble';
      $('felt').appendChild(el);
    }
    const L = LESSONS[lesson], h = L.hint(uiPhase()) || { t: '' };
    const html = `<div class="tt">${L.title}</div><div class="tx">${h.t}</div><button type="button" class="skip" id="tutSkip">Пропустить</button>`;
    if (el.dataset.k !== html) { el.innerHTML = html; el.dataset.k = html; $('tutSkip').onclick = () => finish('back'); }
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
          b.innerHTML = `<b>Обучение</b><small>${load('durocker-tut') ? 'Пройдено · повторить за 2 минуты' : '3 урока за 2 минуты'}</small>`;
          const rules = g.querySelector('[data-go="rules"]');
          g.insertBefore(b, rules || null);
        }
      } catch (e) {}
      return r;
    });
    wrap('menuGo', (o, t, a) => { if (a[0] === 'tutorial') { closeSheets(); start(0); return; } return o.apply(t, a); });
    wrap('setMode', (o, t, a) => { if (a[0] && a[0].kind !== 'tutorial') { lesson = -1; paint(); } return o.apply(t, a); });
  }

  /* первый запуск: предлагаем обучение (тем, кто уже играл, — не навязываем) */
  function offer() {
    if (load('durocker-tut') || prog().games > 0) { openMenu(); return; }
    sheet('page', `<div class="rulecard tutcard"><span class="tag">ДУРКЕР</span><h2>Впервые за столом?</h2>
      <p>Это дурак, где отбиваются <b>покерными комбинациями</b>. Три коротких урока — и ты в игре. Около двух минут.</p>
      <div class="row"><button class="btn blue" type="button" id="tutStart">Начать обучение</button><button class="btn grey" type="button" id="tutNo">Пропустить</button></div></div>`);
    $('tutStart').onclick = () => { $('page').hidden = true; start(0); };
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
html.tut #ruleHint,html.tut .siderules{display:none!important}
@media (orientation:landscape) and (max-height:520px){.tutbubble{position:fixed;left:8px;top:auto;bottom:8px;right:auto;width:min(254px,30vw);font-size:12px;padding:6px 8px}}`;
  document.head.appendChild(css);
  hook();
  return { start, offer, get lesson() { return lesson; } };
})();
