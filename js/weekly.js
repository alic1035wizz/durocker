/* Дурокер — босс недели и сезоны.
   Босс недели: каждый понедельник (00:00 по Москве) новое особое правило из восьми, по кругу. Бой — раз в день,
   победа даёт рубашку этой недели. Сами правила живут в движке (WEEKLY_RULES в engine.js, флаги G.rules.*),
   здесь — персонажи, окно, попытки и награды.
   Сезон — календарный месяц: сезонные очки копятся отдельно (как рейтинг лидеров) и обнуляются 1-го числа.
   Общая сезонная таблица — retained-сообщения durocker/lb1/s/<pid> на том же публичном брокере. */
'use strict';

const WEEKLY = (() => {
  const DAY = 86400000, WEEK = 7 * DAY, MSK = 3 * 3600000;
  const EPOCH = Date.UTC(2026, 9, 19); /* понедельник 19.10.2026, 00:00 по Москве — неделя №0 */
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const js = k => { try { return JSON.parse(rd(k)); } catch (e) { return null; } };
  const escH = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* восемь боссов — по одному на правило (порядок как в WEEKLY_RULES) */
  const BOSSES = [
    { id: 'w-roza', ai: 'valera', style: 'valera', name: 'Цыганка Роза', face: 'ЦР', color: '#c2185b',
      rule: 'Козырь меняется каждый ход', short: 'козырь каждый ход',
      desc: 'Перед каждым ходом Роза перетасовывает судьбу: козырем становится другая масть. Не копи козыри — завтра они никто.',
      back: { id: 'wk0', name: 'Цыганская шаль', css: 'radial-gradient(circle at 50% 50%,#ffd54a 0 12%,transparent 13%) 0 0/14px 14px,repeating-linear-gradient(45deg,#c2185b 0 6px,#7b0e3a 6px 12px)' } },
    { id: 'w-edik', ai: 'valera', style: 'dembel', name: 'Пижон Эдик', face: 'ЭД', color: '#00897b',
      rule: 'Только пары и крупнее', short: 'без одиночек',
      desc: 'Эдик одиночками брезгует: ходят минимум парой. Одиночкой — только если на руке нет ни одной комбинации.',
      back: { id: 'wk1', name: 'Пижонская', css: 'repeating-linear-gradient(90deg,#00897b 0 5px,#004d40 5px 10px),#004d40' } },
    { id: 'w-zhora', ai: 'sharper', style: 'lite', name: 'Клоун Жора', face: 'КЖ', color: '#f57c00',
      rule: '4 джокера в колоде', short: '4 джокера',
      desc: 'Жора докинул в колоду ещё двух джокеров. Сеты и фулл-хаусы растут как грибы — береги своих шутов.',
      back: { id: 'wk2', name: 'Цирк', css: 'repeating-conic-gradient(#f57c00 0 25%,#fff3e0 0 50%) 0 0/16px 16px' } },
    { id: 'w-gosha', ai: 'valera', style: 'torgash', name: 'Барыга Гоша', face: 'БГ', color: '#6d4c41',
      rule: 'Без перевода, но подкидывать можно одиночками', short: 'подкидывай одиночками',
      desc: 'У Гоши всё по мелочи: переводить нельзя, зато подкидывать можно любой картой с номиналом со стола.',
      back: { id: 'wk3', name: 'Барыжья', css: 'repeating-linear-gradient(0deg,#6d4c41 0 4px,#3e2723 4px 8px),repeating-linear-gradient(90deg,rgba(255,213,79,.35) 0 2px,transparent 2px 10px)' } },
    { id: 'w-stas', ai: 'valera', style: 'dembel', name: 'Качок Стас', face: 'КС', color: '#5e35b1',
      rule: 'Каждая отбитая атака — +1 заряда', short: 'заряд за каждую защиту',
      desc: 'Стас качает заряд: каждая отбитая атака даёт деление. Карты-действия летают в два раза чаще.',
      back: { id: 'wk4', name: 'Качалка', css: 'radial-gradient(circle at 50% 50%,#b39ddb 0 18%,transparent 19%) 0 0/12px 12px,#311b92' } },
    { id: 'w-luda', ai: 'valera', style: 'mihalych', name: 'Многодетная Люда', face: 'МЛ', color: '#e53935',
      rule: 'На руке 10 карт', short: 'рука 10 карт',
      desc: 'У Люды всего много: на руке по 10 карт, атаки длиннее, комбинаций больше — и брать тоже больнее.',
      back: { id: 'wk5', name: 'Семейная', css: 'repeating-linear-gradient(45deg,#e53935 0 4px,#fff 4px 6px,#1e88e5 6px 10px,#fff 10px 12px)' } },
    { id: 'w-petrovich', ai: 'sharper', style: 'lite', name: 'Прораб Петрович', face: 'ПП', color: '#fbc02d',
      rule: 'Перекрытие на любое число карт', short: 'перекрытие без лимита',
      desc: 'Петрович строит с запасом: на пару можно лечь хоть стритом, на сет — фулл-хаусом. Лишь бы тип старше.',
      back: { id: 'wk6', name: 'Стройка', css: 'repeating-linear-gradient(-45deg,#fbc02d 0 8px,#212121 8px 16px)' } },
    { id: 'w-prof', ai: 'sharper', style: 'lite', name: 'Профессор Козырев', face: 'ПК', color: '#455a64',
      rule: 'Козырей нет — козыри только джокеры', short: 'без козырей',
      desc: 'Профессор отменил козырную масть: решает только старшинство. Бить чужую масть могут лишь джокеры.',
      back: { id: 'wk7', name: 'Профессорская', css: 'repeating-linear-gradient(0deg,rgba(255,255,255,.12) 0 1px,transparent 1px 8px),repeating-linear-gradient(90deg,rgba(255,255,255,.12) 0 1px,transparent 1px 8px),#263238' } },
  ];

  /* ---------- время по Москве ---------- */
  const weekIdx = (now = Date.now()) => Math.floor((now + MSK - EPOCH) / WEEK);
  const ruleOf = w => ((w % BOSSES.length) + BOSSES.length) % BOSSES.length;
  const weekEnds = w => EPOCH + (w + 1) * WEEK - MSK;
  const today = () => (typeof todayKey === 'function' ? todayKey() : new Date(Date.now() + MSK).toISOString().slice(0, 10));
  const monthKey = (now = Date.now()) => new Date(now + MSK).toISOString().slice(0, 7);
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MONTHS_N = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const monthGen = k => MONTHS[+k.slice(5, 7) - 1];
  const prevMonth = k => { const y = +k.slice(0, 4), m = +k.slice(5, 7); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
  function left(ms) {
    if (ms <= 0) return 'вот-вот';
    const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
    return d ? `${d} д ${h} ч` : h ? `${h} ч ${m} мин` : `${m}:${String(s).padStart(2, '0')}`;
  }
  const boss = () => BOSSES[ruleOf(weekIdx())];

  /* ---------- попытки и награды ---------- */
  function state() { return Object.assign({ day: '', res: '', wins: {} }, js('durocker-weekly') || {}); }
  const saveState = s => wr('durocker-weekly', JSON.stringify(s));
  const usedToday = () => state().day === today();
  const wonThisWeek = () => !!state().wins[weekIdx()];

  /* рубашки недель — в общий список, стили — сюда */
  function looks() {
    try { BOSSES.forEach(b => { if (!BACKS.some(x => x.id === b.back.id)) BACKS.push({ id: b.back.id, name: b.back.name }); }); } catch (e) {}
    if (document.getElementById('wkcss')) return;
    const st = document.createElement('style');
    st.id = 'wkcss';
    st.textContent = BOSSES.map(b => `html[data-back="${b.back.id}"]{--backbg:${b.back.css}}`).join('\n') + `
.wkboss{display:grid;grid-template-columns:64px minmax(0,1fr);gap:12px;align-items:center;background:rgba(0,0,0,.3);border-radius:12px;padding:12px}
.wkava{width:64px;height:64px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-family:var(--f-hard,monospace);font-size:16px;color:#fff;box-shadow:0 4px 0 rgba(0,0,0,.4)}
.wkboss h3{margin:0 0 2px;font-size:17px}
.wkboss .wkrule{color:var(--gold,#eab54b);font-weight:800;font-size:15px;line-height:1.3}
.wkdesc{margin:0;font-size:14px;line-height:1.45;opacity:.9}
.wkmeta{display:grid;grid-template-columns:1fr 1fr;gap:6px;text-align:center}
.wkmeta div{background:rgba(0,0,0,.3);border-radius:8px;padding:7px 4px;min-width:0}
.wkmeta b{display:block;font-family:var(--f-hard,monospace);font-size:12px;color:var(--gold,#eab54b);line-height:1.7}
.wkmeta span{font-size:11px;opacity:.75}
.wkprize{display:flex;align-items:center;gap:12px;background:rgba(0,0,0,.25);border-radius:10px;padding:10px}
.wkback{width:42px;height:60px;border-radius:6px;border:3px solid #f8f1df;flex:none;box-shadow:0 3px 0 rgba(0,0,0,.4)}
.wkprize p{margin:0;font-size:13px;line-height:1.4}
.wkgo{width:100%;border:none;border-radius:10px;padding:14px;font-weight:900;font-size:17px;background:var(--red,#d9362f);color:#fff;box-shadow:0 4px 0 rgba(0,0,0,.45)}
.wkgo:disabled{background:var(--grey,#5b6d68);opacity:.8;box-shadow:none}
.wknote{font-size:12px;opacity:.7;text-align:center;margin:0}
.wkchamp{color:var(--gold,#eab54b);font-weight:800}
.mi.wk b{color:var(--gold,#eab54b)}
#pageIn .lbtabs{display:grid;gap:6px}
#pageIn .lbtabs button{background:rgba(255,255,255,.06);border:1px solid var(--line,rgba(255,255,255,.15));border-radius:8px;padding:8px 4px;font-weight:800;font-size:13px;color:inherit;min-width:0}
#pageIn .lbtabs button.on{background:var(--gold,#eab54b);color:#3a2306;border-color:transparent}
#pageIn .lblist{display:flex;flex-direction:column;gap:4px;margin:0;padding:0;list-style:none}
#pageIn .lbrow{display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:8px;background:rgba(0,0,0,.28);border-radius:8px;padding:7px 10px;font-size:14px}
#pageIn .lbrow .pl{font-family:var(--f-hard,monospace);font-size:11px;color:var(--gold,#eab54b);text-align:center}
#pageIn .lbrow .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
#pageIn .lbrow .nm small{display:block;font-weight:500;font-size:11px;opacity:.7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#pageIn .lbrow .sc{font-family:var(--f-hard,monospace);font-size:12px;text-align:right;white-space:nowrap}
#pageIn .lbrow.me{background:rgba(234,181,75,.22);outline:2px solid var(--gold,#eab54b)}
#pageIn .lbsep{text-align:center;opacity:.5;font-size:12px;margin:2px 0}
#pageIn .lbstatus{font-size:13px;opacity:.8;text-align:center}
`;
    document.head.appendChild(st);
  }

  /* ---------- сезон: очки за месяц ---------- */
  function worth(won) {
    if (!won) return 0;
    if (typeof NET !== 'undefined' && NET) return 5;
    if (MODE.kind === 'daily') return 3;
    let b = null; try { b = currentBot(); } catch (e) {}
    if (!b) return 1;
    if (b.boss === 'sharper') return 8;
    if (b.boss) return 5;
    return b.ai === 'sharper' ? 4 : b.ai === 'valera' ? 2 : 1;
  }
  function season() {
    const k = monthKey(), s = Object.assign({ k, r: 0, w: 0, g: 0, pk: '', pr: 0, ttl: '' }, js('durocker-season') || {});
    if (s.k !== k) {
      /* новый месяц: прошлый сезон уходит в историю, очки — с нуля */
      const old = s.k === prevMonth(k) ? { pk: s.k, pr: s.r } : { pk: s.pk, pr: s.pr };
      Object.assign(s, { k, r: 0, w: 0, g: 0 }, old);
      wr('durocker-season', JSON.stringify(s));
    }
    return s;
  }
  function seasonRecord(won) {
    const s = season();
    s.g++; if (won) { s.w++; s.r += worth(won); }
    wr('durocker-season', JSON.stringify(s));
    publishSoon();
  }

  /* ---------- связь (свой короткий канал, как у таблицы лидеров) ---------- */
  const ROOT = 'durocker/lb1/s/';
  const BROKERS = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const has = () => typeof window.mqtt === 'object' || typeof window.mqtt === 'function';
  function pid() {
    let v = rd('durocker-pid');
    if (!v || !/^[a-z0-9]{8,16}$/.test(v)) { v = Math.random().toString(36).slice(2, 12).padEnd(10, '0'); wr('durocker-pid', v); }
    return v;
  }
  const nick = () => ((typeof myNick === 'function' ? myNick() : rd('durocker-nick')) || 'Игрок').slice(0, 16);
  let cl = null, connecting = null, idleT = 0;
  function conn() {
    if (cl) return Promise.resolve(cl);
    if (!has()) return Promise.resolve(null);
    if (connecting) return connecting;
    connecting = new Promise(res => {
      let i = 0;
      const next = () => {
        if (i >= BROKERS.length) { connecting = null; res(null); return; }
        let c, ok = false;
        try { c = mqtt.connect(BROKERS[i++], { clientId: 'dkss_' + pid() + '_' + Math.random().toString(36).slice(2, 6), connectTimeout: 6000, reconnectPeriod: 0, clean: true, keepalive: 30 }); }
        catch (e) { next(); return; }
        const t = setTimeout(() => { if (!ok) { try { c.end(true); } catch (e) {} next(); } }, 7000);
        c.on('error', () => {});
        c.once('connect', () => { ok = true; clearTimeout(t); cl = c; connecting = null; res(c); });
      };
      next();
    });
    return connecting;
  }
  function idle(ms) { clearTimeout(idleT); idleT = setTimeout(() => { if (cl && !openNow) { try { cl.end(true); } catch (e) {} cl = null; } }, ms || 4000); }
  const mine = () => { const s = season(); return { n: nick(), k: s.k, r: s.r, w: s.w, g: s.g, pk: s.pk || '', pr: s.pr | 0, ttl: s.ttl || '', t: Date.now() }; };
  async function publish() {
    const c = await conn();
    if (!c) return false;
    try { c.publish(ROOT + pid(), JSON.stringify(mine()), { qos: 1, retain: true }); } catch (e) { return false; }
    idle(3000); return true;
  }
  let pubT = 0;
  function publishSoon() { clearTimeout(pubT); pubT = setTimeout(publish, 4000); }
  const int = (x, max) => Number.isInteger(x) && x >= 0 && x <= max;
  function clean(id, e) {
    if (!/^[a-z0-9]{8,16}$/.test(id) || !e || typeof e !== 'object') return null;
    if (typeof e.n !== 'string' || !/^\d{4}-\d\d$/.test(e.k) || !int(e.r, 1e6) || !int(e.w, 1e6) || !int(e.g, 1e6) || e.w > e.g) return null;
    if (typeof e.t !== 'number' || e.t < Date.now() - 70 * DAY || e.t > Date.now() + DAY) return null;
    const n = e.n.replace(/[\u0000-\u001f​-‏‪-‮]/g, '').trim().slice(0, 16) || 'Игрок';
    const pk = typeof e.pk === 'string' && /^\d{4}-\d\d$/.test(e.pk) ? e.pk : '';
    const ttl = typeof e.ttl === 'string' && /^Чемпион [а-я]+$/.test(e.ttl) ? e.ttl : '';
    return { id, n, k: e.k, r: e.r, w: e.w, g: e.g, pk, pr: pk && int(e.pr, 1e6) ? e.pr : 0, ttl, t: e.t };
  }
  async function fetchAll(ms) {
    const c = await conn();
    if (!c) return null;
    const got = new Map();
    const onMsg = (topic, payload) => {
      if (!topic.startsWith(ROOT) || got.size >= 300) return;
      let e; try { e = JSON.parse(payload.toString()); } catch (x) { return; }
      const r = clean(topic.slice(ROOT.length), e);
      if (r) got.set(r.id, r);
    };
    c.on('message', onMsg);
    try { c.subscribe(ROOT + '+', { qos: 0 }); } catch (e) {}
    await new Promise(r => setTimeout(r, ms || 2500));
    try { c.unsubscribe(ROOT + '+'); } catch (e) {}
    if (c.removeListener) c.removeListener('message', onMsg);
    return [...got.values()];
  }
  /* чемпион прошлого месяца: у кого больше очков за тот месяц (запись ещё старая — r, уже новая — pr) */
  function champion(list, pk) {
    let best = null;
    list.forEach(e => {
      const v = e.k === pk ? e.r : e.pk === pk ? e.pr : 0;
      if (v > 0 && (!best || v > best.v)) best = { id: e.id, n: e.n, v };
    });
    return best;
  }

  /* ---------- окно ---------- */
  let openNow = false, tab = 'boss', rows = null, status = '', tickT = 0;
  function render() {
    if (!openNow) return;
    const el = document.getElementById('pageIn');
    if (!el) return;
    const b = boss(), w = weekIdx(), st = state(), used = usedToday(), won = wonThisWeek();
    const tabs = `<div class="lbtabs" style="grid-template-columns:1fr 1fr" role="tablist">
      <button type="button" data-wktab="boss" class="${tab === 'boss' ? 'on' : ''}">Босс недели</button>
      <button type="button" data-wktab="season" class="${tab === 'season' ? 'on' : ''}">Сезон</button></div>`;
    let body = '';
    if (tab === 'boss') {
      const unlocked = (() => { try { return prog().unlocked.back.includes(b.back.id); } catch (e) { return false; } })();
      const btn = used ? (st.res === 'win' ? 'Сегодня — победа ✓. Завтра можно ещё раз' : 'Попытка на сегодня потрачена. Завтра — ещё одна')
        : won ? 'В бой (рубашка уже твоя)' : 'В бой!';
      body = `<div class="wkboss"><div class="wkava" style="background:${b.color}">${escH(b.face)}</div>
          <div><h3>${escH(b.name)}</h3><div class="wkrule">${escH(b.rule)}</div></div></div>
        <p class="wkdesc">${escH(b.desc)}</p>
        <div class="wkmeta"><div><b id="wkLeft">${left(weekEnds(w) - Date.now())}</b><span>до смены босса</span></div>
          <div><b>${used ? 'завтра' : '1 из 1'}</b><span>попытка сегодня</span></div></div>
        <div class="wkprize"><div class="wkback" style="background:${b.back.css}"></div>
          <p><b>Награда — рубашка «${escH(b.back.name)}»</b><br>${unlocked ? 'Уже в коллекции ✓' : 'Только на этой неделе. Победи босса один раз.'}</p></div>
        <button type="button" class="wkgo" id="wkGo" ${used ? 'disabled' : ''}>${btn}</button>
        <p class="wknote">Одна партия против босса, «Полные» правила + особое правило недели. Победа — 5 очков в рейтинг и сезон.</p>`;
    } else {
      const s = season(), my = { ...mine(), id: pid() };
      const all = new Map((rows || []).map(r => [r.id, r])); all.set(my.id, my);
      const list = [...all.values()];
      const cur = list.filter(e => e.k === s.k && (e.r > 0 || e.id === my.id)).sort((a, b) => b.r - a.r || b.w - a.w || a.g - b.g);
      const pk = prevMonth(s.k), ch = champion(list, pk);
      const ttlOf = e => (ch && ch.id === e.id ? `Чемпион ${monthGen(pk)}` : e.ttl || '');
      const place = cur.findIndex(e => e.id === my.id) + 1;
      const endsIn = Date.UTC(+s.k.slice(0, 4), +s.k.slice(5, 7), 1) - MSK - Date.now();
      const row = (e, i) => {
        const t = ttlOf(e);
        return `<li class="lbrow${e.id === my.id ? ' me' : ''}${i < 3 ? ' top' + (i + 1) : ''}"><span class="pl">${['🥇', '🥈', '🥉'][i] || i + 1}</span>
          <span class="nm">${escH(e.n)}${e.id === my.id ? ' (ты)' : ''}<small>${t ? `<span class="wkchamp">👑 ${escH(t)}</span> · ` : ''}побед ${e.w} из ${e.g}</small></span><span class="sc">${e.r}</span></li>`;
      };
      const top = cur.slice(0, 50);
      body = `<div class="wkmeta"><div><b>${MONTHS_N[+s.k.slice(5, 7) - 1]}</b><span>сезон · ещё ${left(endsIn)}</span></div>
          <div><b>${s.r} · ${place || '—'} место</b><span>твои очки</span></div></div>
        ${ch ? `<p class="wknote">👑 Чемпион ${monthGen(pk)}: <b class="wkchamp">${escH(ch.n)}</b> (${ch.v} очков)</p>` : ''}
        ${has() || (typeof CLOUD !== 'undefined' && CLOUD.on()) ? (status ? `<p class="lbstatus">${escH(status)}</p>` : '') : '<p class="lbstatus">Общий сезон виден на сайте и в Telegram (@durocker_bot). Здесь — только твои очки.</p>'}
        ${top.length ? `<ol class="lblist">${top.map(row).join('')}</ol>` : '<p class="lbstatus">В этом сезоне ещё никто не побеждал.</p>'}
        ${place > 50 ? `<div class="lbsep">…</div><ol class="lblist">${row(cur[place - 1], place - 1)}</ol>` : ''}
        <p class="wknote">Очки сезона — как в рейтинге, но с нуля каждый месяц. Лучший за месяц получает титул «Чемпион ${monthGen(s.k)}».</p>`;
      /* сам чемпион прошлого месяца — сохраняем титул в свою запись */
      if (ch && ch.id === my.id && s.ttl !== `Чемпион ${monthGen(pk)}`) { s.ttl = `Чемпион ${monthGen(pk)}`; wr('durocker-season', JSON.stringify(s)); publishSoon(); }
    }
    el.innerHTML = `<div class="sheethead"><h2>Босс недели и сезон</h2><button type="button" class="close" data-close>×</button></div>${tabs}${body}`;
    el.querySelectorAll('[data-wktab]').forEach(x => { x.onclick = () => { tab = x.dataset.wktab; render(); if (tab === 'season') loadSeason(); }; });
    const go = document.getElementById('wkGo');
    if (go) go.onclick = fight;
  }
  async function loadSeason() {
    if (typeof CLOUD !== 'undefined' && CLOUD.on()) {
      status = 'Загружаем сезон…'; render();
      const b = await CLOUD.board();
      if (!openNow) return;
      if (b) {
        const ch = b.champion;
        rows = b.players.filter(p => p.sk || p.spk).map(p => ({ id: p.id, n: p.n, k: p.sk, r: p.sr, w: p.sw, g: p.sg, pk: p.spk, pr: p.spr,
          ttl: ch && ch.id === p.id ? ch.ttl : '', t: p.t }));
        const m = rows.find(r => r.id === pid());
        if (m) { const s = season(); if (s.k === m.k) { s.r = m.r; s.w = m.w; s.g = m.g; wr('durocker-season', JSON.stringify(s)); } }
        status = ''; render(); return;
      }
    }
    if (!has()) return;
    status = 'Загружаем сезон…'; render();
    await publish();
    const got = await fetchAll(2500);
    if (!openNow) return;
    if (got) { rows = got; status = ''; } else status = 'Не удалось связаться с сервером — показываю только тебя.';
    render(); idle(1500);
  }
  function open(t) {
    looks();
    openNow = true; tab = t || tab;
    if (typeof sheet === 'function') sheet('page', ''); else { const p = document.getElementById('page'); if (p) p.hidden = false; }
    render();
    clearInterval(tickT);
    tickT = setInterval(() => {
      const p = document.getElementById('page');
      if (!openNow || !p || p.hidden) { openNow = false; clearInterval(tickT); idle(1000); return; }
      const e = document.getElementById('wkLeft'); if (e) e.textContent = left(weekEnds(weekIdx()) - Date.now());
    }, 1000);
    if (tab === 'season') loadSeason();
  }

  /* ---------- бой ---------- */
  let allowStart = false;
  function fight() {
    if (usedToday()) { try { toast('Бой с боссом недели — раз в день. Возвращайся завтра'); } catch (e) {} return; }
    const s = state(); s.day = today(); s.res = 'play'; saveState(s);
    openNow = false;
    try { closeSheets(); } catch (e) {}
    allowStart = true;
    setMode({ kind: 'weekly', week: weekIdx(), rule: ruleOf(weekIdx()) });
  }

  /* ---------- встраивание в игру без правки чужих файлов ---------- */
  function hook() {
    looks();
    if (typeof currentBot === 'function') {
      const _cb = currentBot;
      currentBot = function () { if (MODE && MODE.kind === 'weekly') return { ...BOSSES[MODE.rule] || boss(), boss: 'weekly', level: 'босс недели' }; return _cb.apply(this, arguments); };
    }
    if (typeof newGame === 'function') {
      const _ng = newGame;
      newGame = function () {
        /* повторный бой с боссом в тот же день («Ещё партия», обновление страницы) не даём — возвращаем в свою игру */
        if (MODE && MODE.kind === 'weekly' && !(typeof NET !== 'undefined' && NET)) {
          if (!allowStart) { MODE = { kind: 'free' }; try { loadSeries(); toast('Бой с боссом недели — раз в день. Это «Своя игра»'); } catch (e) {} }
          allowStart = false;
        }
        return _ng.apply(this, arguments);
      };
    }
    if (typeof openMenu === 'function') {
      const _om = openMenu;
      openMenu = function () {
        const r = _om.apply(this, arguments);
        try {
          const g = document.querySelector('#menuIn .menugrid');
          if (g && !g.querySelector('[data-go="weekly"]')) {
            const b = boss(), bt = document.createElement('button');
            bt.type = 'button'; bt.className = 'mi wk'; bt.dataset.go = 'weekly';
            bt.innerHTML = `<b>Босс недели: ${escH(b.name)}</b><small>${escH(b.short)} · ${usedToday() ? 'попытка завтра' : 'смена через ' + left(weekEnds(weekIdx()) - Date.now())}</small>`;
            const after = g.querySelector('[data-go="daily"]');
            if (after && after.nextSibling) g.insertBefore(bt, after.nextSibling); else g.appendChild(bt);
          }
        } catch (e) {}
        return r;
      };
    }
    if (typeof menuGo === 'function') {
      const _mg = menuGo;
      menuGo = function (k) {
        if (k === 'weekly' || k === 'season') { try { closeSheets(); } catch (e) {} open(k === 'season' ? 'season' : 'boss'); return; }
        return _mg.apply(this, arguments);
      };
    }
    /* конец партии: сезонные очки, результат боя с боссом, награда */
    if (typeof onGameOver === 'function') {
      const _go = onGameOver;
      onGameOver = function () {
        const r = _go.apply(this, arguments);
        try {
          if (G && G.over && !(typeof NET !== 'undefined' && NET && NET.role === 'guest') && MODE.kind !== 'tutorial') {
            const won = G.over === 'p';
            seasonRecord(won);
            if (MODE.kind === 'weekly') {
              const s = state(); s.day = today(); s.res = won ? 'win' : 'lose';
              if (won) s.wins[MODE.week] = true;
              saveState(s);
              if (won) { const b = BOSSES[MODE.rule]; if (unlock('back', b.back.id)) setTimeout(() => { try { toast(`🎁 Рубашка «${b.back.name}» — твоя!`, 3500); } catch (e) {} }, 3000); }
            }
          }
        } catch (e) {}
        return r;
      };
    }
    /* у гостя онлайн движок не крутится — считаем сезон по экрану итогов, один раз на партию;
       бой с боссом — свой экран итогов */
    if (typeof showOver === 'function') {
      const _so = showOver;
      showOver = function () {
        const r = _so.apply(this, arguments);
        try {
          if (typeof NET !== 'undefined' && NET && NET.role === 'guest' && G && G.over) {
            const key = NET.code + '|' + (SERIES && SERIES.games) + '|' + G.over;
            let seen = null; try { seen = sessionStorage.getItem('durocker-ss-seen'); } catch (e) {}
            if (seen !== key) { try { sessionStorage.setItem('durocker-ss-seen', key); } catch (e) {} seasonRecord(G.over === 'p'); }
          } else if (MODE && MODE.kind === 'weekly' && G && G.over && !NET) overScreen();
        } catch (e) {}
        return r;
      };
    }
    /* в шапке: «Босс недели» и «одна партия» */
    if (typeof renderHUD === 'function') {
      const _rh = renderHUD;
      renderHUD = function () {
        const r = _rh.apply(this, arguments);
        try {
          if (MODE && MODE.kind === 'weekly' && !NET) {
            const to = document.getElementById('scTo'); if (to) to.textContent = 'одна партия';
            const mb = document.getElementById('modeBox'), b = BOSSES[MODE.rule];
            if (mb && b && !mb.querySelector('.wkchip')) mb.insertAdjacentHTML('afterbegin', `<span class="boss wkchip">Босс недели: ${escH(b.short)}</span>`);
          }
        } catch (e) {}
        return r;
      };
    }
  }
  function overScreen() {
    const o = document.getElementById('over');
    if (!o || o.hidden) return;
    const b = BOSSES[MODE.rule], won = G.over === 'p', pen = G.penalty || 0;
    const h = G.over === 'draw' ? 'НИЧЬЯ' : won ? 'БОСС ПОВЕРЖЕН!' : 'БОСС ПОБЕДИЛ';
    const s = G.over === 'draw' ? 'Оба скинули карты разом. Попробуй завтра ещё раз.'
      : won ? `У босса осталось ${pen} ${typeof plural === 'function' ? plural(pen) : 'карт'}. Рубашка «${b.back.name}» — в коллекции.`
      : `У тебя осталось ${pen} ${typeof plural === 'function' ? plural(pen) : 'карт'}. Новая попытка — завтра, босс сменится через ${left(weekEnds(weekIdx()) - Date.now())}.`;
    o.innerHTML = `<h2>${h}</h2><p>${escH(s)}</p>${won ? `<div class="wkprize" style="justify-content:center"><div class="wkback" style="background:${b.back.css}"></div><p><b>«${escH(b.back.name)}»</b><br>рубашка недели</p></div>` : ''}
      <div class="row"><button class="btn blue" type="button" id="wkFree">Своя игра</button><button class="btn grey" type="button" id="wkMenu">Меню</button></div>`;
    document.getElementById('wkFree').onclick = () => { try { setMode({ kind: 'free' }); } catch (e) {} };
    document.getElementById('wkMenu').onclick = () => { try { openMenu(); } catch (e) {} };
  }
  hook();
  return { BOSSES, open, boss, weekIdx, ruleOf, season, state, fight, _clean: clean, _champion: champion };
})();
