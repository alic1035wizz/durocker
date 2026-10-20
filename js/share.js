/* ДурКер — «Момент дня» и общий помощник «поделиться файлом».
   Из локальной истории партий выбираем самый сильный момент дня (самая старшая комбинация / «могнул») и предлагаем
   отправить его в чат: картинкой-открыткой или видео-«кружком». Без сервера автопубликации в группу нет:
   публикует всегда сам игрок (см. README → «Что требует сервера»). */
'use strict';
const SHARE = (() => {
  const K = 'durocker-moments';
  const $s = id => document.getElementById(id);
  const E = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const rd = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const wr = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
  const day = () => { try { return todayKey(); } catch (e) { return new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10); } };
  const say = (t, ms) => { try { toast(t, ms); } catch (e) {} };
  /* артефакт Claude: у страницы нет ни ссылки, ни скачивания */
  const exportable = () => { try { return !(typeof TR !== 'undefined' && TR && TR.linkable === undefined); } catch (e) { return true; } };

  /* отправить файл: системное «Поделиться» (с файлом), иначе — скачивание */
  function sendFile(blob, name, text, btn) {
    try {
      const file = new File([blob], name, { type: blob.type });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], text }).catch(() => {}); return 'share'; }
    } catch (e) {}
    if (exportable()) {
      try {
        const u = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(u), 4000);
        say('Файл сохранён — отправь его в чат вручную', 4500);
        return 'download';
      } catch (e) {}
    }
    if (navigator.share) { navigator.share({ text }).catch(() => {}); return 'text'; }
    if (typeof copyText === 'function' && btn) copyText(text, btn);
    say('Текст скопирован. Видео — на сайте или в Telegram', 4500);
    return 'copy';
  }

  /* ---------- момент дня ---------- */
  function load() {
    try { const d = JSON.parse(rd(K) || '{}'); return d && d.day === day() ? d : { day: day(), best: null, n: 0 }; }
    catch (e) { return { day: day(), best: null, n: 0 }; }
  }
  /* чем сильнее комбинация защиты, тем выше счёт: тип → карты → «могнул» → победа в партии */
  const scoreOf = (m, won) => (m.t | 0) * 20 + (m.def ? m.def.length : 0) * 3 + (m.mognul ? 8 : 0) + (m.hype === 'legend' ? 6 : 0) + (won ? 2 : 0);
  let lastKey = '';
  function consider() {
    try {
      if (typeof REPLAY === 'undefined' || !G || !G.over) return;
      const key = ((typeof NET !== 'undefined' && NET) ? NET.code : 'b') + '|' + (SERIES && SERIES.games) + '|' + G.over + '|' + (SERIES && SERIES.p) + (SERIES && SERIES.b);
      if (key === lastKey) return; lastKey = key;
      if (typeof MODE !== 'undefined' && MODE && MODE.kind === 'tutorial') return;
      const m = REPLAY.best(); if (!m) return;
      const d = load(), sc = scoreOf(m, G.over === 'p');
      d.n = (d.n | 0) + 1;
      if (!d.best || sc > d.best.score) {
        d.best = { score: sc, m: { att: m.att, attName: m.attName, def: m.def, defName: m.defName, t: m.t, T: m.T, phrase: m.phrase, mognul: !!m.mognul, hype: m.hype || null, me: m.me, opp: m.opp, ok: m.ok || null } };
        wr(K, JSON.stringify(d));
        if (d.best.m.t >= 2) say('🌟 Новый «Момент дня» — ☰ → «Момент дня»', 3500);
      } else wr(K, JSON.stringify(d));
    } catch (e) { console.warn('[share]', e); }
  }

  let cssOn = false;
  function css() {
    if (cssOn) return; cssOn = true;
    const s = document.createElement('style');
    s.textContent = `.shw{position:fixed;inset:0;z-index:91;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:rgba(3,14,10,.92);padding:16px}
.shw img{width:min(86vw,56vh);height:auto;aspect-ratio:1;border-radius:16px;box-shadow:0 10px 40px rgba(0,0,0,.6);background:#0b3324}
.shw p{margin:0;font-size:13px;color:var(--muted,#9fb5ab);text-align:center}.shw h3{margin:0;font-family:var(--f-hard,monospace);font-size:15px;color:#ffd35c;letter-spacing:.06em}
.shw .row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}`;
    document.head.appendChild(s);
  }
  function openMoment() {
    css();
    try { closeSheets(); } catch (e) {}
    const d = load();
    if (!d.best) { say('Сегодня ещё нет момента — могни кого-нибудь 😏', 3500); return; }
    const m = d.best.m, dnm = t(String(m.defName || '')), anm = t(String(m.attName || '')).toLowerCase(), phr = m.phrase ? I18N.tr(m.phrase) : '';
    let cv;
    try { cv = postcardCanvas({ title: t('МОМЕНТ ДНЯ'), phrase: phr || t(m.mognul ? 'МОГНУЛ!' : 'ТЫ НЕ ДУРАК!'), m: { name: dnm, cards: m.def, vs: m.att, vsName: t(String(m.attName || '')) } }); }
    catch (e) { say('Не удалось собрать открытку', 3000); return; }
    const url = cv.toDataURL('image/png'), exp = exportable();
    const text = t('Момент дня в ДурКере: {d} против {a}! https://t.me/durocker_bot', { d: dnm, a: anm });
    const box = document.createElement('div'); box.className = 'shw'; box.id = 'momentWin';
    box.innerHTML = `<h3>🌟 МОМЕНТ ДНЯ · ${E(day())}</h3><img alt="Момент дня" src="${url}"><p>${E(dnm)} ${t('на')} ${E(anm)}${phr ? ' · ' + E(phr) : ''}</p>
      <div class="row">${exp ? '<button class="btn gold" type="button" data-mm="share">Поделиться</button>' : ''}<button class="btn orange" type="button" data-mm="circle">🎞 Кружок</button><button class="btn grey" type="button" data-mm="close">Закрыть</button></div>`;
    document.body.appendChild(box);
    box.onclick = e => {
      const k = e.target.closest('[data-mm]');
      if (!k) { if (e.target === box) box.remove(); return; }
      const a = k.dataset.mm;
      if (a === 'close') box.remove();
      else if (a === 'circle') { box.remove(); if (typeof REPLAY !== 'undefined') REPLAY.open({ ...m, me: m.me, opp: m.opp, mine: true }, 'circle'); }
      else if (a === 'share') cv.toBlob(b => { if (b) sendFile(b, 'durocker-moment.png', text, k); }, 'image/png');
    };
  }

  /* ---------- встраивание ---------- */
  BUS.on('over', () => { consider(); });
  BUS.menuKey('moment', openMoment);
  BUS.on('menu:open', () => {
    try {
      const g = document.querySelector('#menuIn .menugrid'); if (!g || g.querySelector('[data-go="moment"]')) return;
      const d = load();
      const b = document.createElement('button'); b.type = 'button'; b.className = 'mi'; b.dataset.go = 'moment';
      b.innerHTML = `<b>Момент дня 🌟</b><small>${d.best ? E(t('{n} — поделись в чат', { n: t(String(d.best.m.defName || '')) })) : t('самая сильная комбинация дня')}</small>`;
      const ref = g.querySelector('[data-go="profile"]');
      g.insertBefore(b, ref || null);
    } catch (e) {}
  });
  return { sendFile, openMoment, load, scoreOf, exportable };
})();
