import {
  S,
  ui,
  save,
  vis,
  initStore,
  applyTheme,
  applyNavPos,
  cycleNavPos,
  setRenderer,
  navigate,
  replaceState,
} from "./state/store.js";
import { $, h } from "./utils/dom.js";
import { connectToHub } from "../../../packages/sdk/opensave-sdk.js";
import { Home } from "./ui/homeView.js";
import { AlgorithmsView } from "./ui/algorithmsView.js";
import { SheetView } from "./ui/sheetView.js";
import { ApproachPage } from "./ui/workspaceView.js";
import { AddModal, ManageModal, AccentModal, TplModal } from "./ui/modals.js";

function updateNavScrollButtons() {
  const nav = $("nav");
  const prev = $("nav-prev");
  const next = $("nav-next");
  if (!nav || !prev || !next) return;

  const isHorizontal =
    (S.navPos || "top") === "top" || window.innerWidth <= 860;
  if (!isHorizontal) {
    prev.hidden = true;
    next.hidden = true;
    return;
  }

  const maxScroll = nav.scrollWidth - nav.clientWidth;
  if (maxScroll <= 4) {
    prev.hidden = true;
    next.hidden = true;
    return;
  }

  prev.hidden = false;
  next.hidden = false;
  prev.disabled = nav.scrollLeft <= 2;
  next.disabled = nav.scrollLeft >= maxScroll - 2;
}

function wireNavScroll() {
  const nav = $("nav");
  const prev = $("nav-prev");
  const next = $("nav-next");
  if (!nav) return;

  // Allow vertical mouse wheel to scroll the horizontal top navigation bar
  nav.addEventListener(
    "wheel",
    (e) => {
      const isHorizontal =
        (S.navPos || "top") === "top" || window.innerWidth <= 860;
      if (!isHorizontal) return;
      if (nav.scrollWidth <= nav.clientWidth) return;
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        e.preventDefault();
        nav.scrollLeft += e.deltaY;
      }
    },
    { passive: false }
  );

  nav.addEventListener("scroll", updateNavScrollButtons, { passive: true });
  window.addEventListener("resize", updateNavScrollButtons, { passive: true });

  if (prev) {
    prev.onclick = () => nav.scrollBy({ left: -220, behavior: "smooth" });
  }
  if (next) {
    next.onclick = () => nav.scrollBy({ left: 220, behavior: "smooth" });
  }
}

function render() {
  const y = scrollY;
  const ss = vis();

  $("nav").replaceChildren(
    h(
      "button",
      { class: "tab" + (ui.route === "home" ? " on" : ""), onclick: () => navigate("home") },
      "⌂ Home"
    ),
    h(
      "button",
      { class: "tab" + (ui.route === "algorithms" ? " on" : ""), onclick: () => navigate("algorithms") },
      "⌘ Algorithms"
    ),
    ...ss.map((s) =>
      h(
        "button",
        { class: "tab" + (ui.route === s.id ? " on" : ""), onclick: () => navigate(s.id) },
        s.name
      )
    ),
    h("button", { class: "tab", onclick: AddModal }, "＋ Add"),
    h("button", { class: "tab", onclick: ManageModal }, "☰ Manage")
  );

  const activeSheet = ss.find((x) => x.id === ui.route);
  if (!activeSheet && ui.route !== "algorithms") ui.route = "home";

  $("app").replaceChildren(
    ui.AP
      ? ApproachPage()
      : ui.route === "algorithms"
      ? AlgorithmsView()
      : activeSheet
      ? SheetView(activeSheet)
      : Home()
  );

  requestAnimationFrame(updateNavScrollButtons);
  scrollTo(0, y);
}

setRenderer(render);
wireNavScroll();

// Mobile tools drawer toggle
const menuBtn = $("menu-btn");
const barActions = $("bar-actions");
if (menuBtn && barActions) {
  menuBtn.onclick = () => {
    const open = barActions.classList.toggle("mobile-open");
    menuBtn.setAttribute("aria-expanded", String(open));
  };
  barActions.addEventListener("click", (e) => {
    if (e.target.tagName === "BUTTON" && window.innerWidth <= 760) {
      barActions.classList.remove("mobile-open");
      menuBtn.setAttribute("aria-expanded", "false");
    }
  });
}

$("nav-pos").onclick = () => {
  cycleNavPos();
  requestAnimationFrame(updateNavScrollButtons);
};

$("th").onclick = () => {
  S.theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  save();
  applyTheme();
};

$("tpl-btn").onclick = () => TplModal();

$("ac").onclick = AccentModal;

$("ex").onclick = () => {
  const a = h("a", {
    href: URL.createObjectURL(new Blob([JSON.stringify(S)], { type: "application/json" })),
    download: `sheet-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`,
  });
  document.body.append(a);
  a.click();
  a.remove();
};

$("im").onclick = () => $("fi").click();

$("fi").onchange = (e) => {
  const f = e.target.files[0];
  e.target.value = "";
  if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try {
      const d = JSON.parse(r.result);
      if (!d || !Array.isArray(d.sheets)) throw new Error("Invalid");
      if (!confirm("Replace current data with this backup?")) return;
      replaceState(d);
    } catch {
      alert("Invalid backup file.");
    }
  };
  r.readAsText(f);
};

connectToHub({
  onTheme: (t) => {
    if (t === "dark" || t === "light") {
      S.theme = t;
      save();
      applyTheme();
    }
  },
});

initStore().then(() => {
  applyTheme();
  applyNavPos();
  render();
});
