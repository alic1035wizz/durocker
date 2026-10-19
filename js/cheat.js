/* Дурокер — «Поймай шулера!»
   Шулер (свой и финальный босс) подтасовывает карту из колоды. Это видно: рука соперника мерцает,
   и на ~1,7 с появляется кнопка «ШУЛЕР!». Поймал — ему +3 штрафа и карта уходит обратно.
   Но иногда Шулер только делает вид (мерцание вхолостую) — нажал зря, +1 штраф тебе.
   Обвинить можно не больше двух раз за партию — жать на каждое мерцание невыгодно.
   Подсказка внимательным: при настоящей подтасовке дёргается и колода. */
'use strict';

const CHEAT = (() => {
  const WINDOW = 1700, CALLS = 2;   // окно реакции и сколько раз за партию можно обвинить
  let open = null, timer = 0, el = null;

  function style() {
    if (document.getElementById('cheatCss')) return;
    const st = document.createElement('style');
    st.id = 'cheatCss';
    st.textContent = `
      .dk-flick{animation:dkFlick .5s ease-in-out 3}
      @keyframes dkFlick{0%,100%{filter:none}40%{filter:brightness(1.35) saturate(1.3) drop-shadow(0 0 6px rgba(255,230,140,.55))}60%{filter:brightness(.9)}}
      .dk-twitch{animation:dkTwitch .35s ease-in-out 2}
      @keyframes dkTwitch{0%,100%{transform:none}30%{transform:translate(2px,-1px) rotate(1.5deg)}70%{transform:translate(-2px,1px) rotate(-1deg)}}
      #cheatBtn{position:fixed;left:50%;z-index:60;transform:translateX(-50%) scale(.6);opacity:0;pointer-events:none;
        background:#c8402f;color:#fff;border:3px solid #ffe14a;border-radius:14px;padding:10px 22px;
        font:900 22px/1 var(--f-hard,'Press Start 2P',monospace);letter-spacing:.04em;box-shadow:0 6px 0 rgba(0,0,0,.45);
        transition:transform .15s cubic-bezier(.2,1.6,.4,1),opacity .15s;overflow:hidden;white-space:nowrap}
      #cheatBtn.on{transform:translateX(-50%) scale(1);opacity:1;pointer-events:auto}
      #cheatBtn i{position:absolute;left:0;bottom:0;height:5px;background:#ffe14a;width:100%;transform-origin:left;font-style:normal}
      #cheatBtn.on i{animation:dkBar ${WINDOW}ms linear forwards}
      @keyframes dkBar{to{transform:scaleX(0)}}
      @media (prefers-reduced-motion:reduce){.dk-flick,.dk-twitch{animation:none;outline:2px dashed rgba(255,225,74,.6)}}`;
    document.head.appendChild(st);
  }
  function button() {
    if (el) return el;
    style();
    el = document.createElement('button');
    el.id = 'cheatBtn'; el.type = 'button';
    el.innerHTML = '🕵️ ШУЛЕР!<i></i>';
    el.addEventListener('click', e => { e.stopPropagation(); accuse(); });
    document.body.appendChild(el);
    return el;
  }
  function place(b) {
    const h = document.getElementById('hand'), r = h && h.getBoundingClientRect();
    b.style.top = (r && r.top > 120 ? Math.max(70, r.top - 62) : 120) + 'px';
  }
  function flick(id, cls) {
    const n = document.getElementById(id);
    if (!n) return;
    n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls);
    setTimeout(() => n.classList.remove(cls), 1600);
  }
  function close() {
    open = null; clearTimeout(timer);
    if (el) el.classList.remove('on');
  }
  /* bot.js зовёт при подтасовке (info = {got, worst}) и при «холостом» мерцании (info = null) */
  function seen(info) {
    if (typeof NET !== 'undefined' && NET) return;
    if (!G || G.over || typeof document === 'undefined') return;
    close();
    open = { info, tok: TOK, at: Date.now() };
    flick('botHand', 'dk-flick');
    if (info) flick('deckcol', 'dk-twitch');
    const left = CALLS - (G.calls || 0);
    if (left <= 0) return;   /* обвинения кончились — мерцание видно, но поймать уже нечем */
    const b = button(); place(b);
    b.innerHTML = `🕵️ ШУЛЕР! <small style="font-size:.55em;opacity:.8">×${left}</small><i></i>`;
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    timer = setTimeout(close, WINDOW);
  }
  function accuse() {
    const o = open;
    close();
    if (!o || o.tok !== TOK || !G || G.over) return;
    G.calls = (G.calls || 0) + 1;
    if (o.info) {
      /* поймал: карту возвращаем в колоду, если она ещё на руке у Шулера */
      const { got, worst } = o.info;
      const bi = G.B.indexOf(got), di = G.deck.indexOf(worst);
      if (bi >= 0 && di >= 0) { G.B[bi] = worst; G.deck[di] = got; }
      SERIES.b += 3; saveSeries();
      showHype('caught', true);
      if (typeof voiceLine === 'function') voiceLine('caught', true);
      if (typeof AU !== 'undefined') AU.play('win');
      G.caught = (G.caught || 0) + 1;
    } else {
      SERIES.p += 1; saveSeries();
      showHype('falsecall', false);
      if (typeof voiceLine === 'function') voiceLine('falsecall', true);
      if (typeof AU !== 'undefined') AU.play('lose');
    }
    if (typeof update === 'function') update();
  }
  return { seen, accuse, close, get open() { return open; }, WINDOW };
})();
function cheatSeen(info) { CHEAT.seen(info); }

/* фразы для хайпа: [когда это твоё, когда против тебя] */
if (typeof HYPE !== 'undefined') {
  HYPE.caught = { rude: ['СПАЛИЛСЯ, С*КА!', 'СПАЛИЛСЯ, С*КА!'], clean: ['ПОЙМАН!', 'ПОЙМАН!'] };
  HYPE.falsecall = { rude: ['ГОНИШЬ? +1 ТЕБЕ', 'ГОНИШЬ? +1 ТЕБЕ'], clean: ['МИМО! +1 ТЕБЕ', 'МИМО! +1 ТЕБЕ'] };
}
/* новая партия — старое окно закрываем */
if (typeof newGame === 'function') {
  const _ng = newGame;
  newGame = function (...a) { CHEAT.close(); return _ng.apply(this, a); };
}
