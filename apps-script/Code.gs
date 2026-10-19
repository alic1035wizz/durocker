/* ДурКер — «сервер» на Google Apps Script + Google Таблица.
   Веб-приложение (doGet/doPost): регистрация игроков, отчёты о партиях (очки считает сервер), таблица лидеров,
   сезоны, двойное подтверждение онлайн-матчей, турниры на выбывание и Telegram-бот (вебхук на этот же адрес).
   Токен бота хранится только в свойствах скрипта: TG_TOKEN (Настройки проекта → Свойства скрипта). */

var GAME_URL = 'https://alic1035wizz.github.io/durocker/';
var BOT_LINK = 'https://t.me/durocker_bot';
var TZ = 'Europe/Moscow';

/* очки за победу: считает сервер, клиент присылает только кого победил */
var LEVEL_PTS = { student: 1, valera: 2, sharper: 4, boss: 5, final: 8 };
var KIND_PTS = { daily: 3, weekly: 5, online: 5, company: 2 };
var BOT_CAP = 60;          // не больше очков за ботов в сутки
var REPORT_GAP = 20;       // секунд между отчётами одного игрока

var SCHEMA = {
  Players: ['pid', 'hash', 'nick', 'title', 'frame', 'rating', 'wins', 'games', 'online_w', 'career', 'career_done',
    'season_k', 'season_r', 'season_w', 'season_g', 'season_pk', 'season_pr', 'champion', 'bot_k', 'bot_pts', 'wk_k', 'created', 'updated'],
  Games: ['ts', 'pid', 'kind', 'opp', 'result', 'pts', 'match_id'],
  Daily: ['k', 'pid', 'res', 'pen'],
  Matches: ['match_id', 'host_pid', 'guest_pid', 'host_report', 'guest_report', 'status', 'ts'],
  Tournaments: ['code', 'name', 'size', 'status', 'creator', 'chat_id', 'winner', 'created'],
  TournamentPlayers: ['code', 'pid', 'nick', 'seed'],
  TournamentMatches: ['code', 'round', 'n', 'a_pid', 'b_pid', 'a_rep', 'b_rep', 'winner', 'status'],
  Chats: ['chat_id', 'title', 'added'],
};

/* ================= таблица ================= */
function book_() {
  try { var a = SpreadsheetApp.getActive(); if (a) return a; } catch (e) {}
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  var s = SpreadsheetApp.create('ДурКер — база');
  props.setProperty('SHEET_ID', s.getId());
  return s;
}
function sheet_(name) {
  var b = book_(), sh = b.getSheetByName(name), head = SCHEMA[name];
  if (!sh) { sh = b.insertSheet(name); sh.appendRow(head); try { sh.setFrozenRows(1); } catch (e) {} return sh; }
  /* новые колонки дописываем справа, старые данные не трогаем */
  var cur = sh.getDataRange().getValues()[0] || [];
  var miss = head.filter(function (h) { return cur.indexOf(h) < 0; });
  if (miss.length) sh.getRange(1, cur.length + 1, 1, miss.length).setValues([miss]);
  return sh;
}
function table_(name) {
  var sh = sheet_(name), v = sh.getDataRange().getValues(), head = v[0];
  var rows = v.slice(1).map(function (r, i) { var o = { _r: i + 2 }; head.forEach(function (h, j) { o[h] = r[j]; }); return o; });
  return {
    rows: rows,
    find: function (f) { for (var i = 0; i < rows.length; i++) if (f(rows[i])) return rows[i]; return null; },
    filter: function (f) { return rows.filter(f); },
    add: function (o) {
      sh.appendRow(head.map(function (h) { return o[h] === undefined ? '' : o[h]; }));
      o._r = rows.length + 2; rows.push(o); return o;
    },
    save: function (o) { sh.getRange(o._r, 1, 1, head.length).setValues([head.map(function (h) { return o[h] === undefined ? '' : o[h]; })]); },
  };
}

