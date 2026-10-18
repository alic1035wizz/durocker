/* Дурокер — канал онлайна для сайта: прямое соединение браузеров через PeerJS (WebRTC).
   Своего сервера не нужно, публичный сервер PeerJS только помогает браузерам найти друг друга. */
'use strict';

const TR = (() => {
  const PREFIX = 'durocker-v2-';
  let peer = null, conn = null;
  const wire = (c, h) => {
    c.on('data', m => { if (m && typeof m === 'object' && c === conn) h.msg(String(m.topic), m.data); });
    c.on('close', () => { if (c === conn) h.gone(); });
  };
  return {
    unavailableText: 'Не загрузилась библиотека онлайна. Проверь интернет и обнови страницу.',
    available: () => typeof window.Peer === 'function',
    host(code, h) {
      peer = new Peer(PREFIX + code);
      const me = peer;
      peer.on('open', () => h.ready());
      peer.on('connection', c => {
        if (me !== peer) return;
        if (conn && conn.open) { c.on('open', () => { c.send({ topic: 'full' }); setTimeout(() => c.close(), 300); }); return; }
        conn = c; wire(c, h);
      });
      peer.on('error', e => {
        h.error(e.type === 'unavailable-id' ? 'Этот код уже занят. Закрой стол и создай заново.' : 'Ошибка сети: ' + e.type);
      });
      peer.on('disconnected', () => { try { me.reconnect(); } catch (e) {} });
    },
    join(code, nick, h) {
      peer = new Peer();
      const me = peer;
      peer.on('open', () => {
        if (me !== peer) return;
        conn = peer.connect(PREFIX + code, { reliable: true });
        const c = conn;
        c.on('open', () => { h.open(); c.send({ topic: 'hi', data: { nick } }); });
        wire(c, h);
      });
      peer.on('error', e => h.error(e.type === 'peer-unavailable' ? 'Стол не найден. Проверь код.' : 'Ошибка сети: ' + e.type));
    },
    send(topic, data) { if (conn && conn.open) { try { conn.send({ topic, data }); } catch (e) {} } },
    close() {
      try { conn && conn.close(); } catch (e) {}
      try { peer && peer.destroy(); } catch (e) {}
      conn = null; peer = null;
    },
  };
})();
