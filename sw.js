// BoToc Trading — Service Worker
// Cache-first for static assets; network-first for API/Supabase calls

const CACHE_NAME = 'botoc-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install: pre-cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Supabase / external APIs → network-first (always fresh data)
// - Everything else → cache-first with network fallback
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin API calls (Supabase, goldprice, coingecko)
  if (event.request.method !== 'GET') return;
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('goldprice.org') ||
      url.hostname.includes('coingecko.com') ||
      url.hostname.includes('googleapis.com')) {
    // Network-first for live data
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const toCache = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        return response;
      });
    })
  );
});