/* ================= мелочи ================= */
function num_(x) { var n = Number(x); return isFinite(n) ? n : 0; }
function now_() { return Date.now(); }
function day_(t) { return Utilities.formatDate(new Date(t || now_()), TZ, 'yyyy-MM-dd'); }
function month_(t) { return Utilities.formatDate(new Date(t || now_()), TZ, 'yyyy-MM'); }
function prevMonth_(k) { var y = +k.slice(0, 4), m = +k.slice(5, 7) - 1; if (m < 1) { m = 12; y--; } return y + '-' + (m < 10 ? '0' : '') + m; }
var MONTH_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
function hex_(bytes) { return bytes.map(function (b) { var v = (b + 256) % 256; return (v < 16 ? '0' : '') + v.toString(16); }).join(''); }
function hash_(s) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8)); }
function clean_(s, max) { return String(s == null ? '' : s).replace(/[\u0000-\u001f​-‏‪-‮<>]/g, '').trim().slice(0, max || 16); }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ok_(o) { o = o || {}; o.ok = true; return o; }
function err_(e) { return { ok: false, error: e }; }
function withLock_(f) {
  var l = LockService.getScriptLock();
  l.waitLock(20000);
  try { return f(); } finally { l.releaseLock(); }
}
var CODE_CH = 'abcdefghjkmnpqrstuvwxyz23456789';
function code_() { var s = ''; for (var i = 0; i < 4; i++) s += CODE_CH[Math.floor(Math.random() * CODE_CH.length)]; return s; }

/* ================= вход ================= */
function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    if (p.a === 'ping') return json_(ok_({ t: now_(), day: day_(), month: month_() }));
    if (p.a === 'board') return json_(ok_(board_()));
    if (p.a === 'top') return json_(ok_({ list: top_(p.tab || 'rating', 50) }));
    if (p.a === 't_state') return json_(tState_(p.code));
    return json_(err_('unknown'));
  } catch (x) { return json_(err_(String(x && x.message || x))); }
}
function doPost(e) {
  var body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) { return json_(err_('bad json')); }
  try {
    if (body.update_id !== undefined) { tgUpdate_(body); return json_({ ok: true }); }
    return json_(api_(body));
  } catch (x) { return json_(err_(String(x && x.message || x))); }
}
function api_(b) {
  switch (b.a) {
    case 'register': return register_(b);
    case 'report': return report_(b);
    case 'profile': return profile_(b);
    case 'board': return ok_(board_());
    case 't_create': return tCreate_(b);
    case 't_join': return tJoin_(b);
    case 't_state': return tState_(b.code);
    case 't_report': return tReport_(b);
    default: return err_('unknown');
  }
}

/* ================= игроки ================= */
function register_(b) {
  var pid = String(b.pid || '');
  if (!/^[a-z0-9]{8,16}$/.test(pid)) return err_('bad pid');
  return withLock_(function () {
    var P = table_('Players'), me = P.find(function (r) { return r.pid === pid; });
    var secret = Utilities.getUuid().replace(/-/g, '');
    if (me) {
      /* pid уже занят: перерегистрация только со старым секретом */
      if (me.hash && (!b.secret || hash_(b.secret) !== me.hash)) return err_('taken');
      me.hash = hash_(secret); me.nick = clean_(b.nick) || me.nick; me.updated = now_(); P.save(me);
    } else {
      P.add({ pid: pid, hash: hash_(secret), nick: clean_(b.nick) || 'Игрок', title: '', frame: '', rating: 0, wins: 0, games: 0, online_w: 0,
        career: 0, career_done: false, season_k: month_(), season_r: 0, season_w: 0, season_g: 0, season_pk: '', season_pr: 0, champion: '',
        bot_k: '', bot_pts: 0, wk_k: '', created: now_(), updated: now_() });
    }
    CacheService.getScriptCache().remove('board');
    return ok_({ pid: pid, secret: secret });
  });
}
/* найти и проверить игрока; заодно обновить ник/титул/рамку/карьеру и сезон */
function auth_(P, b) {
  var me = P.find(function (r) { return r.pid === String(b.pid || ''); });
  if (!me || !b.secret || hash_(b.secret) !== me.hash) return null;
  if (b.nick) me.nick = clean_(b.nick) || me.nick;
  if (b.title !== undefined) me.title = clean_(b.title, 32);
  if (b.frame !== undefined) me.frame = /^[a-z0-9-]{0,16}$/.test(String(b.frame)) ? String(b.frame) : me.frame;
  if (b.career !== undefined) { var c = Math.max(0, Math.min(50, Math.floor(num_(b.career)))); if (c > num_(me.career)) me.career = c; }
  if (b.careerDone === true) me.career_done = true;
  seasonRoll_(me);
  return me;
}
function seasonRoll_(me) {
  var k = month_();
  if (me.season_k === k) return;
  if (me.season_k === prevMonth_(k)) { me.season_pk = me.season_k; me.season_pr = num_(me.season_r); }
  me.season_k = k; me.season_r = 0; me.season_w = 0; me.season_g = 0;
}
function profile_(b) {
  return withLock_(function () {
    var P = table_('Players'), me = auth_(P, b);
    if (!me) return err_('auth');
    me.updated = now_(); P.save(me);
    CacheService.getScriptCache().remove('board');
    return ok_({ me: pub_(me) });
  });
}

