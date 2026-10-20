/* ДурКер — локализация. Русский текст в коде остаётся «ключом», английский берётся из словарей js/i18n/en-*.js.
   t('Русская строка {n}', {n: 3})  → английская, если язык en и перевод есть; иначе русская.
   Для статичного HTML и всплывающих подсказок работает наблюдатель за DOM (точное совпадение или шаблон). */
(function () {
  'use strict';
  const LS = 'durker-lang';
  let lang = 'ru';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q === 'en' || q === 'ru') localStorage.setItem(LS, q);
    const saved = localStorage.getItem(LS);
    if (saved === 'en' || saved === 'ru') lang = saved;
    else lang = /^ru|^uk|^be|^kk/i.test(navigator.language || 'ru') ? 'ru' : 'en';
  } catch (e) {}
  const dict = Object.create(null);     // 'ru' -> 'en'
  const patterns = [];                  // [{re, keys, en}] для строк с {имя}
  const esc = s => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  function add(map) {
    for (const k in map) {
      dict[k] = map[k];
      if (k.indexOf('{') >= 0) {
        const keys = [];
        const src = esc(k).replace(/\{(\w+)\}/g, (_, n) => { keys.push(n); return '([\\s\\S]+?)'; });
        patterns.push({ re: new RegExp('^' + src + '$'), keys, en: map[k] });
      }
    }
  }
  const fill = (s, v) => v ? s.replace(/\{(\w+)\}/g, (m, n) => (n in v ? v[n] : m)) : s;
  function t(ru, vars) {
    if (typeof ru !== 'string') return ru;
    const en = lang === 'en' && dict[ru];
    return fill(en || ru, vars);
  }
  /* перевести уже собранную строку (для DOM): точное совпадение или шаблон */
  function tr(s) {
    if (lang !== 'en' || !s) return s;
    const core = s.trim();
    if (!core || !/[А-Яа-яЁё]/.test(core)) return s;
    let en = dict[core];
    if (!en) {
      for (const p of patterns) {
        const m = p.re.exec(core);
        if (m) { const v = {}; p.keys.forEach((k, i) => { v[k] = m[i + 1]; }); en = fill(p.en, v); break; }
      }
    }
    return en ? s.replace(core, en) : s;
  }
  /* число + форма: pl(n, ['карта','карты','карт'], ['card','cards']) */
  function pl(n, ru, en) {
    if (lang === 'en') return n === 1 ? en[0] : en[1];
    const a = Math.abs(n) % 100, b = a % 10;
    return a > 10 && a < 20 ? ru[2] : b > 1 && b < 5 ? ru[1] : b === 1 ? ru[0] : ru[2];
  }
  function setLang(l) {
    try { localStorage.setItem(LS, l); } catch (e) {}
    location.reload();
  }
  const ATTRS = ['title', 'placeholder', 'aria-label', 'alt'];
  function walk(node) {
    if (node.nodeType === 3) {
      const v = node.nodeValue, r = tr(v);
      if (r !== v) node.nodeValue = r;
      return;
    }
    if (node.nodeType !== 1) return;
    const tag = node.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE') return;
    for (const a of ATTRS) {
      if (node.hasAttribute(a)) { const v = node.getAttribute(a), r = tr(v); if (r !== v) node.setAttribute(a, r); }
    }
    for (let c = node.firstChild; c; c = c.nextSibling) walk(c);
  }
  function start() {
    if (lang !== 'en') return;
    document.documentElement.lang = 'en';
    const title = document.title; if (tr(title) !== title) document.title = tr(title);
    walk(document.body);
    new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') { const v = m.target.nodeValue, r = tr(v); if (r !== v) m.target.nodeValue = r; }
        else if (m.type === 'attributes') { const v = m.target.getAttribute(m.attributeName), r = tr(v); if (r !== v) m.target.setAttribute(m.attributeName, r); }
        else m.addedNodes.forEach(walk);
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  window.I18N = { get lang() { return lang; }, add, t, tr, pl, setLang, dict, start };
  window.t = t;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
