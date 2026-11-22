import {
  S,
  ui,
  save,
  notify,
  navigate,
  openTopic,
  openProblem,
  all,
  cnt,
  renameSheet,
  deleteSheet,
} from "../state/store.js";
import { h, pct } from "../utils/dom.js";
import { cxScore } from "../utils/complexity.js";
import { qTags, toggleFav } from "../domain/patterns.js";
import { revInfo } from "../domain/revision.js";
import { Ring, Meter, RevDots } from "./components.js";
import { PatternModal } from "./modals.js";

function bestApproachMeta(q) {
  const ap = q.ap || [];
  const langs = [...new Set(ap.map((a) => a.lang).filter(Boolean))];
  const withTime = ap.filter((a) => a.time);
  const best = withTime.sort((x, y) => {
    const sx = cxScore(x.time);
    const sy = cxScore(y.time);
    return (sx == null ? 99 : sx) - (sy == null ? 99 : sy);
  })[0];
  const ec = Array.isArray(q.ec) ? q.ec : [];
  const ecDone = ec.filter((x) => x.done).length;
  const exCount = Array.isArray(q.ex) ? q.ex.length : 0;
  return {
    count: ap.length,
    langs,
    bestTime: best ? best.time : null,
    bestSpace: best && best.space ? best.space : null,
    ecTotal: ec.length,
    ecDone,
    exCount,
    hasStatement: !!(q.ps && q.ps.trim()),
  };
}

function QuestionRow(q, t) {
  const d = !!S.done[q.id];
  const tags = qTags(q);

  return h(
    "div",
    { class: "q" + (d ? " d" : "") },
    h("input", {
      type: "checkbox",
      checked: d,
      "aria-label": `Mark "${q.t}" solved`,
      onchange: (e) => {
        if (e.target.checked) S.done[q.id] = Date.now();
        else delete S.done[q.id];
        save();
        notify();
      },
    }),
    h(
      "div",
      { class: "q-main" },
      h(
        "button",
        {
          class: "q-title q-title-btn",
          type: "button",
          title: "Open problem workspace",
          onclick: () => openProblem(q),
        },
        q.t
      ),
      tags.length
        ? h(
            "div",
            { class: "ptags" },
            tags.map((tg) =>
              h(
                "button",
                {
                  class: "ptag",
                  type: "button",
                  title: `Filter by ${tg}`,
                  onclick: (e) => {
                    e.stopPropagation();
                    ui.V.p = ui.V.p === tg ? "all" : tg;
                    notify();
                  },
                },
                tg
              )
            )
          )
        : null
    ),
    d ? RevDots(q.id) : null,
    h(
      "div",
      { class: "q-actions" },
      h(
        "button",
        {
          class: "st fav" + (S.fav[q.id] ? " on" : ""),
          title: S.fav[q.id] ? "Remove from favorites" : "Add to favorites",
          "aria-pressed": String(!!S.fav[q.id]),
          onclick: () => toggleFav(q.id),
        },
        S.fav[q.id] ? "♥" : "♡"
      ),
      h(
        "button",
        {
          class: "st tg" + (tags.length ? " on" : ""),
          title: "Pattern tags",
          onclick: () => PatternModal(q),
        },
        "#" + (tags.length || "")
      ),
      h(
        "button",
        {
          class: "st" + (S.star[q.id] ? " on" : ""),
          title: "Mark for revision",
          onclick: () => {
            if (S.star[q.id]) delete S.star[q.id];
            else S.star[q.id] = 1;
            save();
            notify();
          },
        },
        S.star[q.id] ? "★" : "☆"
      ),
      h(
        "button",
        {
          class: "st cd" + ((q.ap || []).length ? " on" : ""),
          title: "Approaches & code",
          onclick: () => openProblem(q),
        },
        "</>" + ((q.ap || []).length || "")
      ),
      h(
        "button",
        {
          class: "st",
          title: "Edit",
          onclick: () => {
            const x = prompt("Edit question", q.t);
            if (x && x.trim()) {
              q.t = x.trim();
              save();
              notify();
            }
          },
        },
        "✎"
      ),
      h(
        "button",
        {
          class: "st",
          title: "Delete",
          onclick: () => {
            if (confirm("Delete this question?")) {
              t.qs = t.qs.filter((z) => z !== q);
              delete S.done[q.id];
              delete S.star[q.id];
              if (S.fav) delete S.fav[q.id];
              if (S.tags) delete S.tags[q.id];
              if (S.rev) delete S.rev[q.id];
              save();
              notify();
            }
          },
        },
        "🗑"
      )
    )
  );
}

