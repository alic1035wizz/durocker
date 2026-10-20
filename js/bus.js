/* ДурКер — шина событий.
   Фичи подписываются на события (BUS.on) или ставят хуки (BUS.hook) вместо того, чтобы
   каждая сама переписывала глобальные функции. На каждую глобальную функцию шина ставит
   ровно одну обёртку, и ставит её лениво — при первой подписке или хуке на эту функцию.

   События (before — до оригинала, без суффикса — после):
     game:start:before / game:start   newGame             {mode, bot, series, rules, g}
     game:over:before  / game:over    onGameOver          {won, over, penalty, g, series, guest}
     match:over                       после game:over, если матч закончен {won, series, bot, g}
     over:before / over               showOver            то же, что game:over (экран итога)
     fx                               showFx (до)         {o, what, key, who}
     hype                             showHype (до)       {key, mine}
     say                              say (после)         {text, ms}
     cheat:seen                       cheatSeen (после)   подмену карты заметили
     snap:button                      snapButton (после)  появилась кнопка «Поделиться»
     turn                             startTurn (после)   {who}
     hud:render                       renderHUD (после)
     lobby:render                     renderLobby (после)
     bots:open                        openBots (после)
     menu:open:before / menu:open     openMenu
     menu:go                          menuGo (до)         {key}
     settings:open                    openSettings (после)
     collection:open:before / :open   openCollection
     rules:resolved                   tableRules (после)  {rules}
   Любой обработчик получает один объект-данные; в нём всегда есть args (аргументы вызова)
   и, для событий «после», ret (результат оригинала).

   BUS.hook(имя_функции, (next, args, th) => значение) — когда нужно ИЗМЕНИТЬ поведение
   или результат функции (currentBot, tableRules, matchTo, act...). Хук вызывает next()
   (можно next(новыеАргументы)), чтобы продолжить цепочку. Позже зарегистрированный хук —
   снаружи, как раньше с вложенными обёртками.
   BUS.menuKey('ключ', fn) — свой пункт меню: menuGo('ключ') вызовет fn и не пойдёт дальше.
   Ошибка в обработчике или хуке пишется в console.warn и игру не ломает. */
