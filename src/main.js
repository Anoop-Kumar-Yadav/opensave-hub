import { registerServiceWorker, precacheApp, purgeAppCache } from "./services/swBridge.js";
import {
  requestPersistentStorage,
  getStorageEstimate,
  exportAllRecords,
  importAllRecords,
} from "../packages/sdk/opensave-sdk.js";
import {
  isDriveConnected,
  signInWithGoogle,
  signOutGoogle,
  backupToGoogleDrive,
  restoreFromGoogleDrive,
} from "./services/driveSync.js";
import { unpackZipFile, createStarterTemplateZip } from "./services/zipReader.js";
import {
  saveSideloadedApp,
  deleteSideloadedApp,
  getSideloadedZip,
  publishAppToServer,
  slugifyAppId,
} from "./services/sideloadService.js";
import { renderDocsView } from "./ui/docsView.js";

const HUB_KEY = "opensave-hub-v1";

const DEFAULT_HUB = () => ({
  settings: {
    autoUpdate: true,
    launchMode: "embedded",
    theme: null,
    publishEndpoint: "/api/v1/apps/publish",
    googleClientId: "",
    githubRepo: "",
  },
  googleUser: null,
  lastDriveSync: null,
  installed: {
    "dsa-sheet": {
      installedVersion: "1.8.0",
      installedAt: Date.now(),
    },
  },
  customApps: [],
});

const hub = DEFAULT_HUB();
try {
  const raw = localStorage.getItem(HUB_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    if (parsed.settings) Object.assign(hub.settings, parsed.settings);
    if (parsed.installed) hub.installed = parsed.installed;
    if (Array.isArray(parsed.customApps)) hub.customApps = parsed.customApps;
    if (parsed.googleUser) hub.googleUser = parsed.googleUser;
    if (parsed.lastDriveSync) hub.lastDriveSync = parsed.lastDriveSync;
  }
} catch {
  // Ignore corrupted storage
}

function saveHub() {
  try {
    localStorage.setItem(HUB_KEY, JSON.stringify(hub));
  } catch {
    // Ignore
  }
}

const state = {
  activeTab: "today", // 'today' | 'tools' | 'apps' | 'installed' | 'search' | 'docs'
  theme: hub.settings.theme || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"),
  appsCategory: "All",
  toolsCategory: "All",
  searchQuery: "",
  catalog: [],
  progressMap: {},
  downloadingMap: {},
  activeProductId: null,
  descExpanded: false,
  accountModalOpen: false,
  addAppModalOpen: false,
  publishAppId: null,
  publishBusy: false,
  driveBusy: false,
  publishResult: null,
  activeWorkspaceApp: null,
  storage: { usage: 0, quota: 0, persisted: false, percent: 0 },
  folderName: null,
  installPrompt: null,
  // Pending unpacked ZIP state inside Add App modal
  zipDraft: null,
  zipError: null,
};

let dirHandle = null;

const TABS = [
  {
    id: "today",
    label: "Today",
    icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3.5"/><path stroke-linecap="round" d="M8 9h8M8 13h5"/></svg>`,
  },
  {
    id: "tools",
    label: "Dev Tools",
    icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><polyline points="16 18 22 12 16 6" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8 6 2 12 8 18" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "apps",
    label: "Apps",
    icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8"/></svg>`,
  },
  {
    id: "installed",
    label: "Installed",
    icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "search",
    label: "Search",
    icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.8-3.8"/></svg>`,
  },
];

const DOCS_TAB = {
  id: "docs",
  label: "Developer Docs",
  icon: `<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="1.9" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

function getAllApps() {
  const map = new Map();
  for (const app of state.catalog) map.set(app.id, app);
  for (const custom of hub.customApps || []) map.set(custom.id, custom);
  return [...map.values()];
}

function getAppById(id) {
  return getAllApps().find((a) => a.id === id);
}

function isInstalled(appId) {
  return !!hub.installed[appId];
}

function hasUpdate(app) {
  if (app.isCustom) return false;
  const inst = hub.installed[app.id];
  return !!(inst && app.status === "available" && inst.installedVersion !== app.version);
}

function fmtSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

function escAttr(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

function renderAppIcon(app, sizeClass = "w-14 h-14") {
  return `
    <div class="${sizeClass} squircle shrink-0 flex items-center justify-center shadow-sm" style="background: ${app.iconBg || "linear-gradient(145deg,#2d6548,#52b788)"};">
      <svg viewBox="0 0 50 50" class="w-full h-full" fill="none" aria-hidden="true">
        ${app.iconGlyph || '<rect x="14" y="14" width="22" height="22" rx="5" stroke="white" stroke-width="2.5"/>'}
      </svg>
    </div>
  `;
}

function renderActionButton(app, variant = "default") {
  if (app.status !== "available") {
    return `
      <div class="flex flex-col items-center shrink-0">
        <button type="button" disabled class="get-btn opacity-55 cursor-not-allowed min-w-[74px] px-4 py-1.5 rounded-full text-[12px] leading-none text-center">SOON</button>
      </div>
    `;
  }

  if (state.downloadingMap[app.id]) {
    const progress = state.progressMap[app.id] || 0;
    const radius = 11;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (progress / 100) * circumference;
    const strokeColor = variant === "glass" ? "#ffffff" : "var(--accent)";
    const trackColor = variant === "glass" ? "rgba(255,255,255,0.28)" : "var(--hairline)";

    return `
      <button type="button" data-action-app="${app.id}" class="w-[74px] h-[30px] flex items-center justify-center rounded-full focus:outline-none" aria-label="Installing ${app.name}">
        <svg class="w-7 h-7" viewBox="0 0 28 28" aria-hidden="true">
          <circle cx="14" cy="14" r="${radius}" fill="none" stroke="${trackColor}" stroke-width="2.4" />
          <circle cx="14" cy="14" r="${radius}" fill="none" stroke="${strokeColor}" stroke-width="2.4" stroke-linecap="round" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" class="progress-ring-circle" />
          <rect x="11" y="11" width="6" height="6" rx="1.2" fill="${strokeColor}" />
        </svg>
      </button>
    `;
  }

  const installed = isInstalled(app.id);
  const label = installed ? (hasUpdate(app) ? "UPDATE" : "OPEN") : "GET";
  const btnClass =
    variant === "solid"
      ? "get-btn get-btn-solid"
      : variant === "glass"
      ? "get-btn get-btn-glass"
      : "get-btn";

  return `
    <div class="flex flex-col items-center shrink-0">
      <button
        type="button"
        data-action-app="${app.id}"
        class="${btnClass} min-w-[74px] px-4 py-1.5 rounded-full text-[13px] leading-none text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
        aria-label="${label} ${app.name}"
      >
        ${label}
      </button>
    </div>
  `;
}

let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById("toastContainer");
  document.getElementById("toastMessage").textContent = message;
  toast.classList.remove("opacity-0", "-translate-y-3");
  toast.classList.add("opacity-100", "translate-y-0");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.add("opacity-0", "-translate-y-3");
    toast.classList.remove("opacity-100", "translate-y-0");
  }, 2600);
}

function getThemeIconSVG() {
  if (state.theme === "dark") {
    return `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path stroke-linecap="round" d="M12 2.5v2M12 19.5v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2.5 12h2M19.5 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>`;
  }
  return `<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M20.4 14.4A8.5 8.5 0 1 1 9.6 3.6a6.8 6.8 0 0 0 10.8 10.8z"/></svg>`;
}

function applyTheme(nextTheme) {
  state.theme = nextTheme;
  hub.settings.theme = nextTheme;
  saveHub();
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem("opensave-theme", nextTheme);
  document.querySelectorAll(".theme-icon-slot").forEach((el) => {
    el.innerHTML = getThemeIconSVG();
  });
  const frame = document.getElementById("workspaceFrame");
  if (frame && frame.contentWindow && state.activeWorkspaceApp) {
    try {
      frame.contentWindow.postMessage({ type: "OPENSAVE_THEME", theme: nextTheme }, window.location.origin);
    } catch {
      // Ignore
    }
  }
  if (state.accountModalOpen) renderAccountModalBody();
}

function toggleTheme() {
  applyTheme(state.theme === "light" ? "dark" : "light");
}

function openWorkspace(app) {
  if (!app || !app.url) return;
  if (app.isCustom && !navigator.serviceWorker?.controller) {
    showToast("Sideloaded apps need HTTPS or localhost with Service Worker active");
  }
  if (hub.installed[app.id]) {
    hub.installed[app.id].lastOpenedAt = Date.now();
    saveHub();
  }
  if (hub.settings.launchMode === "tab") {
    window.open(app.url, "_blank", "noopener");
    return;
  }
  state.activeWorkspaceApp = app;
  const host = document.getElementById("workspaceHost");
  const frame = document.getElementById("workspaceFrame");
  document.getElementById("workspaceTitle").textContent = app.name;
  document.getElementById("workspaceVer").textContent = `v${app.version}`;
  frame.src = app.url;
  frame.onload = () => {
    try {
      frame.contentWindow.postMessage({ type: "OPENSAVE_THEME", theme: state.theme }, window.location.origin);
    } catch {
      // Ignore
    }
  };
  host.classList.remove("hidden");
  host.classList.add("flex");
  document.body.style.overflow = "hidden";
}

