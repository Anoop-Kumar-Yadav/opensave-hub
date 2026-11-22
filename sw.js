const SHELL_CACHE = "opensave-shell-v5";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/opensave-icon.svg",
  "./styles/appstore.css",
  "./styles/devhub.css",
  "./registry/catalog.json",
  "./packages/sdk/opensave-sdk.js",
  "./src/main.js",
  "./src/services/swBridge.js",
  "./src/services/zipReader.js",
  "./src/services/sideloadService.js",
  "./src/services/driveSync.js",
  "./src/ui/docsView.js",
  "./src/ui/adminView.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("opensave-shell-") && k !== SHELL_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Serve permanently sideloaded (.zip) mini-apps from Cache Storage
  const sideloadMatch = url.pathname.match(/\/sideload\/([^/]+)\/(.*)$/);
  if (sideloadMatch) {
    const appId = sideloadMatch[1];
    const relPath = sideloadMatch[2] || "index.html";
    const cacheName = `opensave-sideload-${appId}`;
    event.respondWith(
      caches.open(cacheName).then(async (cache) => {
        const cleanUrl = new URL(url.origin + url.pathname);
        if (cleanUrl.pathname.endsWith("/")) {
          cleanUrl.pathname += "index.html";
        }
        const hit = (await cache.match(cleanUrl.href)) || (await cache.match(request, { ignoreSearch: true }));
        if (hit) return hit;
        return new Response(`File not found in sideloaded app "${appId}": ${relPath}`, {
          status: 404,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
    );
    return;
  }

  // Network-first for catalog.json so updates are discovered immediately when online
  if (url.pathname.endsWith("/registry/catalog.json")) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Stale-while-revalidate for Hub shell and cached mini-apps
  event.respondWith(
    caches.match(request).then((cached) => {
      const netFetch = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || netFetch;
    })
  );
});

// Per-app install, update, and uninstall cache management
self.addEventListener("message", (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.type === "PRECACHE_APP" && msg.appId && Array.isArray(msg.assets)) {
    const cacheName = `opensave-app-${msg.appId}-v${msg.version || "1"}`;
    event.waitUntil(
      (async () => {
        try {
          const cache = await caches.open(cacheName);
          await cache.addAll(msg.assets);
          const keys = await caches.keys();
          await Promise.all(
            keys
              .filter((k) => k.startsWith(`opensave-app-${msg.appId}-`) && k !== cacheName)
              .map((k) => caches.delete(k))
          );
          event.ports[0]?.postMessage({ ok: true, count: msg.assets.length });
        } catch (err) {
          event.ports[0]?.postMessage({ ok: false, error: String(err) });
        }
      })()
    );
  }

  if (msg.type === "PURGE_APP" && msg.appId) {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith(`opensave-app-${msg.appId}-`))
            .map((k) => caches.delete(k))
        )
      ).then(() => event.ports[0]?.postMessage({ ok: true }))
    );
  }
});
