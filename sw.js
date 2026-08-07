const CACHE_NAME = 'asset-km23-v11';
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './Web%20Data/assets/logo.png',
  './Web%20Data/assets/logo-192.png',
  './Web%20Data/assets/logo-512.png',
  './Web%20Data/css/index/index.css',
  './Web%20Data/js/index/api.js',
  './Web%20Data/js/index/app.js',
  './Web%20Data/js/index/ui.js',
  './Web%20Data/js/index/label.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  const isSameOrigin = requestUrl.origin === self.location.origin;
  if (!isSameOrigin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
