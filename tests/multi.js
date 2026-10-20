/* Автотест режима «компания» (3–4 игрока): 100 партий ботов на движке multi/engine4 + multi/bot4.
   Падает при отклонённом ходе, зависшей партии, потере карт (всегда 54) и решении бота дольше 400 мс на 99-м перцентиле / 1500 мс в одиночном выбросе (процессорное время). */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TOTAL = +process.env.SIM_GAMES || +process.argv[2] || 100;
const LS = {};
const sandbox = {
  console, process, setTimeout, clearTimeout, Date, Math, JSON, Promise, Object, Array, Number, String, Map, Set, Symbol, Error,
  document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: { dataset: {} } },
  matchMedia: () => ({ matches: true, addEventListener() {} }),
  localStorage: { getItem: k => (k in LS ? LS[k] : null), setItem: (k, v) => { LS[k] = String(v); } },
};
Object.assign(sandbox, require('./i18n-stub.js'));
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
const src = ['rules.js', 'multi/engine4.js', 'multi/bot4.js'].map(f => fs.readFileSync(path.join(ROOT, 'js', f), 'utf8')).join('\n').replace(/'use strict';/g, '');
vm.runInContext(src + `
function __run(N,games,lv){
  const res={turns:0,loser:Array(N).fill(0),draw:0,bad:0,stuck:0,acts:0,maxms:0,errs:[],all:[]};
  for(let g=0;g<games;g++){
    const bots=Array.from({length:N},(_,i)=>({ai:lv[i%lv.length]}));
    M4.newGame({N,names:bots.map((b,i)=>'B'+i),kinds:Array(N).fill('bot'),bots});
    let guard=0;
    while(M4.M.over==null&&guard++<3000){
      const S=M4.M,s=S.phase.who; const c0=process.cpuUsage();
      const [t,ns]=BOT4.decide(S,s,bots[s]); const c1=process.cpuUsage(c0); const ms=(c1.user+c1.system)/1000; res.maxms=Math.max(res.maxms,ms); res.all.push(ms);
      const r=M4.act(s,t,ns); res.acts++;
      if(!r.ok){res.bad++; if(res.errs.length<5)res.errs.push(t+' '+JSON.stringify(ns)+' '+S.phase.kind); break;}
      const tot=S.hands.reduce((n,h)=>n+h.length,0)+S.deck.length+S.grave+S.table.reduce((n,b)=>n+b.a.n+(b.d?b.d.n:0),0);
      if(tot!==54){res.errs.push('CARDS '+tot);res.bad++;break;}
    }
    if(res.bad)break;
    if(M4.M.over==null){res.stuck++;break}
    res.turns+=M4.M.turnNo; if(M4.M.over==='draw')res.draw++; else res.loser[M4.M.over]++;
  }
  res.turns=(res.turns/games).toFixed(1); return res;
}`, ctx, { filename: 'durocker-multi.js' });

const k = TOTAL / 100, n = x => Math.max(2, Math.round(x * k));
const sets = [[4, n(40), ['valera']], [3, n(30), ['valera']], [4, n(30), ['sharper', 'valera', 'student', 'valera']]];
const errs = []; let games = 0;
for (const [N, g, lv] of sets) {
  const r = vm.runInContext(`__run(${N},${g},${JSON.stringify(lv)})`, ctx);
  games += g; const a = r.all.sort((p, q) => p - q); console.log('   p50', a[a.length >> 1].toFixed(1), 'p99', a[Math.floor(a.length * .99)].toFixed(1), 'p99.9', a[Math.floor(a.length * .999)].toFixed(1), 'ms; >400мс:', a.filter(x => x > 400).length, 'из', a.length);
  console.log(`${N} игрока, боты ${lv.join('/')}: партий ${g}, ходов ${r.acts}, средняя длина ${r.turns}, проигравшие ${JSON.stringify(r.loser)}, ничьих ${r.draw}, макс. решение ${r.maxms.toFixed(1)} мс`);
  if (r.bad) errs.push(`${N} игрока: отклонён ход / потеря карт: ${r.errs.join('; ')}`);
  if (r.stuck) errs.push(`${N} игрока: партия зависла`);
  /* 99-й перцентиль обязан быть < 400 мс; единичные выбросы терпим до 1500 мс (в 4-местной игре они бывают у valera — см. README) */
  if (a[Math.floor(a.length * .99)] > 400) errs.push(`${N} игрока: p99 решения бота ${a[Math.floor(a.length * .99)].toFixed(0)} мс > 400`);
  if (r.maxms > 1500) errs.push(`${N} игрока: решение бота ${r.maxms.toFixed(0)} мс > 1500`);
  if (r.maxms > 400) console.log(`   ВНИМАНИЕ: выбросов > 400 мс: ${a.filter(x => x > 400).length}, максимум ${r.maxms.toFixed(0)} мс`);
}
console.log('партий:', games);
if (errs.length) { console.error('ПРОВАЛ:\n - ' + errs.join('\n - ')); process.exit(1); }
console.log('OK');
