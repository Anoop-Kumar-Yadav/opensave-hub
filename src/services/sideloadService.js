/**
 * Persistent client-side sideloading & server publishing service.
 * - Stores extracted files in Cache Storage (`opensave-sideload-<appId>`) so sw.js serves them at `./sideload/<appId>/...`
 * - Stores the raw `.zip` Blob in IndexedDB (`opensave-sideload-db`) so it persists forever and can be published to a server at any time.
 */
import { getMimeType } from "./zipReader.js";

const SIDELOAD_DB = "opensave-sideload-db";
const ZIP_STORE = "bundles";

function openSideloadDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SIDELOAD_DB, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(ZIP_STORE)) {
        db.createObjectStore(ZIP_STORE, { keyPath: "appId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function slugifyAppId(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "custom-app-" + Date.now().toString(36);
}

function fmtSizeLabel(bytes) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `~${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Installs a unpacked ZIP mini-app permanently into Cache Storage + IndexedDB.
 */
export async function saveSideloadedApp({ appId, meta, filesMap, rawZipBlob, totalBytes }) {
  if (!("caches" in window)) {
    throw new Error("Offline Cache Storage requires a Secure Context (HTTPS or localhost).");
  }

  const cleanId = slugifyAppId(appId);
  const cacheName = `opensave-sideload-${cleanId}`;

  // Clear previous version if re-uploading same appId
  await caches.delete(cacheName);
  const cache = await caches.open(cacheName);

  const baseUrl = new URL(`./sideload/${cleanId}/`, window.location.href).href;
  const assetList = [];

  for (const [relPath, bytes] of filesMap.entries()) {
    const fileUrl = new URL(relPath, baseUrl).href;
    const response = new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": getMimeType(relPath),
        "Cache-Control": "no-cache",
      },
    });
    await cache.put(fileUrl, response);
    assetList.push(`./sideload/${cleanId}/${relPath}`);
  }

  // Persist raw ZIP Blob in IndexedDB for durability & future publishing
  const db = await openSideloadDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(ZIP_STORE, "readwrite");
    tx.objectStore(ZIP_STORE).put({
      appId: cleanId,
      zipBlob: rawZipBlob,
      fileCount: filesMap.size,
      totalBytes,
      savedAt: Date.now(),
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  const accent = /^#[0-9a-f]{6}$/i.test(meta.accent || "") ? meta.accent : "#007aff";

  return {
    id: cleanId,
    name: meta.name.trim(),
    tagline: (meta.tagline || "Custom sideloaded OpenSave mini-app.").trim(),
    description: (meta.description || meta.tagline || "Sideloaded local mini-app installed via ZIP package.").trim(),
    category: (meta.category || "Utilities").trim(),
    section: meta.section === "tools" ? "tools" : "apps",
    version: (meta.version || "1.0.0").trim(),
    developer: (meta.developer || "Local Developer").trim(),
    sizeLabel: fmtSizeLabel(totalBytes),
    status: "available",
    supportsOffline: true,
    isCustom: true,
    url: `./sideload/${cleanId}/index.html`,
    accent,
    iconBg: `linear-gradient(145deg, ${accent} 0%, #5856d6 100%)`,
    iconGlyph:
      '<path d="M16 18h18a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V21a3 3 0 0 1 3-3z" fill="white" fill-opacity="0.22" stroke="white" stroke-width="2.2"/><path d="M21 27l3 3 5-6" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
    tags: Array.isArray(meta.tags) && meta.tags.length ? meta.tags : ["Custom", "Offline", "ZIP"],
    changelog: Array.isArray(meta.changelog) && meta.changelog.length ? meta.changelog : [`v${meta.version || "1.0.0"} — Sideloaded locally via ZIP`],
    assets: assetList,
    privacy: {
      level: "Sideloaded Locally",
      detail: "Stored permanently in your browser's Cache Storage & IndexedDB. Only uploaded if you choose Publish.",
    },
    installedAt: Date.now(),
  };
}

export async function getSideloadedZip(appId) {
  const db = await openSideloadDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ZIP_STORE, "readonly");
    const req = tx.objectStore(ZIP_STORE).get(appId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSideloadedApp(appId) {
  if ("caches" in window) {
    await caches.delete(`opensave-sideload-${appId}`);
  }
  const db = await openSideloadDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ZIP_STORE, "readwrite");
    tx.objectStore(ZIP_STORE).delete(appId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Sends the sideloaded app's ZIP bundle + manifest to a remote OpenSave publish endpoint.
 */
export async function publishAppToServer({ app, endpoint, authorEmail, releaseNotes }) {
  const bundleRecord = await getSideloadedZip(app.id);
  if (!bundleRecord || !bundleRecord.zipBlob) {
    throw new Error("Original ZIP bundle not found in IndexedDB. Re-upload the ZIP to publish.");
  }

  const form = new FormData();
  form.append("bundle", bundleRecord.zipBlob, `${app.id}-v${app.version}.zip`);
  form.append(
    "manifest",
    JSON.stringify({
      id: app.id,
      name: app.name,
      tagline: app.tagline,
      description: app.description,
      category: app.category,
      section: app.section,
      version: app.version,
      developer: app.developer,
      accent: app.accent,
      tags: app.tags,
      authorEmail: authorEmail || "",
      releaseNotes: releaseNotes || "",
    })
  );

  const res = await fetch(endpoint, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Server responded with ${res.status}${errText ? `: ${errText.slice(0, 140)}` : ""}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  return { ok: true, message: "Submitted successfully" };
}