function closeWorkspace() {
  const host = document.getElementById("workspaceHost");
  const frame = document.getElementById("workspaceFrame");
  host.classList.add("hidden");
  host.classList.remove("flex");
  frame.src = "about:blank";
  state.activeWorkspaceApp = null;
  if (!state.activeProductId && !state.accountModalOpen && !state.addAppModalOpen && !state.publishAppId) {
    document.body.style.overflow = "";
  }
  refreshStorageInfo();
}

async function triggerAppAction(appId) {
  const app = getAppById(appId);
  if (!app || app.status !== "available") return;
  if (state.downloadingMap[appId]) return;

  if (isInstalled(appId) && !hasUpdate(app)) {
    openWorkspace(app);
    return;
  }

  const isUpd = hasUpdate(app);
  state.downloadingMap[appId] = true;
  state.progressMap[appId] = 10;
  refreshVisibleUI();

  const cachePromise = precacheApp(app);
  const start = performance.now();
  const duration = 950;

  function step(now) {
    const elapsed = now - start;
    state.progressMap[appId] = Math.min(95, 10 + (elapsed / duration) * 85);
    refreshVisibleUI();
    if (elapsed < duration) {
      requestAnimationFrame(step);
    } else {
      cachePromise.finally(() => {
        hub.installed[appId] = {
          installedVersion: app.version,
          installedAt: hub.installed[appId]?.installedAt || Date.now(),
          updatedAt: Date.now(),
        };
        saveHub();
        delete state.downloadingMap[appId];
        delete state.progressMap[appId];
        refreshStorageInfo();
        refreshVisibleUI();
        showToast(isUpd ? `${app.name} updated to v${app.version}` : `${app.name} installed offline`);
      });
    }
  }
  requestAnimationFrame(step);
}

async function uninstallApp(appId) {
  const app = getAppById(appId);
  if (!app) return;
  const msg = app.isCustom
    ? `Delete sideloaded app "${app.name}" and its cached ZIP bundle?`
    : `Remove "${app.name}" from Installed? Your saved IndexedDB data stays safe.`;
  if (!confirm(msg)) return;

  if (app.isCustom) {
    await deleteSideloadedApp(appId);
    hub.customApps = (hub.customApps || []).filter((c) => c.id !== appId);
  } else {
    await purgeAppCache(appId);
  }
  delete hub.installed[appId];
  saveHub();
  if (state.activeProductId === appId) closeProductModal();
  refreshStorageInfo();
  refreshVisibleUI();
  showToast(`${app.name} removed`);
}

async function refreshStorageInfo() {
  state.storage = await getStorageEstimate();
  if (state.accountModalOpen) renderAccountModalBody();
}

