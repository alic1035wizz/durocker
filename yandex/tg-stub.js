/* ДурКер для Яндекс Игр: вместо tg.js. Telegram и приглашения по ссылке здесь не нужны,
   остаются вибрация и запрет масштаба. */
'use strict';
const TG_LINK = '';
let TGA = null;
function tgStart(done) { done(); }
function startCode() { return null; }
function shareInvite() {}
function buzz(kind) {
  if (load('durocker-buzz') === '0') return;
  try { if (navigator.vibrate) navigator.vibrate(kind === 'big' ? [30, 40, 60] : kind === 'bad' ? [80, 50, 80] : kind === 'light' ? 8 : 20); } catch (e) {}
}
(() => {
  const vp = document.querySelector('meta[name=viewport]');
  if (vp) vp.content = 'width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover';
  const st = document.createElement('style');
  st.textContent = 'html,body,button,.slot,.card{touch-action:manipulation}';
  document.head.appendChild(st);
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
})();
