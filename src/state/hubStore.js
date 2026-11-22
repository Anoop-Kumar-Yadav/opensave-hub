import { precacheApp, purgeAppCache } from "../services/swBridge.js";
import {
  requestPersistentStorage,
  getStorageEstimate,
  exportAllRecords,
} from "../../packages/sdk/opensave-sdk.js";

const HUB_KEY = "opensave-hub-v1";

const DEFAULT_HUB = () => ({
  settings: {
    autoUpdate: true,
    launchMode: "embedded",
    telemetryOptIn: false,
    theme: null,
  },
  installed: {
    "dsa-sheet": {
      installedVersion: "1.8.0",
      installedAt: Date.now(),
      lastOpenedAt: null,
    },
  },
});

export const hub = DEFAULT_HUB();

try {
  const raw = localStorage.getItem(HUB_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.settings) Object.assign(hub.settings, parsed.settings);
    if (parsed.installed) hub.installed = parsed.installed;
  }
} catch {
  // Ignore corrupted storage
}

export const ui = {
  tab: "store", // "store" | "installed" | "settings"
  category: "All",
  search: "",
  catalog: [],
  loading: true,
  activeApp: null,
  detailApp: null,
  toast: null,
  installPrompt: null,
  storage: { usage: 0, quota: 0, persisted: false, percent: 0 },
  folderName: null,
};

let dirHandle = null;
let renderCb = () => {};
export function setRenderer(fn) {
  renderCb = fn;
}
export function notify() {
  renderCb();
}

export function saveHub() {
  try {
    localStorage.setItem(HUB_KEY, JSON.stringify(hub));
  } catch {
    // Ignore
  }
}

let toastTimer = null;
export function showToast(msg) {
  ui.toast = msg;
  notify();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    ui.toast = null;
    notify();
  }, 2600);
}

export async function refreshStorageInfo() {
  ui.storage = await getStorageEstimate();
  notify();
}

export async function enablePersistentStorage() {
  const ok = await requestPersistentStorage();
  await refreshStorageInfo();
  showToast(
    ok
      ? "Persistent storage enabled — browser will protect your data"
      : "Browser manages persistence automatically for installed PWAs"
  );
}

export async function syncToLocalFolder() {
  if (!window.showDirectoryPicker) {
    showToast("Local folder sync requires Chrome, Edge, or Brave on desktop");
    return;
  }
  try {
    if (!dirHandle) {
      dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      ui.folderName = dirHandle.name;
    }
    const records = await exportAllRecords();
    const payload = {
      exportedAt: new Date().toISOString(),
      hub,
      records,
    };
    const fileHandle = await dirHandle.getFileHandle("opensave-backup.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(payload, null, 2));
    await writable.close();
    showToast(`Saved backup to ${dirHandle.name}/opensave-backup.json`);
    notify();
  } catch (err) {
    if (err && err.name !== "AbortError") {
      showToast("Folder sync cancelled or permission denied");
    }
  }
}

export function applyTheme() {
  const t =
    hub.settings.theme ||
    (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = t;
  localStorage.setItem("opensave-theme", t);
  const frame = document.querySelector(".workspace-frame");
  if (frame && frame.contentWindow) {
    frame.contentWindow.postMessage({ type: "OPENSAVE_THEME", theme: t }, window.location.origin);
  }
}

export function toggleTheme() {
  const cur = document.documentElement.dataset.theme;
  hub.settings.theme = cur === "dark" ? "light" : "dark";
  saveHub();
  applyTheme();
  notify();
}

export function hasUpdate(app) {
  const inst = hub.installed[app.id];
  if (!inst) return false;
  return inst.installedVersion !== app.version;
}

export async function loadCatalog(silent = false) {
  if (!silent) {
    ui.loading = true;
    notify();
  }
  try {
    const res = await fetch("./registry/catalog.json", { cache: "no-cache" });
    const data = await res.json();
    ui.catalog = Array.isArray(data.apps) ? data.apps : [];

    if (hub.settings.autoUpdate) {
      let updatedCount = 0;
      for (const app of ui.catalog) {
        const inst = hub.installed[app.id];
        if (inst && inst.installedVersion !== app.version && app.status === "available") {
          await precacheApp(app);
          inst.installedVersion = app.version;
          inst.updatedAt = Date.now();
          updatedCount++;
        }
      }
      if (updatedCount) {
        saveHub();
        showToast(`Auto-updated ${updatedCount} app${updatedCount > 1 ? "s" : ""}`);
      }
    }
  } catch {
    showToast("Offline mode — using cached app catalog");
  } finally {
    ui.loading = false;
    notify();
  }
}

export async function installApp(app) {
  if (app.status !== "available") return;
  showToast(`Caching ${app.name} for offline use...`);
  await precacheApp(app);
  hub.installed[app.id] = {
    installedVersion: app.version,
    installedAt: Date.now(),
    lastOpenedAt: null,
  };
  saveHub();
  refreshStorageInfo();
  showToast(`${app.name} v${app.version} added to OpenSave`);
  notify();
}

export async function updateApp(app) {
  const inst = hub.installed[app.id];
  if (!inst) return;
  showToast(`Updating ${app.name} to v${app.version}...`);
  await precacheApp(app);
  inst.installedVersion = app.version;
  inst.updatedAt = Date.now();
  saveHub();
  refreshStorageInfo();
  showToast(`${app.name} updated to v${app.version}`);
  notify();
}

export async function uninstallApp(app) {
  if (!confirm(`Remove "${app.name}" from your OpenSave drawer? Your saved study data remains safe in IndexedDB.`)) {
    return;
  }
  await purgeAppCache(app.id);
  delete hub.installed[app.id];
  if (ui.activeApp && ui.activeApp.id === app.id) ui.activeApp = null;
  saveHub();
  refreshStorageInfo();
  showToast(`${app.name} removed`);
  notify();
}

export function launchApp(app) {
  if (app.status !== "available" || !app.url) return;
  if (hub.installed[app.id]) {
    hub.installed[app.id].lastOpenedAt = Date.now();
    saveHub();
  }
  if (hub.settings.launchMode === "tab") {
    window.open(app.url, "_blank", "noopener");
  } else {
    ui.detailApp = null;
    ui.activeApp = app;
    notify();
  }
}
