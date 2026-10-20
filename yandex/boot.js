/* ДурКер для Яндекс Игр — загрузчик.
   1) инициализирует SDK (если его нет — например, при проверке без платформы — просто едет дальше);
   2) тянет облачное сохранение игрока и кладёт его в localStorage ДО старта игры;
   3) подгружает скрипты игры строго по порядку (список кладёт tools/build-yandex.py в window.__YSCRIPTS). */
(function () {
  'use strict';
  window.YANDEX = true;
  /* плитки, которых в сборке для Яндекса нет: онлайн, клубы, быстрая игра по сети, таблицы по сети */
  window.YANDEX_HIDE = new Set(['online', 'quick', 'club', 'tourney', 'leaders']);
  const Y = window.__Y = { sdk: null, player: null, lang: 'ru', cloud: false, log: [] };
  const PFX = /^(durocker|durker)-/;
  const MAXB = 190000;
  const dbg = (...a) => { Y.log.push(a.join(' ')); try { if (/[?&]ydebug=1/.test(location.search)) console.log('[ya]', ...a); } catch (e) {} };
  const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout ' + label)), ms))]);

  function snapshot() {
    const o = {};
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (PFX.test(k)) o[k] = localStorage.getItem(k); } } catch (e) {}
    return o;
  }
  /* влезть в лимит 200 КБ на игрока: самые тяжёлые необязательные записи отбрасываем */
  function pack(d, ts) {
    let s = JSON.stringify({ ts, d });
    if (s.length <= MAXB) return s;
    const keys = Object.keys(d).sort((a, b) => d[b].length - d[a].length);
    const d2 = Object.assign({}, d);
    for (const k of keys) { delete d2[k]; dbg('drop', k); s = JSON.stringify({ ts, d: d2 }); if (s.length <= MAXB) break; }
    return s;
  }
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  async function initSdk() {
    if (!window.YaGames || !YaGames.init) { dbg('no YaGames'); return; }
    try { Y.sdk = await withTimeout(YaGames.init(), 6000, 'init'); } catch (e) { dbg('init fail', e && e.message); return; }
    try { const l = Y.sdk.environment && Y.sdk.environment.i18n && Y.sdk.environment.i18n.lang; if (l) Y.lang = String(l).toLowerCase(); } catch (e) {}
    try { document.documentElement.lang = Y.lang; } catch (e) {}
    try {
      Y.player = await withTimeout(Y.sdk.getPlayer(), 6000, 'player');
      const got = await withTimeout(Y.player.getData(['ls']), 6000, 'getData');
      Y.cloud = true;
      if (got && got.ls) {
        let c = null; try { c = JSON.parse(got.ls); } catch (e) {}
        const localTs = parseInt(lsGet('yd-ts'), 10) || 0;
        const hasLocal = Object.keys(snapshot()).length > 2;
        if (c && c.d && (c.ts > localTs || !hasLocal)) {
          for (const k of Object.keys(c.d)) if (PFX.test(k)) lsSet(k, c.d[k]);
          lsSet('yd-ts', String(c.ts || 0));
          dbg('cloud applied', Object.keys(c.d).length);
        } else dbg('local is newer');
      }
    } catch (e) { dbg('cloud fail', e && e.message); }
  }

  /* сохранение: раз в 15 секунд и при сворачивании, только если что-то изменилось (лимит SDK — 100 записей за 5 минут) */
  let lastStr = '', lastAt = 0;
  function save(force) {
    if (!Y.player) return;
    const d = snapshot(), probe = JSON.stringify(d);
    if (probe === lastStr) return;
    if (!force && Date.now() - lastAt < 20000) return;
    const ts = Date.now();
    lastStr = probe; lastAt = ts;
    try { Y.player.setData({ ls: pack(d, ts) }, !!force).then(() => { lsSet('yd-ts', String(ts)); dbg('saved'); }).catch(e => dbg('save fail', e && e.message)); } catch (e) { dbg('save throw', e && e.message); }
  }
  Y.save = save;

  function loadScripts(list, i, done) {
    if (i >= list.length) { done(); return; }
    const s = document.createElement('script');
    s.src = list[i];
    s.onload = () => loadScripts(list, i + 1, done);
    s.onerror = () => { console.error('не загрузился', list[i]); loadScripts(list, i + 1, done); };
    document.body.appendChild(s);
  }

  initSdk().catch(() => {}).then(() => {
    lastStr = JSON.stringify(snapshot());
    loadScripts(window.__YSCRIPTS || [], 0, () => {
      setInterval(() => save(false), 15000);
      document.addEventListener('visibilitychange', () => { if (document.hidden) save(true); });
      window.addEventListener('pagehide', () => save(true));
    });
  });
})();