async function syncToLocalFolder() {
  if (!window.showDirectoryPicker) {
    showToast("Local folder sync requires Chrome, Edge, or Brave on desktop");
    return;
  }
  try {
    if (!dirHandle) {
      dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      state.folderName = dirHandle.name;
    }
    const records = await exportAllRecords();
    const fileHandle = await dirHandle.getFileHandle("opensave-backup.json", { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify({ exportedAt: new Date().toISOString(), hub, records }, null, 2));
    await writable.close();
    showToast(`Saved backup to ${dirHandle.name}/opensave-backup.json`);
    if (state.accountModalOpen) renderAccountModalBody();
  } catch (err) {
    if (err && err.name !== "AbortError") showToast("Folder sync cancelled");
  }
}

function downloadStarterZip() {
  const blob = createStarterTemplateZip();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "quick-scratchpad-starter.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  showToast("Downloaded starter template (.zip)");
}

function updateAccountBadges() {
  const pendingCount = getAllApps().filter((a) => hasUpdate(a)).length;
  const dot = document.getElementById("sidebarUpdateDot");
  const label = document.getElementById("sidebarUpdatesLabel");
  if (dot) {
    dot.textContent = pendingCount;
    dot.classList.toggle("hidden", pendingCount === 0);
  }
  if (label) {
    label.textContent = pendingCount > 0 ? `${pendingCount} update${pendingCount > 1 ? "s" : ""} available` : "Offline · IndexedDB";
  }
  document.querySelectorAll(".header-update-dot").forEach((el) => {
    el.classList.toggle("hidden", pendingCount === 0);
  });
}

function renderNavigation() {
  const sidebarNav = document.getElementById("desktopSidebarNav");
  const mobileNav = document.getElementById("mobileBottomNav");

  sidebarNav.innerHTML =
    TABS.map(
      (t) => `
        <button
          type="button"
          data-tab="${t.id}"
          aria-current="${state.activeTab === t.id ? "page" : "false"}"
          class="sidebar-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
        >
          ${t.icon}
          <span>${t.label}</span>
        </button>
      `
    ).join("") +
    `
      <div class="pt-3 mt-3 border-t border-hairline-subtle space-y-1">
        <button
          type="button"
          data-open-add-app
          class="sidebar-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium accent-text focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
          <span>Add .ZIP App</span>
        </button>
        <button
          type="button"
          data-tab="${DOCS_TAB.id}"
          aria-current="${state.activeTab === DOCS_TAB.id ? "page" : "false"}"
          class="sidebar-item w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[14px] font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
        >
          ${DOCS_TAB.icon}
          <span>${DOCS_TAB.label}</span>
        </button>
      </div>
    `;

  mobileNav.innerHTML = TABS.map(
    (t) => `
      <button
        type="button"
        data-tab="${t.id}"
        aria-current="${state.activeTab === t.id ? "page" : "false"}"
        class="mobile-tab flex flex-col items-center justify-center gap-0.5 py-1 focus:outline-none"
      >
        ${t.icon}
        <span class="text-[10px] font-medium tracking-tight">${t.label}</span>
      </button>
    `
  ).join("");
}

function renderPageHeader(title, eyebrow = "") {
  const pendingCount = getAllApps().filter((a) => hasUpdate(a)).length;
  return `
    <header class="flex items-end justify-between pb-4 mb-6 border-b border-hairline-subtle">
      <div>
        ${eyebrow ? `<p class="text-[11px] sm:text-xs font-bold uppercase tracking-[0.06em] text-sub mb-0.5">${eyebrow}</p>` : ""}
        <h1 class="text-3xl sm:text-[34px] font-bold tracking-tight leading-none text-main">${title}</h1>
      </div>
      <div class="flex items-center gap-2">
        ${state.installPrompt ? `
          <button type="button" id="installPwaBtn" class="get-btn get-btn-solid px-3.5 py-1.5 rounded-full text-xs">
            Install Hub
          </button>
        ` : ""}
        <button
          type="button"
          data-open-add-app
          class="w-9 h-9 rounded-full surface-secondary accent-text hover:opacity-80 flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
          aria-label="Add Mini-App from ZIP"
          title="Add .ZIP Mini-App"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.4" viewBox="0 0 24 24"><path stroke-linecap="round" d="M12 5v14M5 12h14"/></svg>
        </button>
        <button
          type="button"
          data-tab="docs"
          class="w-9 h-9 rounded-full surface-secondary text-sub hover:text-main flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
          aria-label="Developer Documentation"
          title="Developer Docs"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" stroke-linecap="round" stroke-linejoin="round"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button
          type="button"
          data-toggle-theme
          class="w-9 h-9 rounded-full surface-secondary text-sub hover:text-main flex items-center justify-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
          aria-label="Toggle Light and Dark mode"
        >
          <span class="theme-icon-slot">${getThemeIconSVG()}</span>
        </button>
        <button
          type="button"
          data-open-account
          class="relative w-9 h-9 rounded-full bg-gradient-to-br from-[#007aff] to-[#5856d6] text-white text-xs font-bold flex items-center justify-center shadow-sm hover:opacity-90 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
          aria-label="Open Account and Storage"
        >
          OS
          <span class="header-update-dot ${pendingCount === 0 ? "hidden" : ""} absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#ff3b30] ring-2 ring-[var(--bg-primary)]"></span>
        </button>
      </div>
    </header>
  `;
}

function renderAppRow(app, rank = null) {
  return `
    <div
      data-open-app="${app.id}"
      role="button"
      tabindex="0"
      class="group flex items-center gap-3.5 py-3 px-2 -mx-2 rounded-2xl hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
    >
      ${rank !== null ? `<span class="w-5 text-center text-[15px] font-bold text-main shrink-0">${rank}</span>` : ""}
      ${renderAppIcon(app, "w-14 h-14")}
      <div class="min-w-0 flex-1">
        <h3 class="text-[15px] font-semibold text-main truncate leading-snug">${app.name}</h3>
        <p class="text-[12.5px] text-sub truncate">${app.tagline}</p>
        <div class="flex items-center gap-1.5 mt-0.5 text-[11px] text-muted">
          <span>${app.category}</span>
          <span>·</span>
          <span>v${app.version}</span>
          <span>·</span>
          <span>${app.isCustom ? "Sideloaded" : app.sizeLabel}</span>
        </div>
      </div>
      ${renderActionButton(app)}
    </div>
  `;
}

function renderTodayView() {
  const apps = getAllApps();
  const dsa = getAppById("dsa-sheet");
  const board = getAppById("dsa-board") || getAppById("json-studio");
  const liveApps = apps.filter((a) => a.status === "available");
  const roadmapApps = apps.filter((a) => a.status !== "available");
  const todayLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).toUpperCase();

  return `
    <div class="view-enter">
      ${renderPageHeader("Today", todayLabel)}

      <section aria-label="Featured OpenSave Stories" class="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-10">
        ${dsa ? `
          <article
            data-open-app="${dsa.id}"
            role="button"
            tabindex="0"
            class="story-card lg:col-span-7 relative min-h-[380px] sm:min-h-[410px] rounded-[26px] overflow-hidden flex flex-col justify-between cursor-pointer text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
            style="background: radial-gradient(circle at 80% 20%, rgba(82,183,136,0.4), transparent 45%), linear-gradient(145deg, #0d1f18 0%, #1b4332 48%, #2d6a4f 100%);"
          >
            <svg class="absolute inset-0 w-full h-full opacity-90 pointer-events-none" viewBox="0 0 600 420" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <circle cx="470" cy="110" r="110" fill="white" fill-opacity="0.07" />
              <rect x="310" y="75" width="210" height="145" rx="22" fill="white" fill-opacity="0.12" stroke="white" stroke-opacity="0.25" stroke-width="1.5" transform="rotate(-6 415 147)" />
              <rect x="332" y="102" width="95" height="12" rx="6" fill="white" fill-opacity="0.65" transform="rotate(-6 415 147)" />
              <rect x="332" y="126" width="150" height="8" rx="4" fill="white" fill-opacity="0.35" transform="rotate(-6 415 147)" />
              <rect x="332" y="144" width="125" height="8" rx="4" fill="white" fill-opacity="0.35" transform="rotate(-6 415 147)" />
              <circle cx="482" cy="108" r="14" fill="#74c69d" fill-opacity="0.9" transform="rotate(-6 415 147)" />
            </svg>

            <div class="relative z-10 p-6 sm:p-8 max-w-md">
              <span class="inline-block text-[11px] font-bold uppercase tracking-[0.12em] text-white/80 mb-2">FEATURED ON OPENSAVE</span>
              <h2 class="text-3xl sm:text-4xl font-extrabold tracking-tight leading-[1.06]">
                Master DSA with 1/3/7 Spaced Repetition
              </h2>
              <p class="text-sm text-white/80 mt-2.5 leading-relaxed">
                Track sheets, revision queues, pure algorithms, and export clean Medium &amp; LinkedIn articles—100% offline in IndexedDB.
              </p>
            </div>

            <div class="relative z-10 px-5 py-4 bg-black/25 backdrop-blur-xl border-t border-white/15 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                ${renderAppIcon(dsa, "w-12 h-12")}
                <div class="min-w-0">
                  <p class="text-[15px] font-bold text-white truncate">${dsa.name}</p>
                  <p class="text-xs text-white/75 truncate">${dsa.category} · v${dsa.version}</p>
                </div>
              </div>
              ${renderActionButton(dsa, "glass")}
            </div>
          </article>
        ` : ""}

        ${board ? `
          <article
            data-open-app="${board.id}"
            role="button"
            tabindex="0"
            class="story-card lg:col-span-5 relative min-h-[380px] sm:min-h-[410px] rounded-[26px] overflow-hidden flex flex-col justify-between cursor-pointer text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
            style="background: radial-gradient(circle at 20% 25%, rgba(168,85,247,0.42), transparent 50%), linear-gradient(155deg, #130926 0%, #3b0764 55%, #6d28d9 100%);"
          >
            <div class="relative z-10 p-6 sm:p-7">
              <span class="inline-block text-[11px] font-bold uppercase tracking-[0.12em] text-white/80 mb-2">VISUAL STUDIO</span>
              <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight leading-[1.08]">
                Sketch Data Structures Live on Canvas
              </h2>
              <p class="text-sm text-white/75 mt-2.5">${board.tagline}</p>
            </div>

            <div class="relative z-10 px-5 py-4 bg-black/30 backdrop-blur-xl border-t border-white/15 flex items-center justify-between gap-3">
              <div class="flex items-center gap-3 min-w-0">
                ${renderAppIcon(board, "w-12 h-12")}
                <div class="min-w-0">
                  <p class="text-[15px] font-bold text-white truncate">${board.name}</p>
                  <p class="text-xs text-white/75 truncate">${board.category} · v${board.version}</p>
                </div>
              </div>
              ${renderActionButton(board, "glass")}
            </div>
          </article>
        ` : ""}
      </section>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-6 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-[0.08em] text-sub">READY NOW</p>
          <h3 class="text-xl font-bold tracking-tight text-main mb-3">Available Mini-Apps</h3>
          <div class="divide-y divide-[var(--hairline-subtle)]">
            ${liveApps.map((app) => renderAppRow(app)).join("")}
          </div>
        </div>

        <div class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-6 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-[0.08em] text-sub">BUILD &amp; ROADMAP</p>
          <h3 class="text-xl font-bold tracking-tight text-main mb-3">Coming Soon</h3>
          <div class="divide-y divide-[var(--hairline-subtle)]">
            ${roadmapApps.map((app) => renderAppRow(app)).join("")}
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderCatalogTabView(sectionType) {
  const isTools = sectionType === "tools";
  const title = isTools ? "Dev Tools" : "Apps";
  const sectionApps = getAllApps().filter((i) => i.section === sectionType);
  const categories = ["All", ...new Set(sectionApps.map((i) => i.category))];
  const activeCat = isTools ? state.toolsCategory : state.appsCategory;

  const items = sectionApps.filter((i) => activeCat === "All" || i.category === activeCat);
  const live = items.filter((i) => i.status === "available");
  const soon = items.filter((i) => i.status !== "available");

  return `
    <div class="view-enter">
      ${renderPageHeader(title)}

      <div class="flex items-center gap-2 overflow-x-auto no-scrollbar pb-4 mb-6" role="group" aria-label="Category filters">
        ${categories.map(
          (cat) => `
            <button
              type="button"
              data-filter-section="${sectionType}"
              data-filter-cat="${cat}"
              aria-pressed="${activeCat === cat}"
              class="cat-pill shrink-0 px-4 py-1.5 rounded-full text-[13px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
            >
              ${cat}
            </button>
          `
        ).join("")}
      </div>

      <section class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-6 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xl font-bold tracking-tight text-main">Available ${title}</h2>
            <span class="text-xs font-medium text-sub">Free · Offline</span>
          </div>
          ${live.length > 0
            ? `<div class="divide-y divide-[var(--hairline-subtle)]">${live.map((app, i) => renderAppRow(app, i + 1)).join("")}</div>`
            : `<p class="text-sm text-sub py-6 text-center">No live items in this category yet.</p>`}
        </div>

        <div class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-6 shadow-sm">
          <div class="flex items-center justify-between mb-3">
            <h2 class="text-xl font-bold tracking-tight text-main">Upcoming ${title}</h2>
            <span class="text-xs font-medium text-sub">Roadmap</span>
          </div>
          ${soon.length > 0
            ? `<div class="divide-y divide-[var(--hairline-subtle)]">${soon.map((app) => renderAppRow(app)).join("")}</div>`
            : `<p class="text-sm text-sub py-6 text-center">All ${title.toLowerCase()} in this category are live.</p>`}
        </div>
      </section>
    </div>
  `;
}

function renderInstalledView() {
  const installedApps = getAllApps().filter((a) => isInstalled(a.id));

  return `
    <div class="view-enter">
      ${renderPageHeader("Installed")}

      <section class="mb-8">
        <div
          class="relative rounded-[28px] overflow-hidden p-7 sm:p-9 text-white shadow-xl"
          style="background: radial-gradient(circle at 80% 25%, rgba(10,132,255,0.42), transparent 45%), radial-gradient(circle at 15% 85%, rgba(82,183,136,0.35), transparent 45%), #0c0c10;"
        >
          <div class="relative z-10 max-w-xl">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-semibold mb-4">
              <span class="w-2 h-2 rounded-full bg-[#34c759]"></span>
              <span>Offline-First IndexedDB &amp; Cache Storage</span>
            </div>
            <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight leading-[1.1]">
              ${installedApps.length} Mini-App${installedApps.length === 1 ? "" : "s"} Ready Offline
            </h2>
            <p class="text-sm text-white/75 mt-2">
              Auto-update is ${hub.settings.autoUpdate ? "ON" : "OFF"}. Add your own <code>.zip</code> mini-apps with <strong>+</strong> — they stay installed permanently and can be published to the OpenSave server anytime.
            </p>
            <div class="mt-5 flex flex-wrap items-center gap-3">
              <button type="button" data-open-add-app class="px-5 py-2.5 rounded-full bg-white text-[#1d1d1f] hover:bg-white/90 font-bold text-xs transition">
                + Add .ZIP App
              </button>
              <button type="button" data-open-account class="get-btn get-btn-glass px-5 py-2.5 rounded-full text-xs">
                Storage &amp; Updates
              </button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 class="text-xl font-bold tracking-tight text-main mb-4">Your App Drawer</h3>
        ${installedApps.length > 0 ? `
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
            ${installedApps.map(
              (app) => `
                <article
                  data-open-app="${app.id}"
                  role="button"
                  tabindex="0"
                  class="story-card rounded-[24px] overflow-hidden surface-elevated border border-hairline-subtle cursor-pointer flex flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]"
                >
                  <div class="h-32 relative p-5 flex flex-col justify-between text-white" style="background: ${app.iconBg};">
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-[10px] font-bold uppercase tracking-[0.12em] bg-black/25 backdrop-blur-md px-2.5 py-1 rounded-full">v${hub.installed[app.id].installedVersion} · ${app.isCustom ? "SIDELOADED" : "OFFLINE"}</span>
                      ${app.isCustom ? `<button type="button" data-open-publish="${app.id}" class="get-btn get-btn-glass px-3 py-1 rounded-full text-[11px]">Publish</button>` : ""}
                    </div>
                    <div>
                      <h4 class="text-xl font-extrabold tracking-tight">${app.name}</h4>
                      <p class="text-xs text-white/85">${app.category} · ${app.sizeLabel}</p>
                    </div>
                  </div>
                  <div class="p-4 flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3 min-w-0">
                      ${renderAppIcon(app, "w-12 h-12")}
                      <p class="text-xs text-sub line-clamp-2">${app.tagline}</p>
                    </div>
                    ${renderActionButton(app)}
                  </div>
                </article>
              `
            ).join("")}
          </div>
        ` : `
          <div class="surface-elevated rounded-[24px] border border-hairline-subtle py-14 px-6 text-center">
            <h3 class="text-lg font-bold text-main">No Installed Apps Yet</h3>
            <p class="text-sm text-sub mt-1">Browse Today or click + to sideload a .zip mini-app.</p>
          </div>
        `}
      </section>
    </div>
  `;
}

function renderSearchView() {
  const allApps = getAllApps();
  const q = state.searchQuery.trim().toLowerCase();
  const trending = ["DSA", "Canvas", "JSON", "Spaced Repetition", "Offline"];
  const matches = q
    ? allApps.filter((item) => {
        const hay = `${item.name} ${item.tagline} ${item.category} ${(item.tags || []).join(" ")}`.toLowerCase();
        return hay.includes(q);
      })
    : [];

  return `
    <div class="view-enter">
      ${renderPageHeader("Search")}

      <div class="relative mb-7">
        <svg class="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7.5" /><path stroke-linecap="round" d="M20 20l-3.8-3.8" />
        </svg>
        <input
          type="search"
          id="mainSearchInput"
          value="${escAttr(state.searchQuery)}"
          placeholder="Search OpenSave apps, dev tools, and tags"
          aria-label="Search OpenSave"
          class="w-full pl-11 pr-20 py-3 rounded-2xl text-[15px] surface-secondary text-main placeholder:text-muted border border-hairline-subtle focus:outline-none focus:ring-2 focus:ring-[#007aff]"
        />
        ${state.searchQuery ? `<button type="button" id="clearMainSearchBtn" class="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full text-xs font-semibold accent-text">Clear</button>` : ""}
      </div>

      ${!q ? `
        <section class="mb-9">
          <h2 class="text-lg font-bold tracking-tight text-main mb-3">Discover</h2>
          <div class="flex flex-wrap gap-2.5">
            ${trending.map((term) => `
              <button type="button" data-trending-term="${term}" class="cat-pill inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-[13px] font-medium">
                <svg class="w-3.5 h-3.5 accent-text" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path stroke-linecap="round" d="M20 20l-3.8-3.8"/></svg>
                <span>${term}</span>
              </button>
            `).join("")}
          </div>
        </section>

        <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-6 shadow-sm">
          <h2 class="text-lg font-bold tracking-tight text-main mb-3">All OpenSave Tools</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0 divide-[var(--hairline-subtle)]">
            ${allApps.map((app) => renderAppRow(app)).join("")}
          </div>
        </section>
      ` : matches.length > 0 ? `
        <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-6 shadow-sm">
          <p class="text-xs font-semibold text-sub mb-3">${matches.length} result${matches.length === 1 ? "" : "s"} for "${escAttr(state.searchQuery.trim())}"</p>
          <div class="divide-y divide-[var(--hairline-subtle)]">
            ${matches.map((app) => renderAppRow(app)).join("")}
          </div>
        </section>
      ` : `
        <div class="surface-elevated rounded-[24px] border border-hairline-subtle py-16 px-6 text-center">
          <h3 class="text-lg font-bold text-main">No Results</h3>
          <p class="text-sm text-sub mt-1">We couldn't find any OpenSave tools matching "${escAttr(state.searchQuery.trim())}".</p>
          <button type="button" id="emptySearchResetBtn" class="mt-4 px-5 py-2 rounded-full get-btn-solid text-xs font-semibold">Reset Search</button>
        </div>
      `}
    </div>
  `;
}

// ---------------- Product Detail Modal ----------------
function renderProductModalBody() {
  const app = getAppById(state.activeProductId);
  if (!app) return;

  document.getElementById("detailSheetCategory").textContent = app.category;
  const body = document.getElementById("productModalBody");
  const installed = isInstalled(app.id);

  body.innerHTML = `
    <div class="flex items-start gap-4 sm:gap-5">
      ${renderAppIcon(app, "w-20 h-20 sm:w-24 sm:h-24")}
      <div class="min-w-0 flex-1 flex flex-col justify-between">
        <div>
          <h2 id="detailAppTitle" class="text-xl sm:text-2xl font-bold tracking-tight text-main leading-tight">${app.name}</h2>
          <p class="text-sm text-sub mt-0.5">${app.tagline}</p>
        </div>
        <div class="mt-3.5 flex items-center justify-between gap-3 flex-wrap">
          <div class="flex items-center gap-2.5">
            ${renderActionButton(app, "solid")}
            ${app.isCustom ? `<button type="button" data-open-publish="${app.id}" class="get-btn px-4 py-1.5 rounded-full text-[13px] leading-none">Publish</button>` : ""}
          </div>
          ${installed ? `<button type="button" data-uninstall-app="${app.id}" class="text-xs font-semibold text-[#ff3b30] hover:underline px-2 py-1">Remove</button>` : ""}
        </div>
      </div>
    </div>

    <div class="flex items-stretch overflow-x-auto no-scrollbar py-3.5 border-y border-hairline-subtle divide-x divide-[var(--hairline-subtle)] text-center">
      <div class="px-5 shrink-0">
        <p class="text-[10px] font-bold uppercase text-muted">SOURCE</p>
        <p class="text-sm font-semibold text-sub mt-1.5">${app.isCustom ? "Sideloaded" : "Official"}</p>
      </div>
      <div class="px-5 shrink-0">
        <p class="text-[10px] font-bold uppercase text-muted">VERSION</p>
        <p class="text-lg font-bold text-sub mt-0.5">${app.version}</p>
      </div>
      <div class="px-5 shrink-0">
        <p class="text-[10px] font-bold uppercase text-muted">STORAGE</p>
        <p class="text-sm font-semibold text-sub mt-1.5">Offline</p>
      </div>
      <div class="px-5 shrink-0">
        <p class="text-[10px] font-bold uppercase text-muted">DEVELOPER</p>
        <p class="text-sm font-semibold text-sub mt-1.5">${app.developer || "OpenSave"}</p>
      </div>
      <div class="px-5 shrink-0">
        <p class="text-[10px] font-bold uppercase text-muted">SIZE</p>
        <p class="text-lg font-bold text-sub mt-0.5">${app.sizeLabel}</p>
      </div>
    </div>

    <section>
      <p class="text-sm text-main leading-relaxed ${state.descExpanded ? "" : "line-clamp-3"}">${app.description || app.tagline}</p>
      <button type="button" id="toggleDescBtn" class="mt-1.5 text-xs font-semibold accent-text hover:underline">
        ${state.descExpanded ? "less" : "more"}
      </button>
    </section>

    <section class="pt-4 border-t border-hairline-subtle">
      <div class="flex items-center justify-between mb-2">
        <h3 class="text-base font-bold text-main">What’s New</h3>
        <span class="text-xs text-sub">Version ${app.version}</span>
      </div>
      <ul class="list-disc pl-5 space-y-1 text-sm text-sub">
        ${(app.changelog || []).map((c) => `<li>${c}</li>`).join("")}
      </ul>
    </section>

    <section class="pt-4 border-t border-hairline-subtle">
      <h3 class="text-base font-bold text-main mb-3">App Privacy</h3>
      <div class="surface-secondary rounded-2xl p-4 flex items-start gap-3.5">
        <div class="w-9 h-9 rounded-full bg-[#007aff]/15 accent-text flex items-center justify-center shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 3l7 4v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V7l7-4z"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.5 12.2l1.8 1.8 3.7-3.8"/>
          </svg>
        </div>
        <div>
          <p class="text-sm font-bold text-main">${app.privacy?.level || "Data Not Collected"}</p>
          <p class="text-xs text-sub mt-0.5 leading-relaxed">${app.privacy?.detail || "Runs 100% locally in your browser."}</p>
        </div>
      </div>
    </section>
  `;
}

// Generic Modal Open/Close Helper
function showModal(prefix) {
  const modal = document.getElementById(`${prefix}Modal`);
  const backdrop = document.getElementById(`${prefix}ModalBackdrop`);
  const sheet = document.getElementById(`${prefix}ModalSheet`);
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  document.body.style.overflow = "hidden";
  requestAnimationFrame(() => {
    backdrop.classList.remove("opacity-0");
    backdrop.classList.add("opacity-100");
    sheet.classList.remove("opacity-0", "translate-y-8", "sm:translate-y-4", "sm:scale-95");
    sheet.classList.add("opacity-100", "translate-y-0", "sm:scale-100");
  });
}

function hideModal(prefix, onDone) {
  const modal = document.getElementById(`${prefix}Modal`);
  const backdrop = document.getElementById(`${prefix}ModalBackdrop`);
  const sheet = document.getElementById(`${prefix}ModalSheet`);
  backdrop.classList.add("opacity-0");
  backdrop.classList.remove("opacity-100");
  sheet.classList.add("opacity-0", "translate-y-8", "sm:translate-y-4", "sm:scale-95");
  sheet.classList.remove("opacity-100", "translate-y-0", "sm:scale-100");
  setTimeout(() => {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
    if (onDone) onDone();
    if (!state.activeProductId && !state.accountModalOpen && !state.addAppModalOpen && !state.publishAppId && !state.activeWorkspaceApp) {
      document.body.style.overflow = "";
    }
  }, 240);
}

function openProductModal(appId) {
  if (!getAppById(appId)) return;
  state.activeProductId = appId;
  state.descExpanded = false;
  renderProductModalBody();
  showModal("product");
}

function closeProductModal() {
  hideModal("product", () => { state.activeProductId = null; });
}

// ---------------- Add App (.ZIP Sideload) Modal ----------------
function renderAddAppModalBody() {
  const body = document.getElementById("addAppModalBody");
  const d = state.zipDraft;

  body.innerHTML = `
    <div id="zipDropzone" class="zip-dropzone">
      <input type="file" id="zipFileInput" accept=".zip,application/zip" class="hidden" />
      <p class="text-sm font-bold text-main">${d ? `Loaded: ${escAttr(d.fileName)}` : "Drop your Mini-App .ZIP here"}</p>
      <p class="text-xs text-sub mt-1">${d ? `${d.fileCount} files · ${fmtSize(d.totalBytes)} · Click to choose another ZIP` : "Or click to browse. Must contain index.html (and optional opensave.json)."}</p>
    </div>

    ${state.zipError ? `<div class="surface-elevated rounded-2xl p-3.5 border border-hairline text-xs font-semibold text-[#ff3b30]">${escAttr(state.zipError)}</div>` : ""}

    ${d ? `
      <div class="surface-elevated rounded-2xl p-4 border border-hairline-subtle check-list">
        <div class="check-item"><span class="check-dot ${d.hasIndexHtml ? "ok" : "err"}">${d.hasIndexHtml ? "✓" : "✕"}</span><span><code>index.html</code> entry point ${d.hasIndexHtml ? "detected" : "missing (required)"}</span></div>
        <div class="check-item"><span class="check-dot ${d.manifest ? "ok" : "ok"}">${d.manifest ? "✓" : "i"}</span><span><code>opensave.json</code> ${d.manifest ? "parsed automatically" : "not found — fill details below"}</span></div>
      </div>

      <form id="sideloadForm" class="surface-elevated rounded-2xl p-4 border border-hairline-subtle space-y-3.5">
        <div class="zip-input-grid">
          <div class="os-field">
            <label for="slName">App Name *</label>
            <input id="slName" required value="${escAttr(d.form.name)}" placeholder="e.g. Regex Lab" />
          </div>
          <div class="os-field">
            <label for="slId">App ID (slug) *</label>
            <input id="slId" required value="${escAttr(d.form.id)}" placeholder="e.g. regex-lab" />
          </div>
        </div>
        <div class="os-field">
          <label for="slTagline">Tagline *</label>
          <input id="slTagline" required value="${escAttr(d.form.tagline)}" placeholder="Short 1-line description" />
        </div>
        <div class="zip-input-grid">
          <div class="os-field">
            <label for="slCategory">Category</label>
            <input id="slCategory" value="${escAttr(d.form.category)}" placeholder="Dev Tools / Productivity" />
          </div>
          <div class="os-field">
            <label for="slSection">Store Tab</label>
            <select id="slSection">
              <option value="apps" ${d.form.section === "apps" ? "selected" : ""}>Apps</option>
              <option value="tools" ${d.form.section === "tools" ? "selected" : ""}>Dev Tools</option>
            </select>
          </div>
        </div>
        <div class="zip-input-grid">
          <div class="os-field">
            <label for="slVersion">Version</label>
            <input id="slVersion" value="${escAttr(d.form.version)}" placeholder="1.0.0" />
          </div>
          <div class="os-field">
            <label for="slDeveloper">Developer</label>
            <input id="slDeveloper" value="${escAttr(d.form.developer)}" placeholder="Your Name" />
          </div>
        </div>
        <button type="submit" ${d.hasIndexHtml ? "" : "disabled"} class="w-full py-2.5 rounded-full get-btn get-btn-solid text-sm ${d.hasIndexHtml ? "" : "opacity-55 cursor-not-allowed"}">
          Install Permanently (Offline)
        </button>
      </form>
    ` : `
      <div class="surface-elevated rounded-2xl p-4 border border-hairline-subtle flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p class="text-xs font-bold text-main">Need a working example?</p>
          <p class="text-[11px] text-sub">Download our starter .ZIP or read the Developer Docs.</p>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" data-download-starter class="get-btn px-3.5 py-1.5 rounded-full text-xs">Starter .ZIP</button>
          <button type="button" id="openDocsFromAddBtn" class="get-btn px-3.5 py-1.5 rounded-full text-xs">Docs</button>
        </div>
      </div>
    `}
  `;
}

async function handleZipSelection(file) {
  if (!file) return;
  state.zipError = null;
  try {
    const unpacked = await unpackZipFile(file);
    const m = unpacked.manifest || {};
    const baseName = file.name.replace(/\.zip$/i, "");
    state.zipDraft = {
      fileName: file.name,
      rawZipBlob: file,
      ...unpacked,
      form: {
        id: slugifyAppId(m.id || baseName),
        name: m.name || baseName.replace(/[-_]+/g, " "),
        tagline: m.tagline || "Custom offline mini-app installed via ZIP.",
        description: m.description || m.tagline || "",
        category: m.category || "Utilities",
        section: m.section === "tools" ? "tools" : "apps",
        version: m.version || "1.0.0",
        developer: m.developer || "Local Developer",
        accent: m.accent || "#007aff",
        tags: m.tags || ["Custom", "Offline"],
        changelog: m.changelog || [],
      },
    };
  } catch (err) {
    state.zipDraft = null;
    state.zipError = err.message || "Could not read ZIP file.";
  }
  renderAddAppModalBody();
}

function openAddAppModal() {
  state.addAppModalOpen = true;
  state.zipDraft = null;
  state.zipError = null;
  renderAddAppModalBody();
  showModal("addApp");
}

function closeAddAppModal() {
  hideModal("addApp", () => {
    state.addAppModalOpen = false;
    state.zipDraft = null;
    state.zipError = null;
  });
}

// ---------------- Publish to Server Modal ----------------
function renderPublishModalBody() {
  const app = getAppById(state.publishAppId);
  if (!app) return;
  const body = document.getElementById("publishModalBody");

  body.innerHTML = `
    <div class="surface-elevated rounded-2xl p-4 border border-hairline-subtle flex items-center gap-3.5">
      ${renderAppIcon(app, "w-12 h-12")}
      <div class="min-w-0 flex-1">
        <p class="text-[15px] font-bold text-main truncate">${app.name}</p>
        <p class="text-xs text-sub truncate">${app.id} · v${app.version} · ${app.sizeLabel}</p>
      </div>
    </div>

    <form id="publishForm" class="surface-elevated rounded-2xl p-4 border border-hairline-subtle space-y-3.5">
      <div class="os-field">
        <label for="pubEndpoint">OpenSave Publish Server URL</label>
        <input id="pubEndpoint" required value="${escAttr(hub.settings.publishEndpoint || "/api/v1/apps/publish")}" placeholder="https://api.opensave.dev/v1/apps/publish" />
      </div>
      <div class="os-field">
        <label for="pubEmail">Developer Email (optional, for review updates)</label>
        <input id="pubEmail" type="email" placeholder="you@example.com" />
      </div>
      <div class="os-field">
        <label for="pubNotes">Release Notes</label>
        <textarea id="pubNotes" rows="2" placeholder="What does your mini-app do?"></textarea>
      </div>
      <button type="submit" ${state.publishBusy ? "disabled" : ""} class="w-full py-2.5 rounded-full get-btn get-btn-solid text-sm">
        ${state.publishBusy ? "Uploading ZIP to Server..." : "Publish to Server"}
      </button>
    </form>

    ${state.publishResult ? `
      <div class="surface-elevated rounded-2xl p-4 border border-hairline text-xs ${state.publishResult.ok ? "text-[#34c759]" : "text-[#ff3b30]"}">
        <strong>${state.publishResult.ok ? "Published:" : "Server Unreachable / Error:"}</strong> ${escAttr(state.publishResult.message)}
      </div>
    ` : ""}

    <div class="surface-elevated rounded-2xl p-4 border border-hairline-subtle space-y-3">
      <div>
        <p class="text-xs font-bold text-main">Static Repo Publish (₹0 Fallback)</p>
        <p class="text-[11px] text-sub">No backend deployed yet? Export the verified .ZIP and copy its catalog.json entry to submit via GitHub PR.</p>
      </div>
      <div class="os-field">
        <label for="githubRepoInput">GitHub Repository (for GitHub Actions Auto-Publish)</label>
        <input id="githubRepoInput" value="${escAttr(hub.settings.githubRepo || "")}" placeholder="username/opensave-hub" />
      </div>
      <div class="flex flex-wrap gap-2">
        <button type="button" id="submitGithubBtn" class="get-btn get-btn-solid px-3.5 py-1.5 rounded-full text-xs">Open GitHub Submissions</button>
        <button type="button" id="copyCatalogEntryBtn" class="get-btn px-3.5 py-1.5 rounded-full text-xs">Copy catalog.json Entry</button>
        <button type="button" id="downloadBundleZipBtn" class="get-btn px-3.5 py-1.5 rounded-full text-xs">Download Verified .ZIP</button>
      </div>
    </div>
  `;
}

function openPublishModal(appId) {
  const app = getAppById(appId);
  if (!app) return;
  if (state.activeProductId) closeProductModal();
  state.publishAppId = appId;
  state.publishBusy = false;
  state.publishResult = null;
  renderPublishModalBody();
  showModal("publish");
}

function closePublishModal() {
  hideModal("publish", () => {
    state.publishAppId = null;
    state.publishBusy = false;
    state.publishResult = null;
  });
}

// ---------------- Account & Storage Modal ----------------
function renderAccountModalBody() {
  const body = document.getElementById("accountModalBody");
  const allApps = getAllApps();
  const pendingApps = allApps.filter((a) => hasUpdate(a));
  const installedApps = allApps.filter((a) => isInstalled(a.id));
  const st = state.storage;
  const pctWidth = Math.max(st.usage ? 2 : 0, Math.min(100, st.percent));

  body.innerHTML = `
    <div class="surface-elevated rounded-2xl p-4 border border-hairline-subtle flex items-center gap-3.5">
      <div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#007aff] to-[#5856d6] text-white font-bold flex items-center justify-center text-base shadow-sm">
        OS
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-[15px] font-bold text-main">OpenSave Hub</p>
        <p class="text-xs text-sub truncate">Free · Offline-First · IndexedDB Storage</p>
      </div>
      <button type="button" id="openDocsFromAccountBtn" class="get-btn px-3.5 py-1.5 rounded-full text-xs">Docs</button>
    </div>

    <div class="surface-elevated rounded-2xl p-4 border border-hairline-subtle flex items-center justify-between gap-4">
      <div>
        <p class="text-sm font-semibold text-main">Appearance</p>
        <p class="text-xs text-sub">Light or Dark mode</p>
      </div>
      <div class="inline-flex p-1 rounded-xl surface-secondary border border-hairline-subtle">
        <button type="button" data-set-theme="light" class="px-3 py-1 rounded-lg text-xs font-semibold transition ${state.theme === "light" ? "surface-elevated text-main shadow-sm" : "text-sub"}">Light</button>
        <button type="button" data-set-theme="dark" class="px-3 py-1 rounded-lg text-xs font-semibold transition ${state.theme === "dark" ? "surface-elevated text-main shadow-sm" : "text-sub"}">Dark</button>
      </div>
    </div>

    <div class="surface-elevated rounded-2xl p-4 border border-hairline-subtle space-y-3.5">
      <div class="flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-main">Auto-Update Mini-Apps</p>
          <p class="text-xs text-sub">Silently update installed apps when online</p>
        </div>
        <button type="button" id="toggleAutoUpdateBtn" class="get-btn px-3.5 py-1 rounded-full text-xs">
          ${hub.settings.autoUpdate ? "ON" : "OFF"}
        </button>
      </div>
      <div class="pt-3 border-t border-hairline-subtle flex items-center justify-between gap-4">
        <div>
          <p class="text-sm font-semibold text-main">Launch Mode</p>
          <p class="text-xs text-sub">Open inside OpenSave or in a new tab</p>
        </div>
        <div class="inline-flex p-1 rounded-xl surface-secondary border border-hairline-subtle">
          <button type="button" data-launch-mode="embedded" class="px-3 py-1 rounded-lg text-xs font-semibold transition ${hub.settings.launchMode === "embedded" ? "surface-elevated text-main shadow-sm" : "text-sub"}">Embedded</button>
          <button type="button" data-launch-mode="tab" class="px-3 py-1 rounded-lg text-xs font-semibold transition ${hub.settings.launchMode === "tab" ? "surface-elevated text-main shadow-sm" : "text-sub"}">New Tab</button>
        </div>
      </div>
    </div>

    <!-- Google Login & Drive Cloud Backup (Zero Backend) -->
    <section>
      <h3 class="text-xs font-bold uppercase tracking-wider text-sub mb-2.5 px-1">Google Drive Cloud Sync (Free)</h3>
      <div class="surface-elevated rounded-2xl p-4 border border-hairline-subtle space-y-3.5">
        ${hub.googleUser ? `
          <div class="flex items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-bold text-main truncate">${escAttr(hub.googleUser.name)}</p>
              <p class="text-[11px] text-sub truncate">${escAttr(hub.googleUser.email)} · ${isDriveConnected() ? "Connected" : "Session expired (click sync)"}</p>
            </div>
            <button type="button" id="googleSignOutBtn" class="text-xs font-semibold text-[#ff3b30] hover:underline shrink-0">Sign Out</button>
          </div>
          <div class="pt-3 border-t border-hairline-subtle flex flex-wrap items-center justify-between gap-2">
            <span class="text-[11px] text-sub">${hub.lastDriveSync ? `Last sync: ${new Date(hub.lastDriveSync).toLocaleString("en-IN")}` : "Not backed up to Drive yet"}</span>
            <div class="flex gap-2">
              <button type="button" id="driveBackupBtn" ${state.driveBusy ? "disabled" : ""} class="get-btn get-btn-solid px-3.5 py-1.5 rounded-full text-xs">${state.driveBusy ? "Syncing..." : "Backup to Drive"}</button>
              <button type="button" id="driveRestoreBtn" ${state.driveBusy ? "disabled" : ""} class="get-btn px-3.5 py-1.5 rounded-full text-xs">Restore</button>
            </div>
          </div>
        ` : `
          <div class="os-field">
            <label for="googleClientIdInput">Google OAuth Web Client ID</label>
            <input id="googleClientIdInput" value="${escAttr(hub.settings.googleClientId || "")}" placeholder="123456789-xxxx.apps.googleusercontent.com" />
          </div>
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <span class="text-[11px] text-sub">Stores backup privately in Drive <code>appDataFolder</code></span>
            <button type="button" id="googleSignInBtn" ${state.driveBusy ? "disabled" : ""} class="get-btn get-btn-solid px-4 py-1.5 rounded-full text-xs">${state.driveBusy ? "Signing in..." : "Sign in with Google"}</button>
          </div>
        `}
      </div>
    </section>

    <section>
      <h3 class="text-xs font-bold uppercase tracking-wider text-sub mb-2.5 px-1">Local Storage (IndexedDB)</h3>
      <div class="surface-elevated rounded-2xl p-4 border border-hairline-subtle space-y-3.5">
        <div>
          <div class="h-2 rounded-full surface-secondary overflow-hidden mb-1.5">
            <div class="h-full rounded-full accent-bg" style="width:${pctWidth}%"></div>
          </div>
          <div class="flex justify-between text-[11px] text-sub">
            <span>Used: ${fmtSize(st.usage)}</span>
            <span>Quota: ${st.quota ? fmtSize(st.quota) : "Disk-based"}</span>
          </div>
        </div>
        <div class="pt-3 border-t border-hairline-subtle flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold text-main">Persistent Storage</p>
            <p class="text-[11px] text-sub">${st.persisted ? "Protected from browser eviction" : "Ask browser to protect your data"}</p>
          </div>
          ${st.persisted
            ? `<span class="text-xs font-semibold text-[#34c759]">Protected</span>`
            : `<button type="button" id="protectStorageBtn" class="get-btn px-3.5 py-1 rounded-full text-xs">Protect</button>`}
        </div>
        <div class="pt-3 border-t border-hairline-subtle flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-semibold text-main">Sync to Local OS Folder</p>
            <p class="text-[11px] text-sub">${state.folderName ? `Linked: ${state.folderName}` : "Write opensave-backup.json to disk"}</p>
          </div>
          <button type="button" id="syncFolderBtn" class="get-btn px-3.5 py-1 rounded-full text-xs">${state.folderName ? "Sync Now" : "Choose"}</button>
        </div>
      </div>
    </section>

    <section>
      <div class="flex items-center justify-between mb-2.5 px-1">
        <h3 class="text-xs font-bold uppercase tracking-wider text-sub">Upcoming Updates (${pendingApps.length})</h3>
      </div>
      <div class="surface-elevated rounded-2xl border border-hairline-subtle px-4 divide-y divide-[var(--hairline-subtle)]">
        ${pendingApps.length === 0
          ? `<p class="py-5 text-center text-xs text-sub">All your mini-apps are up to date.</p>`
          : pendingApps.map((app) => `
              <div class="py-3.5 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                  ${renderAppIcon(app, "w-11 h-11")}
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-main truncate">${app.name}</p>
                    <p class="text-[11px] text-sub truncate">v${hub.installed[app.id].installedVersion} → v${app.version}</p>
                  </div>
                </div>
                ${renderActionButton(app)}
              </div>
            `).join("")}
      </div>
    </section>

    <section>
      <h3 class="text-xs font-bold uppercase tracking-wider text-sub mb-2.5 px-1">Installed Apps (${installedApps.length})</h3>
      <div class="surface-elevated rounded-2xl border border-hairline-subtle px-4 divide-y divide-[var(--hairline-subtle)]">
        ${installedApps.length === 0
          ? `<p class="py-5 text-center text-xs text-sub">No installed apps yet.</p>`
          : installedApps.map((app) => `
              <div class="py-3 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0 cursor-pointer" data-open-app-from-account="${app.id}">
                  ${renderAppIcon(app, "w-10 h-10")}
                  <div class="min-w-0">
                    <p class="text-sm font-semibold text-main truncate">${app.name}</p>
                    <p class="text-[11px] text-sub truncate">${app.category} · v${hub.installed[app.id].installedVersion}</p>
                  </div>
                </div>
                <button type="button" data-action-app="${app.id}" class="get-btn px-4 py-1.5 rounded-full text-xs shrink-0">OPEN</button>
              </div>
            `).join("")}
      </div>
    </section>
  `;
}

function openAccountModal() {
  state.accountModalOpen = true;
  refreshStorageInfo();
  renderAccountModalBody();
  showModal("account");
}

function closeAccountModal() {
  hideModal("account", () => { state.accountModalOpen = false; });
}

function renderActiveTab() {
  const main = document.getElementById("mainContent");
  let html = "";
  if (state.activeTab === "today") html = renderTodayView();
  else if (state.activeTab === "tools") html = renderCatalogTabView("tools");
  else if (state.activeTab === "apps") html = renderCatalogTabView("apps");
  else if (state.activeTab === "installed") html = renderInstalledView();
  else if (state.activeTab === "search") html = renderSearchView();
  else if (state.activeTab === "docs") html = renderDocsView(renderPageHeader("Developer Docs", "BUILD FOR OPENSAVE"));
  main.innerHTML = html;
}

function refreshVisibleUI() {
  const activeEl = document.activeElement;
  const wasMainSearch = activeEl && activeEl.id === "mainSearchInput";
  const caretPos = wasMainSearch ? activeEl.selectionStart : null;

  renderActiveTab();
  if (state.activeProductId) renderProductModalBody();
  if (state.accountModalOpen) renderAccountModalBody();
  updateAccountBadges();

  if (wasMainSearch) {
    const input = document.getElementById("mainSearchInput");
    if (input) {
      input.focus();
      if (caretPos !== null) input.setSelectionRange(caretPos, caretPos);
    }
  }
}

function switchTab(tabId) {
  if (!TABS.some((t) => t.id === tabId) && tabId !== "docs") return;
  state.activeTab = tabId;
  renderNavigation();
  renderActiveTab();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function loadCatalog() {
  try {
    const res = await fetch("./registry/catalog.json", { cache: "no-cache" });
    const data = await res.json();
    state.catalog = Array.isArray(data.apps) ? data.apps : [];

    if (hub.settings.autoUpdate) {
      let updated = 0;
      for (const app of state.catalog) {
        if (hasUpdate(app)) {
          await precacheApp(app);
          hub.installed[app.id].installedVersion = app.version;
          hub.installed[app.id].updatedAt = Date.now();
          updated++;
        }
      }
      if (updated) {
        saveHub();
        showToast(`Auto-updated ${updated} mini-app${updated > 1 ? "s" : ""}`);
      }
    }
  } catch {
    showToast("Offline mode — using cached catalog");
  }
  refreshVisibleUI();
}

// ---------------- Event Delegation ----------------
document.getElementById("desktopSidebarNav").addEventListener("click", (e) => {
  if (e.target.closest("[data-open-add-app]")) {
    openAddAppModal();
    return;
  }
  const btn = e.target.closest("[data-tab]");
  if (btn) switchTab(btn.dataset.tab);
});

document.getElementById("mobileBottomNav").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (btn) switchTab(btn.dataset.tab);
});

document.getElementById("sidebarQuickSearch").addEventListener("input", (e) => {
  state.searchQuery = e.target.value;
  if (state.activeTab !== "search") {
    state.activeTab = "search";
    renderNavigation();
  }
  renderActiveTab();
});

document.getElementById("sidebarThemeToggle").addEventListener("click", toggleTheme);
document.getElementById("sidebarAccountBtn").addEventListener("click", openAccountModal);

document.getElementById("closeWorkspaceBtn").addEventListener("click", closeWorkspace);
document.getElementById("openWorkspaceTabBtn").addEventListener("click", () => {
  if (state.activeWorkspaceApp) window.open(state.activeWorkspaceApp.url, "_blank", "noopener");
});

document.getElementById("mainContent").addEventListener("click", async (e) => {
  const actionBtn = e.target.closest("[data-action-app]");
  if (actionBtn) {
    e.stopPropagation();
    triggerAppAction(actionBtn.dataset.actionApp);
    return;
  }
  const pubBtn = e.target.closest("[data-open-publish]");
  if (pubBtn) {
    e.stopPropagation();
    openPublishModal(pubBtn.dataset.openPublish);
    return;
  }
  if (e.target.closest("[data-open-add-app]")) {
    openAddAppModal();
    return;
  }
  if (e.target.closest("[data-download-starter]")) {
    downloadStarterZip();
    return;
  }
  const copyBtn = e.target.closest("[data-copy-code]");
  if (copyBtn) {
    const codeEl = document.getElementById(`doc-code-${copyBtn.dataset.copyCode}`);
    if (codeEl && navigator.clipboard) {
      navigator.clipboard.writeText(codeEl.textContent).then(() => showToast("Copied snippet"));
    }
    return;
  }
  const tabBtn = e.target.closest("[data-tab]");
  if (tabBtn) {
    switchTab(tabBtn.dataset.tab);
    return;
  }
  if (e.target.closest("#installPwaBtn") && state.installPrompt) {
    const p = state.installPrompt;
    state.installPrompt = null;
    p.prompt();
    await p.userChoice;
    refreshVisibleUI();
    return;
  }
  if (e.target.closest("[data-toggle-theme]")) {
    toggleTheme();
    return;
  }
  if (e.target.closest("[data-open-account]")) {
    openAccountModal();
    return;
  }
  const filterBtn = e.target.closest("[data-filter-cat]");
  if (filterBtn) {
    if (filterBtn.dataset.filterSection === "tools") state.toolsCategory = filterBtn.dataset.filterCat;
    else state.appsCategory = filterBtn.dataset.filterCat;
    renderActiveTab();
    return;
  }
  const trendBtn = e.target.closest("[data-trending-term]");
  if (trendBtn) {
    state.searchQuery = trendBtn.dataset.trendingTerm;
    document.getElementById("sidebarQuickSearch").value = state.searchQuery;
    renderActiveTab();
    return;
  }
  if (e.target.closest("#clearMainSearchBtn") || e.target.closest("#emptySearchResetBtn")) {
    state.searchQuery = "";
    document.getElementById("sidebarQuickSearch").value = "";
    renderActiveTab();
    return;
  }
  const openCard = e.target.closest("[data-open-app]");
  if (openCard) openProductModal(openCard.dataset.openApp);
});

document.getElementById("mainContent").addEventListener("input", (e) => {
  if (e.target.id === "mainSearchInput") {
    state.searchQuery = e.target.value;
    document.getElementById("sidebarQuickSearch").value = state.searchQuery;
    refreshVisibleUI();
  }
});

// Product Modal events
document.getElementById("closeProductModalBtn").addEventListener("click", closeProductModal);
document.getElementById("productModalBackdrop").addEventListener("click", closeProductModal);
document.getElementById("productModalBody").addEventListener("click", (e) => {
  const actionBtn = e.target.closest("[data-action-app]");
  if (actionBtn) {
    triggerAppAction(actionBtn.dataset.actionApp);
    return;
  }
  const pubBtn = e.target.closest("[data-open-publish]");
  if (pubBtn) {
    openPublishModal(pubBtn.dataset.openPublish);
    return;
  }
  const unBtn = e.target.closest("[data-uninstall-app]");
  if (unBtn) {
    uninstallApp(unBtn.dataset.uninstallApp);
    return;
  }
  if (e.target.closest("#toggleDescBtn")) {
    state.descExpanded = !state.descExpanded;
    renderProductModalBody();
  }
});

// Add App (.ZIP) Modal events
document.getElementById("closeAddAppModalBtn").addEventListener("click", closeAddAppModal);
document.getElementById("addAppModalBackdrop").addEventListener("click", closeAddAppModal);
const addAppBody = document.getElementById("addAppModalBody");

addAppBody.addEventListener("click", (e) => {
  if (e.target.closest("[data-download-starter]")) {
    downloadStarterZip();
    return;
  }
  if (e.target.closest("#openDocsFromAddBtn")) {
    closeAddAppModal();
    setTimeout(() => switchTab("docs"), 250);
    return;
  }
  if (e.target.closest("#zipDropzone")) {
    document.getElementById("zipFileInput")?.click();
  }
});

addAppBody.addEventListener("change", (e) => {
  if (e.target.id === "zipFileInput" && e.target.files?.[0]) {
    handleZipSelection(e.target.files[0]);
  }
});

addAppBody.addEventListener("dragover", (e) => {
  const dz = e.target.closest("#zipDropzone");
  if (dz) {
    e.preventDefault();
    dz.classList.add("drag-active");
  }
});

addAppBody.addEventListener("dragleave", (e) => {
  const dz = e.target.closest("#zipDropzone");
  if (dz) dz.classList.remove("drag-active");
});

addAppBody.addEventListener("drop", (e) => {
  const dz = e.target.closest("#zipDropzone");
  if (dz) {
    e.preventDefault();
    dz.classList.remove("drag-active");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleZipSelection(file);
  }
});

addAppBody.addEventListener("submit", async (e) => {
  if (e.target.id !== "sideloadForm" || !state.zipDraft) return;
  e.preventDefault();
  try {
    const meta = {
      ...state.zipDraft.form,
      name: document.getElementById("slName").value.trim(),
      id: document.getElementById("slId").value.trim(),
      tagline: document.getElementById("slTagline").value.trim(),
      category: document.getElementById("slCategory").value.trim() || "Utilities",
      section: document.getElementById("slSection").value,
      version: document.getElementById("slVersion").value.trim() || "1.0.0",
      developer: document.getElementById("slDeveloper").value.trim() || "Local Developer",
    };

    const appRecord = await saveSideloadedApp({
      appId: meta.id,
      meta,
      filesMap: state.zipDraft.files,
      rawZipBlob: state.zipDraft.rawZipBlob,
      totalBytes: state.zipDraft.totalBytes,
    });

    hub.customApps = (hub.customApps || []).filter((a) => a.id !== appRecord.id);
    hub.customApps.unshift(appRecord);
    hub.installed[appRecord.id] = {
      installedVersion: appRecord.version,
      installedAt: Date.now(),
      isCustom: true,
    };
    saveHub();
    closeAddAppModal();
    refreshStorageInfo();
    switchTab("installed");
    showToast(`${appRecord.name} installed permanently!`);
  } catch (err) {
    state.zipError = err.message || "Install failed.";
    renderAddAppModalBody();
  }
});

// Publish Modal events
document.getElementById("closePublishModalBtn").addEventListener("click", closePublishModal);
document.getElementById("publishModalBackdrop").addEventListener("click", closePublishModal);
const publishBody = document.getElementById("publishModalBody");

publishBody.addEventListener("submit", async (e) => {
  if (e.target.id !== "publishForm") return;
  e.preventDefault();
  const app = getAppById(state.publishAppId);
  if (!app || state.publishBusy) return;

  const endpoint = document.getElementById("pubEndpoint").value.trim();
  const authorEmail = document.getElementById("pubEmail").value.trim();
  const releaseNotes = document.getElementById("pubNotes").value.trim();

  hub.settings.publishEndpoint = endpoint;
  saveHub();

  state.publishBusy = true;
  state.publishResult = null;
  renderPublishModalBody();

  try {
    const res = await publishAppToServer({ app, endpoint, authorEmail, releaseNotes });
    state.publishResult = {
      ok: true,
      message: res.message || `Submitted to server (ID: ${res.submissionId || "queued"})`,
    };
    showToast(`${app.name} sent to OpenSave server`);
  } catch (err) {
    state.publishResult = {
      ok: false,
      message: `${err.message}. Use the Static Repo Publish fallback below if your server isn't running yet.`,
    };
  } finally {
    state.publishBusy = false;
    renderPublishModalBody();
  }
});

