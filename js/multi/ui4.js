/* ДурКер — «Компания»: стол на 3–4 игрока. Ты снизу, соперники сверху по часовой, стол по центру.
   Работает в трёх режимах: с ботами (движок у тебя), хозяин онлайн-стола (движок у тебя) и гость (движок у хозяина).
   Матч до N побед, «Классика» или «Полные правила», голоса ботов, «Поймай шулера» за столом с ботами. */
'use strict';

const UI4 = (() => {
  /* персонажи-боты: берём из BOTS и карьеры (там же их голоса в voices.js) */
  const POOL = ['valera', 'c-zina', 'student', 'c-patsan', 'c-mihalych', 'c-babka', 'c-dembel', 'c-torgash', 'c-provod', 'c-tolik'];
  const FALLBACK = { name: 'Дядя Валера', face: 'ДВ', color: '#d9a03c', ai: 'valera', id: 'valera' };
  function findBot(id) {
    try {
      const b = (typeof BOTS !== 'undefined' ? BOTS : []).find(x => x.id === id);
      if (b) return { id: b.id, name: b.name, face: b.face, color: b.color, ai: b.ai };
      for (const d of (typeof CAREER !== 'undefined' ? CAREER : [])) {
        const o = (d.ops || []).find(x => x.id === id);
        if (o) return { id: o.id, name: o.name, face: o.face, color: o.color, ai: o.ai === 'sharper' ? 'sharper' : o.ai };
      }
    } catch (e) {}
    return null;
  }
  function personas(n, withSharper) {
    const ids = POOL.slice().sort(() => Math.random() - 0.5);
    const out = [];
    if (withSharper) out.push(findBot('sharper') || { id: 'sharper', name: 'Шулер', face: 'Ш', color: '#c8402f', ai: 'sharper' });
    for (const id of ids) { if (out.length >= n) break; const b = findBot(id); if (b && !out.some(x => x.name === b.name)) out.push(b); }
    while (out.length < n) out.push({ ...FALLBACK });
    return out.sort(() => Math.random() - 0.5);
  }
  const OPT_KEY = 'durocker-m4opt';
  function opts() { let o = null; try { o = JSON.parse(load(OPT_KEY)); } catch (e) {} return Object.assign({ to: 2, set: 'full', sharper: false }, o || {}); }
  function saveOpts(o) { store(OPT_KEY, JSON.stringify(o)); }
  const FMT = { 1: 'одна партия', 2: 'до 2 побед', 3: 'до 3 побед' };

  const C = { on: false, mode: null, me: 0, V: null, S: null, sel: new Set(), sort: (() => { try { return load('durocker-sort') === 's' ? 's' : 'r'; } catch (e) { return 'r'; } })(), emo: {}, pick: null, lastEv: 0, lastHype: 0, botT: null, upT: null, tok: 0,
    cfg: null, faces: [], seen: new Set(), log: [], say: {}, voiceAt: 0, cheat: null, cheatTurn: -1, offerLater: false, frozen: false };
  const $4 = id => document.getElementById(id);

  /* ---------- стили ---------- */
  function css() {
    if ($4('m4css')) return;
    const st = document.createElement('style'); st.id = 'm4css';
    st.textContent = `
#m4{position:fixed;inset:0;z-index:50;background:radial-gradient(120% 80% at 50% 0%,#0d2b26 0%,var(--bg) 70%);display:flex;flex-direction:column;gap:6px;
  padding:calc(8px + env(safe-area-inset-top,0px)) 8px calc(8px + env(safe-area-inset-bottom,0px));color:var(--text);overflow:hidden}
#m4[hidden]{display:none!important}
.m4top{display:flex;align-items:center;gap:6px}
.m4top .t{flex:1;min-width:0;font-family:var(--f-hard);font-size:10px;color:var(--gold);line-height:1.5;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m4opps{display:flex;gap:6px}
.m4opp{flex:1;min-width:0;background:rgba(0,0,0,.4);border:2px solid var(--line);border-radius:10px;padding:5px 6px;display:flex;flex-direction:column;gap:3px;position:relative;transition:border-color .2s,box-shadow .2s}
.m4opp.who{border-color:var(--gold);box-shadow:0 0 0 2px rgba(234,181,75,.35),0 0 14px rgba(234,181,75,.35)}
.m4opp.out{opacity:.45}
.m4opp .hd{display:flex;align-items:center;gap:5px;min-width:0}
.m4opp .ava{width:24px;height:24px;font-size:8px}
.m4opp .nm{font-weight:800;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.m4dots{font-size:10px;color:var(--gold);letter-spacing:1px;white-space:nowrap}
.m4dots i{font-style:normal;opacity:.35}
.m4opp .row{display:flex;align-items:center;justify-content:space-between;gap:4px}
.m4opp .backs{display:flex;height:22px;--w:15px;padding-left:5px}
.m4opp .backs .card{margin-left:-8px}
.m4opp .cnt{font-size:11px;color:var(--muted);white-space:nowrap}
.m4pips{display:inline-flex;gap:2px;vertical-align:middle}
.m4pips b{width:7px;height:7px;border-radius:2px;background:rgba(255,255,255,.15);transform:rotate(45deg)}
.m4pips b.on{background:var(--gold)}
.m4pips.full b{background:var(--gold);box-shadow:0 0 6px var(--gold)}
.m4say{position:absolute;left:4px;right:4px;top:calc(100% + 4px);z-index:6;background:var(--paper);color:#201a26;font-size:11px;font-weight:700;line-height:1.25;border-radius:8px;padding:4px 6px;box-shadow:0 3px 0 rgba(0,0,0,.35);pointer-events:none;animation:m4say .25s cubic-bezier(.2,1.5,.4,1)}
.m4say:before{content:'';position:absolute;left:14px;top:-6px;border:6px solid transparent;border-top:0;border-bottom-color:var(--paper)}
@keyframes m4say{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}
.m4opp.flick{animation:m4flick .5s ease-in-out 3}
@keyframes m4flick{0%,100%{filter:none}40%{filter:brightness(1.4) saturate(1.3) drop-shadow(0 0 6px rgba(255,230,140,.6))}60%{filter:brightness(.9)}}
.m4deck.twitch{animation:m4tw .35s ease-in-out 2}
@keyframes m4tw{0%,100%{transform:none}30%{transform:translate(2px,-1px) rotate(1.5deg)}70%{transform:translate(-2px,1px) rotate(-1deg)}}
.m4badge{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;border-radius:999px;padding:1px 6px;background:var(--grey);color:#fff;white-space:nowrap}
.m4badge.atk{background:var(--blue)}.m4badge.def{background:var(--red)}.m4badge.pass{background:#444}.m4badge.out{background:var(--green)}
.m4felt{--w:44px;position:relative;flex:1;min-height:150px;border-radius:22px;background:radial-gradient(ellipse at 50% 45%,var(--felt) 0%,var(--felt-deep) 80%);
  border:6px solid #5a3a1c;box-shadow:inset 0 0 40px rgba(0,0,0,.55),0 6px 0 rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:28px 52px 14px 12px}
.m4dir{position:absolute;left:10px;right:56px;top:6px;text-align:center;font-weight:800;font-size:12px;color:var(--paper);text-shadow:1px 1px 0 #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m4dir b{color:var(--gold)}
.m4bats{display:flex;flex-wrap:wrap;gap:14px 14px;justify-content:center;align-items:flex-start;max-height:100%;overflow:hidden;padding-top:6px}
.m4b{display:flex;flex-direction:column;align-items:center;gap:2px}
.m4b .lbl{font-size:10px;font-weight:700;background:rgba(0,0,0,.55);border-radius:6px;padding:0 5px;white-space:nowrap;position:relative;z-index:3}
.m4b .row{display:flex}.m4b .row .card+.card{margin-left:calc(var(--w)*-.5)}
.m4b .def{margin-top:calc(var(--w)*-.95);margin-left:calc(var(--w)*.35)}
.m4b.open .atk .card .front{box-shadow:0 0 0 2px var(--gold),0 0 12px rgba(234,181,75,.6)}
.m4b .new{animation:m4in .35s cubic-bezier(.2,1.4,.4,1)}
@keyframes m4in{from{transform:translateY(-30px) scale(.7);opacity:0}to{transform:none;opacity:1}}
.m4deck{position:absolute;right:8px;bottom:10px;--w:32px;display:flex;flex-direction:column;align-items:center;gap:2px;font-size:10px;color:var(--muted)}
.m4deck .tr{transform:rotate(90deg) translateX(-6px);margin-bottom:-14px}
.m4deck .suit{font-size:16px;color:var(--gold);line-height:1}
.m4grave{position:absolute;right:8px;top:8px;font-size:10px;color:var(--muted);text-align:center}
.m4ev{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);max-width:80%;font-weight:800;font-size:12px;background:rgba(0,0,0,.55);border-radius:8px;padding:3px 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
.m4ev.on{animation:m4ev .5s ease}
@keyframes m4ev{from{transform:translate(-50%,8px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
.m4hype{position:absolute;left:50%;bottom:16%;z-index:8;pointer-events:none;font-family:var(--f-hard);font-size:20px;line-height:1.25;text-align:center;width:92%;
  color:#ffe14a;-webkit-text-stroke:2px #000;paint-order:stroke fill;text-shadow:4px 4px 0 #b3202a,8px 8px 0 rgba(0,0,0,.5);transform:translateX(-50%) rotate(-6deg);opacity:0}
.m4hype.bad{color:#ff5a4e;text-shadow:4px 4px 0 #1b1b40,8px 8px 0 rgba(0,0,0,.5)}
.m4hype.on{animation:m4hy 1.8s cubic-bezier(.2,1.5,.4,1) forwards}
@keyframes m4hy{0%{opacity:0;transform:translateX(-50%) rotate(-6deg) scale(.3)}15%{opacity:1;transform:translateX(-50%) rotate(-6deg) scale(1.1)}25%{transform:translateX(-50%) rotate(-6deg) scale(1)}85%{opacity:1}100%{opacity:0;transform:translateX(-50%) rotate(-6deg) scale(1)}}
.m4info{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.4);border:2px solid var(--line);border-radius:10px;padding:6px 10px;min-height:42px;font-size:13px;line-height:1.3}
.m4info .tx{flex:1;min-width:0}
.m4info.ok{border-color:#2e9d5b}.m4info.no{border-color:#b3202a}.m4info.gold{border-color:var(--gold)}
.m4info b{color:var(--gold)}
.m4log{display:none}
.m4me{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:12px;color:var(--muted);padding:0 4px}
.m4me .badges{display:flex;gap:4px;align-items:center}
.m4me .chg{background:none;border:none;padding:2px 4px;color:var(--muted);font-size:11px;display:inline-flex;gap:4px;align-items:center;cursor:pointer}
.m4ctl{display:grid;grid-template-columns:1fr auto 1fr;gap:8px}
.m4ctl .btn{min-height:50px;font-size:16px}
.m4mid{display:flex;flex-direction:column;gap:4px;align-items:stretch;justify-content:center}
.m4mid button{border:none;border-radius:8px;font-weight:800;color:#fff;padding:6px 10px;font-size:13px;box-shadow:0 3px 0 rgba(0,0,0,.4)}
.m4mid .pk{background:var(--green)}
.m4mid .so{background:var(--orange);color:#3a2004;font-size:11px;padding:3px 8px}
#m4cheat{position:absolute;left:50%;bottom:calc(178px + env(safe-area-inset-bottom,0px));z-index:9;transform:translateX(-50%) scale(.6);opacity:0;pointer-events:none;
  background:#c8402f;color:#fff;border:3px solid #ffe14a;border-radius:14px;padding:10px 22px;font:900 20px/1 var(--f-hard,'Press Start 2P',monospace);
  box-shadow:0 6px 0 rgba(0,0,0,.45);transition:transform .15s cubic-bezier(.2,1.6,.4,1),opacity .15s;overflow:hidden;white-space:nowrap}
#m4cheat.on{transform:translateX(-50%) scale(1);opacity:1;pointer-events:auto}
#m4cheat i{position:absolute;left:0;bottom:0;height:5px;background:#ffe14a;width:100%;transform-origin:left}
#m4cheat.on i{animation:m4bar 1700ms linear forwards}
@keyframes m4bar{to{transform:scaleX(0)}}
.m4offer{position:absolute;inset:0;z-index:7;background:rgba(0,0,0,.66);display:flex;align-items:center;justify-content:center;padding:16px}
.m4offer .box{background:var(--sheet);border:2px solid rgba(234,181,75,.6);border-radius:16px;padding:14px;max-width:420px;width:100%;display:flex;flex-direction:column;gap:10px;text-align:center}
.m4offer h3{font-family:var(--f-hard);font-size:13px;color:var(--gold);margin:0;line-height:1.6}
.m4offer .ch{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.m4offer .ch button{background:rgba(0,0,0,.35);border:2px solid var(--line);border-radius:12px;color:var(--text);padding:8px;display:flex;flex-direction:column;align-items:center;gap:6px;--w:52px;cursor:pointer}
.m4offer .ch button:hover{border-color:var(--gold)}
.m4offer .ch span{font-weight:800}.m4offer .ch em{font-style:normal;font-size:11px;color:var(--muted);line-height:1.3}
.m4offer .later{background:none;border:none;color:var(--muted);text-decoration:underline;cursor:pointer}
.m4over{position:absolute;inset:0;z-index:10;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px}
.m4over .box{background:var(--sheet);border:2px solid rgba(234,181,75,.5);border-radius:16px;padding:16px;max-width:420px;width:100%;display:flex;flex-direction:column;gap:10px;text-align:center}
.m4over h2{font-family:var(--f-hard);font-size:16px;color:var(--gold);margin:0;line-height:1.5}
.m4over h2.big{font-size:20px}
.m4over table{width:100%;border-collapse:collapse;font-size:14px}
.m4over td{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left}
.m4over td.w{font-family:var(--f-hard);font-size:12px;color:var(--gold);text-align:center;white-space:nowrap}
.m4over td.p{text-align:right;font-size:12px;color:var(--muted);white-space:nowrap}
.m4over tr.loser td:first-child{color:#ff8a7a}
.m4over tr.win td:first-child{color:#8fe3a9}
.m4over .deci{font-family:var(--f-hard);font-size:11px;color:#ffe14a;line-height:1.6}
.m4over .btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.m4over .btn{padding:12px 18px}
.m4lobby .seat{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:rgba(0,0,0,.25)}
.m4lobby .seat .ava{width:26px;height:26px;font-size:8px}
.m4lobby .seat.off{opacity:.5}
.m4pick{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.m4pick .btn{padding:14px 8px}
.m4chips{display:flex;gap:6px;flex-wrap:wrap}
.m4chips button{flex:1;min-width:0;border:2px solid var(--line);background:rgba(0,0,0,.3);color:var(--text);border-radius:10px;padding:8px 6px;font-weight:800;font-size:13px;cursor:pointer}
.m4chips button.on{border-color:var(--gold);background:rgba(234,181,75,.18);color:var(--gold)}
.m4setup h3{margin:12px 0 6px}
.m4setup .small{font-size:12px;color:var(--muted);margin:4px 0 0}
@media (orientation:landscape) and (max-height:520px){
  #m4{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr) auto auto auto;column-gap:10px;row-gap:5px;padding-top:calc(6px + env(safe-area-inset-top,0px));padding-bottom:calc(6px + env(safe-area-inset-bottom,0px))}
  .m4top{grid-column:1/3}
  .m4opps{grid-column:1;grid-row:2}
  .m4felt{grid-column:1;grid-row:3/7;min-height:0;--w:38px}
  .m4info{grid-column:2;grid-row:2;align-self:start;font-size:12px}
  .m4log{grid-column:2;grid-row:3;display:flex;flex-direction:column;justify-content:flex-end;gap:2px;min-height:0;overflow:hidden;font-size:11px;color:var(--muted);
    background:rgba(0,0,0,.25);border:1px solid var(--line);border-radius:10px;padding:5px 8px}
  .m4log div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .m4log div:last-child{color:var(--text);font-weight:700}
  .m4log .sc{font-family:var(--f-hard);font-size:9px;color:var(--gold);margin-bottom:auto;line-height:1.6;white-space:normal}
  .m4me{grid-column:2;grid-row:4}
  .m4hand{grid-column:2;grid-row:5}
  .m4ctl{grid-column:2;grid-row:6}
  .m4ctl .btn{min-height:42px;font-size:14px;padding:8px 4px}
  .m4opp{padding:3px 5px}.m4opp .backs{display:none}
  .m4say{top:auto;bottom:calc(100% + 4px)}.m4say:before{display:none}
  #m4cheat{bottom:auto;top:44%;left:78%}
  .m4hype{font-size:16px}
}
@media (min-width:900px) and (min-height:521px){
  #m4{max-width:980px;margin:0 auto}

}`;
    document.head.appendChild(st);
  }
  function mount() {
    css();
    let el = $4('m4');
    if (!el) {
      el = document.createElement('div'); el.id = 'm4'; el.hidden = true;
      el.innerHTML = `<div class="m4top"><button class="iconbtn" type="button" id="m4menu" aria-label="Меню">☰</button><div class="t" id="m4title">КОМПАНИЯ</div><button class="iconbtn" type="button" id="m4exit" aria-label="Выйти из компании">✕</button></div>
        <div class="m4opps" id="m4opps"></div>
        <div class="m4felt" id="m4felt"><div class="m4dir" id="m4dir"></div><div class="m4bats" id="m4bats"></div>
          <div class="m4grave" id="m4grave"></div><div class="m4deck" id="m4deck"></div><div class="m4ev" id="m4ev"></div><div class="m4hype" id="m4hype"></div></div>
        <div class="m4info" id="m4info"><div class="tx" id="m4tx"></div></div>
        <div class="m4log" id="m4log"></div>
        <div class="m4me" id="m4me"></div>
        <div class="m4hand" id="m4hand"></div>
        <div class="m4ctl"><div id="m4alt" class="ctl"></div><div class="m4mid"><button type="button" class="pk" id="m4pick">⟳ Подбор</button><button type="button" class="so" id="m4sort">Ранги</button></div><div id="m4main" class="ctl"></div></div>
        <button type="button" id="m4cheat">🕵️ ШУЛЕР!<i></i></button>
        <div id="m4offer"></div>
        <div id="m4over"></div>`;
      document.body.appendChild(el);
      $4('m4hand').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) toggle(+c.dataset.id.slice(1)); });
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-a4]'); if (b && !b.disabled) { doAct(b.dataset.a4); return; }
        const p = e.target.closest('[data-pick4]'); if (p) { pickOffer(p.dataset.pick4); return; }
        if (e.target.closest('#m4later')) { C.offerLater = true; renderOffer(); return; }
        if (e.target.closest('#m4chg')) { C.offerLater = false; renderOffer(); }
      });
      $4('m4pick').onclick = nextPick;
      $4('m4sort').onclick = () => { C.sort = C.sort === 'r' ? 's' : 'r'; try { store('durocker-sort', C.sort); } catch (e) {} render(); };
      addEventListener('resize', () => layoutHand());
      $4('m4exit').onclick = () => exit();
      $4('m4menu').onclick = () => { try { openMenu(); } catch (e) {} };
      $4('m4cheat').onclick = e => { e.stopPropagation(); accuse(); };
    }
    return el;
  }

  /* ---------- вход и выход ---------- */
  /* лёгкая пауза игры на двоих: пока открыто окно компании, бот за ней не ходит */
  function pauseDuo() {
    try { if (G && !G.over && !G.busy && !NET) { G.busy = true; C.frozen = true; clearTimeout(turnTimer); } } catch (e) {}
  }
  function resumeDuo() {
    if (!C.frozen || C.on) return;
    C.frozen = false;
    try { if (G && G.busy) { G.busy = false; commit(); } } catch (e) {}
  }
  function freezeDuo() {
    try { TOK++; } catch (e) {}
    try { clearTimeout(turnTimer); } catch (e) {}
    try { if (G) { G.deadline = 0; G.busy = true; } } catch (e) {}
    try { if (NET) { TR.close(); NET = null; } } catch (e) {}
    C.frozen = false;
  }
  function enter(mode, me) {
    mount(); freezeDuo();
    C.on = true; C.mode = mode; C.me = me || 0; C.sel = new Set(); C.pick = null; C.lastEv = 0; C.lastHype = 0; C.seen = new Set(); C.tok++;
    C.log = []; C.say = {}; C.cheat = null; C.cheatTurn = -1; C.offerLater = false; C.overShown = null;
    $4('m4').hidden = false;
    $4('m4').dataset.theme = (C.faces || []).some(f => f && f.id === 'sharper') ? 'casino' : 'kitchen';
    document.documentElement.classList.add('m4on');
    try { closeSheets(); } catch (e) {}
  }
  function exit(silent) {
    if (!C.on) return;
    C.on = false; C.tok++; clearTimeout(C.botT); clearTimeout(C.upT); closeCheat();
    try { NET4.leave(); } catch (e) {}
    $4('m4').hidden = true;
    document.documentElement.classList.remove('m4on');
    if (!silent) { try { G = null; newGame(); } catch (e) {} }
  }

  /* ---------- игра с ботами ---------- */
  function startBots(N) {
    const o = opts();
    const bots = personas(N - 1, o.sharper);
    C.cfg = { N, names: [myNick(), ...bots.map(b => b.name)], kinds: ['me', ...bots.map(() => 'bot')], bots: [null, ...bots],
      to: o.to, set: o.set, wins: Array(N).fill(0), pens: Array(N).fill(0), games: 0, calls: 0 };
    C.faces = [null, ...bots];
    enter('bots', 0);
    M4.newGame(C.cfg);
    AU.play('deal');
    refresh();
  }
  function nextGame() {
    const M = M4.M;
    if (!M) return;
    const done = M.matchDone;
    C.cfg.wins = done ? Array(M.N).fill(0) : M.wins.slice();
    C.cfg.pens = done ? Array(M.N).fill(0) : M.pens.slice();
    C.cfg.games = done ? 0 : M.games;
    C.cfg.calls = done ? 0 : M.calls;
    if (C.mode === 'host') { NET4.hostNext(); return; }
    M4.newGame(C.cfg);
    C.sel.clear(); C.seen = new Set(); C.cheatTurn = -1; AU.play('deal');
    refresh();
  }
  /* после каждого изменения: перерисовать и дать ход ботам */
  function refresh() {
    if (!C.on) return;
    if (C.mode === 'guest') { render(); return; }
    C.V = M4.viewFor(C.me);
    C.S = M4.fromView(C.V);
    render();
    if (C.mode === 'host') NET4.broadcast();
    scheduleBots();
  }
  const botAt = s => M4.M && M4.M.kinds[s] === 'bot';
  function scheduleBots() {
    clearTimeout(C.botT);
    const M = M4.M;
    if (!M || M.over != null || M.phase.who == null) return;
    const s = M.phase.who;
    scheduleUpgrade();
    if (M.kinds[s] !== 'bot') { if (C.mode === 'host') NET4.armTurn(s); return; }
    const t = C.tok;
    C.botT = setTimeout(() => {
      if (t !== C.tok || !M4.M || M4.M.over != null || M4.M.phase.who !== s) return;
      const MM = M4.M;
      maybeCheat(s);
      /* атакующий-бот может докинуть к своей атаке, пока другой бот думает над защитой */
      if (MM.phase.kind === 'defend') {
        const ob = M4.openBattle(MM);
        if (ob && ob.by !== s && botAt(ob.by) && Math.random() < 0.3) {
          const u = BOT4.upgrade(MM, ob.by, MM.bots[ob.by]);
          if (u && M4.act(ob.by, 'upgrade', u).ok) { refresh(); return; }
        }
      }
      let [type, ns] = BOT4.decide(MM, s, MM.bots[s]);
      let r = M4.act(s, type, ns);
      if (!r.ok) r = M4.act(s, MM.phase.kind === 'defend' ? 'take' : 'pass', []);
      if (!r.ok && MM.phase.kind === 'attack') { const c = MM.hands[s].find(x => !x.action) || MM.hands[s][0]; if (c) M4.act(s, c.action ? 'action' : 'play', [c.n]); }
      refresh();
    }, M.phase.kind === 'throw' || M.phase.kind === 'addtake' ? 550 : 800);
  }
  /* бот-атакующий докидывает, пока думает живой защитник */
  function scheduleUpgrade() {
    clearTimeout(C.upT);
    const M = M4.M;
    if (!M || M.over != null || !M.rules.upgrade || M.upgraded || M.phase.kind !== 'defend' || botAt(M.phase.who)) return;
    const ob = M4.openBattle(M);
    if (!ob || !botAt(ob.by)) return;
    const t = C.tok, key = M.turnNo + '|' + M.table.length;
    C.upT = setTimeout(() => {
      const MM = M4.M;
      if (t !== C.tok || !MM || MM.over != null || MM.upgraded || key !== MM.turnNo + '|' + MM.table.length) return;
      const ob2 = M4.openBattle(MM);
      if (!ob2 || ob2.by !== ob.by) return;
      const u = BOT4.upgrade(MM, ob.by, MM.bots[ob.by]);
      if (u && M4.act(ob.by, 'upgrade', u).ok) refresh();
    }, 1300 + Math.random() * 900);
  }

  /* ---------- «Поймай шулера!» (только с ботами) ---------- */
  function maybeCheat(s) {
    const M = M4.M;
    if (C.mode !== 'bots' || !M || !M.bots[s] || M.bots[s].ai !== 'sharper' || M.bots[s].id !== 'sharper') return;
    if (C.cheatTurn === M.turnNo) return;
    C.cheatTurn = M.turnNo;
    if (Math.random() < 0.5) { const info = M4.cheatSwap(s); if (info) { showCheat(s, info); return; } }
    if (Math.random() < 0.4) showCheat(s, null);
  }
  function showCheat(s, info) {
    closeCheat();
    const box = document.querySelector(`#m4opps [data-seat="${s}"]`);
    if (box) { box.classList.remove('flick'); void box.offsetWidth; box.classList.add('flick'); setTimeout(() => box.classList.remove('flick'), 1600); }
    if (info) { const d = $4('m4deck'); d.classList.remove('twitch'); void d.offsetWidth; d.classList.add('twitch'); setTimeout(() => d.classList.remove('twitch'), 900); }
    const left = M4.CALLS - (M4.M.calls || 0);
    if (left <= 0) return;
    C.cheat = { s, info, tok: C.tok };
    const b = $4('m4cheat');
    b.innerHTML = `🕵️ ШУЛЕР! <small style="font-size:.55em;opacity:.8">×${left}</small><i></i>`;
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    C.cheatT = setTimeout(closeCheat, 1700);
  }
  function closeCheat() { C.cheat = null; clearTimeout(C.cheatT); const b = $4('m4cheat'); if (b) b.classList.remove('on'); }
  function accuse() {
    const o = C.cheat;
    closeCheat();
    if (!o || o.tok !== C.tok || !M4.M || M4.M.over != null) return;
    const r = M4.accuse(C.me, o.s, o.info);
    if (!r.ok) return;
    if (r.caught) { AU.play('win'); voice(o.s, 'caught', true); } else { AU.play('lose'); voice(o.s, 'falsecall', true); }
    refresh();
  }

  /* ---------- голоса ботов ---------- */
  function voice(s, ev, force) {
    const f = C.faces[s];
    if (!f || !C.V || C.V.kinds[s] !== 'bot' || typeof VOICES === 'undefined') return;
    const list = VOICES[f.id] && VOICES[f.id][ev];
    if (!list || !list.length) return;
    const now = Date.now();
    if (!force && (now - C.voiceAt < 4000 || Math.random() > 0.45)) return;
    C.voiceAt = now;
    const p = list[Math.floor(Math.random() * list.length)];
    const rude = typeof rudeOn === 'function' && rudeOn();
    C.say[s] = { t: Array.isArray(p) ? p[rude ? 1 : 0] : p, until: now + 2800 };
    setTimeout(() => { if (C.on) renderOpps(); }, 2900);
    if (C.V) renderOpps();
  }
  function voiceFor(V) {
    const e = V.ev;
    if (!e) return;
    const me = C.me, bot = s => s != null && V.kinds[s] === 'bot';
    if (e.kind === 'trump') { const bs = [...Array(V.N).keys()].filter(bot); if (bs.length) voice(bs[Math.floor(Math.random() * bs.length)], 'start', Math.random() < 0.8); return; }
    if (e.what === 'mognul') {
      if (bot(e.actor) && e.target === me) voice(e.actor, 'mognulYou', Math.random() < 0.7);
      else if (e.actor === me && bot(e.target)) voice(e.target, 'mognulMe', Math.random() < 0.7);
      return;
    }
    if (e.what === 'over') {
      if (V.winner != null && bot(V.winner) && V.over === me) voice(V.winner, 'win', true);
      else if (bot(V.over)) voice(V.over, 'lose', true);
      return;
    }
    if (!bot(e.actor)) return;
    if (e.what === 'cover') voice(e.actor, 'cover');
    else if (e.what === 'take') voice(e.actor, 'take');
    else if (e.what === 'transfer') voice(e.actor, 'transfer');
    else if (e.what === 'charge') voice(e.actor, 'charge');
  }

  /* ---------- действия игрока ---------- */
  const selCards = () => (C.S ? C.S.hand.filter(c => C.sel.has(c.n)) : []);
  /* можно ли сейчас докинуть к своей атаке */
  function canUp() {
    const S = C.S;
    if (!S || !S.rules || !S.rules.upgrade || S.over != null || C.pending || S.upgraded || S.phase.kind !== 'defend' || S.phase.who === C.me) return false;
    const ob = M4.openBattle(S);
    return !!(ob && ob.by === C.me);
  }
  function toggle(n) {
    if (!C.S || (C.S.phase.who !== C.me && !canUp())) return;
    if (C.sel.has(n)) C.sel.delete(n); else if (C.sel.size < 5) C.sel.add(n);
    AU.play('select'); render();
  }
  function doAct(a) {
    if (a === 'new') { nextGame(); return; }
    if (a === 'exit') { exit(); return; }
    if (a === 'none') return;
    const ns = (a === 'play' || a === 'transfer' || a === 'action' || a === 'upgrade') ? selCards().map(c => c.n) : [];
    if (C.mode === 'guest') { NET4.sendAct(a, ns); C.sel.clear(); C.pending = true; render(); setTimeout(() => { if (C.pending) { C.pending = false; render(); } }, 4000); return; }
    const r = M4.act(C.me, a, ns);
    if (!r.ok) { if (r.why) toast(r.why); return; }
    C.sel.clear();
    refresh();
  }
  function pickOffer(k) {
    if (C.mode === 'guest') { NET4.sendAct('pick', [], k); C.offerLater = false; $4('m4offer').innerHTML = ''; return; }
    if (M4.act(C.me, 'pick', [], k).ok) { AU.play('action'); refresh(); }
  }
  function nextPick() {
    if (!C.S) return;
    const up = canUp();
    if (C.S.phase.who !== C.me && !up) return;
    const sig = (up ? 'u' : C.S.phase.kind) + '|' + C.S.hand.map(c => c.n).join() + '|' + C.S.table.length + '|' + (C.S.turnNo || 0);
    if (!C.pick || C.pick.sig !== sig) {
      let opts;
      if (up) {
        const h = C.S.hand.filter(c => !c.action); opts = [];
        for (let i = 0; i < h.length; i++) for (let j = i; j < h.length; j++) {
          const cs = i === j ? [h[i]] : [h[i], h[j]], r = M4.checkUpgrade(C.S, C.me, cs);
          if (r.ok) opts.push({ ...r, e: { ...r.e, cards: cs, n: cs.length } });
        }
      } else opts = M4.options(C.S, C.me, C.S.hand);
      const pre = cs => cs.some(c => c.joker || c.s === C.S.T);
      const cost = cs => cs.reduce((n, c) => n + (c.joker ? 30 : c.r + (c.s === C.S.T ? 14 : 0)), 0);
      opts.sort((x, y) => (pre(x.e.cards) - pre(y.e.cards)) || (x.type === 'transfer') - (y.type === 'transfer') || cost(x.e.cards) / x.e.cards.length - cost(y.e.cards) / y.e.cards.length || y.e.cards.length - x.e.cards.length);
      C.pick = { sig, list: opts.slice(0, 40), i: -1 };
    }
    if (!C.pick.list.length) { toast(up ? 'Докинуть нечем' : C.S.phase.kind === 'defend' ? 'Нечем крыть — бери' : 'Нечего подкинуть — жми «Бито»'); return; }
    C.pick.i = (C.pick.i + 1) % C.pick.list.length;
    C.sel = new Set(C.pick.list[C.pick.i].e.cards.map(c => c.n));
    AU.play('select'); render();
  }

  /* ---------- отрисовка ---------- */
  const face = s => C.faces[s] || null;
  function ava(s) {
    const f = face(s), nm = (C.V.names[s] || '?');
    return `<span class="ava" style="background:${f ? f.color : '#3b6db8'}">${esc(f ? f.face : nm.slice(0, 2).toUpperCase())}</span>`;
  }
  function badge(s) {
    const V = C.V;
    if (V.out.includes(s)) return `<span class="m4badge out">${V.winner === s || V.out[0] === s ? 'вышел первым' : 'вышел'}</span>`;
    if (V.phase.kind === 'over') return '';
    if (s === V.def) return '<span class="m4badge def">кроется</span>';
    if (s === V.att) return '<span class="m4badge atk">ходит</span>';
    if (V.passed.includes(s)) return '<span class="m4badge pass">пас</span>';
    return '';
  }
  const dots = (w, to) => `<span class="m4dots">${'●'.repeat(Math.min(w, to))}<i>${'○'.repeat(Math.max(0, to - w))}</i></span>`;
  function pips(s) {
    const V = C.V;
    if (!V.rules || !V.rules.charge) return '';
    const n = V.charge[s] || 0, full = V.offers && V.offers[s];
    return `<span class="m4pips ${full ? 'full' : ''}">${[0, 1, 2].map(i => `<b class="${full || i < n ? 'on' : ''}"></b>`).join('')}</span>`;
  }
  const withT = f => M4.withCtx(C.S || C.V, f);
  function sortHand(h) {
    const T = C.V.T;
    return h.slice().sort(C.sort === 'r' ? (a, b) => (a.action - b.action) || a.r - b.r || a.s - b.s
      : (a, b) => (a.action - b.action) || (a.joker - b.joker) || ((a.s === T) - (b.s === T)) || a.s - b.s || a.r - b.r);
  }
  function renderOpps() {
    const V = C.V, me = C.me;
    if (!V) return;
    const opps = [];
    for (let i = 1; i < V.N; i++) opps.push((me + i) % V.N);
    const now = Date.now();
    $4('m4opps').innerHTML = opps.map(s => {
      const n = V.counts[s], who = V.phase.who === s, off = C.mode !== 'bots' && NET4.offline(s);
      const backs = withT(() => Array.from({ length: Math.min(n, 8) }, () => cardHTML({ id: 'x', n: -1 }, true)).join(''));
      const sy = C.say[s] && C.say[s].until > now ? `<div class="m4say">${esc(C.say[s].t)}</div>` : '';
      return `<div class="m4opp ${who ? 'who' : ''} ${V.out.includes(s) ? 'out' : ''}" data-seat="${s}"><div class="hd">${ava(s)}<span class="nm">${esc(V.names[s])}${off ? ' 📵' : ''}</span>${dots(V.wins[s], V.to)}</div>
        <div class="row"><span class="backs">${backs}</span><span class="cnt">${n} ${plural(n)}</span></div><div class="row">${badge(s) || '<span></span>'}${who && V.phase.kind !== 'over' ? '<span class="cnt">думает…</span>' : pips(s)}</div>${sy}</div>`;
    }).join('');
    if (Object.keys(C.emo).length) applyEmo();
  }
  function render() {
    const V = C.V;
    if (!C.on || !V) return;
    const snap = snap4();
    const S = C.S, me = C.me, myTurn = V.phase.who === me && !C.pending, up = canUp();
    $4('m4title').textContent = (C.mode === 'bots' ? 'КОМПАНИЯ' : 'СТОЛ ' + (NET4.code() || '').toUpperCase()) + ` · ${FMT[V.to] || ''} · партия ${V.games + (V.over != null ? 0 : 1)}`;
    renderOpps();
    /* стол */
    const nm = s => (s === me ? 'Ты' : esc(V.names[s]));
    const toMe = s => (s === me ? 'тебя' : esc(V.names[s]));
    $4('m4dir').innerHTML = V.phase.kind === 'over' ? 'Партия окончена' : `<b>${nm(V.att)}</b> → <b>${s2(V.def)}</b>${V.table.length ? ` · ${M4.atkCount(S)}/${V.limit}` : ''}`;
    function s2(s) { return s === me ? 'тебя' : esc(V.names[s]); }
    void toMe;
    const fresh = new Set();
    $4('m4bats').innerHTML = S.table.map(b => {
      const row = (e, cls) => `<div class="row ${cls}">${withT(() => e.cards.map(c => { const k = cls + c.n; const nw = !C.seen.has(k); fresh.add(k); return nw ? cardHTML(c).replace('class="card', 'class="card new') : cardHTML(c); }).join(''))}</div>`;
      return `<div class="m4b ${b.d ? '' : 'open'}"><span class="lbl">${esc(b.a.name)}${b.d ? ' → ' + esc(b.d.name) : ''}</span>${row(b.a, 'atk')}${b.d ? row(b.d, 'def') : ''}</div>`;
    }).join('') || `<div class="lbl" style="color:var(--muted);font-weight:700">${V.phase.kind === 'attack' ? (V.att === me ? 'Твой ход — выбери карты' : `${esc(V.names[V.att])} ходит…`) : ''}</div>`;
    C.seen = fresh;
    $4('m4grave').innerHTML = V.grave ? `бито<br>${V.grave}` : '';
    const trump = mkCard(V.trumpN);
    $4('m4deck').innerHTML = V.deckN ? `${withT(() => `<div class="tr">${cardHTML(trump)}</div>${cardHTML({ id: 'd', n: -1 }, true)}`)}<span>${V.deckN}</span>` : `<span class="suit">${SU[V.T]}</span><span>козырь</span>`;
    if (V.ev && V.ev.id !== C.lastEv) {
      C.lastEv = V.ev.id;
      const ev = $4('m4ev'); ev.textContent = V.ev.text; ev.classList.remove('on'); void ev.offsetWidth; ev.classList.add('on');
      C.log.push(V.ev.text); if (C.log.length > 12) C.log.shift();
      const k = V.ev.kind;
      if (k === 'atk') AU.play('place'); else if (k === 'def') { AU.play('place'); AU.play('cover'); } else if (k === 'take') AU.play('take');
      else if (k === 'bito') AU.play('bito'); else if (k === 'gold') AU.play('transfer');
      voiceFor(V); emoFor(V);
    }
    if (V.hype && V.hype.id !== C.lastHype) { C.lastHype = V.hype.id; showHype4(V.hype); }
    $4('m4log').innerHTML = `<div class="sc">${[...Array(V.N).keys()].map(s => `${s === me ? 'Ты' : esc(V.names[s])} ${V.wins[s]}`).join(' · ')} · ${FMT[V.to]}</div>` + C.log.slice(-7).map(t => `<div>${esc(t)}</div>`).join('');
    /* подсказка и кнопки */
    const cs = selCards(), k = V.phase.kind;
    const act1 = cs.length === 1 && cs[0].action ? cs[0] : null;
    let r = null;
    if (myTurn && cs.length) r = M4.check(S, me, cs);
    else if (up && cs.length) r = M4.checkUpgrade(S, me, cs);
    const tr = myTurn && k === 'defend' && cs.length && !act1 ? M4.checkTransfer(S, me, cs) : { ok: false };
    let tx = '', cls = '';
    if (V.over != null) tx = 'Партия окончена';
    else if (up && cs.length) { tx = r && r.ok ? `<b>${esc(r.why)}</b>` : esc((r && r.why) || 'Так атака не станет старше'); cls = r && r.ok ? 'gold' : 'no'; }
    else if (!myTurn) tx = C.pending ? 'Отправляем…' : `<b>${esc(V.names[V.phase.who] || '')}</b> думает…${up ? ' Можешь докинуть к своей атаке.' : ''}`;
    else if (act1) { tx = `<b>${esc(ACTS[act1.action].name)} ${SU[act1.s]}</b> — ${esc((r && r.why) || ACTS[act1.action].desc(SU[act1.s]))}`; cls = r && r.ok ? 'gold' : 'no'; }
    else if (cs.length) {
      const e = r && r.e ? r.e : M4.withCtx(S, () => ev(cs));
      tx = `${e ? '<b>' + esc(e.name) + '</b> — ' : ''}${esc((tr.ok && (!r || !r.ok || r.type === 'transfer')) ? tr.why : (r && r.why) || (e ? '' : 'не комбинация'))}`;
      cls = (r && r.ok) || tr.ok ? ((tr.ok && !(r && r.ok && r.type === 'play')) || (r && r.ok && r.why === 'Перекрытие!') ? 'gold' : 'ok') : 'no';
    } else {
      const ob = M4.openBattle(S), full = V.rules && V.rules.over;
      tx = k === 'attack' ? `Ходи на <b>${s2(V.def)}</b>: одиночкой или комбинацией, до ${Math.min(V.limit, V.counts[V.def])} карт.`
        : k === 'defend' ? `Крой <b>${esc(ob.a.name.toLowerCase())}</b> тем же числом карт и старше${full && ob.a.n >= 2 && ob.a.n < 5 ? ` (или перекрой ${ob.a.n + 1})` : ''}${V.N > 2 && V.rules.transfer ? ' — или переведи на ' + nm(M4.nextActive(S, me)) : ''}.`
        : k === 'throw' ? `Подкинь комбинацию с номиналом со стола — или «Бито».`
        : k === 'addtake' ? `<b>${nm(V.def)}</b> берёт — докинь вдогонку или «Хватит».` : '';
    }
    $4('m4tx').innerHTML = tx;
    $4('m4info').className = 'm4info ' + cls;
    const chg = V.rules && V.rules.charge ? `<button type="button" class="chg" id="m4chg">${pips(me)}${V.offer ? '<b style="color:var(--gold)">выбрать!</b>' : 'заряд'}</button>` : '';
    $4('m4me').innerHTML = `<span>Ты ${dots(V.wins[me], V.to)} · штраф ${V.pens[me]}</span><span class="badges">${chg}${badge(me)}<span>на руке ${V.hand.length}</span></span>`;
    /* рука */
    const hand = sortHand(S.hand);
    $4('m4hand').innerHTML = withT(() => hand.map((c, i) => `<div class="slot ${C.sel.has(c.n) ? 'sel' : ''}" data-s="${c.action ? 'a' : c.joker ? 'j' : c.s}" style="--i:${i}">${cardHTML(c)}</div>`).join(''));
    layoutHand();
    const B = (cls, a, label, en = true) => `<button class="btn ${cls}" type="button" data-a4="${a}" ${en ? '' : 'disabled'}>${label}</button>`;
    let main = B('ghost', 'none', 'Ждём…', false), alt = B('ghost', 'none', '—', false);
    if (myTurn && V.over == null) {
      const ok = !!(r && r.ok);
      if (act1) main = B('gold', 'action', 'Сыграть', ok);
      else if (k === 'attack') main = B('blue', 'play', 'Ходить', ok);
      if (k === 'defend') { if (!act1) main = tr.ok && !(ok && r.type === 'play') ? B('gold', 'transfer', 'Перевести') : B('blue', 'play', 'Покрыть', ok); alt = B('red', 'take', 'Беру'); }
      if (k === 'throw') { if (!act1) main = B('blue', 'play', 'Подкинуть', ok); alt = B('orange', 'pass', 'Бито'); }
      if (k === 'addtake') { if (!act1) main = B('blue', 'play', 'Вдогонку', ok); alt = B('grey', 'pass', 'Хватит'); }
    } else if (up && cs.length) main = B('gold', 'upgrade', 'Апгрейд', !!(r && r.ok));
    $4('m4alt').innerHTML = alt; $4('m4main').innerHTML = main;
    $4('m4pick').disabled = (!myTurn && !up) || V.over != null;
    $4('m4pick').textContent = C.pick && C.pick.i >= 0 && C.pick.list[C.pick.i] && C.pick.list[C.pick.i].e.cards.every(c => C.sel.has(c.n)) ? `⟳ ${C.pick.i + 1}/${C.pick.list.length}` : '⟳ Подбор';
    $4('m4sort').textContent = C.sort === 'r' ? 'Ранги' : 'Масти';
    renderOffer();
    renderOver();
    fly4(snap);
  }
  /* ---------- веер руки, полёт карт, эмоции портретов ---------- */
  function layoutHand() {
    const h = $4('m4hand');
    if (!h || h.hidden || !C.on || typeof TABLE === 'undefined') return;
    try { TABLE.fan(h, { spread: 0.92, ang: 4, arc: 1.6, dir: 1, grp: C.sort === 's' }); } catch (e) {}
  }
  const motionOff = () => { try { return (typeof reduced !== 'undefined' && reduced) || (typeof animK === 'function' && !animK()); } catch (e) { return false; } };
  function snap4() {
    const m = {};
    if (!C.on) return m;
    document.querySelectorAll('#m4 .card[data-id]').forEach(el => {
      if (el.closest('.m4deck,.m4opp')) return;
      const r = el.getBoundingClientRect();
      m[el.dataset.id] = { x: r.left + r.width / 2, y: r.top + r.height / 2, down: el.classList.contains('down') };
    });
    return m;
  }
  const suitOf4 = el => { const f = el.querySelector('.front'); const m = f && /\bs(\d)\b/.exec(f.className); return el.classList.contains('joker') ? 4 : (m ? +m[1] : 0); };
  function fly4(snap) {
    if (!C.on || motionOff() || typeof TABLE === 'undefined' || !TABLE.arcFly || $4('m4').hidden) return;
    const V = C.V, k = (typeof animK === 'function' ? animK() : 1) || 1;
    const dk = document.querySelector('#m4 .m4deck'), dr = dk && dk.getBoundingClientRect();
    const actor = V && V.ev && V.ev.actor != null ? V.ev.actor : null;
    const seat = actor != null && actor !== C.me ? document.querySelector(`#m4 .m4opp[data-seat="${actor}"]`) : null;
    const sr = seat && seat.getBoundingClientRect();
    let n = 0;
    document.querySelectorAll('#m4 .card[data-id]').forEach(el => {
      if (el.closest('.m4deck,.m4opp') || n > 14) return;
      const r = el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const o = snap[el.dataset.id], onTable = !!el.closest('.m4bats'), down = el.classList.contains('down');
      let dx, dy, from = false;
      if (o) { dx = o.x - cx; dy = o.y - cy; from = o.down; }
      else if (onTable && sr) { dx = sr.left + sr.width / 2 - cx; dy = sr.top + sr.height / 2 - cy; from = true; }
      else if (!onTable && dr) { dx = dr.left + dr.width / 2 - cx; dy = dr.top + dr.height / 2 - cy; from = true; }
      else return;
      const dist = Math.hypot(dx, dy);
      if (dist < 8 && from === down) return;
      n++;
      if (!onTable && o && dist < 90) {
        el.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 300 * k, easing: 'cubic-bezier(.2,.9,.25,1.08)' });
        return;
      }
      TABLE.arcFly(el, { dx, dy, fromDown: from, toDown: down, dur: 460 * k, delay: !o && !onTable ? Math.min(n, 8) * 50 : 0, land: onTable, rect: r, noShadow: !onTable });
      if (onTable) setTimeout(() => { try { VFX.land(cx, cy + r.height * 0.3, suitOf4(el), 1, r.width); } catch (e) {} }, Math.round(460 * 0.84 * k));
    });
  }
  /* эмоция портрета у места: переживает перерисовку мест */
  function seatEmote(s, e, ms) {
    if (s == null || s === C.me) return;
    C.emo[s] = { e, until: Date.now() + (ms || 1500) };
    applyEmo();
  }
  function applyEmo() {
    if (typeof PORTRAITS === 'undefined' || !PORTRAITS.emote) return;
    setTimeout(() => {
      const now = Date.now();
      Object.keys(C.emo).forEach(s => {
        const o = C.emo[s];
        if (o.until <= now) { delete C.emo[s]; return; }
        const el = document.querySelector(`#m4 .m4opp[data-seat="${s}"] svg.pt`);
        if (el) PORTRAITS.emote(el, o.e, o.until - now);
      });
    }, 0);
  }
  function emoFor(V) {
    const e = V.ev;
    if (!e) return;
    if (e.what === 'take') seatEmote(e.actor, 'angry', 1800);
    else if (e.what === 'cover' || e.what === 'transfer') seatEmote(e.actor, 'smug', 1400);
    else if (e.what === 'mognul') { seatEmote(e.actor, 'smug', 1900); seatEmote(e.target, 'shock', 1700); }
    else if (e.what === 'charge') seatEmote(e.actor, 'think', 1200);
    else if (e.what === 'over') { if (V.over !== 'draw' && V.over != null) seatEmote(V.over, 'angry', 3000); if (V.winner != null) seatEmote(V.winner, 'smug', 3000); }
  }
  /* хайп-фраза, если это про тебя */
  function showHype4(h) {
    const me = C.me;
    let mine = null;
    if (h.actor === me) mine = true; else if (h.target === me) mine = false;
    if (mine == null) return;
    const t = typeof hypeText === 'function' ? hypeText(h.key, mine) : '';
    if (!t) return;
    const el = $4('m4hype');
    el.textContent = t; el.className = 'm4hype' + (mine ? '' : ' bad');
    void el.offsetWidth; el.classList.add('on');
    if (h.key === 'mognul') { try { TABLE.slowmo(mine); } catch (e) {} }
    try { if (mine) VFX.burstFelt(9); } catch (e) {}
    try { buzz(mine ? 'big' : 'bad'); } catch (e) {}
    try { AU.play(mine ? 'hype' : 'hypeBad'); } catch (e) {}
  }
  /* выбор карты-действия за полный заряд */
  function renderOffer() {
    const V = C.V, el = $4('m4offer'), o = V && V.offer;
    if (!o || C.offerLater || V.over != null) { el.innerHTML = ''; return; }
    const key = o.kinds.join() + o.s;
    if (el.dataset.k === key && el.innerHTML) return;
    el.dataset.k = key;
    el.innerHTML = `<div class="m4offer"><div class="box"><h3>ЗАРЯД ПОЛНЫЙ!<br>ВЫБЕРИ КАРТУ</h3><div class="ch">${o.kinds.map(k => {
      const c = { action: k, s: o.s, id: 'o' + k, n: -1, r: 16 };
      return `<button type="button" data-pick4="${k}">${withT(() => cardHTML(c))}<span>${ACTS[k].name} ${SU[o.s]}</span><em>${esc(ACTS[k].desc(SU[o.s]))}</em></button>`;
    }).join('')}</div><button type="button" class="later" id="m4later">Выберу позже</button></div></div>`;
    try { AU.play('action'); } catch (e) {}
  }
  function renderOver() {
    const V = C.V, el = $4('m4over');
    if (V.over == null) { el.innerHTML = ''; C.overShown = null; return; }
    const me = C.me, lost = V.over === me, draw = V.over === 'draw', won = V.winner === me;
    if (C.overShown !== V.games) {
      C.overShown = V.games;
      AU.play(lost ? 'lose' : 'win');
      if ((won || (V.matchDone && V.matchWinner === me))) try { VFX.confetti(); } catch (e) {}
    }
    const order = [...Array(V.N).keys()].sort((a, b) => V.wins[b] - V.wins[a] || V.pens[a] - V.pens[b]);
    const rows = order.map(s => `<tr class="${s === V.over ? 'loser' : s === V.winner ? 'win' : ''}"><td><span class="who">${ava(s)}<span>${s === me ? 'Ты' : esc(V.names[s])}${s === V.over ? ' — дурак' : s === V.winner ? ' — вышел первым' : ''}</span></span></td><td class="w">${dots(V.wins[s], V.to)}</td><td class="p">штраф ${V.pens[s]}</td></tr>`).join('');
    const host = C.mode !== 'guest';
    let h, sub, deci = '';
    if (V.matchDone) {
      const wn = V.matchWinner;
      h = wn === me ? 'МАТЧ ТВОЙ!' : `МАТЧ: ${esc(V.names[wn])}`;
      sub = `${wn === me ? 'Ты' : esc(V.names[wn])} первым набрал ${V.to} ${V.to === 1 ? 'победу' : 'победы'}.`;
    } else {
      h = draw ? 'НИЧЬЯ' : won ? 'ВЫШЕЛ ПЕРВЫМ!' : lost ? 'ДУРАК!' : 'НЕ ДУРАК';
      sub = draw ? 'Все вышли одновременно — партия не в счёт.'
        : `${V.winner != null ? (won ? 'Победа в партии твоя.' : `Партию взял ${esc(V.names[V.winner])}.`) : ''} ${lost ? `У тебя осталось карт: +${V.pen} штрафа.` : V.over !== 'draw' ? `Дурак — ${esc(V.names[V.over])}: +${V.pen} штрафа.` : ''}`;
      const near = [...Array(V.N).keys()].filter(s => V.wins[s] === V.to - 1).length;
      if (V.to > 1 && near >= 2) deci = 'РЕШАЮЩАЯ!';
      else if (V.to > 1 && near === 1) deci = 'МАТЧ-БОЛЛ';
    }
    el.innerHTML = `<div class="m4over"><div class="box"><h2 class="${V.matchDone ? 'big' : ''}">${h}</h2>
      <p>${sub}</p><table>${rows}</table>${deci ? `<div class="deci">${deci}</div>` : ''}<p class="small" style="color:var(--muted);font-size:12px">Матч: ${FMT[V.to]} · ${V.set === 'full' ? 'полные правила' : 'классика'}</p>
      <div class="btns">${host ? `<button class="btn blue" type="button" data-a4="new">${V.matchDone ? 'Реванш' : deci === 'РЕШАЮЩАЯ!' ? 'Решающая партия' : 'Следующая партия'}</button>` : '<span style="color:var(--muted)">Ждём хозяина стола…</span>'}<button class="btn grey" type="button" data-a4="exit">${V.matchDone ? 'Меню' : 'Выйти'}</button></div></div></div>`;
  }

  /* ---------- окно выбора ---------- */
  function chips(name, list, cur) {
    return `<div class="m4chips" data-chip="${name}">${list.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(cur) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  }
  function setupHTML(o, online) {
    return `${chips('to', [[1, 'Одна партия'], [2, 'До 2 побед'], [3, 'До 3 побед']], o.to)}
      <h3>Правила</h3>${chips('set', [['classic', 'Классика'], ['full', 'Полные правила']], o.set)}
      <p class="small">${o.set === 'full' ? '«Могнул», заряд и карты-действия, перекрытие на одну карту больше, апгрейд своей атаки.' : 'Комбинации, подкидывание по номиналу и по типу, перевод.'}</p>
      ${online ? '' : `<h3>Особый гость</h3>${chips('sharper', [['0', 'Без шулера'], ['1', 'С шулером 🕵️']], o.sharper ? '1' : '0')}
      <p class="small">${o.sharper ? 'За столом Шулер: следи за его рукой и жми «ШУЛЕР!», когда он подтасовывает.' : 'Все соседи играют честно.'}</p>`}`;
  }
  function bindChips(root, o, rerender) {
    root.querySelectorAll('[data-chip] button').forEach(b => {
      b.onclick = e => {
        e.stopPropagation();
        const k = b.parentElement.dataset.chip, v = b.dataset.v;
        if (k === 'to') o.to = +v; else if (k === 'set') o.set = v; else if (k === 'sharper') o.sharper = v === '1';
        saveOpts(o); rerender();
      };
    });
  }
  function openSetup() {
    try {
      pauseDuo();
      const o = opts();
      sheet('page', `${head('Компания 3–4')}<div class="m4setup">
        <p>Дурак на троих или вчетвером, с комбинациями. Подкидывают все, кроме защитника, перевод — на следующего. В партии побеждает тот, кто первым вышел, дурак получает штраф.</p>
        <h3>Матч</h3>${setupHTML(o, false)}
        <h3>С ботами</h3>
        <div class="m4pick"><button class="btn blue" type="button" data-m4="b3">Втроём</button><button class="btn blue" type="button" data-m4="b4">Вчетвером</button></div>
        <h3>С друзьями онлайн</h3>
        ${T4.available() ? `<div class="m4pick"><button class="btn green" type="button" data-m4="h">Создать стол</button><button class="btn orange" type="button" data-m4="j">Войти по коду</button></div>
        <div class="joinrow"><input id="m4code" maxlength="4" placeholder="КОД" autocomplete="off" aria-label="Код стола компании"></div>`
        : '<p style="color:var(--muted)">Онлайн компанией — на сайте и в Telegram (@durocker_bot).</p>'}</div>`);
      bindChips($('pageIn'), o, openSetup);
      $('pageIn').onclick = e => {
        const b = e.target.closest('[data-m4]'); if (!b) return;
        const k = b.dataset.m4;
        if (k === 'b3') startBots(3); else if (k === 'b4') startBots(4);
        else if (k === 'h') NET4.host();
        else if (k === 'j') { const c = ($4('m4code').value || '').trim().toLowerCase(); if (!/^[a-z0-9]{4}$/.test(c)) { toast('Код — 4 символа'); return; } NET4.join(c); }
      };
    } catch (e) { console.error(e); }
  }

  /* ---------- встраивание в меню ---------- */
  function hook() {
    try { css(); } catch (e) {}
    if (typeof openMenu === 'function') {
      const _om = openMenu;
      openMenu = function () {
        const r = _om.apply(this, arguments);
        try {
          const g = document.querySelector('#menuIn .menugrid');
          if (g && !g.querySelector('[data-go="company"]')) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'mi'; b.dataset.go = 'company';
            b.innerHTML = `<b>Компания 3–4 👥</b><small>${C.on ? 'Вернуться за стол компании' : 'Дурак втроём и вчетвером'}</small>`;
            const after = g.querySelector('[data-go="online"]');
            if (after && after.nextSibling) g.insertBefore(b, after.nextSibling); else g.appendChild(b);
          }
          if (C.on && !g.querySelector('[data-go="company-exit"]')) {
            const b = document.createElement('button');
            b.type = 'button'; b.className = 'mi'; b.dataset.go = 'company-exit';
            b.innerHTML = '<b>Выйти из компании</b><small>Вернуться к игре вдвоём</small>';
            g.appendChild(b);
          }
        } catch (e) {}
        return r;
      };
    }
    if (typeof menuGo === 'function') {
      const _mg = menuGo;
      menuGo = function (k) {
        if (k === 'company') { try { closeSheets(); } catch (e) {} if (C.on) return; openSetup(); return; }
        if (k === 'company-exit') { try { closeSheets(); } catch (e) {} exit(); return; }
        /* любой другой режим из меню — выходим из компании */
        if (C.on && k !== 'rules' && k !== 'settings' && k !== 'coll' && k !== 'leaders' && k !== 'tutorial') exit(true);
        return _mg.apply(this, arguments);
      };
    }
    /* закрыли окно компании, так и не сев за стол — игра на двоих продолжается */
    if (typeof closeSheets === 'function') {
      const _cs = closeSheets;
      closeSheets = function () {
        const r = _cs.apply(this, arguments);
        try { if (!C.on && !(NET4.N)) resumeDuo(); } catch (e) {}
        return r;
      };
    }
    /* в онлайн-лобби на двоих — кнопка «компанией» */
    if (typeof renderLobby === 'function') {
      const _rl = renderLobby;
      renderLobby = function () {
        const r = _rl.apply(this, arguments);
        try {
          const L = $('lobbyIn');
          if (L && !NET && $('hostBtn') && !L.querySelector('#m4lobbyBtn')) {
            const b = document.createElement('button');
            b.type = 'button'; b.id = 'm4lobbyBtn'; b.className = 'btn green';
            b.textContent = '👥 Играть компанией (3–4)';
            b.onclick = () => { $('lobby').hidden = true; openSetup(); };
            $('hostBtn').insertAdjacentElement('afterend', b);
          }
        } catch (e) {}
        return r;
      };
    }
  }
  hook();

  return {
    C, enter, exit, render, refresh, startBots, openSetup, nextGame, opts, saveOpts, setupHTML, bindChips, personas, pauseDuo, resumeDuo, FMT,
    setView(V) { C.V = V; C.S = M4.fromView(V); C.pending = false; render(); },
    setFaces(f) { C.faces = f; },
    get on() { return C.on; },
  };
})();
