// Service Worker – cachar INGENTING.
// Den finns bara för att Chrome/Edge ska räkna appen som installerbar
// (så att installationssidan kan visa en Installera-knapp).
// Tidigare version cachade filerna och gjorde att uppdateringar inte kom fram,
// därför rensas alla gamla cachar när den här versionen aktiveras.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", e =>
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

// Hämta alltid från nätet. API-anrop (POST) lämnas helt orörda.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(fetch(e.request));
});
