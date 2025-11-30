// Minimal service worker for PWA installation
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// Optional: Basic fetch handler (can be empty for now)
self.addEventListener("fetch", (event) => {
  // Let the browser handle all fetches normally
  event.respondWith(fetch(event.request));
});
