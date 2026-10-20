/* ДурКер — канал онлайна для страницы внутри Claude: комната Claude (room capability).
   Подключается вместо transport-peer.js при сборке страницы tools/build-artifact.py. */
'use strict';

const TR = (() => {
  let room = null, other = null, unsub = [], hiTimer = null;
  const lobbyP = () => (window.claude && window.claude.use ? window.claude.use('room').catch(() => null) : Promise.resolve(null));
  const off = () => { unsub.forEach(u => { try { u(); } catch (e) {} }); unsub = []; clearTimeout(hiTimer); };
  async function open(code, h) {
    const lobby = await lobbyP();
    if (!lobby) { h.error('Онлайн недоступен в этом просмотре. Открой страницу в Claude, войдя в аккаунт.'); return null; }
    try { return await lobby.join('durak-' + code); }
    catch (e) { h.error('Не удалось подключиться к столу. Попробуй ещё раз.'); return null; }
  }
  const watchGone = (h) => room.onPeers(ch => { if (other && !ch.peers.some(p => p.peer === other)) h.gone(); });
  return {
    unavailableText: 'Онлайн недоступен в этом просмотре.',
    available: () => !!(window.claude && window.claude.use),
    async host(code, h) {
      off(); other = null;
      room = await open(code, h);
      if (!room) return;
      room.presence({ role: 'host' }).catch(() => {});
      unsub.push(
        room.on('hi', m => {
          if (m.sameTab) return;
          /* место занято живым гостем — чужие «привет» игнорируем */
          if (other && other !== m.peer && room.peers().some(p => p.peer === other)) return;
          other = m.peer; h.msg('hi', m.data);
        }),
        room.on('act', m => { if (m.peer === other) h.msg('act', m.data); }),
        room.on('react', m => { if (m.peer === other) h.msg('react', m.data); }),
        room.on('rematch', m => { if (m.peer === other) h.msg('rematch', m.data); }),
        room.on('bet', m => { if (m.peer === other) h.msg('bet', m.data); }),
        room.on('dbl', m => { if (m.peer === other) h.msg('dbl', m.data); }),
        watchGone(h),
      );
      h.ready();
    },
    async join(code, nick, h) {
      off(); other = null;
      room = await open(code, h);
      if (!room) return;
      room.presence({ role: 'guest' }).catch(() => {});
      let got = false;
      unsub.push(
        room.on('st', m => {
          if (m.isMe) return;
          if (other && other !== m.peer && room.peers().some(p => p.peer === other)) return;
          if (!got) { got = true; h.open(); }
          other = m.peer; h.msg('st', m.data);
        }),
        room.on('react', m => { if (!m.isMe && m.peer === other) h.msg('react', m.data); }),
        room.on('bet', m => { if (!m.isMe && m.peer === other) h.msg('bet', m.data); }),
        room.on('dbl', m => { if (!m.isMe && m.peer === other) h.msg('dbl', m.data); }),
        watchGone(h),
      );
      const hi = () => { if (!got && room) { room.emit('hi', { nick }).catch(() => {}); hiTimer = setTimeout(hi, 2000); } };
      hi();
    },
    send(topic, data) { if (room) room.emit(topic, data).catch(() => {}); },
    close() { off(); if (room) room.leave().catch(() => {}); room = null; other = null; },
  };
})();
