import {
  hub,
  ui,
  saveHub,
  notify,
  showToast,
  toggleTheme,
  hasUpdate,
  loadCatalog,
  installApp,
  updateApp,
  uninstallApp,
  launchApp,
  enablePersistentStorage,
  syncToLocalFolder,
  refreshStorageInfo,
} from "../state/hubStore.js";
import { icon } from "./icons.js";

const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const k in props) {
    if (k.startsWith("on")) el.addEventListener(k.slice(2), props[k]);
    else if (k === "class") el.className = props[k];
    else if (props[k] !== false) el.setAttribute(k, props[k]);
  }
  children.flat().forEach((c) => {
    if (c != null) el.append(c.nodeType ? c : document.createTextNode(c));
  });
  return el;
};

function fmtSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 1 : 0)} ${units[i]}`;
}

function AppCard(app) {
  const inst = hub.installed[app.id];
  const isAvailable = app.status === "available";
  const needsUpdate = hasUpdate(app);

  return h(
    "article",
    {
      class: "app-card",
      onclick: () => {
        ui.detailApp = app;
        notify();
      },
    },
    h(
      "div",
      { class: "app-card-head" },
      h("div", { class: "app-icon-tile", style: `--app-acc:${app.accent || "var(--acc)"}` }, icon(app.icon, 21)),
      h(
        "div",
        { class: "app-card-meta" },
        h("h3", {}, app.name),
        h("span", { class: "app-card-sub" }, `${app.category} · v${app.version}`)
      ),
      inst
        ? h("span", { class: "status-dot-pill " + (needsUpdate ? "warn" : "ok") }, needsUpdate ? "Update" : "Installed")
        : !isAvailable
        ? h("span", { class: "status-dot-pill" }, "Soon")
        : null
    ),
    h("p", { class: "app-card-desc" }, app.tagline),
    h(
      "div",
      { class: "app-card-foot", onclick: (e) => e.stopPropagation() },
      h("span", { class: "app-card-info" }, isAvailable ? `${app.sizeLabel} · Offline` : "Roadmap"),
      !isAvailable
        ? h("button", { class: "btn sm", type: "button", disabled: "disabled" }, "Coming Soon")
        : inst
        ? h(
            "div",
            { style: "display:flex;gap:6px" },
            needsUpdate
              ? h("button", { class: "btn sm warn", type: "button", onclick: () => updateApp(app) }, icon("refresh", 13), "Update")
              : null,
            h("button", { class: "btn sm tonal", type: "button", onclick: () => launchApp(app) }, "Open", icon("arrowUpRight", 13))
          )
        : h("button", { class: "btn sm primary", type: "button", onclick: () => installApp(app) }, icon("plus", 13), "Add")
    )
  );
}

function DetailModal(app) {
  const inst = hub.installed[app.id];
  const isAvailable = app.status === "available";
  const needsUpdate = hasUpdate(app);

  const mask = h(
    "div",
    {
      class: "modal-mask",
      onclick: (e) => {
        if (e.target === mask) {
          ui.detailApp = null;
          notify();
        }
      },
    },
    h(
      "div",
      { class: "modal-card", role: "dialog", "aria-modal": "true" },
      h(
        "div",
        { class: "modal-head" },
        h("div", { class: "app-icon-tile", style: `--app-acc:${app.accent || "var(--acc)"}` }, icon(app.icon, 22)),
        h(
          "div",
          { class: "modal-head-info" },
          h("h2", {}, app.name),
          h("div", { class: "app-card-sub" }, `${app.category} · v${app.version} · ${app.sizeLabel} · IndexedDB Offline`)
        ),
        h(
          "button",
          {
            class: "btn sm",
            type: "button",
            "aria-label": "Close details",
            onclick: () => {
              ui.detailApp = null;
              notify();
            },
          },
          icon("x", 15)
        )
      ),
      h("p", { style: "margin:0;color:var(--ink-2);line-height:1.65" }, app.description || app.tagline),
      h(
        "div",
        { class: "tag-row" },
        (app.tags || []).map((t) => h("span", { class: "tag" }, t))
      ),
      h(
        "div",
        {},
        h("h4", { style: "margin-bottom:8px;font-size:12px;color:var(--mut);letter-spacing:0.6px" }, "RELEASE NOTES"),
        h(
          "ul",
          { class: "changelog-list" },
          (app.changelog || []).map((line) => h("li", {}, line))
        )
      ),
      h(
        "div",
        { class: "app-card-foot", style: "padding-top:14px" },
        inst
          ? h("button", { class: "btn sm danger", type: "button", onclick: () => uninstallApp(app) }, icon("trash", 14), "Remove")
          : h("span", { class: "app-card-info" }, "Free · Runs locally"),
        h(
          "div",
          { style: "display:flex;gap:8px" },
          isAvailable && inst && needsUpdate
            ? h("button", { class: "btn sm warn", type: "button", onclick: () => updateApp(app) }, icon("refresh", 14), `Update v${app.version}`)
            : null,
          isAvailable && inst
            ? h("button", { class: "btn primary", type: "button", onclick: () => launchApp(app) }, "Open App", icon("arrowUpRight", 14))
            : isAvailable
            ? h("button", { class: "btn primary", type: "button", onclick: () => installApp(app) }, icon("plus", 14), "Add to OpenSave")
            : h("button", { class: "btn", type: "button", disabled: "disabled" }, "Coming Soon")
        )
      )
    )
  );
  return mask;
}

function EmbeddedWorkspace(app) {
  const inst = hub.installed[app.id];
  const frame = h("iframe", {
    class: "workspace-frame",
    src: app.url,
    title: app.name,
    onload: () => {
      const t = document.documentElement.dataset.theme;
      try {
        frame.contentWindow.postMessage({ type: "OPENSAVE_THEME", theme: t }, window.location.origin);
      } catch {
        // Ignore
      }
    },
  });

  return h(
    "div",
    { class: "workspace-host" },
    h(
      "div",
      { class: "workspace-bar" },
      h(
        "div",
        { class: "workspace-bar-left" },
        h(
          "button",
          {
            class: "btn sm",
            type: "button",
            onclick: () => {
              ui.activeApp = null;
              refreshStorageInfo();
              notify();
            },
          },
          icon("arrowLeft", 14),
          "OpenSave"
        ),
        h("span", { class: "workspace-title" }, app.name),
        inst ? h("span", { class: "status-dot-pill ok" }, `v${inst.installedVersion}`) : null
      ),
      h(
        "button",
        {
          class: "btn sm",
          type: "button",
          onclick: () => window.open(app.url, "_blank", "noopener"),
        },
        icon("external", 14),
        "Open in Tab"
      )
    ),
    frame
  );
}

function SettingsView() {
  const Toggle = (checked, onChange) =>
    h(
      "label",
      { class: "switch" },
      h("input", { type: "checkbox", checked, onchange: (e) => onChange(e.target.checked) }),
      h("span", { class: "switch-track" })
    );

  const st = ui.storage;
  const pctWidth = Math.max(st.usage ? 2 : 0, Math.min(100, st.percent));

  return h(
    "div",
    { class: "settings-grid" },
    h(
      "section",
      { class: "setting-card" },
      h("div", { class: "setting-card-head" }, icon("hardDrive", 18), h("h3", {}, "Local Storage & Quota")),
      h(
        "div",
        { style: "display:grid;gap:8px" },
        h("div", { class: "quota-bar" }, h("div", { style: `width:${pctWidth}%` })),
        h(
          "div",
          { class: "quota-meta" },
          h("span", {}, `Used: ${fmtSize(st.usage)}`),
          h("span", {}, st.quota ? `Quota: ${fmtSize(st.quota)}` : "Disk-based quota")
        )
      ),
      h(
        "div",
        { class: "setting-row" },
        h(
          "div",
          {},
          h("b", {}, "Persistent Storage"),
          h(
            "small",
            {},
            st.persisted
              ? "Active — browser protects your IndexedDB data from automatic eviction."
              : "Request browser protection so study data is never evicted under low disk space."
          )
        ),
        st.persisted
          ? h("span", { class: "status-dot-pill ok" }, "Protected")
          : h("button", { class: "btn sm tonal", type: "button", onclick: enablePersistentStorage }, icon("shield", 14), "Protect")
      ),
      h(
        "div",
        { class: "setting-row" },
        h(
          "div",
          {},
          h("b", {}, "Sync to Local OS Folder"),
          h(
            "small",
            {},
            ui.folderName
              ? `Linked folder: ${ui.folderName} (opensave-backup.json)`
              : "Write a full IndexedDB + Hub backup directly to a folder on your hard drive."
          )
        ),
        h("button", { class: "btn sm", type: "button", onclick: syncToLocalFolder }, icon("folder", 14), ui.folderName ? "Sync Now" : "Choose Folder")
      )
    ),
    h(
      "section",
      { class: "setting-card" },
      h("div", { class: "setting-card-head" }, icon("sliders", 18), h("h3", {}, "App Delivery & Updates")),
      h(
        "div",
        { class: "setting-row" },
        h(
          "div",
          {},
          h("b", {}, "Automatic per-app updates"),
          h("small", {}, "Silently update installed mini-apps when a new version is published.")
        ),
        Toggle(hub.settings.autoUpdate, (v) => {
          hub.settings.autoUpdate = v;
          saveHub();
          showToast(v ? "Auto-update enabled" : "Auto-update disabled");
          notify();
        })
      ),
      h(
        "div",
        { class: "setting-row" },
        h(
          "div",
          {},
          h("b", {}, "Launch mode"),
          h("small", {}, "Open installed apps inside the OpenSave workspace or in a new tab.")
        ),
        h(
          "select",
          {
            style: "width:auto;padding:6px 12px;border-radius:999px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font-size:13px",
            onchange: (e) => {
              hub.settings.launchMode = e.target.value;
              saveHub();
              notify();
            },
          },
          h("option", { value: "embedded", selected: hub.settings.launchMode === "embedded" }, "Embedded"),
          h("option", { value: "tab", selected: hub.settings.launchMode === "tab" }, "New Tab")
        )
      ),
      h(
        "div",
        { class: "setting-row" },
        h(
          "div",
          {},
          h("b", {}, "Check for updates"),
          h("small", {}, "Fetch latest versions from registry/catalog.json.")
        ),
        h("button", { class: "btn sm", type: "button", onclick: () => loadCatalog(false) }, icon("refresh", 14), "Check Now")
      )
    )
  );
}

export function renderHub() {
  const installedIds = Object.keys(hub.installed);
  const installedApps = ui.catalog.filter((a) => installedIds.includes(a.id));
  const liveApps = ui.catalog.filter((a) => a.status === "available");
  const roadmapApps = ui.catalog.filter((a) => a.status !== "available");
  const featured = liveApps[0] || null;
  const categories = ["All", ...new Set(ui.catalog.map((a) => a.category))];
  const isDark = document.documentElement.dataset.theme === "dark";

  const filterList = (list) =>
    list.filter((a) => {
      const matchCat = ui.category === "All" || a.category === ui.category;
      const q = ui.search.trim().toLowerCase();
      const matchQ =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.tagline.toLowerCase().includes(q) ||
        (a.tags || []).some((t) => t.toLowerCase().includes(q));
      return matchCat && matchQ;
    });

  const searchInput = h("input", {
    placeholder: "Search tools, categories, or tags",
    value: ui.search,
    "aria-label": "Search OpenSave tools",
    oninput: (e) => {
      ui.search = e.target.value;
      if (ui.tab === "settings") ui.tab = "store";
      notify();
    },
  });

  const header = h(
    "header",
    { class: "cws-header" },
    h(
      "div",
      { class: "cws-header-top" },
      h(
        "button",
        {
          class: "brand",
          type: "button",
          onclick: () => {
            ui.tab = "store";
            notify();
          },
        },
        h("span", { class: "brand-icon" }, icon("logo", 18)),
        "OpenSave",
        h("span", { class: "brand-sub" }, "Store")
      ),
      h("div", { class: "cws-search" }, icon("search", 16), searchInput),
      h(
        "div",
        { class: "cws-header-right" },
        ui.installPrompt
          ? h(
              "button",
              {
                class: "btn primary sm",
                type: "button",
                onclick: async () => {
                  const p = ui.installPrompt;
                  ui.installPrompt = null;
                  p.prompt();
                  await p.userChoice;
                  notify();
                },
              },
              icon("download", 14),
              "Install Hub"
            )
          : null,
        h(
          "button",
          { class: "btn sm", type: "button", "aria-label": "Toggle theme", onclick: toggleTheme },
          icon(isDark ? "sun" : "moon", 15),
          isDark ? "Light" : "Dark"
        )
      )
    ),
    h(
      "nav",
      { class: "cws-nav-strip", "aria-label": "Store navigation" },
      h(
        "button",
        {
          class: "cws-tab" + (ui.tab === "store" ? " on" : ""),
          type: "button",
          onclick: () => { ui.tab = "store"; notify(); },
        },
        icon("compass", 15),
        "Discover",
        h("span", { class: "tab-count" }, String(ui.catalog.length))
      ),
      h(
        "button",
        {
          class: "cws-tab" + (ui.tab === "installed" ? " on" : ""),
          type: "button",
          onclick: () => { ui.tab = "installed"; notify(); },
        },
        icon("package", 15),
        "Installed",
        h("span", { class: "tab-count" }, String(installedApps.length))
      ),
      h(
        "button",
        {
          class: "cws-tab" + (ui.tab === "settings" ? " on" : ""),
          type: "button",
          onclick: () => {
            ui.tab = "settings";
            refreshStorageInfo();
            notify();
          },
        },
        icon("sliders", 15),
        "Settings"
      )
    )
  );

  let mainContent;

  if (ui.tab === "settings") {
    mainContent = h(
      "div",
      {},
      h("div", { class: "shelf-head" }, h("h2", {}, "Settings & Local Storage"), h("span", {}, "IndexedDB · Offline-First")),
      SettingsView()
    );
  } else if (ui.tab === "installed") {
    const visible = filterList(installedApps);
    mainContent = h(
      "div",
      {},
      h("div", { class: "shelf-head" }, h("h2", {}, "Installed Tools"), h("span", {}, `${visible.length} ready offline`)),
      visible.length
        ? h("div", { class: "app-grid" }, visible.map(AppCard))
        : h(
            "div",
            { class: "empty-state" },
            h("h3", {}, "No installed tools yet"),
            h("p", {}, "Browse Discover to add DSA.sheet or JSON Studio for offline use."),
            h("button", { class: "btn primary", style: "margin-top:12px", onclick: () => { ui.tab = "store"; notify(); } }, icon("compass", 15), "Explore Discover")
          )
    );
  } else {
    const filteredLive = filterList(liveApps);
    const filteredRoadmap = filterList(roadmapApps);
    const showHero = !ui.search.trim() && ui.category === "All" && featured;

    mainContent = h(
      "div",
      {},
      showHero
        ? h(
            "section",
            { class: "spotlight" },
            h(
              "div",
              { class: "spotlight-left" },
              h("div", { class: "spotlight-icon", style: `--app-acc:${featured.accent || "var(--acc)"}` }, icon(featured.icon, 26)),
              h(
                "div",
                {},
                h("span", { class: "spotlight-kicker" }, "Featured Tool"),
                h("h1", {}, featured.name),
                h("p", {}, featured.tagline)
              )
            ),
            h(
              "div",
              { class: "spotlight-actions" },
              h(
                "button",
                {
                  class: "btn",
                  type: "button",
                  onclick: () => {
                    ui.detailApp = featured;
                    notify();
                  },
                },
                "Details"
              ),
              hub.installed[featured.id]
                ? h("button", { class: "btn primary", type: "button", onclick: () => launchApp(featured) }, "Open App", icon("arrowUpRight", 15))
                : h("button", { class: "btn primary", type: "button", onclick: () => installApp(featured) }, icon("plus", 15), "Add to OpenSave")
            )
          )
        : null,
      h(
        "div",
        { class: "cat-bar" },
        categories.map((cat) =>
          h(
            "button",
            {
              class: "cat-chip" + (ui.category === cat ? " on" : ""),
              type: "button",
              onclick: () => {
                ui.category = cat;
                notify();
              },
            },
            cat
          )
        )
      ),
      ui.loading
        ? h("div", { class: "empty-state" }, h("h3", {}, "Loading OpenSave Store..."))
        : [
            h("div", { class: "shelf-head" }, h("h2", {}, "Available Tools"), h("span", {}, `${filteredLive.length} live`)),
            filteredLive.length
              ? h("div", { class: "app-grid" }, filteredLive.map(AppCard))
              : h("div", { class: "empty-state" }, h("h3", {}, "No matching tools"), h("p", {}, "Try another search term or category.")),
            filteredRoadmap.length
              ? [
                  h("div", { class: "shelf-head" }, h("h2", {}, "Coming Soon"), h("span", {}, `${filteredRoadmap.length} planned`)),
                  h("div", { class: "app-grid" }, filteredRoadmap.map(AppCard)),
                ]
              : null,
          ]
    );
  }

  return h(
    "div",
    { class: "hub-shell" },
    header,
    h("main", { class: "hub-main" }, mainContent),
    h(
      "footer",
      { class: "hub-footer" },
      h("span", {}, "OpenSave · Free & Offline-First"),
      h("span", {}, `IndexedDB Storage · Auto-update ${hub.settings.autoUpdate ? "ON" : "OFF"}`)
    ),
    ui.detailApp ? DetailModal(ui.detailApp) : null,
    ui.activeApp ? EmbeddedWorkspace(ui.activeApp) : null,
    ui.toast ? h("div", { class: "toast", role: "status", "aria-live": "polite" }, ui.toast) : null
  );
}
