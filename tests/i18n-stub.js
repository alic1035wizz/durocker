/* заглушка локализации для тестов в vm: русский вывод без словарей (t возвращает ключ с подстановкой, I18N.pl склоняет по-русски) */
const fill = (s, v) => (v ? s.replace(/\{(\w+)\}/g, (m, n) => (n in v ? v[n] : m)) : s);
const I18N = {
  lang: 'ru', add() {}, tr: s => s, dict: {},
  pl(n, ru) { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? ru[2] : b > 1 && b < 5 ? ru[1] : b === 1 ? ru[0] : ru[2]; },
};
module.exports = { I18N, t: (s, v) => (typeof s === 'string' ? fill(s, v) : s) };
