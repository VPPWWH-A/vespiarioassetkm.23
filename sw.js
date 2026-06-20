const CACHE_NAME = 'asset-km23-v1';

// We just need a basic fetch handler to satisfy PWA install requirements.
// We won't aggressively cache everything to ensure live data is loaded.
self.addEventListener('fetch', (event) => {
  // If we don't call respondWith, the browser will just do a normal network request.
  // This is enough to pass the Chrome PWA criteria.
  return;
});

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