/* ================= отчёт о партии ================= */
function report_(b) {
  var kind = String(b.kind || ''), win = b.result === 'win';
  if (['bot', 'daily', 'weekly', 'online', 'company'].indexOf(kind) < 0) return err_('bad kind');
  if (b.result !== 'win' && b.result !== 'lose') return err_('bad result');
  var cache = CacheService.getScriptCache();
  return withLock_(function () {
    var P = table_('Players'), me = auth_(P, b);
    if (!me) return err_('auth');
    /* онлайн засчитывается только когда оба подтвердят — частоту не ограничиваем */
    if (kind === 'online') return online_(P, me, b);
    if (cache.get('rp_' + me.pid)) return err_('too often');
    cache.put('rp_' + me.pid, '1', REPORT_GAP);
    var today = day_(), pts = 0, note = '';
    if (kind === 'bot' || kind === 'company') {
      if (me.bot_k !== today) { me.bot_k = today; me.bot_pts = 0; }
      if (win) {
        var want = kind === 'company' ? KIND_PTS.company : (LEVEL_PTS[b.oppLevel] || 1);
        pts = Math.max(0, Math.min(want, BOT_CAP - num_(me.bot_pts)));
        if (pts < want) note = 'cap';
        me.bot_pts = num_(me.bot_pts) + pts;
      }
    } else if (kind === 'daily') {
      var k = String(b.dailyKey || '');
      if (!/^\d{4}-\d\d-\d\d$/.test(k) || (k !== today && k !== day_(now_() - 864e5))) return err_('bad day');
      var D = table_('Daily');
      if (D.find(function (r) { return r.k === k && r.pid === me.pid; })) return err_('daily done');
      D.add({ k: k, pid: me.pid, res: win ? 'win' : 'lose', pen: Math.max(0, Math.min(60, Math.floor(num_(b.pen)))) });
      if (win) pts = KIND_PTS.daily;
    } else if (kind === 'weekly') {
      if (me.wk_k === today) return err_('weekly done');
      me.wk_k = today;
      if (win) pts = KIND_PTS.weekly;
    }
    award_(me, win, pts);
    me.updated = now_(); P.save(me);
    table_('Games').add({ ts: now_(), pid: me.pid, kind: kind, opp: clean_(b.opp, 24), result: win ? 'win' : 'lose', pts: pts, match_id: '' });
    cache.remove('board');
    return ok_({ pts: pts, note: note, me: pub_(me) });
  });
}
function award_(me, win, pts) {
  me.games = num_(me.games) + 1; me.season_g = num_(me.season_g) + 1;
  if (win) { me.wins = num_(me.wins) + 1; me.season_w = num_(me.season_w) + 1; }
  me.rating = num_(me.rating) + pts; me.season_r = num_(me.season_r) + pts;
}
/* онлайн-матч: хозяин и гость присылают отчёт с одним matchId; засчитывается, когда результаты сходятся */
function online_(P, me, b) {
  var id = String(b.matchId || ''), role = b.role === 'guest' ? 'guest' : 'host';
  if (!/^[a-z0-9_]{4,40}$/.test(id)) return err_('bad match');
  var M = table_('Matches'), m = M.find(function (r) { return r.match_id === id; });
  if (!m) m = M.add({ match_id: id, host_pid: '', guest_pid: '', host_report: '', guest_report: '', status: 'pending', ts: now_() });
  if (m.status !== 'pending') return ok_({ status: m.status, me: pub_(me) });
  var other = role === 'host' ? 'guest' : 'host';
  if (m[other + '_pid'] === me.pid) return err_('same player');
  if (m[role + '_pid'] && m[role + '_pid'] !== me.pid) return err_('seat taken');
  m[role + '_pid'] = me.pid; m[role + '_report'] = b.result;
  if (m.host_report && m.guest_report) {
    if (m.host_report !== m.guest_report) {
      m.status = 'ok';
      var hw = m.host_report === 'win';
      var H = P.find(function (r) { return r.pid === m.host_pid; }), G = P.find(function (r) { return r.pid === m.guest_pid; });
      [[H, hw], [G, !hw]].forEach(function (x) {
        if (!x[0]) return;
        seasonRoll_(x[0]);
        award_(x[0], x[1], x[1] ? KIND_PTS.online : 0);
        if (x[1]) x[0].online_w = num_(x[0].online_w) + 1;
        x[0].updated = now_(); P.save(x[0]);
        table_('Games').add({ ts: now_(), pid: x[0].pid, kind: 'online', opp: '', result: x[1] ? 'win' : 'lose', pts: x[1] ? KIND_PTS.online : 0, match_id: id });
      });
      CacheService.getScriptCache().remove('board');
    } else m.status = 'disputed';
  }
  M.save(m);
  me.updated = now_(); P.save(me);
  return ok_({ status: m.status, me: pub_(me) });
}

