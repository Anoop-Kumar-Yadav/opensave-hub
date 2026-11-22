import { DATA, STORAGE_KEY, DEFAULT_ACCENT } from "../data/sheets.js";
import { $, shadeHex } from "../utils/dom.js";
import { OpenSaveStorage } from "../../../../packages/sdk/opensave-sdk.js";

const dsaStorage = new OpenSaveStorage("dsa-sheet");

const DEFAULT_STATE = () => ({
  done: {},
  star: {},
  fav: {},
  tags: {},
  rev: {},
  custom: [],
  sheets: null,
  algoTree: null,
  deleted: [],
  hidden: [],
  theme: null,
  navPos: "top",
  sheetView: "list",
});

export const S = DEFAULT_STATE();

export const ui = {
  route: "home",
  topic: null,
  V: { q: "", f: "all", p: "all" },
  open: new Set(),
  AP: null,
  revFilter: "all",
  algoId: null,
  algoOpen: new Set([
    "alg-sec-sorting",
    "alg-sec-searching",
    "alg-sec-trees",
    "alg-sec-binary-trees",
    "alg-sec-graphs",
    "alg-sec-shortest-path",
  ]),
  algoSearch: "",
};

export const BASE = DATA.map((s) => ({
  id: s.id,
  name: s.name,
  topics: s.t.map(([n, q], i) => ({
    n,
    qs: q.map((t, j) => ({ id: `${s.id}-${i}-${j}`, t: t.trim() })),
  })),
}));

let renderFn = () => {};
export function setRenderer(fn) {
  renderFn = fn;
}
export function notify() {
  renderFn();
}

export function save() {
  // Persist to IndexedDB (gigabyte-scale quota, no 5 MiB localStorage limit)
  dsaStorage.set("state", JSON.parse(JSON.stringify(S))).catch(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(S));
    } catch {
      // Ignore quota errors
    }
  });
}

export function syncBase() {
  const clone = (b) => JSON.parse(JSON.stringify(b));
  if (!S.sheets) {
    S.sheets = [...BASE.map(clone), ...S.custom];
    S.custom = [];
  } else {
    BASE.forEach((b) => {
      if (!S.sheets.some((s) => s.id === b.id) && !S.deleted.includes(b.id)) {
        S.sheets.push(clone(b));
      }
    });
  }
  save();
}

export async function initStore() {
  let loaded = null;
  try {
    loaded = await dsaStorage.get("state");
  } catch {
    loaded = null;
  }

  // One-time automatic migration from legacy localStorage ("sheet-tracker-v1") to IndexedDB
  if (!loaded) {
    try {
      const legacy = localStorage.getItem(STORAGE_KEY);
      if (legacy) {
        loaded = JSON.parse(legacy);
      }
    } catch {
      loaded = null;
    }
  }

  if (loaded && typeof loaded === "object") {
    Object.assign(S, loaded);
  }
  S.rev = S.rev || {};
  S.fav = S.fav || {};
  S.tags = S.tags || {};
  syncBase();
}

export const vis = () => (S.sheets || []).filter((s) => !S.hidden.includes(s.id));
export const all = (s) => s.topics.flatMap((t) => t.qs);
export const cnt = (qs) => qs.filter((q) => S.done[q.id]).length;

export function applyAccent() {
  const a = /^#[0-9a-f]{6}$/i.test(S.accent || "") ? S.accent : DEFAULT_ACCENT;
  document.documentElement.style.setProperty("--acc", shadeHex(a, -18));
  document.documentElement.style.setProperty("--acc2", a);
  document.documentElement.style.setProperty("--soft", a + "1a");
}

export function applyNavPos() {
  const valid = ["top", "left", "right"];
  const pos = valid.includes(S.navPos) ? S.navPos : "top";
  document.documentElement.dataset.nav = pos;
  const btn = $("nav-pos");
  if (btn) {
    const labels = { top: "Nav: Top", left: "Nav: Left", right: "Nav: Right" };
    btn.textContent = labels[pos];
  }
}

export function setNavPos(pos) {
  if (!["top", "left", "right"].includes(pos)) return;
  S.navPos = pos;
  save();
  applyNavPos();
  notify();
}

export function cycleNavPos() {
  const order = ["top", "left", "right"];
  const cur = order.indexOf(S.navPos || "top");
  setNavPos(order[(cur + 1) % order.length]);
}

export function applyTheme() {
  const t =
    S.theme || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light");
  document.documentElement.dataset.theme = t;
  const thBtn = $("th");
  if (thBtn) thBtn.textContent = t === "dark" ? "☀ Light" : "☾ Dark";
  applyAccent();
  applyNavPos();
}

export function navigate(route) {
  ui.AP = null;
  ui.route = route;
  ui.topic = null;
  ui.V = { q: "", f: "all", p: "all" };
  notify();
  scrollTo(0, 0);
}

export function openTopic(sheetId, topicName) {
  ui.AP = null;
  ui.route = sheetId;
  ui.topic = topicName;
  ui.V = { q: "", f: "all", p: "all" };
  notify();
  scrollTo(0, 0);
}

export function openAlgorithms(algoId = null, folderIds = []) {
  ui.AP = null;
  ui.route = "algorithms";
  if (algoId) ui.algoId = algoId;
  folderIds.forEach((id) => ui.algoOpen.add(id));
  notify();
  scrollTo(0, 0);
}

export function openProblem(q) {
  ui.AP = { q, y: scrollY };
  notify();
  scrollTo(0, 0);
}

export function renameSheet(s) {
  const x = prompt("Rename sheet", s.name);
  if (x && x.trim()) {
    s.name = x.trim();
    save();
    notify();
  }
}

export function deleteSheet(s) {
  if (!confirm(`Delete “${s.name}” and its progress?`)) return;
  all(s).forEach((q) => {
    delete S.done[q.id];
    delete S.star[q.id];
    if (S.rev) delete S.rev[q.id];
    if (S.fav) delete S.fav[q.id];
    if (S.tags) delete S.tags[q.id];
  });
  S.sheets = S.sheets.filter((x) => x.id !== s.id);
  S.hidden = S.hidden.filter((x) => x !== s.id);
  if (BASE.some((b) => b.id === s.id)) S.deleted.push(s.id);
  save();
  navigate("home");
}

export function replaceState(data) {
  const next = Object.assign(DEFAULT_STATE(), data);
  Object.keys(S).forEach((k) => delete S[k]);
  Object.assign(S, next);
  S.rev = S.rev || {};
  S.fav = S.fav || {};
  S.tags = S.tags || {};
  save();
  syncBase();
  applyTheme();
  navigate("home");
}
