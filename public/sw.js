// Service Worker for CineSafe - Aggressive Caching Strategy
const CACHE_VERSION = 'cinesafe-v1';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/favicon.svg'
];

// Install: Cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== STATIC_CACHE && key !== DYNAMIC_CACHE)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: Stale-while-revalidate for HTML, Cache-first for assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip external requests except fonts and CDN assets
    if (!url.origin.includes(self.location.origin) &&
        !url.href.includes('fonts.gstatic.com') &&
        !url.href.includes('firebasestorage.googleapis.com')) {
        return;
    }

    // For HTML: Network-first with cache fallback
    if (request.headers.get('accept')?.includes('text/html')) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => caches.match(request))
        );
        return;
    }

    // For JS/CSS/Fonts: Cache-first (stale-while-revalidate)
    if (url.pathname.includes('/assets/') ||
        url.href.includes('fonts.gstatic.com') ||
        url.href.includes('.woff')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                const fetchPromise = fetch(request).then((response) => {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
                    return response;
                });
                return cached || fetchPromise;
            })
        );
        return;
    }

    // For images from Firebase Storage: Cache with long TTL
    if (url.href.includes('firebasestorage.googleapis.com')) {
        event.respondWith(
            caches.match(request).then((cached) => {
                if (cached) return cached;
                return fetch(request).then((response) => {
                    const clone = response.clone();
                    caches.open(DYNAMIC_CACHE).then((cache) => cache.put(request, clone));
                    return response;
                });
            })
        );
        return;
    }
});
