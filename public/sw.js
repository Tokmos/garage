// Service Worker – cachar appen för offline-visning
const CACHE = "garageport-v2";
const ASSETS = ["/", "/index.html", "/manifest.json", "/icon.svg"];

self.addEventListener("install", e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)))
);

self.addEventListener("activate", e =>
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
);

self.addEventListener("fetch", e => {
  // API-anrop går alltid till nätverket
  if (e.request.url.includes("/api/")) return;

  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