function QuestionTile(q, t, idx) {
  const d = !!S.done[q.id];
  const tags = qTags(q);
  const meta = bestApproachMeta(q);
  const rev = d ? revInfo(q.id) : null;

  return h(
    "article",
    {
      class: "q-tile" + (d ? " solved" : ""),
      onclick: () => openProblem(q),
    },
    h(
      "div",
      { class: "q-tile-head" },
      h(
        "div",
        { class: "q-tile-status", onclick: (e) => e.stopPropagation() },
        h("input", {
          type: "checkbox",
          checked: d,
          "aria-label": `Mark "${q.t}" solved`,
          onchange: (e) => {
            if (e.target.checked) S.done[q.id] = Date.now();
            else delete S.done[q.id];
            save();
            notify();
          },
        }),
        h("span", { class: "q-tile-num" }, "#" + String(idx + 1).padStart(2, "0")),
        h("span", { class: "q-tile-state " + (d ? "done" : "todo") }, d ? "Solved" : "Unsolved")
      ),
      h(
        "div",
        { class: "q-actions", onclick: (e) => e.stopPropagation() },
        h(
          "button",
          {
            class: "st fav" + (S.fav[q.id] ? " on" : ""),
            title: S.fav[q.id] ? "Remove from favorites" : "Add to favorites",
            "aria-pressed": String(!!S.fav[q.id]),
            onclick: () => toggleFav(q.id),
          },
          S.fav[q.id] ? "♥" : "♡"
        ),
        h(
          "button",
          {
            class: "st" + (S.star[q.id] ? " on" : ""),
            title: "Mark for revision",
            onclick: () => {
              if (S.star[q.id]) delete S.star[q.id];
              else S.star[q.id] = 1;
              save();
              notify();
            },
          },
          S.star[q.id] ? "★" : "☆"
        ),
        h(
          "button",
          {
            class: "st tg" + (tags.length ? " on" : ""),
            title: "Pattern tags",
            onclick: () => PatternModal(q),
          },
          "#" + (tags.length || "")
        ),
        h(
          "button",
          {
            class: "st",
            title: "Edit title",
            onclick: () => {
              const x = prompt("Edit question", q.t);
              if (x && x.trim()) {
                q.t = x.trim();
                save();
                notify();
              }
            },
          },
          "✎"
        ),
        h(
          "button",
          {
            class: "st",
            title: "Delete question",
            onclick: () => {
              if (confirm("Delete this question?")) {
                t.qs = t.qs.filter((z) => z !== q);
                delete S.done[q.id];
                delete S.star[q.id];
                if (S.fav) delete S.fav[q.id];
                if (S.tags) delete S.tags[q.id];
                if (S.rev) delete S.rev[q.id];
                save();
                notify();
              }
            },
          },
          "🗑"
        )
      )
    ),
    h("h4", { class: "q-tile-title" }, q.t),
    tags.length
      ? h(
          "div",
          { class: "ptags", onclick: (e) => e.stopPropagation() },
          tags.slice(0, 4).map((tg) =>
            h(
              "button",
              {
                class: "ptag",
                type: "button",
                title: `Filter by ${tg}`,
                onclick: () => {
                  ui.V.p = ui.V.p === tg ? "all" : tg;
                  notify();
                },
              },
              tg
            )
          ),
          tags.length > 4 ? h("span", { class: "ptag" }, `+${tags.length - 4}`) : null
        )
      : null,
    h(
      "div",
      { class: "q-tile-meta" },
      h(
        "div",
        { class: "q-meta-pill" },
        h("span", {}, "APPROACHES"),
        h(
          "strong",
          {},
          meta.count
            ? `${meta.count}${meta.langs.length ? " · " + meta.langs.slice(0, 2).join(", ") : ""}`
            : "None yet"
        )
      ),
      h(
        "div",
        { class: "q-meta-pill" },
        h("span", {}, "BEST COMPLEXITY"),
        h(
          "strong",
          {},
          meta.bestTime
            ? `${meta.bestTime}${meta.bestSpace ? " / " + meta.bestSpace : ""}`
            : "—"
        )
      ),
      meta.ecTotal
        ? h(
            "div",
            { class: "q-meta-pill" },
            h("span", {}, "EDGE CASES"),
            h("strong", {}, `${meta.ecDone}/${meta.ecTotal} verified`)
          )
        : null,
      meta.exCount || meta.hasStatement
        ? h(
            "div",
            { class: "q-meta-pill" },
            h("span", {}, "NOTES"),
            h(
              "strong",
              {},
              [
                meta.hasStatement ? "Statement" : "",
                meta.exCount ? `${meta.exCount} ex` : "",
              ]
                .filter(Boolean)
                .join(" · ")
            )
          )
        : null
    ),
    h(
      "div",
      { class: "q-tile-foot" },
      d && rev
        ? [
            h("span", { class: `rev-badge ${rev.status}` }, rev.badge),
            h("div", { onclick: (e) => e.stopPropagation() }, RevDots(q.id)),
          ]
        : [
            h("span", { class: "q-tile-topic" }, t.n),
            h("span", { class: "q-tile-open" }, "Open →"),
          ]
    )
  );
}