/* ================= таблица лидеров ================= */
function pub_(r) {
  return { id: r.pid, n: String(r.nick || 'Игрок'), r: num_(r.rating), w: num_(r.wins), g: num_(r.games), o: num_(r.online_w),
    c: num_(r.career), cd: r.career_done === true || r.career_done === 'TRUE', ttl: String(r.title || ''), fr: String(r.frame || ''),
    tc: String(r.champion || ''), sk: String(r.season_k || ''), sr: num_(r.season_r), sw: num_(r.season_w), sg: num_(r.season_g),
    spk: String(r.season_pk || ''), spr: num_(r.season_pr), t: num_(r.updated) };
}
function board_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('board');
  if (hit) return JSON.parse(hit);
  var since = now_() - 60 * 864e5, k = day_(), mk = month_(), pk = prevMonth_(mk);
  var players = table_('Players').filter(function (r) { return num_(r.updated) >= since; }).map(pub_)
    .sort(function (a, b) { return b.r - a.r || b.w - a.w; }).slice(0, 300);
  var daily = table_('Daily').filter(function (r) { return r.k === k; }).map(function (r) { return { id: r.pid, res: r.res, pen: num_(r.pen) }; });
  /* чемпион прошлого месяца: у кого больше очков за тот месяц */
  var champ = null;
  players.forEach(function (p) {
    var v = p.sk === pk ? p.sr : p.spk === pk ? p.spr : 0;
    if (v > 0 && (!champ || v > champ.v)) champ = { id: p.id, n: p.n, v: v, k: pk, ttl: 'Чемпион ' + MONTH_GEN[+pk.slice(5, 7) - 1] };
  });
  var out = { day: k, month: mk, players: players, daily: daily, champion: champ, t: now_() };
  try { cache.put('board', JSON.stringify(out), 60); } catch (e) {}
  return out;
}
function top_(tab, n) {
  var B = board_(), list;
  if (tab === 'season') list = B.players.filter(function (p) { return p.sk === B.month && p.sr > 0; }).sort(function (a, b) { return b.sr - a.sr; });
  else if (tab === 'career') list = B.players.filter(function (p) { return p.c > 0 || p.cd; }).sort(function (a, b) { return (b.cd - a.cd) || b.c - a.c; });
  else if (tab === 'daily') {
    var by = {}; B.players.forEach(function (p) { by[p.id] = p; });
    list = B.daily.map(function (d) { var p = by[d.id] || { id: d.id, n: 'Игрок' }; return { id: d.id, n: p.n, res: d.res, pen: d.pen }; })
      .sort(function (a, b) { return a.res === b.res ? (a.res === 'win' ? b.pen - a.pen : a.pen - b.pen) : a.res === 'win' ? -1 : 1; });
  } else list = B.players.filter(function (p) { return p.r > 0; });
  return list.slice(0, n || 50);
}