'use strict';
const BUS = (() => {
  const W = typeof window !== 'undefined' ? window : globalThis;
  const subs = Object.create(null), hooks = Object.create(null), keys = Object.create(null);
  const installed = Object.create(null), pending = Object.create(null);

  /* точка → [событие до, событие после] */
  const POINTS = {
    newGame: ['game:start:before', 'game:start'],
    onGameOver: ['game:over:before', 'game:over'],
    showOver: ['over:before', 'over'],
    showFx: ['fx', null],
    showHype: ['hype', null],
    say: [null, 'say'],
    cheatSeen: [null, 'cheat:seen'],
    snapButton: [null, 'snap:button'],
    startTurn: [null, 'turn'],
    renderHUD: [null, 'hud:render'],
    renderLobby: [null, 'lobby:render'],
    openBots: [null, 'bots:open'],
    openMenu: ['menu:open:before', 'menu:open'],
    menuGo: ['menu:go', null],
    openSettings: [null, 'settings:open'],
    openCollection: ['collection:open:before', 'collection:open'],
    tableRules: [null, 'rules:resolved']
  };
  const EVENT_POINT = Object.create(null);
  Object.keys(POINTS).forEach(p => POINTS[p].forEach((e, i) => { if (e) EVENT_POINT[e] = p; }));

  const safe = (f) => { try { return f(); } catch (e) { console.warn('[BUS]', e); } };
  /* глобальные let-переменные игры читаем прямо по имени (без eval — в песочнице он может быть закрыт) */
  const V = {
    G: () => (typeof G !== 'undefined' ? G : undefined),
    MODE: () => (typeof MODE !== 'undefined' ? MODE : undefined),
    SERIES: () => (typeof SERIES !== 'undefined' ? SERIES : undefined),
    NET: () => (typeof NET !== 'undefined' ? NET : undefined)
  };
  const g = (n) => V[n]();

  /* данные события */
  function dataFor(point, args, ret, after) {
    const d = { args, point };
    if (after) d.ret = ret;
    switch (point) {
      case 'newGame': safe(() => { d.mode = g('MODE'); d.series = g('SERIES'); d.g = g('G'); d.rules = d.g && d.g.rules; d.bot = typeof W.currentBot === 'function' ? W.currentBot() : undefined; }); break;
      case 'onGameOver': case 'showOver': safe(() => {
        const G = g('G'), NET = g('NET');
        d.g = G; d.series = g('SERIES'); d.over = G && G.over; d.won = !!G && G.over === 'p';
        d.penalty = G && G.penalty; d.guest = !!(NET && NET.role === 'guest');
      }); break;
      case 'showFx': { const o = args[0] || {}; d.o = o; d.what = o.what; d.key = o.key; d.who = o.actor; break; }
      case 'showHype': d.key = args[0]; d.mine = args[1]; break;
      case 'say': d.text = args[0]; d.ms = args[1]; break;
      case 'startTurn': d.who = args[0]; break;
      case 'menuGo': d.key = args[0]; break;
      case 'tableRules': d.rules = ret; break;
    }
    return d;
  }

  function emit(evt, data) {
    const l = subs[evt]; if (!l) return;
    l.slice().forEach(fn => safe(() => fn(data || {})));
  }

  /* цепочка хуков: последний зарегистрированный — снаружи */
  function run(name, th, args, orig) {
    const hs = hooks[name] || [];
    const call = (i, a) => {
      if (i < 0) return orig.apply(th, a);
      let called = false, res;
      try {
        return hs[i]((na) => { called = true; res = call(i - 1, na || a); return res; }, a, th);
      } catch (e) {
        console.warn('[BUS hook ' + name + ']', e);
        return called ? res : call(i - 1, a);
      }
    };
    return call(hs.length - 1, args);
  }

  function install(name) {
    if (installed[name]) return true;
    const orig = W[name];
    if (typeof orig !== 'function') { pending[name] = true; return false; }
    installed[name] = true; delete pending[name];
    const pt = POINTS[name] || [null, null];
    const w = function () {
      const th = this, args = arguments;
      if (pt[0]) emit(pt[0], dataFor(name, args, undefined, false));
      if (name === 'menuGo' && keys[args[0]]) { safe(() => keys[args[0]](args[0])); return; }
      const ret = run(name, th, args, orig);
      if (pt[1]) emit(pt[1], dataFor(name, args, ret, true));
      if (name === 'onGameOver') matchOver(args, ret);
      return ret;
    };
    w.__bus = true; w.__orig = orig;
    W[name] = w;
    return true;
  }

  /* матч закончен — после onGameOver, если серия завершена */
  function matchOver(args, ret) {
    if (!subs['match:over']) return;
    safe(() => {
      const S = g('SERIES'), G = g('G'), NET = g('NET');
      if (!S || !S.done || (NET && NET.role === 'guest')) return;
      const to = typeof W.seriesTo === 'function' ? W.seriesTo() : (S.to || 2);
      emit('match:over', { won: !!(S.w && S.w.p >= to), series: S, g: G, bot: typeof W.currentBot === 'function' ? W.currentBot() : undefined, args, ret });
    });
  }

  function on(evt, fn) {
    (subs[evt] || (subs[evt] = [])).push(fn);
    if (EVENT_POINT[evt]) install(EVENT_POINT[evt]);
    else if (evt === 'match:over') install('onGameOver');
    return fn;
  }
  function off(evt, fn) { const l = subs[evt]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } }
  function hook(name, fn) { (hooks[name] || (hooks[name] = [])).push(fn); install(name); return fn; }
  function menuKey(key, fn) { keys[key] = fn; install('menuGo'); }
  function flush() { Object.keys(pending).forEach(install); }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', flush);
    if (typeof window !== 'undefined') window.addEventListener('load', flush);
  }
  return { on, off, emit, hook, menuKey, flush, events: () => Object.keys(EVENT_POINT).concat('match:over'), _installed: installed, _subs: subs };
})();