function TopicTile(s, t, idx) {
  const total = t.qs.length;
  const solved = cnt(t.qs);
  const p = pct(solved, total);
  const favs = t.qs.filter((q) => S.fav[q.id]).length;
  const withCode = t.qs.filter((q) => (q.ap || []).length > 0).length;
  const due = t.qs.filter((q) => {
    if (!S.done[q.id]) return false;
    const st = revInfo(q.id).status;
    return st === "overdue" || st === "due";
  }).length;

  const statusText = total > 0 && solved === total ? "Completed" : solved > 0 ? "In Progress" : "Not Started";
  const statusCls = total > 0 && solved === total ? "done" : "todo";

  return h(
    "article",
    {
      class: "topic-tile" + (total > 0 && solved === total ? " completed" : ""),
      onclick: () => openTopic(s.id, t.n),
    },
    h(
      "div",
      { class: "topic-tile-head" },
      h("span", { class: "q-tile-num" }, String(idx + 1).padStart(2, "0")),
      h("span", { class: `q-tile-state ${statusCls}` }, statusText),
      h("span", { style: "flex:1" }),
      Ring(p, 46)
    ),
    h("h3", { class: "topic-tile-title" }, t.n),
    h(
      "div",
      { class: "topic-tile-meta" },
      h("span", {}, `${solved} / ${total} solved`),
      withCode ? h("span", {}, `· ${withCode} with code`) : null,
      favs ? h("span", { style: "color:#d14d5a" }, `· ♥ ${favs}`) : null,
      due ? h("span", { class: "rev-badge due" }, `${due} due`) : null
    ),
    Meter(p),
    h(
      "div",
      { class: "topic-tile-foot" },
      h("span", { class: "q-tile-topic" }, `${total - solved} remaining`),
      h("span", { class: "q-tile-open" }, "Open topic →")
    )
  );
}

function TopicPage(s, t) {
  const total = t.qs.length;
  const solved = cnt(t.qs);
  const p = pct(solved, total);
  const usedPats = [...new Set(t.qs.flatMap((x) => qTags(x)))].sort();
  if (ui.V.p !== "all" && !usedPats.includes(ui.V.p)) ui.V.p = "all";
  const viewMode = S.sheetView || "list";

  const container = h("div", {});

  const fill = () => {
    const { V } = ui;
    const qs = t.qs.filter((q) => {
      const tags = qTags(q);
      const matchSearch =
        !V.q ||
        q.t.toLowerCase().includes(V.q) ||
        tags.some((tg) => tg.toLowerCase().includes(V.q));
      const matchFilter =
        V.f === "all"
          ? true
          : V.f === "done"
          ? !!S.done[q.id]
          : V.f === "todo"
          ? !S.done[q.id]
          : V.f === "star"
          ? !!S.star[q.id]
          : V.f === "fav"
          ? !!S.fav[q.id]
          : true;
      const matchPat = V.p === "all" || tags.includes(V.p);
      return matchSearch && matchFilter && matchPat;
    });

    if (!qs.length) {
      container.replaceChildren(h("div", { class: "card empty" }, "No questions match."));
      return;
    }

    if (viewMode === "tiles") {
      container.replaceChildren(
        h(
          "div",
          { class: "q-tiles", style: "padding:0" },
          qs.map((q, i) => QuestionTile(q, t, i))
        )
      );
    } else {
      container.replaceChildren(
        h(
          "div",
          { class: "card", style: "padding:0;overflow:hidden" },
          qs.map((q) => QuestionRow(q, t))
        )
      );
    }
  };
  fill();

  return h(
    "div",
    {},
    h(
      "div",
      { class: "topic-page-bar" },
      h("button", { class: "btn", onclick: () => navigate(s.id) }, `← Back to ${s.name}`),
      h(
        "button",
        {
          class: "btn p",
          onclick: () => {
            const x = prompt(`New question in "${t.n}"`);
            if (x && x.trim()) {
              t.qs.push({
                id: "q" + Date.now() + Math.random().toString(36).slice(2, 6),
                t: x.trim(),
              });
              save();
              notify();
            }
          },
        },
        "＋ Add question"
      )
    ),
    h(
      "div",
      { class: "breadcrumbs", style: "margin-bottom:16px" },
      h("span", {}, s.name),
      h("span", {}, "/"),
      h("strong", {}, t.n)
    ),
    h(
      "div",
      { class: "card hd" },
      Ring(p, 76),
      h(
        "div",
        {},
        h("h2", {}, t.n),
        h("small", { style: "color:var(--mut)" }, `${solved} of ${total} solved · ${total - solved} remaining`),
        Meter(p)
      )
    ),
    h(
      "div",
      { class: "tools" },
      h("input", {
        placeholder: `Search in ${t.n} or patterns…`,
        value: ui.V.q,
        oninput: (e) => {
          ui.V.q = e.target.value.toLowerCase();
          fill();
        },
      }),
      h(
        "select",
        {
          "aria-label": "Filter by status",
          onchange: (e) => {
            ui.V.f = e.target.value;
            notify();
          },
        },
        [
          ["all", "All"],
          ["done", "Solved"],
          ["todo", "Unsolved"],
          ["fav", "♥ Favorites"],
          ["star", "★ Starred"],
        ].map(([v, l]) => h("option", { value: v, selected: ui.V.f === v }, l))
      ),
      h(
        "select",
        {
          "aria-label": "Filter by pattern",
          onchange: (e) => {
            ui.V.p = e.target.value;
            notify();
          },
        },
        h(
          "option",
          { value: "all", selected: ui.V.p === "all" },
          `All patterns${usedPats.length ? ` (${usedPats.length})` : ""}`
        ),
        ...usedPats.map((pt) => h("option", { value: pt, selected: ui.V.p === pt }, pt))
      ),
      h(
        "div",
        { class: "seg-ctrl", role: "group", "aria-label": "View mode" },
        [
          ["list", "☰ List"],
          ["tiles", "▦ Tiles"],
        ].map(([mode, lbl]) =>
          h(
            "button",
            {
              class: "seg-btn" + (viewMode === mode ? " on" : ""),
              type: "button",
              "aria-pressed": String(viewMode === mode),
              onclick: () => {
                S.sheetView = mode;
                save();
                notify();
              },
            },
            lbl
          )
        )
      )
    ),
    container
  );
}

