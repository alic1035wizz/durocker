/* Дурокер — «Компания»: канал связи для стола на 3–4 игрока. Тот же публичный MQTT-брокер, что и у игры вдвоём,
   но свои темы: durocker/m1/<код>/h — сообщения хозяину, durocker/m1/<код>/g — от хозяина гостям (с адресатом или всем). */
'use strict';

const T4 = (() => {
  const custom = new URLSearchParams(location.search).get('broker');
  const BROKERS = custom ? [custom] : ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt', 'wss://test.mosquitto.org:8081/mqtt'];
  const ROOT = 'durocker/m1/';
  /* id вкладки живёт до её закрытия — после обновления страницы садимся на своё же место */
  const me = (() => { try { let v = sessionStorage.getItem('durocker-m4me'); if (!v) { v = Math.random().toString(36).slice(2, 10); sessionStorage.setItem('durocker-m4me', v); } return v; } catch (e) { return Math.random().toString(36).slice(2, 10); } })();
  let cl = null, base = '', role = null, timers = [];
  const available = () => typeof window.mqtt === 'object' || typeof window.mqtt === 'function';
  function connect(done, fail) {
    let i = 0;
    const next = () => {
      if (i >= BROKERS.length) { fail(); return; }
      const url = BROKERS[i++];
      let c, ok = false;
      try { c = mqtt.connect(url, { clientId: 'dk4_' + me + '_' + Math.random().toString(36).slice(2, 6), connectTimeout: 6000, reconnectPeriod: 2000, clean: true, keepalive: 30 }); }
      catch (e) { next(); return; }
      const t = setTimeout(() => { if (!ok) { try { c.end(true); } catch (e) {} next(); } }, 8000);
      c.once('connect', () => { ok = true; clearTimeout(t); cl = c; done(); });
      c.on('error', () => {});
    };
    next();
  }
  function pub(box, t, d, to) { if (cl) try { cl.publish(base + box, JSON.stringify({ f: me, t, d, to }), { qos: 1 }); } catch (e) {} }
  function listen(box, onMsg) {
    cl.subscribe(base + box, { qos: 1 });
    cl.on('message', (topic, payload) => {
      if (topic !== base + box) return;
      let m; try { m = JSON.parse(payload.toString()); } catch (e) { return; }
      if (!m || m.f === me || (m.to && m.to !== me)) return;
      onMsg(m);
    });
  }
  const fail = h => () => h.error('Не удалось подключиться к серверу игры. Проверь интернет; если включён VPN — попробуй без него (или наоборот).');
  return {
    me, available,
    host(code, h) {
      this.close(); role = 'host'; base = ROOT + code + '/';
      connect(() => {
        listen('h', m => h.msg(m.f, m.t, m.d));
        timers.push(setInterval(() => pub('g', 'hb', null), 4000));
        h.ready();
      }, fail(h));
    },
    join(code, nick, h) {
      this.close(); role = 'guest'; base = ROOT + code + '/';
      connect(() => {
        listen('g', m => h.msg(m.f, m.t, m.d));
        h.ready();
        timers.push(setInterval(() => pub('h', 'ping', { nick, v: VERSION }), 4000));
      }, fail(h));
    },
    /* хозяин → гостю (to) или всем; гость → хозяину */
    send(t, d, to) { pub(role === 'host' ? 'g' : 'h', t, d, to); },
    close() { timers.forEach(clearInterval); timers = []; if (cl) { try { cl.end(true); } catch (e) {} } cl = null; role = null; },
  };
})();
