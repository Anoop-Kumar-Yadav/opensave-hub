export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  } catch (err) {
    console.warn("SW registration skipped:", err);
    return null;
  }
}

function sendSwMessage(payload) {
  return new Promise((resolve) => {
    const controller = navigator.serviceWorker?.controller;
    if (!controller) {
      resolve({ ok: true, offlineSkipped: true });
      return;
    }
    const ch = new MessageChannel();
    const timer = setTimeout(() => resolve({ ok: true, timeout: true }), 4000);
    ch.port1.onmessage = (e) => {
      clearTimeout(timer);
      resolve(e.data || { ok: true });
    };
    controller.postMessage(payload, [ch.port2]);
  });
}

export async function precacheApp(app) {
  if (!app.assets || !app.assets.length) return { ok: true };
  return sendSwMessage({
    type: "PRECACHE_APP",
    appId: app.id,
    version: app.version,
    assets: app.assets,
  });
}

export async function purgeAppCache(appId) {
  return sendSwMessage({
    type: "PURGE_APP",
    appId,
  });
}