export function SheetView(s) {
  // If a topic is selected, render its dedicated Topic Page
  if (ui.topic) {
    const activeTopic = s.topics.find((t) => t.n === ui.topic);
    if (activeTopic) return TopicPage(s, activeTopic);
    ui.topic = null;
  }

  const q = all(s);
  const d = cnt(q);
  const p = pct(d, q.length);

  const grid = h("div", { class: "topic-tiles" });
  const fillTopics = () => {
    const query = ui.V.q;
    const filtered = s.topics
      .map((t, idx) => ({ t, idx }))
      .filter(({ t }) => {
        if (!query) return true;
        if (t.n.toLowerCase().includes(query)) return true;
        return t.qs.some(
          (item) =>
            item.t.toLowerCase().includes(query) ||
            qTags(item).some((tg) => tg.toLowerCase().includes(query))
        );
      });

    const cards = filtered.map(({ t, idx }) => TopicTile(s, t, idx));
    if (!query) {
      cards.push(
        h(
          "div",
          {
            class: "card add",
            style: "min-height:150px",
            onclick: () => {
              const name = prompt(`New topic in "${s.name}"`);
              if (name && name.trim()) {
                const clean = name.trim();
                if (!s.topics.some((x) => x.n.toLowerCase() === clean.toLowerCase())) {
                  s.topics.push({ n: clean, qs: [] });
                  save();
                  openTopic(s.id, clean);
                } else {
                  alert("A topic with that name already exists.");
                }
              }
            },
          },
          "＋ Add new topic"
        )
      );
    }

    if (!cards.length) {
      grid.replaceChildren(h("div", { class: "empty", style: "grid-column:1/-1" }, "No topics or questions match."));
    } else {
      grid.replaceChildren(...cards);
    }
  };
  fillTopics();

  return h(
    "div",
    {},
    h(
      "div",
      { class: "card hd" },
      Ring(p, 84),
      h(
        "div",
        {},
        h("h2", {}, s.name),
        h(
          "small",
          { style: "color:var(--mut)" },
          `${d} of ${q.length} solved · ${q.length - d} remaining · ${s.topics.length} topics`
        ),
        Meter(p)
      ),
      h(
        "div",
        { class: "hd-actions" },
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              S.hidden = S.sheets.filter((x) => x.id !== s.id).map((x) => x.id);
              save();
              navigate(s.id);
            },
          },
          "Focus"
        ),
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              S.hidden.push(s.id);
              save();
              navigate("home");
            },
          },
          "Hide"
        ),
        h("button", { class: "btn", onclick: () => renameSheet(s) }, "Rename"),
        h("button", { class: "btn", onclick: () => deleteSheet(s) }, "Delete")
      )
    ),
    h(
      "div",
      { class: "tools" },
      h("input", {
        placeholder: "Search topics, questions, or patterns…",
        value: ui.V.q,
        oninput: (e) => {
          ui.V.q = e.target.value.toLowerCase();
          fillTopics();
        },
      })
    ),
    grid
  );
}