/* ================= турниры ================= */
function tCreate_(b, fromChat) {
  var size = +b.size === 8 ? 8 : 4;
  return withLock_(function () {
    var P = table_('Players'), me = fromChat ? null : auth_(P, b);
    if (!fromChat && !me) return err_('auth');
    var T = table_('Tournaments'), code;
    do { code = code_(); } while (T.find(function (r) { return r.code === code; }));
    T.add({ code: code, name: clean_(b.name, 24) || ('Турнир ' + code.toUpperCase()), size: size, status: 'open', creator: me ? me.pid : '',
      chat_id: b.chat_id ? String(b.chat_id) : '', winner: '', created: now_() });
    if (me) { table_('TournamentPlayers').add({ code: code, pid: me.pid, nick: me.nick, seed: 0 }); me.updated = now_(); P.save(me); }
    return ok_({ code: code, state: tStateRaw_(code) });
  });
}
function tJoin_(b) {
  var code = String(b.code || '').toLowerCase();
  return withLock_(function () {
    var P = table_('Players'), me = auth_(P, b);
    if (!me) return err_('auth');
    var T = table_('Tournaments'), t = T.find(function (r) { return r.code === code; });
    if (!t) return err_('no tournament');
    var TP = table_('TournamentPlayers'), list = TP.filter(function (r) { return r.code === code; });
    if (list.some(function (r) { return r.pid === me.pid; })) return ok_({ state: tStateRaw_(code) });
    if (t.status !== 'open') return err_('started');
    if (list.length >= num_(t.size)) return err_('full');
    TP.add({ code: code, pid: me.pid, nick: me.nick, seed: 0 });
    list.push({ code: code, pid: me.pid, nick: me.nick });
    if (list.length >= num_(t.size)) tStart_(T, t, TP, list);
    return ok_({ state: tStateRaw_(code) });
  });
}
function tStart_(T, t, TP, list) {
  /* случайная посадка */
  var order = list.map(function (r) { return r.pid; });
  for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = order[i]; order[i] = order[j]; order[j] = x; }
  TP.filter(function (r) { return r.code === t.code; }).forEach(function (r) { r.seed = order.indexOf(r.pid) + 1; TP.save(r); });
  var TM = table_('TournamentMatches');
  for (var k = 0; k < order.length / 2; k++) TM.add({ code: t.code, round: 1, n: k + 1, a_pid: order[2 * k], b_pid: order[2 * k + 1], a_rep: '', b_rep: '', winner: '', status: 'pending' });
  t.status = 'running'; T.save(t);
  if (t.chat_id) tgSend(t.chat_id, '🏆 <b>' + esc_(t.name) + '</b> стартовал! ' + order.length + ' игроков, матчи до 2 побед.\nСетка — в игре: «Турнир» → код <code>' + t.code.toUpperCase() + '</code>');
}
function tReport_(b) {
  var code = String(b.code || '').toLowerCase(), round = Math.floor(num_(b.round)), n = Math.floor(num_(b.n));
  if (b.result !== 'win' && b.result !== 'lose') return err_('bad result');
  return withLock_(function () {
    var P = table_('Players'), me = auth_(P, b);
    if (!me) return err_('auth');
    var T = table_('Tournaments'), t = T.find(function (r) { return r.code === code; });
    if (!t || t.status !== 'running') return err_('not running');
    var TM = table_('TournamentMatches'), m = TM.find(function (r) { return r.code === code && num_(r.round) === round && num_(r.n) === n; });
    if (!m || m.status !== 'pending') return ok_({ state: tStateRaw_(code) });
    var side = m.a_pid === me.pid ? 'a' : m.b_pid === me.pid ? 'b' : '';
    if (!side) return err_('not your match');
    m[side + '_rep'] = b.result;
    if (m.a_rep && m.b_rep) {
      if (m.a_rep !== m.b_rep) { m.winner = m.a_rep === 'win' ? m.a_pid : m.b_pid; m.status = 'done'; }
      else { m.a_rep = ''; m.b_rep = ''; } // результаты не сошлись — матч переигрывают
    }
    TM.save(m);
    if (m.status === 'done') tAdvance_(P, T, t, TM, round);
    return ok_({ state: tStateRaw_(code) });
  });
}
function tAdvance_(P, T, t, TM, round) {
  var cur = TM.filter(function (r) { return r.code === t.code && num_(r.round) === round; }).sort(function (a, b) { return num_(a.n) - num_(b.n); });
  if (cur.some(function (r) { return r.status !== 'done'; })) return;
  var winners = cur.map(function (r) { return r.winner; });
  if (winners.length === 1) {
    t.status = 'done'; t.winner = winners[0]; T.save(t);
    var w = P.find(function (r) { return r.pid === winners[0]; });
    if (w) { w.champion = 'Чемпион турнира «' + clean_(t.name, 24) + '»'; w.updated = now_(); P.save(w); }
    CacheService.getScriptCache().remove('board');
    if (t.chat_id) tgSend(t.chat_id, '👑 <b>' + esc_(w ? w.nick : 'Победитель') + '</b> выиграл турнир «' + esc_(t.name) + '»! Титул «Чемпион турнира» — его.');
    return;
  }
  for (var k = 0; k < winners.length / 2; k++) TM.add({ code: t.code, round: round + 1, n: k + 1, a_pid: winners[2 * k], b_pid: winners[2 * k + 1], a_rep: '', b_rep: '', winner: '', status: 'pending' });
  if (t.chat_id) tgSend(t.chat_id, '⚔️ «' + esc_(t.name) + '»: ' + (winners.length === 2 ? 'финал' : 'раунд ' + (round + 1)) + ' начинается!');
}
function tStateRaw_(code) {
  code = String(code || '').toLowerCase();
  var t = table_('Tournaments').find(function (r) { return r.code === code; });
  if (!t) return null;
  var players = table_('TournamentPlayers').filter(function (r) { return r.code === code; }).map(function (r) { return { pid: r.pid, nick: String(r.nick), seed: num_(r.seed) }; });
  var matches = table_('TournamentMatches').filter(function (r) { return r.code === code; })
    .map(function (r) { return { round: num_(r.round), n: num_(r.n), a: r.a_pid, b: r.b_pid, ar: r.a_rep, br: r.b_rep, winner: r.winner, status: r.status }; });
  return { code: code, name: String(t.name), size: num_(t.size), status: t.status, winner: t.winner, players: players, matches: matches };
}
function tState_(code) { var s = tStateRaw_(code); return s ? ok_({ state: s }) : err_('no tournament'); }

