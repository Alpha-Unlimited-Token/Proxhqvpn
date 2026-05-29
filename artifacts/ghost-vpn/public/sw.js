const CACHE = "proxhqvpn-v3";
const OFFLINE_URLS = ["/", "/my-vpn", "/downloads", "/guide", "/pricing"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      c.addAll(OFFLINE_URLS).catch(() => {})
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never cache API calls — always go to network
  if (url.pathname.startsWith("/api/")) return;

  // Network first for navigation, cache fallback
  if (request.mode === "navigate") {
    e.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("/").then((r) => r ?? new Response("Offline", { status: 503 })))
    );
    return;
  }

  // Cache first for static assets
  e.respondWith(
    caches.match(request).then((cached) => {
      const fetched = fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone)).catch(() => {});
        }
        return res;
      }).catch(() => cached ?? new Response("", { status: 503 }));
      return cached ?? fetched;
    })
  );
});
