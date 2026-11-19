/**
 * Voice Translator Service Worker
 * Provides offline caching for the app shell and PWA installability.
 *
 * Strategy:
 * - Navigations: network-first, cached index.html as fallback.
 * - Static same-origin assets: stale-while-revalidate (instant load + background updates).
 * - Translation API: network only, never cached.
 * - Other cross-origin requests (e.g. fonts): left to the browser.
 */

const CACHE_NAME = 'voice-translator-v5';
const INDEX_URL = new URL('./index.html', self.location.href).href;

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

// 1. Install: pre-cache the app shell, then activate immediately.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
      .catch(error => console.warn('Precache failed:', error))
  );
});

// 2. Activate: remove outdated caches and take control.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// 3. Allow the page to request immediate activation of a waiting worker.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 4. Fetch routing.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let requestUrl;
  try {
    requestUrl = new URL(request.url);
  } catch (_) {
    return;
  }

  // Translation API: always network, never cached.
  if (requestUrl.hostname.includes('mymemory.translated.net')) return;

  // Cross-origin requests (Google Fonts, etc.): let the browser handle them.
  if (requestUrl.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});

/** Tries the network first, falling back to the cached app shell. */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(INDEX_URL, networkResponse.clone());
    }
    return networkResponse;
  } catch (_) {
    const cached = await caches.match(request) || await caches.match(INDEX_URL);
    if (cached) return cached;
    return new Response('You are offline and the app has not been cached yet.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=UTF-8' }
    });
  }
}

/** Returns a cached response immediately while refreshing it in the background. */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const networkUpdate = fetch(request)
    .then(networkResponse => {
      if (networkResponse && networkResponse.ok && networkResponse.type === 'basic') {
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
      }
      return networkResponse;
    })
    .catch(() => null);

  if (cached) return cached;

  const networkResponse = await networkUpdate;
  if (networkResponse) return networkResponse;

  return new Response('', { status: 504, statusText: 'Offline' });
}