/* ================= Telegram ================= */
function tgToken_() { return PropertiesService.getScriptProperties().getProperty('TG_TOKEN'); }
function tgCall_(method, payload) {
  var tok = tgToken_();
  if (!tok) return null;
  var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + tok + '/' + method, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true,
  });
  try { return JSON.parse(r.getContentText()); } catch (e) { return null; }
}
function tgSend(chatId, html, markup) {
  var p = { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true };
  if (markup) p.reply_markup = markup;
  return tgCall_('sendMessage', p);
}
function playBtn_(isPrivate, startapp) {
  if (isPrivate && !startapp) return { inline_keyboard: [[{ text: '🃏 Играть', web_app: { url: GAME_URL } }]] };
  return { inline_keyboard: [[{ text: startapp ? '🏆 Вступить' : '🃏 Играть', url: BOT_LINK + '?startapp' + (startapp ? '=' + startapp : '') }]] };
}
function medal_(i) { return ['🥇', '🥈', '🥉'][i] || (i + 1) + '.'; }
function topText_() {
  var l = top_('rating', 10);
  if (!l.length) return '🏆 <b>Таблица лидеров</b>\nПока пусто — сыграй первым!';
  return '🏆 <b>Топ-10 ДурКера</b>\n' + l.map(function (p, i) { return medal_(i) + ' ' + esc_(p.n) + ' — <b>' + p.r + '</b>' + (p.tc ? ' 👑' : ''); }).join('\n');
}
function dailyText_() {
  var l = top_('daily', 10), k = day_();
  var head = '📅 <b>Ежедневная раздача · ' + k.slice(8, 10) + '.' + k.slice(5, 7) + '</b>\n';
  if (!l.length) return head + 'Сегодня ещё никто не сыграл. Ты первый?';
  var wins = l.filter(function (d) { return d.res === 'win'; });
  var hero = wins[0] ? '\n🔥 Сегодня в дейли всех порвал <b>' + esc_(wins[0].n) + '</b>!' : '';
  return head + l.map(function (d, i) { return medal_(i) + ' ' + esc_(d.n) + ' — ' + (d.res === 'win' ? '✅ победа, сопернику +' + d.pen : '❌ +' + d.pen + ' себе'); }).join('\n') + hero;
}
function tgUpdate_(u) {
  /* Telegram может прислать то же обновление повторно — отсекаем */
  var cache = CacheService.getScriptCache(), key = 'tg_' + u.update_id;
  if (cache.get(key)) return;
  cache.put(key, '1', 21600);
  var m = u.message || u.channel_post;
  if (!m || !m.text) return;
  var chat = m.chat, priv = chat.type === 'private';
  var parts = m.text.trim().split(/\s+/), cmd = parts[0].toLowerCase().replace(/@.*$/, '');
  if (cmd === '/start' || cmd === '/play') {
    tgSend(chat.id, '🃏 <b>ДурКер</b> — дурак, где отбиваются покерными комбинациями.\n\n♠️ Пара бьёт пару, стрит — две пары\n🔥 «ТЕБЯ МОГНУЛИ» на каждый мощный ход\n🏙 Карьера «С подъезда в казино»\n👥 Онлайн с друзьями и турниры\n\nКоманды: /top · /daily · /tournament 4 · /subscribe', playBtn_(priv));
  } else if (cmd === '/top') tgSend(chat.id, topText_(), playBtn_(priv));
  else if (cmd === '/daily') tgSend(chat.id, dailyText_(), playBtn_(priv));
  else if (cmd === '/tournament') {
    var size = parts[1] === '8' ? 8 : 4, name = clean_(parts.slice(2).join(' '), 24) || (chat.title ? clean_(chat.title, 20) : 'Турнир');
    var r = tCreate_({ size: size, name: name, chat_id: chat.id }, true);
    if (r.ok) tgSend(chat.id, '🏆 <b>' + esc_(name) + '</b> — турнир на ' + size + ' игроков, матчи до 2 побед.\nЖми «Вступить», пока есть места. Код: <code>' + r.code.toUpperCase() + '</code>', playBtn_(false, 'tj_' + r.code));
  } else if (cmd === '/subscribe') {
    withLock_(function () {
      var C = table_('Chats');
      if (!C.find(function (r) { return String(r.chat_id) === String(chat.id); })) C.add({ chat_id: String(chat.id), title: clean_(chat.title || chat.username || '', 40), added: now_() });
    });
    tgSend(chat.id, '🔔 Подписал этот чат: каждый вечер в 21:00 — итоги дня и топ-3.');
  } else if (cmd === '/unsubscribe') {
    withLock_(function () {
      var C = table_('Chats'), r = C.find(function (x) { return String(x.chat_id) === String(chat.id); });
      if (r) { r.chat_id = ''; C.save(r); }
    });
    tgSend(chat.id, '🔕 Больше не пишу сюда итоги дня.');
  }
}
/* итоги дня в подписанные чаты — триггер по времени, 21:00 МСК */
function dailyDigest() {
  var chats = table_('Chats').filter(function (r) { return r.chat_id; });
  if (!chats.length) return;
  var top3 = top_('rating', 3);
  var text = dailyText_() + (top3.length ? '\n\n🏆 <b>Топ-3 рейтинга</b>\n' + top3.map(function (p, i) { return medal_(i) + ' ' + esc_(p.n) + ' — ' + p.r; }).join('\n') : '');
  chats.forEach(function (c) { tgSend(c.chat_id, text, playBtn_(false)); });
}

/* ================= запустить один раз вручную ================= */
/* 1) после «Развернуть → Новое развёртывание» — подключает бота к этому веб-приложению */
function setWebhook() {
  var url = ScriptApp.getService().getUrl();
  if (!tgToken_()) throw new Error('Сначала добавь свойство скрипта TG_TOKEN (Настройки проекта → Свойства скрипта)');
  var r = tgCall_('setWebhook', { url: url, drop_pending_updates: true, allowed_updates: ['message', 'channel_post'] });
  tgCall_('setMyCommands', { commands: [
    { command: 'start', description: 'Играть' }, { command: 'top', description: 'Топ-10' }, { command: 'daily', description: 'Итоги дейли' },
    { command: 'tournament', description: 'Турнир: /tournament 4 или 8' }, { command: 'subscribe', description: 'Итоги дня в этот чат' },
  ] });
  Logger.log(JSON.stringify(r));
  return r;
}
/* 2) ежедневные итоги в 21:00 по Москве */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'dailyDigest') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('dailyDigest').timeBased().atHour(21).everyDays(1).inTimezone(TZ).create();
}
/* 3) создать листы сразу (необязательно — создаются сами при первом запросе) */
function setup() { Object.keys(SCHEMA).forEach(sheet_); }
