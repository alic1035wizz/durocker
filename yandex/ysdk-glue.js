/* ДурКер для Яндекс Игр — связка игры с SDK. Грузится последним перед main.js.
   Без SDK (window.__Y.sdk === null) безопасно ничего не делает. */
'use strict';
(() => {
  const Y = window.__Y || { sdk: null };
  const sdk = Y.sdk;
  const st = { playing: false, adOpen: false, lastAd: 0, matchDone: false, readyDone: false, wasPlaying: false };
  const LOG = (...a) => { try { Y.log && Y.log.push(a.join(' ')); if (/[?&]ydebug=1/.test(location.search)) console.log('[ya]', ...a); } catch (e) {} };
  const call = (fn) => { try { return fn(); } catch (e) { LOG('err', e && e.message); } };

  /* ---------- общее: без контекстного меню, без выделения ---------- */
  document.addEventListener('contextmenu', e => e.preventDefault());
  const css = document.createElement('style');
  css.textContent = 'html,body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:none}input,textarea{-webkit-user-select:text;user-select:text}' +
    /* всё, что требует внешних сервисов, в этой версии не показываем */
    '#snapOver,#circleOver,#shareBtn,[data-mm="share"],[data-rp="circle"],[data-rp="plain"],#shareLink,.lb-event[data-go="tourney"]{display:none!important}';
  document.head.appendChild(css);

  /* ---------- звук ---------- */
  const ctx = () => { try { return typeof AU !== 'undefined' && AU._ctx ? AU._ctx() : null; } catch (e) { return null; } };
  function silence() { const c = ctx(); if (c && c.state === 'running') call(() => c.suspend()); }
  function unsilence() { const c = ctx(); if (c && c.state === 'suspended' && !document.hidden && !st.adOpen && !st.paused) call(() => c.resume()); }
  st.paused = false;

  /* ---------- разметка геймплея ---------- */
  const gp = sdk && sdk.features && sdk.features.GameplayAPI;
  function gStart() { if (st.playing || st.adOpen || st.paused) return; st.playing = true; if (gp) call(() => gp.start()); LOG('gp.start'); }
  function gStop() { if (!st.playing) return; st.playing = false; if (gp) call(() => gp.stop()); LOG('gp.stop'); }

  /* ---------- пауза от платформы и от сворачивания ---------- */
  function pauseAll() { if (st.paused) return; st.paused = true; st.wasPlaying = st.playing; gStop(); silence(); LOG('pause'); }
  function resumeAll() { if (!st.paused) return; st.paused = false; unsilence(); if (st.wasPlaying) gStart(); LOG('resume'); }
  if (sdk && sdk.on) { call(() => sdk.on('game_api_pause', pauseAll)); call(() => sdk.on('game_api_resume', resumeAll)); }
  document.addEventListener('visibilitychange', () => { if (document.hidden) { pauseAll(); } else { resumeAll(); } });
  window.addEventListener('blur', () => silence());
  window.addEventListener('focus', () => unsilence());

  /* ---------- готовность: игрок может начать ---------- */
  function ready() {
    if (st.readyDone) return; st.readyDone = true;
    const l = sdk && sdk.features && sdk.features.LoadingAPI;
    if (l) call(() => l.ready());
    LOG('ready');
  }

  /* ---------- реклама ---------- */
  function adGuard() { st.adOpen = true; st.wasPlaying = st.playing || st.wasPlaying; gStop(); silence(); }
  function adDone() { st.adOpen = false; unsilence(); }
  function showFullscreen(next) {
    if (!sdk || !sdk.adv || !sdk.adv.showFullscreenAdv) { next(); return; }
    let finished = false;
    const fin = () => { if (finished) return; finished = true; adDone(); next(); };
    adGuard();
    call(() => sdk.adv.showFullscreenAdv({ callbacks: {
      onOpen: () => { LOG('adv open'); },
      onClose: (shown) => { LOG('adv close', shown); st.lastAd = Date.now(); fin(); },
      onError: (e) => { LOG('adv error'); fin(); }
    } }));
    setTimeout(fin, 45000); /* на случай, если колбэки не придут */
  }
  function showRewarded(onReward) {
    if (!sdk || !sdk.adv || !sdk.adv.showRewardedVideo) return;
    let rewarded = false, finished = false;
    const fin = () => { if (finished) return; finished = true; adDone(); if (rewarded) onReward(); else if (typeof toast === 'function') toast('Награда не засчитана — видео не досмотрено', 2600); };
    adGuard();
    call(() => sdk.adv.showRewardedVideo({ callbacks: {
      onOpen: () => LOG('rw open'),
      onRewarded: () => { rewarded = true; LOG('rw rewarded'); },
      onClose: () => { LOG('rw close'); st.lastAd = Date.now(); fin(); },
      onError: () => { LOG('rw error'); if (typeof toast === 'function') toast('Видео сейчас недоступно', 2200); finished = true; adDone(); }
    } }));
  }
  window.YGAMES = { showFullscreen, showRewarded, state: st, log: () => (Y.log || []).slice() };

  /* между матчами: после «Дальше / Новый матч», не чаще раза в 3 минуты, не посреди партии */
  document.addEventListener('click', e => {
    if (!sdk || st.bypass) return;
    const b = e.target.closest && e.target.closest('#again');
    if (!b) return;
    const done = typeof SERIES !== 'undefined' && SERIES && SERIES.done;
    if (!done || Date.now() - st.lastAd < 180000 || st.adOpen) return;
    e.preventDefault(); e.stopImmediatePropagation();
    showFullscreen(() => { st.bypass = true; try { b.click(); } finally { st.bypass = false; } });
  }, true);

  /* награда за видео: окно «Фишки» и выбор ставки при нуле */
  function rwButton() {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn orange'; b.id = 'ydRw';
    b.innerHTML = '📺 Смотреть рекламу и получить +100 🪙';
    b.onclick = () => showRewarded(() => {
      if (window.CHIPS) CHIPS.add(100);
      if (typeof toast === 'function') toast('+100 🪙 за просмотр', 2200);
      try { if (typeof renderHUD === 'function') renderHUD(); } catch (e) {}
      const pg = document.getElementById('page');
      if (pg && !pg.hidden && pg.querySelector('.cbig') && typeof menuGo === 'function') { try { menuGo('chips'); } catch (e) {} }
    });
    return b;
  }
  function patchChips() {
    if (!sdk || !window.CHIPS) return;
    const big = document.querySelector('#page .cbig');
    if (big && !document.getElementById('ydRw')) big.insertAdjacentElement('afterend', rwButton());
    const seg = document.querySelector('#botsIn #chBetSeg');
    if (seg && CHIPS.get() <= 0 && !document.getElementById('ydRw2')) {
      const b = rwButton(); b.id = 'ydRw2'; seg.insertAdjacentElement('afterend', b);
    }
    /* займ у Торгаша заменяем просмотром рекламы */
    document.querySelectorAll('#chLoan,#chLoan2').forEach(x => x.remove());
  }
  const obs = new MutationObserver(() => patchChips());
  const watchTargets = () => ['page', 'botsIn'].forEach(id => { const el = document.getElementById(id); if (el) obs.observe(el, { childList: true, subtree: true }); });
  watchTargets();

  /* ---------- события игры ---------- */
  if (typeof BUS !== 'undefined') {
    BUS.on('turn', () => { if (typeof G !== 'undefined' && G && !G.over) gStart(); });
    BUS.on('game:start', () => { st.matchDone = false; });
    BUS.on('over', () => { gStop(); });
    BUS.on('menu:open', () => gStop());
    BUS.on('lobby:render', () => { gStop(); ready(); });
    BUS.on('match:over', () => { st.matchDone = true; });
  }
  /* на случай, если лобби не нарисовалось (первая загрузка с ошибкой): всё равно сообщаем о готовности */
  setTimeout(ready, 4000);
})();
