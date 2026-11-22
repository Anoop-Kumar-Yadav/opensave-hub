import { S, ui, vis, all, cnt, syncBase, notify, navigate, openTopic, openProblem, openAlgorithms, setNavPos } from "../state/store.js";
import { h, pct } from "../utils/dom.js";
import { buildRevQueue } from "../domain/revision.js";
import { qTags } from "../domain/patterns.js";
import { Stat, Activity, streak, SheetCard, Meter, RevDots, GlowSettings } from "./components.js";
import { ensureAlgoTree, listAllAlgos, countAlgos, countSubfolders, addFolder } from "../domain/algorithms.js";
import { AddModal, ManageModal, TplModal } from "./modals.js";

function RevisionSidebar(queue) {
  const dueCount = queue.filter(
    (x) => x.info.status === "overdue" || x.info.status === "due"
  ).length;
  const filtered = queue.filter((x) =>
    ui.revFilter === "all"
      ? true
      : ui.revFilter === "due"
      ? x.info.status === "overdue" || x.info.status === "due"
      : x.info.mastered
  );

  return h(
    "aside",
    { class: "home-sidebar" },
    h(
      "div",
      { class: "rev-panel" },
      h(
        "div",
        { class: "rev-head" },
        h(
          "div",
          { class: "rev-head-top" },
          h(
            "div",
            {},
            h("div", { class: "eyebrow" }, h("span", { class: "eyebrow-line" }), "PRIORITY QUEUE"),
            h("div", { class: "rev-head-title", style: "margin-top:4px" }, "Revision tracker")
          ),
          h(
            "span",
            { class: "rev-due-pill" + (dueCount ? " has-due" : "") },
            dueCount ? `${dueCount} DUE` : "ALL CAUGHT UP"
          )
        ),
        h(
          "div",
          { class: "rev-filters" },
          [
            ["all", `All (${queue.length})`],
            ["due", `Due (${dueCount})`],
            ["done", "Mastered"],
          ].map(([k, lbl]) =>
            h(
              "button",
              {
                class: "rev-ftab" + (ui.revFilter === k ? " on" : ""),
                onclick: () => {
                  ui.revFilter = k;
                  notify();
                },
              },
              lbl
            )
          )
        ),
        h(
          "div",
          { class: "rev-legend" },
          h("span", {}, "Sorted by urgency (PQ)"),
          h("span", {}, "1d · 3d · 7d")
        )
      ),
      h(
        "div",
        { class: "rev-list" },
        filtered.length
          ? filtered.map(({ q, sheet, topic, info }) =>
              h(
                "div",
                { class: "rev-item" },
                h(
                  "div",
                  { class: "rev-item-top" },
                  h(
                    "button",
                    { class: "rev-q-title", onclick: () => openProblem(q) },
                    S.fav[q.id] ? h("span", { class: "rev-fav-mark", title: "Favorite" }, "♥") : null,
                    q.t
                  ),
                  h("span", { class: `rev-badge ${info.status}` }, info.badge)
                ),
                qTags(q).length
                  ? h(
                      "div",
                      { class: "rev-tags" },
                      qTags(q)
                        .slice(0, 3)
                        .map((tg) => h("span", { class: "ptag" }, tg))
                    )
                  : null,
                h(
                  "div",
                  { class: "rev-item-bot" },
                  h("span", { class: "rev-meta", title: `${sheet} · ${topic}` }, `${topic} · ${sheet}`),
                  RevDots(q.id)
                )
              )
            )
          : [
              h(
                "div",
                { class: "empty" },
                queue.length
                  ? "No questions in this filter."
                  : "Solve any question to start your 1 / 3 / 7 spaced-repetition queue."
              ),
            ]
      )
    )
  );
}

