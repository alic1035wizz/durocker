/* ДурКер — главный экран-«лобби» (волна 6).
   Не заменяет меню, а надстраивает его: после openMenu() все плитки [data-go], которые добавили другие модули,
   собираются заново в лобби — ИГРАТЬ, «Сегодня», быстрые режимы, «Ещё». Ни одна плитка и ни одна функция не теряется:
   нажатия по-прежнему идут в menuGo(). Показывается при запуске и после выхода из партии. */
'use strict';
(function () {
  const $q = (s, r) => (r || document).querySelector(s);
  const E = s => (typeof esc === 'function' ? esc(s) : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const safe = (fn, d) => { try { return fn(); } catch (e) { return d; } };
  let fromLobby = false, moreOpen = false, actedG = null; /* actedG — партия, в которой игрок уже что-то сделал */

  /* ---------- данные ---------- */
  const DAY = 86400000, WEEK = 7 * DAY, MSK = 3 * 3600000, EPOCH = Date.UTC(2026, 9, 19);
  function leftText(ms) {
    if (ms <= 0) return t('вот-вот');
    const d = Math.floor(ms / DAY), h = Math.floor(ms % DAY / 3600000), m = Math.floor(ms % 3600000 / 60000);
    return d ? t('{d} д {h} ч', { d, h }) : h ? t('{h} ч {m} мин', { h, m }) : t('{m} мин', { m });
  }
  function face(host, key, fallback, emo) {
    if (!host) return;
    safe(() => { if (typeof PORTRAITS !== 'undefined' && PORTRAITS.mount) { PORTRAITS.mount(host, key, { emo: emo || 'neutral' }); return; } throw 0; }, 0);
    if (!host.firstElementChild) host.textContent = fallback || '';
  }
  function playInfo() {
    const p = prog();
    if (typeof NET !== 'undefined' && NET) return { kind: 'back', sub: 'Онлайн-партия идёт — вернуться за стол', face: null };
    const live = G && !G.over && actedG === G;
    const op = safe(() => currentBot(), null);
    if (live) return { kind: 'resume', title: 'ПРОДОЛЖИТЬ', sub: t('Партия идёт · против {n}', { n: op ? t(op.name) : t('соперника') }), op };
    if (!p.careerDone) {
      const stage = Math.min(p.career, CAREER_OPS.length - 1), st = CAREER_OPS[stage];
      const fresh = !p.career && !p.games;
      return { kind: 'career', stage, op: st, title: 'ИГРАТЬ',
        sub: t('{a}: район «{d}» · {s}', { a: t(fresh ? 'Начать карьеру' : 'Продолжить'), d: t(CAREER[st.district].name), s: t(st.name) }) };
    }
    const wr = p.games ? p.wins / p.games : 0;
    const id = p.games < 6 || wr < 0.45 ? 'student' : wr < 0.7 ? 'valera' : 'sharper', b = BOTS.find(x => x.id === id) || BOTS[1];
    return { kind: 'quick', bot: b.id, op: b, title: 'ИГРАТЬ', sub: t('Быстрая игра · {n} ({l})', { n: t(b.name), l: t(b.level) }) };
  }
  function playGo() {
    const info = playInfo();
    if (info.kind === 'back' || info.kind === 'resume') { closeSheets(); return; }
    if (info.kind === 'career') {
      closeSheets();
      const fresh = G && !G.over && actedG !== G;
      if (MODE.kind === 'career' && MODE.stage === info.stage && fresh) return; /* свежая раздача этого боя уже готова */
      setMode({ kind: 'career', stage: info.stage });
      return;
    }
    store('durocker-bot', info.bot); closeSheets(); setMode({ kind: 'free' });
  }

  /* ---------- сборка ---------- */
  function decorate() {
    const menu = $q('#menu'), box = $q('#menuIn'), grid = box && $q('.menugrid', box);
    if (!grid) return;
    const tiles = {};
    grid.querySelectorAll(':scope > [data-go]').forEach(b => { if (!tiles[b.dataset.go]) tiles[b.dataset.go] = b; });
    const p = prog(), day = todayKey(), info = playInfo();
    const txt = (k, sel) => (tiles[k] && $q(sel, tiles[k]) ? $q(sel, tiles[k]).textContent : '');

    /* кошелёк: плитка «Фишки» от chips.js */
    let wallet = '';
    if (tiles.chips) {
      const num = (txt('chips', 'b').match(/[\d\s .,]+$/) || [''])[0].trim(), sm = txt('chips', 'small');
      const streak = (sm.match(/🔥\s*\D*?(\d+)/) || [])[1], chest = /🎁/.test(sm); /* без привязки к языку: смотрим на значки */
      wallet = `<button type="button" class="lb-wallet" data-go="chips" aria-label="Фишки">🪙 <b>${E(num || '')}</b>${streak ? `<span class="lb-hot">🔥${E(streak)}</span>` : ''}${chest ? '<span class="lb-chest" title="Сундук ждёт">🎁</span>' : ''}</button>`;
    }

    /* ИГРАТЬ */
    const playBtn = `<button type="button" class="lb-play ${info.kind}" data-lb="play">
      <span class="lb-pface" id="lbPface" aria-hidden="true"></span>
      <span class="lb-ptext"><b>${E(info.title || 'ВЕРНУТЬСЯ')}</b><small>${E(info.sub)}</small></span>
      <span class="lb-go" aria-hidden="true">▶</span></button>`;

    /* «Сегодня» */
    const cards = [];
    const r = p.daily[day];
    cards.push(`<button type="button" class="lb-card daily ${r ? 'done' : ''}" data-go="daily">
      <span class="lb-ico">🃏</span><span class="lb-ct"><em>${t('Ежедневная #{n}', { n: dailyNumber(day) })}</em>
      <b>${r ? (r.won ? '✅ Не дурак' : '🃏 Дурак') : 'Одна колода для всех'}</b>
      <small>${r ? t('могнул ×{m} · ходов {n}', { m: r.mognul, n: r.turns }) : 'одна партия против Шулера'}</small></span></button>`);
    let boss = null;
    if (typeof WEEKLY !== 'undefined') boss = safe(() => {
      const b = WEEKLY.boss(), w = WEEKLY.weekIdx(), st = WEEKLY.state();
      const used = st.day === day, won = !!(st.wins && st.wins[w]);
      return { b, left: leftText(EPOCH + (w + 1) * WEEK - MSK - Date.now()), status: t(won ? '✅ Победа на этой неделе' : used ? 'Попытка потрачена — завтра ещё' : 'Одна попытка в день') };
    }, null);
    if (boss) cards.push(`<button type="button" class="lb-card boss" data-go="weekly">
      <span class="lb-bface" id="lbBface" aria-hidden="true"></span><span class="lb-ct"><em>${t('Босс недели · ещё {x}', { x: E(boss.left) })}</em>
      <b>${E(t(boss.b.name))}</b><small>${E(t(boss.b.short || boss.b.rule))} · ${E(boss.status)}</small></span></button>`);
    let pass = null;
    if (typeof PASS !== 'undefined') pass = safe(() => { const s = PASS.state(), lv = PASS.levelOf(s.xp); return { L: lv.L, into: lv.into, next: lv.next }; }, null);
    if (pass) {
      const pct = pass.next ? Math.min(100, Math.round(pass.into / pass.next * 100)) : 100;
      cards.push(`<button type="button" class="lb-card pass" data-go="pass">
        <span class="lb-ico">🎟</span><span class="lb-ct"><em>Пропуск сезона</em><b>${t('Уровень {n}', { n: pass.L })}${pass.L >= 30 ? ' · ' + t('макс.') : ''}</b>
        <span class="bar"><i style="width:${pct}%"></i></span><small>${pass.next ? `${pass.into} / ${pass.next} XP` : 'всё получено'}</small></span></button>`);
    }
    const ev = tiles.event ? `<button type="button" class="lb-event" data-go="event"><b>${E(txt('event', 'b'))}</b><small>${E(txt('event', 'small'))}</small></button>` : '';

    /* быстрые режимы */
    const st0 = CAREER_OPS[Math.min(p.career, CAREER_OPS.length - 1)];
    const quick = [
      ['career', '🏙', 'Карьера', p.careerDone ? 'пройдена' : t('район «{d}»', { d: t(CAREER[st0.district].name) })],
      ['online', '🌐', 'Онлайн', 'с другом по коду'],
      ['rogue', '🌙', 'Ночь в казино', (txt('rogue', 'small').split('·').pop() || '').trim() || '8 боссов подряд'],
      ['company', '👥', 'Компания', 'дурак на 3–4']
    ].filter(q => tiles[q[0]]);
    const quickHTML = quick.map(q => `<button type="button" class="lb-tile" data-go="${q[0]}"><i>${q[1]}</i><b>${E(q[2])}</b><small>${E(q[3])}</small></button>`).join('');
    const used = new Set(quick.map(q => q[0]));

    /* «Ещё»: всё остальное из меню, как есть */
    const rest = document.createElement('div');
    rest.className = 'menugrid lb-more';
    rest.id = 'lbMore';
    rest.hidden = !moreOpen;
    [...grid.children].forEach(el => { if (!(el.dataset && used.has(el.dataset.go))) rest.appendChild(el); });

    /* переключатель языка: текущий подсвечен, смена перезагружает страницу */
    const cur = (window.I18N && I18N.lang) || 'ru';
    const langSwitch = `<div class="lb-lang" role="group" aria-label="Language">${['ru', 'en'].map(l => `<button type="button" data-lang="${l}" class="${cur === l ? 'on' : ''}" aria-pressed="${cur === l}">${l.toUpperCase()}</button>`).join('')}</div>`;
    box.innerHTML = `<div class="lb">
      <div class="lb-top"><div class="lb-logo"><span class="lb-suits" aria-hidden="true"><i>♠</i><i class="r">♥</i><i class="r">♦</i><i>♣</i></span><b>${t('ДурКер')}</b></div>
        ${langSwitch}${wallet}<button type="button" class="close" data-close aria-label="Закрыть">×</button></div>
      <div class="lb-fan" aria-hidden="true"><i style="--a:-34deg"><b>A</b><s>♠</s></i><i style="--a:-17deg" class="r"><b>K</b><s>♥</s></i><i style="--a:0deg" class="jk"><b>★</b><s>JOKER</s></i><i style="--a:17deg" class="r"><b>Q</b><s>♦</s></i><i style="--a:34deg"><b>J</b><s>♣</s></i></div>
      <div class="lb-main">${playBtn}</div>
      <div class="lb-today"><h3>Сегодня</h3><div class="lb-cards n${cards.length}">${cards.join('')}</div>${ev}</div>
      ${quickHTML ? `<div class="lb-modes">${quickHTML}</div>` : ''}
      <button type="button" class="lb-morebtn" data-lb="more" aria-expanded="${moreOpen}">${t('Ещё')} <span class="lb-caret">${moreOpen ? '▴' : '▾'}</span></button>
    </div>`;
    $q('.lb', box).appendChild(rest);
    $q('#menu').classList.add('lb-home');

    /* лица */
    if (info.op) face($q('#lbPface'), info.op.id, info.op.face);
    else { const f = $q('#lbPface'); if (f) f.textContent = '🪑'; }
    if (boss) face($q('#lbBface'), boss.b.id, boss.b.face);
  }

  /* ---------- события ---------- */
  document.addEventListener('click', e => {
    const t = e.target; if (!t || !t.closest) return;
    const lng = t.closest('[data-lang]');
    if (lng) {
      if (window.I18N && lng.dataset.lang !== I18N.lang) {
        /* ?lang=… в адресе перебило бы выбор после перезагрузки — убираем его */
        try { const u = new URL(location.href); if (u.searchParams.has('lang')) { u.searchParams.delete('lang'); history.replaceState(null, '', u.pathname + u.search + u.hash); } } catch (x) {}
        I18N.setLang(lng.dataset.lang);
      }
      return;
    }
    const lb = t.closest('[data-lb]');
    if (lb) {
      if (lb.dataset.lb === 'play') playGo();
      else if (lb.dataset.lb === 'more') {
        moreOpen = !moreOpen;
        const m = $q('#lbMore'); if (m) m.hidden = !moreOpen;
        lb.setAttribute('aria-expanded', moreOpen); const c = $q('.lb-caret', lb); if (c) c.textContent = moreOpen ? '▴' : '▾';
        if (moreOpen && m) setTimeout(() => m.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 30);
      }
      return;
    }
    /* окно открыли из лобби — по «×» возвращаемся в него */
    const go = t.closest('#menu.lb-home [data-go]');
    if (go && !/^(leave|restart)$/.test(go.dataset.go)) fromLobby = true;
    const cl = t.closest('[data-close]');
    if (cl) {
      const sh = cl.closest('.sheet');
      if (sh && sh.id !== 'menu' && fromLobby && !(typeof NET !== 'undefined' && NET)) {
        fromLobby = false;
        setTimeout(() => { if (![...document.querySelectorAll('.sheet')].some(s => !s.hidden)) openMenu(); }, 0);
      } else if (sh && sh.id === 'menu') fromLobby = false;
    }
  }, true);

  /* ---------- обёртки ---------- */
  if (typeof openMenu === 'function') {
    const _om = openMenu;
    openMenu = function () {
      fromLobby = false;
      const r = _om.apply(this, arguments);
      try { decorate(); } catch (e) { console.error('[lobby]', e); }
      return r;
    };
  }
  if (typeof sendAct === 'function') {
    const _sa = sendAct;
    sendAct = function () { if (G && !G.over) actedG = G; return _sa.apply(this, arguments); };
  }
  if (typeof newGame === 'function') {
    const _ng = newGame;
    newGame = function () { fromLobby = false; return _ng.apply(this, arguments); };
  }

  /* лобби при запуске: вызывает main.js, когда не было ссылки-приглашения и не открыта карточка правила */
  window.lobbyStart = function () {
    try { if ($q('#page') && !$q('#page').hidden) return; openMenu(); } catch (e) { console.error('[lobby]', e); }
  };
})();
