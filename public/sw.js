const CACHE_NAME = 'ongi-shell-v2.3.0';
const APP_ROOT = self.registration.scope;
const APP_ROOT_PATH = new URL(APP_ROOT).pathname;
const APP_SHELL = [
  APP_ROOT,
  new URL('site.webmanifest', APP_ROOT).href,
  new URL('favicon-192x192.png', APP_ROOT).href,
  new URL('favicon-512x512.png', APP_ROOT).href,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const requestUrl = new URL(request.url);

  if (request.method !== 'GET' || requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (requestUrl.pathname === APP_ROOT_PATH) {
            const copy = response.clone();
            void caches.open(CACHE_NAME).then((cache) => cache.put(APP_ROOT, copy));
          }
          return response;
        })
        .catch(() => caches.match(APP_ROOT)),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })),
  );
});
