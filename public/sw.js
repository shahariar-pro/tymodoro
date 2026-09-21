/**
 * sw.js - Service Worker for Tymodoro PWA
 * Versioned cache with offline precaching and update flow.
 */

const CACHE_VERSION = "tymodoro-v2";

const PRECACHE_ASSETS = [
  "./",
  "./index.html",
  "./css/style.css",
  "./vendor/lucide.min.js",
  "./js/main.js",
  "./js/timer.js",
  "./js/stats.js",
  "./js/storage.js",
  "./js/tasks.js",
  "./js/audio.js",
  "./js/tick-worker.js",
  "./js/ui/toasts.js",
  "./js/ui/modals.js",
  "./js/ui/settings.js",
  "./js/ui/stats-view.js",
  "./js/ui/mixer-view.js",
  "./float-timer.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon.svg",
];

// Install: precache all critical shell files
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => {
        // Ready to activate when requested
      }),
  );
});

// Activate: clean up outdated caches from earlier versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_VERSION) {
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Fetch: cache-first strategy for same-origin GET requests
self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Optional background revalidate for shell assets
        return cachedResponse;
      }

      return fetch(request)
        .then((networkResponse) => {
          if (
            networkResponse &&
            networkResponse.status === 200 &&
            networkResponse.type === "basic"
          ) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_VERSION).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fails on page navigation, fallback to cached index.html
          if (request.mode === "navigate") {
            return caches.match("./index.html");
          }
        });
    }),
  );
});

// Message listener for skipWaiting trigger
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
