const VERSION = 'v7';
const SHELL_CACHE = `note5-shell-${VERSION}`;

const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/reset.css',
  './css/theme.css',
  './css/app.css',
  './js/main.js',
  './js/config.js',
  './js/debug.js',
  './js/utils/dom.js',
  './js/ui/theme.js',
  './js/ui/router.js',
  './js/ui/toast.js',
  './js/ui/progress.js',
  './js/ui/dialog.js',
  './js/ui/status.js',
  './js/ui/search.js',
  './js/ui/views/login.js',
  './js/ui/views/list.js',
  './js/ui/views/editor.js',
  './js/ui/views/settings.js',
  './js/storage/db.js',
  './js/storage/notes.js',
  './js/storage/session.js',
  './js/storage/settings.js',
  './js/storage/autosave.js',
  './js/crypto/worker.js',
  './js/crypto/client.js',
  './js/sync/serializer.js',
  './js/sync/chunker.js',
  './js/sync/api.js',
  './js/sync/backup.js',
  './js/sync/scheduler.js',
  './icons/icon.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== SHELL_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // La API del Worker nunca pasa por caché
  if (url.pathname.startsWith('/api/') || url.hostname.endsWith('workers.dev')) return;

  // Navegación → red primero, fallback al index cacheado (SPA)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Assets estáticos → cache-first
  if (e.request.method === 'GET' && url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached;
        return fetch(e.request).then(res => {
          if (res.ok && res.type === 'basic') {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then(c => c.put(e.request, clone));
          }
          return res;
        });
      })
    );
  }
});
