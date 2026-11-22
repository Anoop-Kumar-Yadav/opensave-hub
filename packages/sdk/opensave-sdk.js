/**
 * @opensave/sdk — Shared offline-first IndexedDB storage & host-bridge SDK.
 * Removes the 5 MiB localStorage cap by storing app state in IndexedDB (disk-based GB quota)
 * with updatedAt & syncState metadata ready for future cloud sync.
 */

const DB_NAME = "opensave-platform-v1";
const STORE_NAME = "records";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "pk" });
        store.createIndex("byApp", "appId", { unique: false });
        store.createIndex("bySync", "syncState", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class OpenSaveStorage {
  constructor(appId) {
    this.appId = appId;
  }

  _pk(key) {
    return `${this.appId}::${key}`;
  }

  async get(key) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(this._pk(key));
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }

  async set(key, value) {
    const db = await openDB();
    const record = {
      pk: this._pk(key),
      appId: this.appId,
      key,
      value,
      updatedAt: Date.now(),
      syncState: "dirty",
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve(record);
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearApp() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const idx = store.index("byApp");
      const req = idx.openCursor(IDBKeyRange.only(this.appId));
      req.onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

export async function exportAllRecords() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function importAllRecords(records) {
  if (!Array.isArray(records)) return 0;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    let count = 0;
    for (const rec of records) {
      if (rec && rec.pk && rec.appId && rec.key !== undefined) {
        store.put({
          pk: rec.pk,
          appId: rec.appId,
          key: rec.key,
          value: rec.value,
          updatedAt: rec.updatedAt || Date.now(),
          syncState: "synced",
        });
        count++;
      }
    }
    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
  });
}

export async function requestPersistentStorage() {
  if (!navigator.storage || !navigator.storage.persist) return false;
  try {
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function getStorageEstimate() {
  let usage = 0;
  let quota = 0;
  let persisted = false;
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usage = est.usage || 0;
      quota = est.quota || 0;
    }
    if (navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted();
    }
  } catch {
    // Ignore unsupported environments
  }
  const percent = quota > 0 ? Math.min(100, (usage / quota) * 100) : 0;
  return { usage, quota, persisted, percent };
}

export function connectToHub({ onTheme } = {}) {
  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    const msg = event.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "OPENSAVE_THEME" && typeof onTheme === "function") {
      onTheme(msg.theme);
    }
  });
}
