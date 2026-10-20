/* ДурКер — расширенные достижения (волна 5). meta.js не трогаем: дописываем в ACHS и проверяем условия
   по итогам каждой партии (STATS.onRecord). Секретные скрывают описание до получения.
   Награды — рубашки (a-*, CSS в style.css), столы/музыка из meta.js и титулы (показываются в Профиле). */
'use strict';

(() => {
  [['a-wall', 'Каменная стена'], ['a-flush', 'Флеш-рояль'], ['a-detective', 'Детектив'], ['a-streak', 'Огонь серии'], ['a-veteran', 'Ветеран'], ['a-legend', 'Легенда']]
    .forEach(([id, name]) => { if (!BACKS.some(b => b.id === id)) BACKS.push({ id, name: t(name) }); });

  const T = () => STATS.st().tot, S = () => STATS.st();
  const modeN = k => (T().byMode[k] || { n: 0 }).n, modeW = k => (T().byMode[k] || { w: 0 }).w;
  const oppW = id => (T().byOpp[id] || { w: 0 }).w, oppN = id => (T().byOpp[id] || { n: 0 }).n;
  const typeN = t => T().types[t] || 0;
  const lastN = n => S().games.slice(-n);
  const cnt = (cur, max) => () => [cur(), max];

  /* ctx: r — запись партии, m — матч (если закончился), win — выиграна ли партия */
  const L = [
    /* серии и объём */
    ['g10', 'Новичок за столом', 'Сыграть 10 партий', 0, null, null, () => T().n >= 10, cnt(() => T().n, 10)],
    ['g100', 'Сто партий', 'Сыграть 100 партий', 0, { back: 'a-veteran' }, 'Ветеран стола', () => T().n >= 100, cnt(() => T().n, 100)],
    ['g500', 'Полтыщи партий', 'Сыграть 500 партий', 0, null, 'Не слезает со стола', () => T().n >= 500, cnt(() => T().n, 500)],
    ['w25', 'Четверть сотни', 'Выиграть 25 партий', 0, null, null, () => T().w >= 25, cnt(() => T().w, 25)],
    ['w100', 'Сотня побед', 'Выиграть 100 партий', 0, { back: 'a-legend' }, 'Сотник', () => T().w >= 100, cnt(() => T().w, 100)],
    ['st3', 'Тройка подряд', '3 победы подряд', 0, null, null, () => S().streak.best >= 3, cnt(() => S().streak.best, 3)],
    ['st5', 'Пятёрка подряд', '5 побед подряд', 0, null, null, () => S().streak.best >= 5, cnt(() => S().streak.best, 5)],
    ['st10', 'Десятка подряд', '10 побед подряд', 0, { back: 'a-streak' }, 'Неостановимый', () => S().streak.best >= 10, cnt(() => S().streak.best, 10)],
    ['st20', 'Неудержимый', '20 побед подряд', 1, null, 'Рок над столом', () => S().streak.best >= 20, cnt(() => S().streak.best, 20)],
    /* мастерство */
    ['clean_sh', 'Чистая игра', 'Выиграть у Шулера, ни разу не взяв', 0, { back: 'a-detective' }, null, c => c.win && c.r.ai === 'sharper' && c.r.takes === 0],
    ['mog_sf', 'Стрит-флеш на могнул', 'Могнуть, отбив стрит-флешем', 0, null, null, c => c.r.mogSF],
    ['pp3', 'Тройной пинг-понг', 'Перевести 3 раза за партию', 0, null, null, c => c.r.transfers >= 3],
    ['pp5', 'Вечный двигатель', 'Перевести 5 раз за партию', 1, null, null, c => c.r.transfers >= 5],
    ['joker_last', 'Джокер из рукава', 'Выиграть, сыграв джокера последним ходом', 1, null, 'Фартовый', c => c.win && c.r.jokerLast],
    ['catch1', 'Глаз-алмаз', 'Поймать шулера', 0, null, null, () => T().caught >= 1],
    ['catch2', 'Дважды пойман', 'Поймать шулера дважды за матч', 0, null, null, c => c.matchCaught >= 2],
    ['catch10', 'Детектив', 'Поймать шулера 10 раз', 0, null, 'Шерлок', () => T().caught >= 10, cnt(() => T().caught, 10)],
    ['five1', 'Отбить пятёрку', 'Отбить пятикарточную комбинацию', 0, null, null, () => T().five >= 1],
    ['five10', 'Каменная стена', 'Отбить пятёрку 10 раз', 0, { back: 'a-wall' }, 'Стена', () => T().five >= 10, cnt(() => T().five, 10)],
    ['mog50', 'Кладбищенский сторож', 'Могнуть 50 раз', 0, null, null, () => T().mog >= 50, cnt(() => T().mog, 50)],
    ['mog200', 'Могильщик-профи', 'Могнуть 200 раз', 0, null, 'Могильщик-профи', () => T().mog >= 200, cnt(() => T().mog, 200)],
    ['mog3', 'Тройной могнул', 'Могнуть 3 раза за одну партию', 0, null, null, c => c.r.mog >= 3],
    ['sf_play', 'Стрит-флеш', 'Сыграть стрит-флеш', 0, null, null, () => typeN(11) >= 1],
    ['sf10', 'Флеш-рояль', 'Сыграть стрит-флеш 10 раз', 0, { back: 'a-flush' }, null, () => typeN(11) >= 10, cnt(() => typeN(11), 10)],
    ['quad', 'Каре — не шутка', 'Сыграть каре 5 раз', 0, null, null, () => typeN(7) >= 5, cnt(() => typeN(7), 5)],
    ['full', 'Полный дом', 'Сыграть фулл-хаус 5 раз', 0, null, null, () => typeN(10) >= 5, cnt(() => typeN(10), 5)],
    ['dry8', 'Всухую до конца', 'Выиграть, не взяв ни разу', 0, null, null, c => c.win && c.r.takes === 0],
    ['dry12', 'Разгром', 'Выиграть со штрафом соперника 12+', 1, null, null, c => c.win && c.r.pen >= 12],
    ['fast', 'Быстрая рука', 'Выиграть партию не дольше чем за 6 ходов', 1, null, null, c => c.win && c.r.turns > 0 && c.r.turns <= 6],
    /* режимы */
    ['blitz_win', 'Блиц-боец', 'Выиграть партию в Блице', 0, null, null, c => c.win && c.r.blitz],
    ['blitz10', 'Секундомер', 'Выиграть Блиц, когда на часах меньше 10 секунд', 1, null, null, c => c.win && c.r.blitz && c.r.clock != null && c.r.clock < 10000],
    ['daily7', 'Неделя ежедневок', 'Сыграть 7 ежедневных раздач', 0, null, null, () => modeN('daily') >= 7, cnt(() => modeN('daily'), 7)],
    ['daily_w', 'Раздача дня', 'Выиграть ежедневную раздачу', 0, null, null, c => c.win && c.r.mode === 'daily'],
    ['weekly', 'Босс недели', 'Победить босса недели', 0, { track: 'night' }, null, c => c.win && c.r.mode === 'weekly'],
    ['career_flawless', 'Без поражений у боссов', 'Пройти карьеру, ни разу не проиграв боссам', 1, { table: 'gold' }, 'Чистый маршрут', () => prog().careerDone && T().bossLoss === 0],
    ['boss3', 'Охотник на боссов', 'Победить трёх разных боссов', 0, null, null, () => Object.keys(T().bossWins).length >= 3, cnt(() => Object.keys(T().bossWins).length, 3)],
    ['online1', 'Живая игра', 'Сыграть онлайн с человеком', 0, null, null, () => modeN('online') + modeN('quick') >= 1],
    ['online_w10', 'Гроза интернета', 'Выиграть 10 онлайн-партий', 0, null, 'Гроза сети', () => modeW('online') + modeW('quick') >= 10, cnt(() => modeW('online') + modeW('quick'), 10)],
    ['match5', 'Матчи — моё', 'Выиграть 5 матчей', 0, null, null, () => S().matches.filter(m => m.r === 'W').length >= 5, cnt(() => S().matches.filter(m => m.r === 'W').length, 5)],
    ['comeback', 'Камбэк', 'Выиграть матч, проиграв первую партию', 1, null, null, c => !!(c.m && c.m.r === 'W' && c.m.lostFirst)],
    /* особенные */
    ['night', 'Ночная смена', 'Выиграть партию между 3 и 5 утра', 1, null, null, c => c.win && c.r.hour >= 3 && c.r.hour < 5],
    ['turbo10', 'На форсаже', 'Сыграть 10 партий в турбо-режиме', 0, null, null, () => T().turbo >= 10, cnt(() => T().turbo, 10)],
    ['loser3', 'Закалка', 'Проиграть 3 партии подряд и не уйти', 1, null, null, () => lastN(3).length === 3 && lastN(3).every(g => g.res === 'l')],
    ['revenge', 'Реванш', 'Выиграть у соперника, которому проиграл прошлую партию', 0, null, null, c => { const g = S().games.slice(-2); return c.win && g.length === 2 && g[0].oppId === c.r.oppId && g[0].res === 'l'; }],
    ['sharper5', 'Гроза шулеров', 'Выиграть 5 партий у Шулера', 0, null, null, () => oppW('sharper') + oppW('c-sharper') >= 5, cnt(() => oppW('sharper') + oppW('c-sharper'), 5)],
    ['bot_all', 'Знаток', 'Сыграть против 8 разных соперников', 0, null, null, () => Object.keys(T().byOpp).length >= 8, cnt(() => Object.keys(T().byOpp).length, 8)],
    ['takes0match', 'Ни одной карты', 'Выиграть матч, ни разу не взяв', 1, null, 'Невозмутимый', c => !!(c.m && c.m.r === 'W' && c.matchTakes === 0)],
  ];

  const have = new Set(ACHS.map(a => a.id));
  const META = {};
  L.forEach(([id, name, desc, secret, reward, title, chk, progress]) => {
    if (have.has(id)) return;
    const a = { id, name: t(name), desc: t(desc), reward: reward || null, secret: !!secret, title: title ? t(title) : null, _chk: chk };
    if (progress) a.progress = progress;
    ACHS.push(a); META[id] = a;
  });

  window.ACH_TITLES = () => ACHS.filter(a => a.title && prog().ach[a.id]).map(a => a.title);

  /* ---------- попап ---------- */
  /* компактная всплывашка в общей очереди toast: «🏆 Название · награда» */
  function pop(a) {
    const extra = a.title ? ' · ' + t('титул «{title}»', { title: t(a.title) }) : a.reward ? ' · ' + t('награда') : '';
    toast(`🏆 ${t(a.name)}${extra}`, 2600, { ach: true });
  }

  /* ---------- проверка ---------- */
  function awardAll(ctx) {
    const p = prog();
    ACHS.forEach(a => {
      if (!a._chk || p.ach[a.id]) return;
      let ok = false;
      try { ok = !!a._chk(ctx); } catch (e) { console.error(a.id, e); }
      if (ok) { grant(a.id); pop(a); }
    });
  }

  let jokerLast = false;
  BUS.on('fx', d => {
    const o = d.o;
    try {
      if (o && o.actor === 'p' && ['attack', 'throw', 'defend', 'transfer'].includes(o.what) && G && G.table)
        jokerLast = G.table.some(x => (x.a && x.a.joker) || (x.d && x.d.joker));
      else if (o && o.what === 'trump') jokerLast = false;
    } catch (e) {}
  });

  STATS.onRecord((r, m, s) => {
    const n = (typeof SERIES !== 'undefined' && SERIES.games) || 1;
    const g = s.games.slice(-Math.max(1, n));
    r.jokerLast = jokerLast && r.res === 'w' && G && G.P && G.P.length === 0;
    if (m) { m.lostFirst = g.length > 1 && g[0].res === 'l'; }
    awardAll({ r, m, win: r.res === 'w', s, matchCaught: g.reduce((x, y) => x + (y.caught || 0), 0), matchTakes: g.reduce((x, y) => x + (y.takes || 0), 0) });
  });
  window.ACH_CHECK = () => awardAll({ r: {}, m: null, win: false, s: S(), matchCaught: 0, matchTakes: 1 });
})();
