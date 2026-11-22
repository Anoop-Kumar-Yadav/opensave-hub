import { TC, SC } from "../data/sheets.js";
import { S, ui, save, notify } from "../state/store.js";
import { h, rc, copyCode } from "../utils/dom.js";
import { md } from "../utils/markdown.js";
import { glow } from "../utils/complexity.js";
import { aTags } from "../domain/patterns.js";
import {
  ensureAlgoTree,
  findNodeWithParent,
  listAllAlgos,
  countAlgos,
  algoTags,
  addFolder,
  addAlgo,
  renameNode,
  deleteNode,
} from "../domain/algorithms.js";
import { Code, CxPick, CodeEditor } from "./components.js";
import { AlgoPatternModal } from "./modals.js";

export function AlgorithmsView() {
  const tree = ensureAlgoTree();
  let ed = null;
  let ne = null;
  const root = h("div", {});

  // Auto-select first algorithm if none selected or selected was deleted
  const allEntries = listAllAlgos(tree);
  if (!ui.algoId || !findNodeWithParent(tree, ui.algoId)) {
    ui.algoId = allEntries.length ? allEntries[0].algo.id : null;
  }

  const shrink = (f) =>
    new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => {
        const im = new Image();
        im.onload = () => {
          const k = Math.min(1, 1200 / Math.max(im.width, im.height));
          const c = document.createElement("canvas");
          c.width = im.width * k;
          c.height = im.height * k;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(im, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", 0.82));
        };
        im.onerror = () => resolve(null);
        im.src = fr.result;
      };
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(f);
    });

  const imgs = (l) => [...(l || [])].filter((f) => f.type.startsWith("image/"));

  const embedImg = async (targetObj, fs, ta) => {
    targetObj.imgm = targetObj.imgm || {};
    let snippet = "";
    for (const f of fs) {
      const d = await shrink(f);
      if (!d) continue;
      const id = "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      targetObj.imgm[id] = d;
      snippet += `\n![diagram](img:${id})\n`;
    }
    if (!snippet) return;
    save();
    if (ta) {
      ta.setRangeText(snippet, ta.selectionStart, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
    }
  };

  // Recursive search filter helper
  const matchesSearch = (node, query) => {
    if (!query) return true;
    const q = query.toLowerCase();
    if (node.name.toLowerCase().includes(q)) return true;
    if (node.type === "algo") {
      if ((node.desc || "").toLowerCase().includes(q)) return true;
      if (algoTags(node).some((t) => t.toLowerCase().includes(q))) return true;
      return false;
    }
    return (node.children || []).some((ch) => matchesSearch(ch, query));
  };

  const renderTreeNodes = (nodes, depth = 0, query = "") => {
    const out = [];
    nodes.forEach((node, idx) => {
      if (!matchesSearch(node, query)) return;

      if (node.type === "folder") {
        const isOpen = ui.algoOpen.has(node.id) || !!query;
        const total = countAlgos(node);

        const row = h(
          "div",
          { class: "tree-row tree-folder", style: `--depth:${depth}` },
          h(
            "button",
            {
              class: "tree-label-btn",
              type: "button",
              onclick: () => {
                if (ui.algoOpen.has(node.id)) ui.algoOpen.delete(node.id);
                else ui.algoOpen.add(node.id);
                draw();
              },
            },
            h("span", { class: "tree-car" + (isOpen ? " open" : "") }, "▸"),
            h("span", { class: "tree-name" }, node.name),
            h("span", { class: "tree-cnt" }, String(total))
          ),
          h(
            "div",
            { class: "tree-acts" },
            h(
              "button",
              {
                class: "tree-act",
                type: "button",
                title: `Add algorithm inside "${node.name}"`,
                onclick: (e) => {
                  e.stopPropagation();
                  const name = prompt(`New algorithm inside "${node.name}"`);
                  if (name && name.trim()) {
                    node.children = node.children || [];
                    ui.algoOpen.add(node.id);
                    const created = addAlgo(node.children, name);
                    if (created) ui.algoId = created.id;
                    draw();
                  }
                },
              },
              "+A"
            ),
            h(
              "button",
              {
                class: "tree-act",
                type: "button",
                title: `Add sub-section inside "${node.name}"`,
                onclick: (e) => {
                  e.stopPropagation();
                  const name = prompt(`New sub-section inside "${node.name}"`);
                  if (name && name.trim()) {
                    node.children = node.children || [];
                    ui.algoOpen.add(node.id);
                    const sub = addFolder(node.children, name);
                    if (sub) ui.algoOpen.add(sub.id);
                    draw();
                  }
                },
              },
              "+S"
            ),
            h(
              "button",
              {
                class: "tree-act",
                type: "button",
                title: "Rename section",
                onclick: (e) => {
                  e.stopPropagation();
                  const name = prompt("Rename section", node.name);
                  if (name && name.trim()) renameNode(node, name);
                },
              },
              "✎"
            ),
            h(
              "button",
              {
                class: "tree-act del",
                type: "button",
                title: "Delete section",
                onclick: (e) => {
                  e.stopPropagation();
                  if (confirm(`Delete section "${node.name}" and everything inside it?`)) {
                    deleteNode(nodes, idx);
                  }
                },
              },
              "×"
            )
          )
        );
        out.push(row);

        if (isOpen && Array.isArray(node.children)) {
          if (node.children.length) {
            out.push(...renderTreeNodes(node.children, depth + 1, query));
          } else if (!query) {
            out.push(
              h("div", { class: "tree-empty-branch", style: `--depth:${depth + 1}` }, "Empty — click +A or +S")
            );
          }
        }
      } else {
        const active = ui.algoId === node.id;
        const apCount = (node.ap || []).length;
        const row = h(
          "div",
          { class: "tree-row tree-algo" + (active ? " active" : ""), style: `--depth:${depth}` },
          h(
            "button",
            {
              class: "tree-label-btn",
              type: "button",
              onclick: () => {
                ui.algoId = node.id;
                ed = null;
                ne = null;
                draw();
                scrollTo(0, 0);
              },
            },
            h("span", { class: "tree-dot" }),
            h("span", { class: "tree-name" }, node.name),
            apCount ? h("span", { class: "tree-cnt" }, String(apCount)) : null
          ),
          h(
            "div",
            { class: "tree-acts" },
            h(
              "button",
              {
                class: "tree-act",
                type: "button",
                title: "Rename algorithm",
                onclick: (e) => {
                  e.stopPropagation();
                  const name = prompt("Rename algorithm", node.name);
                  if (name && name.trim()) renameNode(node, name);
                },
              },
              "✎"
            ),
            h(
              "button",
              {
                class: "tree-act del",
                type: "button",
                title: "Delete algorithm",
                onclick: (e) => {
                  e.stopPropagation();
                  if (confirm(`Delete algorithm "${node.name}"?`)) {
                    if (ui.algoId === node.id) ui.algoId = null;
                    deleteNode(nodes, idx);
                  }
                },
              },
              "×"
            )
          )
        );
        out.push(row);
      }
    });
    return out;
  };

  const NotesBlock = (target, field, collapseKey, label, placeholder, imgOwner) => {
    const has = !!(target[field] && target[field].trim());
    const editKey = target.id + ":" + field;

    if (ne === editKey) {
      const ta = h("textarea", { rows: 8, spellcheck: "false", placeholder });
      const pv = h("div", { class: "md", style: "display:none" });
      ta.value = target[field] || "";

      const ins = (pre, post, fb) => {
        const s = ta.selectionStart;
        const en = ta.selectionEnd;
        const sel = ta.value.slice(s, en) || fb;
        ta.setRangeText(pre + sel + post, s, en, "end");
        ta.focus();
      };
      const line = (p) => {
        const s = ta.selectionStart;
        const st = ta.value.lastIndexOf("\n", s - 1) + 1;
        ta.setRangeText(p, st, st, "end");
        ta.focus();
      };

      const tb = h(
        "div",
        { class: "tb" },
        ...[
          ["B", () => ins("**", "**", "bold")],
          ["I", () => ins("*", "*", "italic")],
          ["H", () => line("## ")],
          ["• List", () => line("- ")],
          ["1. List", () => line("1. ")],
          ["Quote", () => line("> ")],
          ["Code", () => ins("`", "`", "code")],
          ["Dry Run Block", () => ins("\n```\n", "\n```\n", "i=0 | arr=[3,1,2]")],
        ].map(([t, fn]) => h("button", { class: "btn", type: "button", onclick: fn }, t))
      );

      let prev = false;
      const tg = h(
        "button",
        {
          class: "btn",
          onclick: () => {
            prev = !prev;
            ta.style.display = prev ? "none" : "";
            tb.style.display = prev ? "none" : "";
            pv.style.display = prev ? "" : "none";
            if (prev) pv.innerHTML = md(ta.value, imgOwner.imgm || {});
            tg.textContent = prev ? "Write" : "Preview";
          },
        },
        "Preview"
      );

      return h(
        "div",
        {
          class: "nt",
          ondragover: (e) => {
            if ([...e.dataTransfer.types].includes("Files")) e.preventDefault();
          },
          ondrop: (e) => {
            const f = imgs(e.dataTransfer.files);
            if (!f.length) return;
            e.preventDefault();
            embedImg(imgOwner, f, ta);
          },
          onpaste: (e) => {
            const f = imgs(e.clipboardData && e.clipboardData.files);
            if (f.length) {
              e.preventDefault();
              embedImg(imgOwner, f, ta);
            }
          },
        },
        h("div", { class: "aph" }, h("b", {}, label), h("span", { style: "flex:1" }), tg),
        tb,
        ta,
        pv,
        h(
          "div",
          { class: "row" },
          h("button", { class: "btn", onclick: () => { ne = null; draw(); } }, "Cancel"),
          h(
            "button",
            {
              class: "btn p",
              onclick: () => {
                target[field] = ta.value;
                target[collapseKey] = false;
                save();
                ne = null;
                draw();
              },
            },
            "Save"
          )
        )
      );
    }

    const body = h("div", { class: "md" });
    body.innerHTML = md(target[field] || "", imgOwner.imgm || {});
    return h(
      "div",
      { class: "nt" },
      h(
        "div",
        { class: "aph" },
        h(
          "button",
          {
            class: "section-toggle",
            "aria-expanded": String(!target[collapseKey]),
            onclick: () => {
              target[collapseKey] = !target[collapseKey];
              save();
              draw();
            },
          },
          h("span", { style: "color:var(--mut);font-size:12px" }, target[collapseKey] ? "▸" : "▾"),
          label + (has ? "" : " (empty)")
        ),
        h("span", { style: "flex:1" }),
        h("button", { class: "btn", onclick: () => { ne = editKey; draw(); } }, has ? "Edit" : "＋ Add")
      ),
      has && !target[collapseKey] ? body : null
    );
  };

  const draw = () => {
    const found = ui.algoId ? findNodeWithParent(tree, ui.algoId) : null;
    const algo = found && found.node.type === "algo" ? found.node : null;
    const path = found ? found.path : [];

    // Left Sidebar: Dynamic Recursive Tree
    const searchInp = h("input", {
      placeholder: "Search algorithms or tags…",
      value: ui.algoSearch || "",
      "aria-label": "Search algorithms",
      oninput: (e) => {
        ui.algoSearch = e.target.value;
        const container = root.querySelector(".algo-tree-body");
        if (container) {
          const items = renderTreeNodes(tree, 0, ui.algoSearch.trim());
          container.replaceChildren(
            ...(items.length ? items : [h("div", { class: "empty" }, "No matching algorithms.")])
          );
        }
      },
    });

    const treeItems = renderTreeNodes(tree, 0, (ui.algoSearch || "").trim());

    const sidebar = h(
      "aside",
      { class: "algo-sidebar" },
      h(
        "div",
        { class: "algo-tree-panel" },
        h(
          "div",
          { class: "algo-tree-head" },
          h(
            "div",
            { class: "algo-tree-head-top" },
            h(
              "div",
              {},
              h("div", { class: "eyebrow" }, h("span", { class: "eyebrow-line" }), "PURE ALGORITHMS"),
              h("div", { class: "rev-head-title", style: "margin-top:4px" }, "Algorithm Vault")
            ),
            h(
              "button",
              {
                class: "btn p",
                style: "padding:5px 9px;font-size:12px",
                title: "Create a new root section",
                onclick: () => {
                  const name = prompt("New main section (e.g. Dynamic Programming, String Matching)");
                  if (name && name.trim()) {
                    const sec = addFolder(tree, name);
                    if (sec) ui.algoOpen.add(sec.id);
                    draw();
                  }
                },
              },
              "+ Section"
            )
          ),
          searchInp,
          h(
            "div",
            { class: "algo-tree-hint" },
            h("span", {}, "+A = Add algo"),
            h("span", {}, "+S = Add sub-section")
          )
        ),
        h(
          "div",
          { class: "algo-tree-body" },
          treeItems.length
            ? treeItems
            : [h("div", { class: "empty" }, "No sections yet. Click + Section above to create one.")]
        )
      )
    );

    // Right Main Pane: Selected Algorithm Workspace
    let mainPane;
    if (!algo) {
      mainPane = h(
        "div",
        { class: "card", style: "padding:32px;text-align:center" },
        h("h2", {}, "Select or create an algorithm"),
        h(
          "p",
          { class: "note", style: "margin:10px auto 18px;max-width:460px" },
          "Organize pure algorithms into sections and nested sub-sections on the left, then document multiple implementations, complexities, dry runs, and interview explanations."
        ),
        h(
          "button",
          {
            class: "btn p",
            onclick: () => {
              const name = prompt("New main section (e.g. Sorting, Searching, Trees)");
              if (name && name.trim()) {
                const sec = addFolder(tree, name);
                if (sec) ui.algoOpen.add(sec.id);
                draw();
              }
            },
          },
          "＋ Create Section"
        )
      );
    } else {
      algo.ap = algo.ap || [];
      const langs = [...new Set(algo.ap.map((a) => a.lang).filter(Boolean))];
      const tags = algoTags(algo);

      const ImplCard = (a, i) =>
        h(
          "article",
          { class: "card apc", id: `algo-impl-${i + 1}`, style: glow(a, algo.ap, S.gl) },
          h(
            "div",
            { class: "aph" },
            h("span", { class: "num" }, String(i + 1).padStart(2, "0")),
            h(
              "div",
              {
                class: "sol-title",
                onclick: () => {
                  a.fd = !a.fd;
                  save();
                  draw();
                },
              },
              h("b", {}, a.title),
              h("small", {}, `Implementation ${i + 1}`)
            ),
            a.lang ? h("span", { class: "tag-pill" }, a.lang) : null,
            h(
              "button",
              {
                class: "btn",
                title: "Tag this implementation",
                onclick: () => AlgoPatternModal(algo, a),
              },
              `#${aTags(a).length ? ` ${aTags(a).length}` : ""}`
            ),
            h("button", { class: "btn", onclick: () => { ed = a; draw(); scrollTo(0, 0); } }, "Edit"),
            h(
              "button",
              {
                class: "btn",
                onclick: () => {
                  if (confirm("Delete this implementation?")) {
                    algo.ap.splice(i, 1);
                    save();
                    draw();
                  }
                },
              },
              "Delete"
            ),
            h(
              "button",
              {
                class: "btn",
                "aria-expanded": String(!a.fd),
                onclick: () => {
                  a.fd = !a.fd;
                  save();
                  draw();
                },
              },
              a.fd ? "▸" : "▾"
            )
          ),
          a.fd
            ? null
            : h(
                "div",
                { class: "solution-body" },
                a.time || a.space
                  ? h(
                      "div",
                      { class: "complexity-row" },
                      h(
                        "div",
                        { class: "complexity" },
                        h("span", { class: "complexity-label" }, "TIME COMPLEXITY"),
                        h("strong", {}, a.time || "—")
                      ),
                      h(
                        "div",
                        { class: "complexity" },
                        h("span", { class: "complexity-label" }, "SPACE COMPLEXITY"),
                        h("strong", {}, a.space || "—")
                      )
                    )
                  : null,
                h(
                  "div",
                  { class: "ptags", style: "margin:10px 0 12px" },
                  ...aTags(a).map((tg) => h("span", { class: "ptag" }, tg)),
                  h(
                    "button",
                    { class: "ptag ptag-add", type: "button", onclick: () => AlgoPatternModal(algo, a) },
                    aTags(a).length ? "✎ Edit tags" : "＋ Impl tag"
                  )
                ),
                h(
                  "div",
                  { class: "code-shell" },
                  h(
                    "div",
                    { class: "code-toolbar" },
                    h("span", {}, h("i", { class: "language-dot" }), a.lang || "Code"),
                    h(
                      "button",
                      { class: "copy-button", onclick: (e) => copyCode(a.code, e.target) },
                      "Copy code"
                    )
                  ),
                  Code(a)
                ),
                NotesBlock(
                  a,
                  "note",
                  "nc",
                  "Notes & Dry Run",
                  "Write step-by-step dry run, invariants, trace tables, or paste diagram screenshots…",
                  algo
                ),
                NotesBlock(
                  a,
                  "exp",
                  "xc",
                  "Interview Explanation",
                  "How would you explain this implementation, optimization, and trade-offs in an interview?",
                  algo
                )
              )
        );

      const ImplForm = () => {
        const a = ed.id ? ed : null;
        const t = h("input", {
          placeholder: "Implementation title (e.g. Standard, Early-Exit Optimized, Iterative)",
          value: a ? a.title : "",
        });
        const l = h(
          "select",
          {},
          ["Java", "C++", "Python", "JavaScript", "C", "Go", "Other"].map((x) =>
            h("option", { value: x, selected: !!(a && a.lang === x) }, x)
          )
        );
        const tc = CxPick(TC, a && a.time, "Time complexity");
        const sc = CxPick(SC, a && a.space, "Space complexity");
        const ce = CodeEditor(a ? a.code : "", l);
        const c = ce.ta;
        c.value = a ? a.code : "";

        return h(
          "div",
          { class: "card problem-form", style: "display:grid;gap:12px" },
          h("h3", {}, a ? "Edit implementation" : "New implementation"),
          t,
          h("div", { class: "two" }, l, tc, sc),
          ce,
          h(
            "div",
            { class: "row" },
            h("button", { class: "btn", onclick: () => { ed = null; draw(); } }, "Cancel"),
            h(
              "button",
              {
                class: "btn p",
                onclick: () => {
                  if (!t.value.trim() || !c.value.trim()) {
                    return alert("Add a title and some code.");
                  }
                  const o = {
                    id: a ? a.id : "ai" + Date.now(),
                    title: t.value.trim(),
                    lang: l.value,
                    time: tc.get(),
                    space: sc.get(),
                    code: c.value,
                    note: a ? a.note || "" : "",
                    exp: a ? a.exp || "" : "",
                    tags: a ? a.tags || [] : [],
                  };
                  if (a) Object.assign(a, o);
                  else algo.ap.push(o);
                  save();
                  ed = null;
                  draw();
                },
              },
              "Save"
            )
          )
        );
      };

      mainPane = h(
        "div",
        { class: "algo-main" },
        h(
          "div",
          { class: "breadcrumbs" },
          h("span", {}, "Algorithms"),
          ...path.flatMap((p) => [h("span", {}, "/"), h("span", {}, p.name)]),
          h("span", {}, "/"),
          h("strong", {}, algo.name)
        ),
        h(
          "section",
          { class: "problem-hero" },
          h(
            "div",
            { class: "eyebrow" },
            h("span", { class: "eyebrow-line" }),
            path.length ? path.map((p) => p.name).join(" · ") : "ALGORITHM"
          ),
          h(
            "div",
            { class: "hero-row" },
            h(
              "div",
              {},
              h("h1", {}, algo.name),
              h(
                "p",
                {
                  class: "hero-description",
                  style: "cursor:pointer",
                  title: "Click to edit summary",
                  onclick: () => {
                    const next = prompt("Edit short summary", algo.desc || "");
                    if (next !== null) {
                      algo.desc = next.trim();
                      save();
                      draw();
                    }
                  },
                },
                algo.desc || "Click to add a short one-line summary for this algorithm…"
              )
            ),
            h(
              "div",
              { class: "problem-index" },
              h("span", {}, "VERSIONS"),
              h("strong", {}, String(algo.ap.length).padStart(2, "0")),
              h("small", {}, "saved")
            )
          ),
          h(
            "div",
            { class: "meta-row" },
            h(
              "span",
              { class: "status-pill" },
              h("i", {}),
              algo.ap.length ? `${algo.ap.length} implementation${algo.ap.length === 1 ? "" : "s"}` : "No code yet"
            ),
            ...(langs.length ? [h("span", {}, "·"), h("span", {}, langs.join(", "))] : [])
          ),
          h(
            "div",
            { class: "ptags", style: "margin-top:14px" },
            ...tags.map((tg) => h("span", { class: "ptag" }, tg)),
            h(
              "button",
              { class: "ptag ptag-add", type: "button", onclick: () => AlgoPatternModal(algo) },
              tags.length ? "✎ Edit tags" : "＋ Add tag"
            )
          )
        ),
        algo.ap.length
          ? h(
              "div",
              { class: "card", style: "margin-top:20px;padding:14px 18px" },
              h("div", { class: "problem-side-label", style: "margin-bottom:8px" }, "COMPLEXITY AT A GLANCE"),
              h(
                "div",
                { class: "algo-cx-grid" },
                algo.ap.map((a) =>
                  h(
                    "div",
                    { class: "algo-cx-item" },
                    h("span", {}, a.title),
                    h("strong", {}, `${a.time || "—"} / ${a.space || "—"}`)
                  )
                )
              )
            )
          : null,
        h(
          "div",
          { class: "card psc", style: "margin-top:18px;padding:4px 20px 18px" },
          NotesBlock(
            algo,
            "overview",
            "oc",
            "Concept, Intuition & Dry Run",
            "Write core intuition, recurrence relation, stability, in-place properties, or general dry run…",
            algo
          )
        ),
        h(
          "section",
          { class: "problem-solutions", style: "margin-top:32px" },
          h(
            "div",
            { class: "solutions-heading" },
            h(
              "div",
              {},
              h("div", { class: "eyebrow" }, h("span", { class: "eyebrow-line" }), "IMPLEMENTATIONS"),
              h("h2", {}, "Code & Optimizations"),
              h("p", {}, "Store standard, iterative, recursive, and optimized versions with dry runs and interview notes.")
            ),
            h(
              "span",
              { class: "count-pill" },
              `${String(algo.ap.length).padStart(2, "0")} VERSION${algo.ap.length === 1 ? "" : "S"}`
            )
          ),
          ed ? ImplForm() : null,
          ...algo.ap.map(ImplCard),
          h(
            "button",
            {
              class: "problem-add-approach",
              onclick: () => {
                ed = {};
                draw();
                setTimeout(
                  () =>
                    document
                      .querySelector(".problem-form")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" }),
                  0
                );
              },
            },
            "＋ Add implementation"
          )
        )
      );
    }

    rc(root, h("div", { class: "algo-layout" }, sidebar, mainPane));
  };

  draw();
  return root;
}
