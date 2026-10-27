// BoToc Trading — Service Worker
// Network-first for HTML/JS/CSS (so code updates always reach visitors);
// cache-first for icons/manifest (rarely change, kept for offline/PWA use);
// network-first for API/Supabase calls (always fresh data).

const CACHE_NAME = 'botoc-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Files that must always be fetched fresh when online — these are the
// files that change on every deploy. Cache is only a fallback for offline use.
const NETWORK_FIRST = ['/', '/index.html', '/style.css', '/script.js'];

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

  // Network-first for the core site files, so a new deploy is picked up
  // on the very next load instead of waiting on this cache to expire.
  if (url.origin === self.location.origin && NETWORK_FIRST.includes(url.pathname)) {
    event.respondWith(
      fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (icons, manifest, images already covered above)
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
