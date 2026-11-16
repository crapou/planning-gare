// Offline-first shell so the trick works on bad venue Wi-Fi.
// App files: network first (2.5 s timeout) then cache. OpenCV: cache first (immutable).
const VERSION = 'mc-v1';
const SHELL = [
  './', 'index.html', 'css/app.css', 'manifest.webmanifest',
  'js/app.js', 'js/store.js', 'js/util.js', 'js/home.js', 'js/camera.js', 'js/overlay.js',
  'js/cards.js', 'js/tracker.js', 'js/tracker-worker.js', 'js/settings.js',
  'media/keepawake.mp4', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function timeout(ms) { return new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms)); }

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.endsWith('.mp4')) return; // range requests: let the network/HTTP cache handle it
  const immutable = url.pathname.includes('/vendor/') || url.hostname.includes('jsdelivr') || url.hostname.includes('opencv.org');
  if (immutable) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    Promise.race([fetch(req), timeout(2500)])
      .then((res) => {
        if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))),
  );
});