publishBody.addEventListener("click", async (e) => {
  const app = getAppById(state.publishAppId);
  if (!app) return;

  if (e.target.closest("#submitGithubBtn")) {
    const repo = (document.getElementById("githubRepoInput")?.value || "").trim().replace(/^https?:\/\/github\.com\//, "").replace(/\/+$/, "");
    if (!repo || !repo.includes("/")) {
      showToast("Enter your GitHub repo as username/repo-name");
      return;
    }
    hub.settings.githubRepo = repo;
    saveHub();
    window.open(`https://github.com/${repo}/upload/main/submissions`, "_blank", "noopener");
    showToast("Upload your .ZIP to submissions/ — GitHub Actions will auto-publish it!");
    return;
  }

  if (e.target.closest("#copyCatalogEntryBtn")) {
    const entry = {
      id: app.id,
      name: app.name,
      tagline: app.tagline,
      description: app.description,
      category: app.category,
      section: app.section,
      version: app.version,
      sizeLabel: app.sizeLabel,
      status: "available",
      supportsOffline: true,
      url: `./apps/${app.id}/index.html`,
      accent: app.accent,
      developer: app.developer,
      tags: app.tags,
      changelog: app.changelog,
      assets: (app.assets || []).map((p) => p.replace(`./sideload/${app.id}/`, `./apps/${app.id}/`)),
    };
    await navigator.clipboard?.writeText(JSON.stringify(entry, null, 2));
    showToast("Copied catalog.json entry");
    return;
  }

  if (e.target.closest("#downloadBundleZipBtn")) {
    const rec = await getSideloadedZip(app.id);
    if (!rec?.zipBlob) {
      showToast("ZIP bundle not found in IndexedDB");
      return;
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(rec.zipBlob);
    a.download = `${app.id}-v${app.version}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    showToast(`Downloaded ${app.id}-v${app.version}.zip`);
  }
});

// Account Modal events
document.getElementById("closeAccountModalBtn").addEventListener("click", closeAccountModal);
document.getElementById("accountModalBackdrop").addEventListener("click", closeAccountModal);
document.getElementById("accountModalBody").addEventListener("click", async (e) => {
  if (e.target.closest("#openDocsFromAccountBtn")) {
    closeAccountModal();
    setTimeout(() => switchTab("docs"), 250);
    return;
  }
  const themeBtn = e.target.closest("[data-set-theme]");
  if (themeBtn) {
    applyTheme(themeBtn.dataset.setTheme);
    return;
  }
  if (e.target.closest("#toggleAutoUpdateBtn")) {
    hub.settings.autoUpdate = !hub.settings.autoUpdate;
    saveHub();
    renderAccountModalBody();
    showToast(`Auto-update ${hub.settings.autoUpdate ? "enabled" : "disabled"}`);
    return;
  }
  const launchBtn = e.target.closest("[data-launch-mode]");
  if (launchBtn) {
    hub.settings.launchMode = launchBtn.dataset.launchMode;
    saveHub();
    renderAccountModalBody();
    return;
  }
  if (e.target.closest("#protectStorageBtn")) {
    const ok = await requestPersistentStorage();
    await refreshStorageInfo();
    showToast(ok ? "Persistent storage enabled" : "Browser manages persistence automatically");
    return;
  }
  if (e.target.closest("#googleSignInBtn")) {
    const cid = (document.getElementById("googleClientIdInput")?.value || "").trim();
    hub.settings.googleClientId = cid;
    saveHub();
    state.driveBusy = true;
    renderAccountModalBody();
    try {
      const profile = await signInWithGoogle(cid, { prompt: "consent" });
      hub.googleUser = profile;
      saveHub();
      showToast(`Signed in as ${profile.name}`);
    } catch (err) {
      showToast(err.message || "Google sign-in failed");
    } finally {
      state.driveBusy = false;
      renderAccountModalBody();
    }
    return;
  }
  if (e.target.closest("#googleSignOutBtn")) {
    signOutGoogle();
    hub.googleUser = null;
    saveHub();
    renderAccountModalBody();
    showToast("Signed out of Google");
    return;
  }
  if (e.target.closest("#driveBackupBtn")) {
    state.driveBusy = true;
    renderAccountModalBody();
    try {
      const records = await exportAllRecords();
      await backupToGoogleDrive({
        clientId: hub.settings.googleClientId,
        emailHint: hub.googleUser?.email || "",
        payload: {
          schemaVersion: 1,
          backedUpAt: new Date().toISOString(),
          hub: { settings: hub.settings, installed: hub.installed, customApps: hub.customApps },
          records,
        },
      });
      hub.lastDriveSync = Date.now();
      saveHub();
      showToast(`Backed up ${records.length} app record(s) to Google Drive`);
    } catch (err) {
      showToast(err.message || "Drive backup failed");
    } finally {
      state.driveBusy = false;
      renderAccountModalBody();
    }
    return;
  }
  if (e.target.closest("#driveRestoreBtn")) {
    if (!confirm("Restore your OpenSave Hub and mini-app data from Google Drive? This overwrites local state.")) return;
    state.driveBusy = true;
    renderAccountModalBody();
    try {
      const { data } = await restoreFromGoogleDrive({
        clientId: hub.settings.googleClientId,
        emailHint: hub.googleUser?.email || "",
      });
      if (data?.hub?.installed) hub.installed = data.hub.installed;
      if (data?.hub?.settings) Object.assign(hub.settings, data.hub.settings);
      saveHub();
      const restoredCount = await importAllRecords(data?.records || []);
      refreshStorageInfo();
      refreshVisibleUI();
      showToast(`Restored ${restoredCount} app record(s) from Google Drive`);
    } catch (err) {
      showToast(err.message || "Drive restore failed");
    } finally {
      state.driveBusy = false;
      renderAccountModalBody();
    }
    return;
  }
  if (e.target.closest("#syncFolderBtn")) {
    syncToLocalFolder();
    return;
  }
  const actionBtn = e.target.closest("[data-action-app]");
  if (actionBtn) {
    triggerAppAction(actionBtn.dataset.actionApp);
    return;
  }
  const openFromAcc = e.target.closest("[data-open-app-from-account]");
  if (openFromAcc) {
    const id = openFromAcc.dataset.openAppFromAccount;
    closeAccountModal();
    setTimeout(() => openProductModal(id), 250);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (state.activeWorkspaceApp) closeWorkspace();
  else if (state.publishAppId) closePublishModal();
  else if (state.addAppModalOpen) closeAddAppModal();
  else if (state.activeProductId) closeProductModal();
  else if (state.accountModalOpen) closeAccountModal();
});

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  state.installPrompt = e;
  refreshVisibleUI();
});

// Boot
applyTheme(state.theme);
renderNavigation();
registerServiceWorker();
loadCatalog();
refreshStorageInfo();
