/* Дурокер — офлайн: сначала сеть (чтобы обновления приходили сразу), без сети — из кэша */
const CACHE = 'durocker-tut1';
const CORE = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-192.png',
  ...['rules', 'engine', 'bot', 'meta', 'net', 'transport-mqtt', 'audio', 'vfx', 'ui', 'tutorial', 'voices', 'cheat', 'leaders', 'tg', 'main'].map(f => `js/${f}.js`)];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  const same = url.origin === location.origin;
  const lib = /mqtt|fonts\.(googleapis|gstatic)/.test(url.href);
  if (!same && !lib) return;
  e.respondWith(fetch(r).then(res => {
    if (res.ok || res.type === 'opaque') { const cp = res.clone(); caches.open(CACHE).then(c => c.put(r, cp)).catch(() => {}); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: same }).then(m => m || caches.match('index.html'))));
});
