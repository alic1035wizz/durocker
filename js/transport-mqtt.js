/* Дурокер — канал онлайна для сайта: публичный MQTT-брокер по защищённому WebSocket.
   Работает через мобильный интернет и NAT, своего сервера не нужно. Если брокер недоступен,
   пробуем следующий. Хозяин и гость следят друг за другом «пульсом» раз в 4 секунды. */
'use strict';

const TR = (() => {
  const custom = new URLSearchParams(location.search).get('broker');
  const BROKERS = custom ? [custom] : [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt',
    'wss://test.mosquitto.org:8081/mqtt',
  ];
  const ROOT = 'durocker/v3/';
  const BEAT = 4000, LOST = 15000;
  const me = Math.random().toString(36).slice(2, 10);
  let cl = null, base = '', role = null, h = null, other = null, lastSeen = 0, lost = false, timers = [], nick = '', got = false;

  const now = () => Date.now();
  const clear = () => { timers.forEach(t => clearInterval(t)); timers = []; };
  function connect(done, fail) {
    let i = 0;
    const next = () => {
      if (i >= BROKERS.length) { fail(); return; }
      const url = BROKERS[i++];
      let c;
      try { c = mqtt.connect(url, { clientId: 'dk_' + me + '_' + Math.random().toString(36).slice(2, 6), connectTimeout: 6000, reconnectPeriod: 2000, clean: true, keepalive: 30 }); }
      catch (e) { next(); return; }
      let ok = false;
      const t = setTimeout(() => { if (!ok) { try { c.end(true); } catch (e) {} next(); } }, 8000);
      c.once('connect', () => { ok = true; clearTimeout(t); cl = c; done(); });
      c.on('error', () => {});
    };
    next();
  }
  function pub(box, t, d, to) {
    if (!cl) return;
    try { cl.publish(base + box, JSON.stringify({ f: me, t, d, to }), { qos: 1 }); } catch (e) {}
  }
  function listen(box, onMsg) {
    cl.subscribe(base + box, { qos: 1 });
    cl.on('message', (topic, payload) => {
      if (topic !== base + box) return;
      let m; try { m = JSON.parse(payload.toString()); } catch (e) { return; }
      if (!m || m.f === me || (m.to && m.to !== me)) return;
      onMsg(m);
    });
  }
  /* соперник пропал / вернулся */
  function watch() {
    timers.push(setInterval(() => {
      if (other && !lost && now() - lastSeen > LOST) { lost = true; h.gone(); }
    }, 2000));
  }
  const failText = 'Не удалось подключиться к серверу игры. Проверь интернет; если включён VPN — попробуй без него (или наоборот).';

  return {
    unavailableText: 'Не загрузилась библиотека онлайна. Проверь интернет и обнови страницу.',
    available: () => typeof window.mqtt === 'object' || typeof window.mqtt === 'function',
    host(code, hh) {
      this.close(); h = hh; role = 'host'; base = ROOT + code + '/';
      connect(() => {
        listen('h', m => {
          if (m.t === 'hi') {
            /* место занято живым гостем — второму отвечаем «стол полон» */
            if (other && other !== m.f && now() - lastSeen < LOST) { pub('g', 'full', null, m.f); return; }
            other = m.f; lastSeen = now(); lost = false; nick = (m.d && m.d.nick) || nick;
            h.msg('hi', m.d);
            return;
          }
          if (m.f !== other) return;
          lastSeen = now();
          if (lost) { lost = false; h.msg('hi', { nick }); }
          if (m.t !== 'hi' && m.t !== 'ping') h.msg(m.t, m.d);
        });
        timers.push(setInterval(() => { if (other) pub('g', 'hb', null, other); }, BEAT));
        watch();
        h.ready();
      }, () => h.error(failText));
    },
    join(code, nk, hh) {
      this.close(); h = hh; role = 'guest'; base = ROOT + code + '/'; got = false;
      connect(() => {
        listen('g', m => {
          if (m.t === 'full') { h.error('За этим столом уже играют двое.'); return; }
          if (other && m.f !== other && now() - lastSeen < LOST) return;
          other = m.f; lastSeen = now();
          if (lost) lost = false;
          if (m.t === 'st') { if (!got) { got = true; h.open(); } h.msg('st', m.d); }
          else if (m.t !== 'hb') h.msg(m.t, m.d);
        });
        const hi = () => pub('h', 'hi', { nick: nk });
        hi();
        /* пока стол не ответил — стучимся; потом шлём пульс */
        timers.push(setInterval(() => { if (!got) hi(); }, 2000));
        timers.push(setInterval(() => { if (got) pub('h', 'ping', null); }, BEAT));
        watch();
      }, () => h.error(failText));
    },
    send(topic, data) { pub(role === 'host' ? 'g' : 'h', topic, data, role === 'host' ? other : undefined); },
    close() {
      clear();
      if (cl) { try { cl.end(true); } catch (e) {} }
      cl = null; other = null; lost = false; got = false; lastSeen = 0;
    },
  };
})();
