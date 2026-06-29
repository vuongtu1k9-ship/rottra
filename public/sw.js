const CACHE_NAME = "rottra-v1";
const STATIC_ASSETS = [
  "/",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET, non-http, and API calls
  if (request.method !== "GET" || !url.protocol.startsWith("http") || url.pathname.startsWith("/api/")) {
    return;
  }

  // Bypass cache completely in localhost/dev environment to prevent SolidJS multiple instances
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return;
  }

  // Network-first for HTML pages
  if (request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then(cached => {
          if (cached) return cached;
          return new Response("Offline resource unavailable", { 
            status: 503, 
            statusText: "Service Unavailable" 
          });
        }))
    );
    return;
  }

  // Cache-first for static assets (JS, CSS, images, fonts)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch((err) => {
          console.warn("[SW] Fetch failed for:", request.url, err);
          return new Response("Offline resource unavailable", { 
            status: 503, 
            statusText: "Service Unavailable" 
          });
        });
    })
  );
});
