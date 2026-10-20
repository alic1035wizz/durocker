/* Автотест: партии бот против бота на настоящем движке (rules/engine/bot/meta) в vm с заглушками DOM.
   Падает при любом REJECT/STUCK, при выходе винрейтов лестницы за границы и при решении бота дольше 400 мс на p99 (одиночные выбросы терпим до 1500 мс)
   (меряем процессорное время, чтобы нагрузка на CI-машине не давала ложных срабатываний).
   Запуск: node tests/sim.js [партий на пару, по умолчанию 500 всего]  (SIM_GAMES=100 для быстрой проверки) */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TOTAL = +process.env.SIM_GAMES || +process.argv[2] || 500;
const MAX_MS = 400;

const LS = {};
const el = () => ({ hidden: true, style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener() {}, appendChild() {}, querySelector: () => null, querySelectorAll: () => [] });
const sandbox = {
  console, process, setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON, Promise, Object, Array, Number, String, Map, Set, Symbol, Error,
  document: { getElementById: () => el(), querySelector: () => null, querySelectorAll: () => [], documentElement: { dataset: {}, classList: el().classList }, body: el(), createElement: el, addEventListener() {} },
  matchMedia: () => ({ matches: true, addEventListener() {} }),
  localStorage: { getItem: k => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); } },
  location: { search: '', hash: '' },
};
sandbox.window = sandbox; sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

const src = ['rules', 'engine', 'bot', 'meta'].map(f => fs.readFileSync(path.join(ROOT, 'js', f + '.js'), 'utf8')).join('\n').replace(/'use strict';/g, '');
const harness = `
function update(){} function sync(){} function showOver(){} function say(){} async function flyToGrave(){} function toast(){} function renderNet(){} function showReact(){}
function fx(o){o.id=++fxId;G.fx=o;(G.fxList=G.fxList||[]).push(o);}
wait=()=>Promise.resolve(); drive=function(){};
var __S=null, __TIMES={}, __FAIL=[];
function __swap(){[G.P,G.B]=[G.B,G.P];G.phase.who&&(G.phase.who=other(G.phase.who));G.attacker=other(G.attacker);[G.charge.p,G.charge.b]=[G.charge.b,G.charge.p];[G.offer.p,G.offer.b]=[G.offer.b,G.offer.p]}
function __timed(bot,f){const c0=process.cpuUsage();const r=f();const c1=process.cpuUsage(c0);const dt=(c1.user+c1.system)/1000;(__TIMES[bot.id]=__TIMES[bot.id]||[]).push(Math.round(dt*10)/10);return r}
function __tryUp(att,bot){const go=()=>{const cs=botUpgradePick(bot);if(cs&&!act('b','upgrade',cs)){__FAIL.push('REJECT upgrade');}};if(att==='b')go();else{__swap();try{go()}finally{__swap()}}}
async function __match(pBot,bBot,games){
  const res={p:0,b:0,draw:0};
  for(let g=0;g<games;g++){ newGame(); let guard=0,upTurn=-1;
    while(!G.over&&guard++<6000){ await new Promise(r=>setTimeout(r,0));
      if(G.offer.p){act('p','pick',G.offer.p.kinds[0]);}
      if(G.offer.b)botPick();
      if(G.busy||!G.phase.who)continue;
      const s=G.phase.who; let m;
      if(G.phase.kind==='defend'&&!G.upgraded&&upTurn!==G.turnNo+':'+atkCount()){upTurn=G.turnNo+':'+atkCount();__tryUp(other(s),s==='p'?bBot:pBot);if(__FAIL.length)return res;if(G.busy||!G.phase.who)continue;}
      if(s==='p'){__swap();try{m=__timed(pBot,()=>botDecide(pBot))}finally{__swap()}}else m=__timed(bBot,()=>botDecide(bBot));
      if(m[0]==='pass'){run(()=>endTurn(true));continue}
      if(!act(s,m[0],m[1])){__FAIL.push('REJECT '+s+' '+m[0]+' '+G.phase.kind);return res}
    }
    if(!G.over){__FAIL.push('STUCK game '+g);return res}
    res[G.over]++; SERIES={p:0,b:0,games:0,done:false};
  }
  return res;
}
async function __run(pairs){
  const B=id=>BOTS.find(b=>b.id===id)||CAREER_OPS.find(b=>b.id===id); const out=[];
  for(const [x,y,n] of pairs){ MODE={kind:'free'}; const r=await __match(B(x),B(y),n); out.push({x,y,n,r}); if(__FAIL.length)break; }
  return {out,times:__TIMES,fail:__FAIL};
}`;
vm.runInContext(src + harness, ctx, { filename: 'durocker-bundle.js' });

(async () => {
  /* лестница: Валера обыгрывает Студента, Шулер обыгрывает Валеру */
  const k = TOTAL / 500, n = x => Math.max(2, Math.round(x * k));
  const pairs = [['valera', 'student', n(250)], ['sharper', 'valera', n(150)], ['sharper', 'student', n(100)]];
  const t0 = Date.now();
  const { out, times, fail } = await vm.runInContext(`__run(${JSON.stringify(pairs)})`, ctx);
  const errs = fail.slice();
  let games = 0;
  const rate = {};
  for (const o of out) {
    const w = o.r.p + o.r.b; games += o.n; const pct = w ? 100 * o.r.p / w : 0;
    rate[o.x + '>' + o.y] = pct;
    console.log(`${o.x} vs ${o.y}: ${JSON.stringify(o.r)}  победы первого ${pct.toFixed(1)}%`);
  }
  const lim = (key, lo, hi, name) => { const v = rate[key]; if (v == null) return; if (v < lo || v > hi) errs.push(`${name}: ${v.toFixed(1)}% вне ${lo}–${hi}%`); };
  /* цели волны 7 (по партиям; тест не моделирует ловлю подлога): Валера/Студент 70–75, Шулер/Валера около 60, Шулер/Студент около 70 */
  lim('valera>student', 62, 82, 'Валера/Студент');
  lim('sharper>valera', 50, 72, 'Шулер/Валера');
  lim('sharper>student', 60, 85, 'Шулер/Студент');
  for (const id in times) {
    const a = times[id].slice().sort((p, q) => p - q), mx = a[a.length - 1];
    console.log(`процессорное время решения ${id}: n=${a.length} среднее ${(a.reduce((p, q) => p + q, 0) / a.length).toFixed(2)} мс, p95 ${a[Math.floor(a.length * .95)]} мс, макс ${mx} мс`);
    const p99 = a[Math.floor(a.length * .99)], over = a.filter(x => x > MAX_MS).length;
    if (over) console.log(`   ВНИМАНИЕ: ${id}: решений > ${MAX_MS} мс: ${over} из ${a.length}, p99 ${p99} мс`);
    if (p99 > MAX_MS) errs.push(`бот ${id}: p99 решения ${p99} мс (> ${MAX_MS})`);
    if (mx > 1500) errs.push(`бот ${id} думал ${mx} мс (> 1500)`);
  }
  console.log(`партий: ${games}, ${((Date.now() - t0) / 1000).toFixed(0)} с`);
  if (errs.length) { console.error('\nПРОВАЛ:\n - ' + errs.join('\n - ')); process.exit(1); }
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
