/* ДурКер — нативная оболочка (Capacitor / Google Play).
   Без window.Capacitor (сайт, Telegram, артефакт) файл ничего не делает.
   Внутри приложения: не регистрирует service worker, красит статус-бар, прячет сплэш,
   обрабатывает кнопку «Назад» Android и дополняет «Позвать друга» ссылкой на Google Play. */
'use strict';
(function () {
  const C = window.Capacitor;
  const isNative = !!(C && (typeof C.isNativePlatform === 'function' ? C.isNativePlatform() : C.platform && C.platform !== 'web'));
  if (!isNative) return;

  const PLAY_LINK = 'https://play.google.com/store/apps/details?id=ru.durker.app';
  const BG = '#06191a';
  window.NATIVE_APP = true;
  document.documentElement.dataset.native = '1';
  const plug = n => (C.Plugins && C.Plugins[n]) || null;
  const safe = f => { try { return f(); } catch (e) { return undefined; } };

  /* service worker в приложении не нужен: файлы лежат внутри пакета, а кэш мешал бы обновлениям */
  safe(() => {
    if (window.ServiceWorkerContainer && ServiceWorkerContainer.prototype) {
      ServiceWorkerContainer.prototype.register = () => Promise.resolve();
    }
    if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    }
  });

  /* статус-бар в цвет стола, без наложения на страницу */
  safe(() => {
    const sb = plug('StatusBar');
    if (!sb) return;
    sb.setStyle && sb.setStyle({ style: 'DARK' });
    sb.setBackgroundColor && sb.setBackgroundColor({ color: BG });
    sb.setOverlaysWebContent && sb.setOverlaysWebContent({ overlay: false });
  });

  /* сплэш закрываем, когда игра нарисовала первый экран */
  const hideSplash = () => safe(() => { const s = plug('SplashScreen'); if (s && s.hide) s.hide({ fadeOutDuration: 200 }); });
  if (document.readyState === 'complete') setTimeout(hideSplash, 300); else window.addEventListener('load', () => setTimeout(hideSplash, 300));
  setTimeout(hideSplash, 4000); /* на всякий случай */

  /* без масштаба и выделения текста */
  safe(() => {
    const st = document.createElement('style');
    st.textContent = 'html[data-native]{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;overscroll-behavior:none}';
    document.head.appendChild(st);
  });

  /* кнопка «Назад»: закрывает окно → возвращает в меню/лобби → при двойном нажатии выходит */
  let lastBack = 0;
  const visible = id => { const e = document.getElementById(id); return !!(e && !e.hidden); };
  function onBack() {
    const say = (typeof toast === 'function') ? toast : () => {};
    /* вложенные окна (правила, «Знакомства», профиль...) → в меню/лобби */
    if (visible('page') || visible('bots') || visible('lobby')) {
      ['page', 'bots', 'lobby'].forEach(id => { const e = document.getElementById(id); if (e) e.hidden = true; });
      if (typeof openMenu === 'function') openMenu();
      return;
    }
    /* меню/лобби открыто */
    if (visible('menu')) {
      const now = Date.now();
      if (now - lastBack < 1800) { const a = plug('App'); if (a && a.exitApp) a.exitApp(); return; }
      lastBack = now;
      say(t('Нажми «Назад» ещё раз, чтобы выйти'), 1600);
      return;
    }
    /* идёт партия: открываем меню, как по кнопке ☰ */
    if (typeof openMenu === 'function') openMenu();
  }
  safe(() => { const a = plug('App'); if (a && a.addListener) a.addListener('backButton', onBack); });

  /* «Позвать друга»: системное меню «Поделиться» со ссылкой на стол и на приложение в Google Play */
  if (typeof shareInvite === 'function' && typeof inviteLink === 'function') {
    const orig = shareInvite;
    window.shareInvite = function (code, btn) {
      const link = inviteLink(code);
      const text = t('Го в ДурКер! Стол {c}. Приложение: {l}', { c: String(code).toUpperCase(), l: PLAY_LINK });
      if (navigator.share) { navigator.share({ title: t('ДурКер'), text, url: link }).catch(() => {}); return; }
      const sh = plug('Share');
      if (sh && sh.share) { sh.share({ title: t('ДурКер'), text, url: link, dialogTitle: t('Позвать друга') }).catch(() => {}); return; }
      return orig(code, btn);
    };
  }
})();
