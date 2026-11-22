export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => null);
}

function sendSwMessage(msg) {
  if (!("serviceWorker" in navigator)) return Promise.resolve({ ok: false });
  return navigator.serviceWorker.ready.then((reg) => {
    const target = reg.active || navigator.serviceWorker.controller;
    if (!target) return { ok: false };
    return new Promise((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => resolve(e.data || { ok: true });
      target.postMessage(msg, [ch.port2]);
    });
  }).catch(() => ({ ok: false }));
}

export function precacheApp(app) {
  return sendSwMessage({
    type: "PRECACHE_APP",
    appId: app.id,
    version: app.version,
    assets: app.assets || (app.url ? [app.url] : []),
  });
}

export function purgeAppCache(appId) {
  return sendSwMessage({ type: "PURGE_APP", appId });
}
