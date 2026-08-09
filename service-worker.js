const CACHE = 'ets-checkin-app-v1';
const ASSETS = ['./', './index.html', './assets/app.css', './assets/app.js', './manifest.webmanifest', './assets/icon.svg'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname.includes('/wp-json/ets-app/v1/')) return;
  event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request)));
});