export function Home() {
  const ss = vis();
  const q = ss.flatMap(all);
  const d = cnt(q);
  const w = Object.values(S.done).filter((t) => Date.now() - t < 6048e5).length;
  const queue = buildRevQueue(ss);
  const dueCount = queue.filter(
    (x) => x.info.status === "overdue" || x.info.status === "due"
  ).length;
  const algoTree = ensureAlgoTree();
  const totalAlgos = listAllAlgos(algoTree).length;

  return h(
    "div",
    { class: "home-layout" },
    h(
      "div",
      { class: "home-main" },
      h("h2", {}, "Overview"),
      h(
        "div",
        { class: "grid", style: "margin-top:14px" },
        Stat(`${d} / ${q.length}`, "Questions solved"),
        Stat(`${pct(d, q.length)}%`, "Overall completion"),
        Stat(dueCount, "Due for revision (1/3/7)"),
        Stat(w, "Solved in last 7 days"),
        Stat(`${streak()} 🔥`, "Day streak"),
        Stat(Object.keys(S.fav).length, "Favorites"),
        Stat(Object.keys(S.star).length, "Starred")
      ),
      h("div", { class: "sec" }, h("h2", {}, "Last 14 days")),
      Activity(),
      GlowSettings(),
      h(
        "div",
        { class: "sec" },
        h("h2", {}, "Navigation Layout")
      ),
      h(
        "div",
        { class: "card", style: "display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap" },
        h(
          "div",
          {},
          h("b", { style: "font-family:'Manrope',sans-serif;font-size:14px" }, "Navigation Bar Position"),
          h(
            "p",
            { class: "note", style: "margin-top:3px" },
            "Dock the navigation bar at the top (mouse-wheel scrollable) or as a vertical sidebar on the left or right."
          )
        ),
        h(
          "div",
          { class: "seg-ctrl", role: "group", "aria-label": "Navigation bar position" },
          [
            ["top", "Top"],
            ["left", "Left"],
            ["right", "Right"],
          ].map(([pos, label]) =>
            h(
              "button",
              {
                class: "seg-btn" + ((S.navPos || "top") === pos ? " on" : ""),
                type: "button",
                "aria-pressed": String((S.navPos || "top") === pos),
                onclick: () => setNavPos(pos),
              },
              label
            )
          )
        )
      ),
      h(
        "div",
        { class: "sec" },
        h("h2", {}, "Export Templates"),
        h(
          "button",
          { class: "btn p", onclick: () => TplModal() },
          "Edit Medium / LinkedIn templates"
        )
      ),
      h(
        "div",
        { class: "card", style: "display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap" },
        h(
          "div",
          {},
          h("b", { style: "font-family:'Manrope',sans-serif;font-size:14px" }, "Visual Blog Template Studio"),
          h(
            "p",
            { class: "note", style: "margin-top:3px" },
            "Drag and drop sections, set conditions, and customize Markdown layouts globally for Medium and LinkedIn exports."
          )
        ),
        h("button", { class: "btn", onclick: () => TplModal() }, "Open Template Studio →")
      ),
      h(
        "div",
        { class: "sec" },
        h("h2", {}, "Your sheets"),
        S.hidden.length
          ? h("button", { class: "btn", onclick: ManageModal }, `${S.hidden.length} hidden · Manage`)
          : null,
        S.deleted.length
          ? h(
              "button",
              {
                class: "btn",
                onclick: () => {
                  S.deleted = [];
                  syncBase();
                  notify();
                },
              },
              "Restore default sheets"
            )
          : null
      ),
      h("div", { class: "grid" }, ss.map(SheetCard), h("div", { class: "card add", onclick: AddModal }, "＋ Add new sheet")),
      h(
        "div",
        { class: "sec" },
        h("h2", {}, "Pure Algorithms"),
        h(
          "button",
          { class: "btn", onclick: () => openAlgorithms() },
          `Open Vault (${totalAlgos}) →`
        )
      ),
      h(
        "div",
        { class: "grid" },
        algoTree.map((node) => {
          const ac = countAlgos(node);
          const sc = countSubfolders(node);
          const firstEntry = listAllAlgos([node])[0];
          return h(
            "div",
            {
              class: "card sc",
              style: "display:block",
              onclick: () => {
                const openIds = [node.id];
                if (firstEntry) firstEntry.path.forEach((p) => openIds.push(p.id));
                openAlgorithms(firstEntry ? firstEntry.algo.id : null, openIds);
              },
            },
            h("small", { style: "color:var(--mut);font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.8px" }, node.type === "folder" ? "SECTION" : "ALGORITHM"),
            h("h3", { style: "margin-top:4px" }, node.name),
            h(
              "small",
              {},
              `${ac} algorithm${ac === 1 ? "" : "s"}${sc ? ` · ${sc} sub-section${sc === 1 ? "" : "s"}` : ""}`
            )
          );
        }),
        h(
          "div",
          {
            class: "card add",
            onclick: () => {
              const name = prompt("New algorithm section (e.g. Sorting, Searching, Trees, DP)");
              if (name && name.trim()) {
                const sec = addFolder(algoTree, name);
                if (sec) openAlgorithms(null, [sec.id]);
              }
            },
          },
          "＋ Add algorithm section"
        )
      ),
      h("div", { class: "sec" }, h("h2", {}, "Topic breakdown")),
      h(
        "div",
        { class: "grid" },
        ss.flatMap((s) =>
          s.topics.map((t) => {
            const p = pct(cnt(t.qs), t.qs.length);
            return h(
              "div",
              {
                class: "card sc",
                style: "display:block",
                title: "Open topic",
                onclick: () => openTopic(s.id, t.n),
              },
              h("small", { style: "color:var(--mut)" }, s.name),
              h("h3", {}, t.n),
              h("small", {}, `${cnt(t.qs)} / ${t.qs.length} · ${p}%`),
              Meter(p)
            );
          })
        )
      )
    ),
    RevisionSidebar(queue)
  );
}
