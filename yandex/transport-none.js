/* ДурКер для Яндекс Игр: вместо transport-mqtt.js. Сети у игры нет — онлайн-режимов в сборке нет. */
'use strict';
const TR = {
  available: () => false,
  unavailableText: 'Онлайн-режимов в этой версии нет.',
  async host(code, h) { if (h && h.error) h.error(TR.unavailableText); },
  async join(code, nick, h) { if (h && h.error) h.error(TR.unavailableText); },
  send() {},
  close() {},
};
