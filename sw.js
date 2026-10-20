/* ДурКер — офлайн: сначала сеть (чтобы обновления приходили сразу), без сети — из кэша */
const CACHE = 'durker-w7';
const CORE = ['./', 'index.html', 'css/style.css', 'css/ds.css', 'css/lobby.css', 'css/table.css', 'css/story.css', 'css/company.css', 'css/access.css', 'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/icon-maskable.png', 'assets/apple-touch-icon.png',
  ...['rules', 'bus', 'engine', 'bot', 'meta', 'net', 'transport-mqtt', 'audio', 'vfx', 'ui', 'tutorial', 'voices', 'cheat', 'weekly', 'multi/engine4', 'multi/bot4', 'multi/transport4', 'multi/net4', 'multi/ui4', 'replay', 'quick', 'pass', 'cloud', 'stats', 'achieve', 'events', 'chips', 'rogue', 'portraits', 'table', 'story-data', 'story', 'access', 'netbet', 'clubs', 'share', 'leaders', 'lobby', 'tg', 'main'].map(f => `js/${f}.js`)];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).catch(() => {})); self.skipWaiting(); });
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
