/* Дурокер — запуск внутри Telegram (Mini App) и вибрация.
   В Телеграме: имя игрока из профиля, вход за стол по ссылке t.me/…?startapp=t_код, вибрация и на iPhone. */
'use strict';

/* ссылка на мини-приложение вида https://t.me/имя_бота/имя_приложения — вписать после создания бота в @BotFather */
const TG_LINK = 'https://t.me/durocker_bot';
let TGA = null;

function tgStart(done) {
  const inTg = /tgWebApp/.test(location.hash + location.search) || window.TelegramWebviewProxy;
  if (!inTg) { done(); return; }
  const s = document.createElement('script');
  s.src = 'https://telegram.org/js/telegram-web-app.js';
  s.onload = () => {
    TGA = window.Telegram && window.Telegram.WebApp;
    if (TGA) {
      try {
        TGA.ready(); TGA.expand();
        if (TGA.disableVerticalSwipes) TGA.disableVerticalSwipes();
        if (TGA.setHeaderColor) TGA.setHeaderColor('#0f1a17');
        if (TGA.setBackgroundColor) TGA.setBackgroundColor('#0f1a17');
        const u = TGA.initDataUnsafe && TGA.initDataUnsafe.user;
        if (u && !load('durocker-nick')) store('durocker-nick', (u.first_name || u.username || 'Игрок').slice(0, 16));
        document.documentElement.dataset.tg = '1';
      } catch (e) {}
    }
    done();
  };
  s.onerror = () => done();
  document.head.appendChild(s);
}
/* код стола, с которым открыли игру: ?t=код на сайте или startapp=t_код в Телеграме */
function startCode() {
  const sp = TGA && TGA.initDataUnsafe && TGA.initDataUnsafe.start_param;
  if (sp && /^t_[a-z0-9]{4}$/.test(sp)) return sp.slice(2);
  const t = new URLSearchParams(location.search).get('t');
  return t && /^[a-z0-9]{4}$/.test(t) ? t : null;
}
/* позвать друга: в Телеграме — выбор чата, на телефоне — системное «Поделиться», иначе копируем ссылку */
function shareInvite(code, btn) {
  const link = inviteLink(code), text = `Го в Дурокер! Стол ${code.toUpperCase()}`;
  if (TGA && TGA.openTelegramLink) { TGA.openTelegramLink('https://t.me/share/url?url=' + encodeURIComponent(link) + '&text=' + encodeURIComponent(text)); return; }
  if (navigator.share) { navigator.share({ title: 'Дурокер', text, url: link }).catch(() => {}); return; }
  copyText(link, btn);
}

/* вибрация: Телеграм умеет и на iPhone; в браузере — только Android */
function buzz(kind) {
  if (load('durocker-buzz') === '0') return;
  try {
    const hf = TGA && TGA.HapticFeedback;
    if (hf) {
      if (kind === 'big') hf.notificationOccurred('success');
      else if (kind === 'bad') hf.notificationOccurred('error');
      else hf.impactOccurred(kind === 'light' ? 'light' : 'medium');
      return;
    }
    if (navigator.vibrate) navigator.vibrate(kind === 'big' ? [30, 40, 60] : kind === 'bad' ? [80, 50, 80] : kind === 'light' ? 8 : 20);
  } catch (e) {}
}

/* без масштаба по двойному касанию: игра — не документ, двойной тап по картам не должен приближать экран */
(() => {
  const vp = document.querySelector('meta[name=viewport]');
  if (vp) vp.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  const st = document.createElement('style');
  st.textContent = 'html,body,button,.slot,.card{touch-action:manipulation}';
  document.head.appendChild(st);
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
})();
