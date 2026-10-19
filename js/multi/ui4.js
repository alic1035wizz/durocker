/* ДурКер — «Компания»: стол на 3–4 игрока. Ты снизу, соперники сверху по часовой, стол по центру.
   Работает в трёх режимах: с ботами (движок у тебя), хозяин онлайн-стола (движок у тебя) и гость (движок у хозяина). */
'use strict';

const UI4 = (() => {
  const BOTNAMES = [
    { name: 'Дядя Валера', face: 'ДВ', color: '#d9a03c', ai: 'valera' },
    { name: 'Тётя Зина', face: 'З', color: '#b85b5b', ai: 'sharper' },
    { name: 'Студент', face: 'СТ', color: '#4f8fd8', ai: 'student' },
    { name: 'Пацан с района', face: 'П', color: '#5b8a8a', ai: 'valera' },
    { name: 'Дворник Михалыч', face: 'М', color: '#8a9a5b', ai: 'student' },
  ];
  const C = { on: false, mode: null, me: 0, V: null, S: null, sel: new Set(), sort: 'r', pick: null, lastEv: 0, botT: null, tok: 0, cfg: null, faces: [], seen: new Set() };
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
.m4opp .sc{font-family:var(--f-hard);font-size:9px;color:var(--gold)}
.m4opp .row{display:flex;align-items:center;justify-content:space-between;gap:4px}
.m4opp .backs{display:flex;height:22px;--w:15px;padding-left:5px}
.m4opp .backs .card{margin-left:-8px}
.m4opp .cnt{font-size:11px;color:var(--muted);white-space:nowrap}
.m4badge{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;border-radius:999px;padding:1px 6px;background:var(--grey);color:#fff;white-space:nowrap}
.m4badge.atk{background:var(--blue)}.m4badge.def{background:var(--red)}.m4badge.pass{background:#444}.m4badge.out{background:var(--green)}
.m4felt{--w:44px;position:relative;flex:1;min-height:150px;border-radius:22px;background:radial-gradient(ellipse at 50% 45%,var(--felt) 0%,var(--felt-deep) 80%);
  border:6px solid #5a3a1c;box-shadow:inset 0 0 40px rgba(0,0,0,.55),0 6px 0 rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;padding:28px 52px 14px 12px}
.m4dir{position:absolute;left:10px;right:56px;top:6px;text-align:center;font-weight:800;font-size:12px;color:var(--paper);text-shadow:1px 1px 0 #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.m4dir b{color:var(--gold)}
.m4bats{display:flex;flex-wrap:wrap;gap:10px 14px;justify-content:center;align-items:flex-start;max-height:100%;overflow:hidden}
.m4b{display:flex;flex-direction:column;align-items:center;gap:2px}
.m4b .lbl{font-size:10px;font-weight:700;background:rgba(0,0,0,.45);border-radius:6px;padding:0 5px;white-space:nowrap}
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
.m4info{display:flex;align-items:center;gap:8px;background:rgba(0,0,0,.4);border:2px solid var(--line);border-radius:10px;padding:6px 10px;min-height:42px;font-size:13px;line-height:1.3}
.m4info .tx{flex:1;min-width:0}
.m4info.ok{border-color:#2e9d5b}.m4info.no{border-color:#b3202a}.m4info.gold{border-color:var(--gold)}
.m4info b{color:var(--gold)}
.m4me{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted);padding:0 4px}
.m4me .badges{display:flex;gap:4px}
.m4hand{--w:62px;display:flex;justify-content:center;align-items:flex-end;height:104px;padding:0 6px;flex:none}
.m4hand .m4slot{position:relative;flex:none;transition:transform .15s;cursor:pointer;margin-left:calc(var(--w)*var(--ov,-.45))}
.m4hand .m4slot:first-child{margin-left:0}
.m4hand .m4slot.sel{transform:translateY(-18px)}
.m4hand .m4slot.sel .card .front{box-shadow:0 0 0 3px var(--gold),0 8px 12px rgba(0,0,0,.45)}
.m4hand .m4slot.can .card .front{box-shadow:0 0 0 2px #62c98a,0 6px 10px rgba(0,0,0,.4)}
.m4ctl{display:grid;grid-template-columns:1fr auto 1fr;gap:8px}
.m4ctl .btn{min-height:50px;font-size:16px}
.m4mid{display:flex;flex-direction:column;gap:4px;align-items:stretch;justify-content:center}
.m4mid button{border:none;border-radius:8px;font-weight:800;color:#fff;padding:6px 10px;font-size:13px;box-shadow:0 3px 0 rgba(0,0,0,.4)}
.m4mid .pk{background:var(--green)}
.m4mid .so{background:var(--orange);color:#3a2004;font-size:11px;padding:3px 8px}
.m4over{position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:16px}
.m4over .box{background:var(--sheet);border:2px solid rgba(234,181,75,.5);border-radius:16px;padding:16px;max-width:420px;width:100%;display:flex;flex-direction:column;gap:10px;text-align:center}
.m4over h2{font-family:var(--f-hard);font-size:16px;color:var(--gold);margin:0;line-height:1.5}
.m4over table{width:100%;border-collapse:collapse;font-size:14px}
.m4over td{padding:4px 6px;border-bottom:1px solid var(--line);text-align:left}
.m4over td:last-child{text-align:right;font-family:var(--f-hard);font-size:12px;color:var(--gold)}
.m4over tr.loser td{color:#ff8a7a}
.m4over .btns{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.m4over .btn{padding:12px 18px}
.m4lobby .seat{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:rgba(0,0,0,.25)}
.m4lobby .seat .ava{width:26px;height:26px;font-size:8px}
.m4lobby .seat.off{opacity:.5}
.m4pick{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.m4pick .btn{padding:14px 8px}
@media (orientation:landscape) and (max-height:520px){
  #m4{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);grid-template-rows:auto auto 1fr auto auto auto;column-gap:10px;row-gap:5px;padding-top:calc(6px + env(safe-area-inset-top,0px));padding-bottom:calc(6px + env(safe-area-inset-bottom,0px))}
  .m4top{grid-column:1/3}
  .m4opps{grid-column:1;grid-row:2}
  .m4felt{grid-column:1;grid-row:3/7;min-height:0;--w:38px}
  .m4info{grid-column:2;grid-row:2/4;align-self:start;font-size:12px}
  .m4me{grid-column:2;grid-row:4}
  .m4hand{grid-column:2;grid-row:5;--w:46px;height:76px}
  .m4ctl{grid-column:2;grid-row:6}
  .m4ctl .btn{min-height:42px;font-size:14px;padding:8px 4px}
  .m4opp{padding:3px 5px}.m4opp .backs{display:none}
}
@media (min-width:900px) and (min-height:521px){
  #m4{max-width:980px;margin:0 auto}
  .m4felt{--w:58px}.m4hand{--w:70px;height:120px}
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
          <div class="m4grave" id="m4grave"></div><div class="m4deck" id="m4deck"></div><div class="m4ev" id="m4ev"></div></div>
        <div class="m4info" id="m4info"><div class="tx" id="m4tx"></div></div>
        <div class="m4me" id="m4me"></div>
        <div class="m4hand" id="m4hand"></div>
        <div class="m4ctl"><div id="m4alt" class="ctl"></div><div class="m4mid"><button type="button" class="pk" id="m4pick">⟳ Подбор</button><button type="button" class="so" id="m4sort">Ранг</button></div><div id="m4main" class="ctl"></div></div>
        <div id="m4over"></div>`;
      document.body.appendChild(el);
      $4('m4hand').addEventListener('click', e => { const c = e.target.closest('.card'); if (c) toggle(+c.dataset.id.slice(1)); });
      el.addEventListener('click', e => { const b = e.target.closest('[data-a4]'); if (b && !b.disabled) doAct(b.dataset.a4); });
      $4('m4pick').onclick = nextPick;
      $4('m4sort').onclick = () => { C.sort = C.sort === 'r' ? 's' : 'r'; render(); };
      $4('m4exit').onclick = () => exit();
      $4('m4menu').onclick = () => { try { openMenu(); } catch (e) {} };
    }
    return el;
  }

  /* ---------- вход и выход ---------- */
  function freezeDuo() {
    try { TOK++; } catch (e) {}
    try { clearTimeout(turnTimer); } catch (e) {}
    try { if (G) { G.deadline = 0; G.busy = true; } } catch (e) {}
    try { if (NET) { TR.close(); NET = null; } } catch (e) {}
  }
  function enter(mode, me) {
    mount(); freezeDuo();
    C.on = true; C.mode = mode; C.me = me || 0; C.sel = new Set(); C.pick = null; C.lastEv = 0; C.seen = new Set(); C.tok++;
    $4('m4').hidden = false;
    document.documentElement.classList.add('m4on');
    try { closeSheets(); } catch (e) {}
  }
  function exit(silent) {
    if (!C.on) return;
    C.on = false; C.tok++; clearTimeout(C.botT);
    try { NET4.leave(); } catch (e) {}
    $4('m4').hidden = true;
    document.documentElement.classList.remove('m4on');
    if (!silent) { try { G = null; newGame(); } catch (e) {} }
  }

  /* ---------- игра с ботами ---------- */
  function startBots(N) {
    const bots = BOTNAMES.slice().sort(() => Math.random() - 0.5).slice(0, N - 1);
    C.cfg = { N, names: [myNick(), ...bots.map(b => b.name)], kinds: ['me', ...bots.map(() => 'bot')], bots: [null, ...bots], series: Array(N).fill(0), games: 0 };
    C.faces = [null, ...bots];
    enter('bots', 0);
    M4.newGame(C.cfg);
    AU.play('deal');
    refresh();
  }
  function nextGame() {
    const M = M4.M;
    if (!M) return;
    const done = M.seriesDone;
    C.cfg.series = done ? Array(M.N).fill(0) : M.series.slice();
    C.cfg.games = done ? 0 : M.games;
    if (C.mode === 'host') { NET4.hostNext(); return; }
    M4.newGame(C.cfg);
    C.sel.clear(); C.seen = new Set(); AU.play('deal');
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
  function scheduleBots() {
    clearTimeout(C.botT);
    const M = M4.M;
    if (!M || M.over != null || M.phase.who == null) return;
    const s = M.phase.who;
    if (M.kinds[s] !== 'bot') { if (C.mode === 'host') NET4.armTurn(s); return; }
    const t = C.tok;
    C.botT = setTimeout(() => {
      if (t !== C.tok || !M4.M || M4.M.over != null || M4.M.phase.who !== s) return;
      let [type, ns] = BOT4.decide(M4.M, s, M4.M.bots[s]);
      let r = M4.act(s, type, ns);
      if (!r.ok) r = M4.act(s, M4.M.phase.kind === 'defend' ? 'take' : 'pass', []);
      if (!r.ok && M4.M.phase.kind === 'attack') M4.act(s, 'play', [M4.M.hands[s][0].n]);
      refresh();
    }, M.phase.kind === 'throw' || M.phase.kind === 'addtake' ? 550 : 800);
  }

  /* ---------- действия игрока ---------- */
  const selCards = () => (C.S ? C.S.hand.filter(c => C.sel.has(c.n)) : []);
  function toggle(n) {
    if (!C.S || C.S.phase.who !== C.me) return;
    if (C.sel.has(n)) C.sel.delete(n); else if (C.sel.size < 5) C.sel.add(n);
    AU.play('select'); render();
  }
  function doAct(a) {
    if (a === 'new') { nextGame(); return; }
    if (a === 'exit') { exit(); return; }
    if (a === 'none') return;
    const ns = (a === 'play' || a === 'transfer') ? selCards().map(c => c.n) : [];
    if (C.mode === 'guest') { NET4.sendAct(a, ns); C.sel.clear(); C.pending = true; render(); return; }
    const r = M4.act(C.me, a, ns);
    if (!r.ok) { if (r.why) toast(r.why); return; }
    C.sel.clear();
    refresh();
  }
  function nextPick() {
    if (!C.S || C.S.phase.who !== C.me) return;
    const sig = C.S.phase.kind + '|' + C.S.hand.map(c => c.n).join() + '|' + C.S.table.length + '|' + (C.S.turnNo || 0);
    if (!C.pick || C.pick.sig !== sig) {
      const opts = M4.options(C.S, C.me, C.S.hand);
      const pre = cs => cs.some(c => c.joker || c.s === C.S.T);
      const cost = cs => cs.reduce((n, c) => n + (c.joker ? 30 : c.r + (c.s === C.S.T ? 14 : 0)), 0);
      opts.sort((x, y) => (pre(x.e.cards) - pre(y.e.cards)) || (x.type === 'transfer') - (y.type === 'transfer') || cost(x.e.cards) / x.e.n - cost(y.e.cards) / y.e.n || y.e.n - x.e.n);
      C.pick = { sig, list: opts.slice(0, 40), i: -1 };
    }
    if (!C.pick.list.length) { toast(C.S.phase.kind === 'defend' ? 'Нечем крыть — бери' : 'Нечего подкинуть — жми «Бито»'); return; }
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
    if (V.out.includes(s)) return '<span class="m4badge out">вышел</span>';
    if (V.phase.kind === 'over') return '';
    if (s === V.def) return '<span class="m4badge def">кроется</span>';
    if (s === V.att) return '<span class="m4badge atk">ходит</span>';
    if (V.passed.includes(s)) return '<span class="m4badge pass">пас</span>';
    return '';
  }
  const withT = f => M4.withCtx(C.S || C.V, f);
  function sortHand(h) {
    const T = C.V.T;
    return h.slice().sort(C.sort === 'r' ? (a, b) => a.r - b.r || a.s - b.s
      : (a, b) => (a.joker - b.joker) || ((a.s === T) - (b.s === T)) || a.s - b.s || a.r - b.r);
  }
  function render() {
    const V = C.V;
    if (!C.on || !V) return;
    const S = C.S, me = C.me, myTurn = V.phase.who === me && !C.pending;
    $4('m4title').textContent = (C.mode === 'bots' ? 'КОМПАНИЯ' : 'СТОЛ ' + (NET4.code() || '').toUpperCase()) + ` · партия ${V.games + (V.over != null ? 0 : 1)}`;
    /* соперники по часовой */
    const opps = [];
    for (let i = 1; i < V.N; i++) opps.push((me + i) % V.N);
    $4('m4opps').innerHTML = opps.map(s => {
      const n = V.counts[s], who = V.phase.who === s, off = C.mode !== 'bots' && NET4.offline(s);
      const backs = withT(() => Array.from({ length: Math.min(n, 8) }, () => cardHTML({ id: 'x', n: -1 }, true)).join(''));
      return `<div class="m4opp ${who ? 'who' : ''} ${V.out.includes(s) ? 'out' : ''}"><div class="hd">${ava(s)}<span class="nm">${esc(V.names[s])}${off ? ' 📵' : ''}</span><span class="sc">${V.series[s]}</span></div>
        <div class="row"><span class="backs">${backs}</span><span class="cnt">${n} ${plural(n)}</span></div><div class="row">${badge(s) || '<span></span>'}${who && V.phase.kind !== 'over' ? '<span class="cnt">думает…</span>' : ''}</div></div>`;
    }).join('');
    /* стол */
    const nm = s => (s === me ? 'Ты' : esc(V.names[s]));
    $4('m4dir').innerHTML = V.phase.kind === 'over' ? 'Партия окончена' : `<b>${nm(V.att)}</b> → <b>${nm(V.def)}</b>${V.table.length ? ` · ${M4.atkCount(S)}/${V.limit}` : ''}`;
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
      const k = V.ev.kind;
      if (k === 'atk') AU.play('place'); else if (k === 'def') { AU.play('place'); AU.play('cover'); } else if (k === 'take') AU.play('take');
      else if (k === 'bito') AU.play('bito'); else if (k === 'gold') AU.play('transfer');
    }
    /* подсказка и кнопки */
    const cs = selCards(), k = V.phase.kind;
    let r = myTurn && cs.length ? M4.check(S, me, cs) : null;
    const tr = myTurn && k === 'defend' && cs.length ? M4.checkTransfer(S, me, cs) : { ok: false };
    let tx = '', cls = '';
    if (V.over != null) tx = 'Партия окончена';
    else if (!myTurn) tx = C.pending ? 'Отправляем…' : `<b>${esc(V.names[V.phase.who] || '')}</b> думает…`;
    else if (cs.length) {
      const e = r && r.e ? r.e : M4.withCtx(S, () => ev(cs));
      tx = `${e ? '<b>' + esc(e.name) + '</b> — ' : ''}${esc((tr.ok && (!r || !r.ok || r.type === 'transfer')) ? tr.why : (r && r.why) || (e ? '' : 'не комбинация'))}`;
      cls = (r && r.ok) || tr.ok ? (tr.ok && !(r && r.ok && r.type === 'play') ? 'gold' : 'ok') : 'no';
    } else {
      const ob = M4.openBattle(S);
      tx = k === 'attack' ? `Ходи на <b>${nm(V.def)}</b>: одиночкой или комбинацией, до ${Math.min(V.limit, V.counts[V.def])} карт.`
        : k === 'defend' ? `Крой <b>${esc(ob.a.name.toLowerCase())}</b> тем же числом карт и старше${V.N > 2 ? ' — или переведи на ' + nm(M4.nextActive(S, me)) : ''}.`
        : k === 'throw' ? `Подкинь комбинацию с номиналом со стола — или «Бито».`
        : k === 'addtake' ? `<b>${nm(V.def)}</b> берёт — докинь вдогонку или «Хватит».` : '';
    }
    $4('m4tx').innerHTML = tx;
    $4('m4info').className = 'm4info ' + cls;
    $4('m4me').innerHTML = `<span>${esc(myNick())} · штраф ${V.series[me]}/${M4.SERIES_TO}</span><span class="badges">${badge(me)}<span>на руке ${V.hand.length}</span></span>`;
    /* рука */
    const can = new Set();
    const hand = sortHand(S.hand);
    const n = hand.length, ov = n > 12 ? -.68 : n > 9 ? -.58 : n > 6 ? -.45 : -.2;
    $4('m4hand').style.setProperty('--ov', ov);
    $4('m4hand').innerHTML = withT(() => hand.map(c => `<div class="m4slot ${C.sel.has(c.n) ? 'sel' : ''} ${can.has(c.n) ? 'can' : ''}">${cardHTML(c)}</div>`).join(''));
    const B = (cls, a, label, en = true) => `<button class="btn ${cls}" type="button" data-a4="${a}" ${en ? '' : 'disabled'}>${label}</button>`;
    let main = B('ghost', 'none', 'Ждём…', false), alt = B('ghost', 'none', '—', false);
    if (myTurn && V.over == null) {
      const ok = !!(r && r.ok);
      if (k === 'attack') main = B('blue', 'play', 'Ходить', ok);
      if (k === 'defend') { main = tr.ok && !(ok && r.type === 'play') ? B('gold', 'transfer', 'Перевести') : B('blue', 'play', 'Покрыть', ok); alt = B('red', 'take', 'Беру'); }
      if (k === 'throw') { main = B('blue', 'play', 'Подкинуть', ok); alt = B('orange', 'pass', 'Бито'); }
      if (k === 'addtake') { main = B('blue', 'play', 'Вдогонку', ok); alt = B('grey', 'pass', 'Хватит'); }
    }
    $4('m4alt').innerHTML = alt; $4('m4main').innerHTML = main;
    $4('m4pick').disabled = !myTurn || V.over != null;
    $4('m4pick').textContent = C.pick && C.pick.i >= 0 && C.pick.list[C.pick.i] && C.pick.list[C.pick.i].e.cards.every(c => C.sel.has(c.n)) ? `⟳ ${C.pick.i + 1}/${C.pick.list.length}` : '⟳ Подбор';
    $4('m4sort').textContent = C.sort === 'r' ? 'Ранг' : 'Масть';
    renderOver();
  }
  function renderOver() {
    const V = C.V, el = $4('m4over');
    if (V.over == null) { el.innerHTML = ''; C.overShown = null; return; }
    const lost = V.over === C.me, draw = V.over === 'draw';
    if (C.overShown !== V.games) { C.overShown = V.games; AU.play(lost ? 'lose' : 'win'); if (!lost && !draw) try { VFX.confetti(); } catch (e) {} }
    const rows = [...Array(V.N).keys()].sort((a, b) => V.series[a] - V.series[b])
      .map(s => `<tr class="${s === V.over ? 'loser' : ''}"><td>${s === C.me ? 'Ты' : esc(V.names[s])}${s === V.over ? ' — дурак' : V.out.includes(s) ? '' : ''}</td><td>${V.series[s]}</td></tr>`).join('');
    const host = C.mode !== 'guest';
    el.innerHTML = `<div class="m4over"><div class="box"><h2>${draw ? 'НИЧЬЯ' : lost ? 'ДУРАК!' : 'НЕ ДУРАК!'}</h2>
      <p>${draw ? 'Все вышли одновременно.' : lost ? `У тебя осталось карт: +${V.pen} штрафа.` : `Дурак — ${esc(V.names[V.over])}: +${V.pen} штрафа.`}</p>
      <table>${rows}</table><p class="small" style="color:var(--muted);font-size:12px">Серия до ${M4.SERIES_TO} штрафных${V.seriesDone ? ' — окончена!' : ''}</p>
      <div class="btns">${host ? `<button class="btn blue" type="button" data-a4="new">${V.seriesDone ? 'Новая серия' : 'Ещё партия'}</button>` : '<span style="color:var(--muted)">Ждём хозяина стола…</span>'}<button class="btn grey" type="button" data-a4="exit">Выйти</button></div></div></div>`;
  }

  /* ---------- окно выбора ---------- */
  function openSetup() {
    try {
      sheet('page', `${head('Компания 3–4')}
        <p>Дурак на троих или вчетвером, с комбинациями. Правила — «Классика»: кроешь тем же числом карт и старше, подкидывают все, кроме защитника, перевод — на следующего.</p>
        <h3>С ботами</h3>
        <div class="m4pick"><button class="btn blue" type="button" data-m4="b3">Втроём</button><button class="btn blue" type="button" data-m4="b4">Вчетвером</button></div>
        <h3>С друзьями онлайн</h3>
        ${T4.available() ? `<div class="m4pick"><button class="btn green" type="button" data-m4="h">Создать стол</button><button class="btn orange" type="button" data-m4="j">Войти по коду</button></div>
        <div class="joinrow"><input id="m4code" maxlength="4" placeholder="КОД" autocomplete="off" aria-label="Код стола компании"></div>`
        : '<p style="color:var(--muted)">Онлайн компанией — на сайте и в Telegram (@durocker_bot).</p>'}`);
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
    C, enter, exit, render, refresh, startBots, openSetup, nextGame,
    setView(V) { C.V = V; C.S = M4.fromView(V); C.pending = false; render(); },
    setFaces(f) { C.faces = f; },
    get on() { return C.on; },
  };
})();
