import { TC, SC, EDGE_CASE_PRESETS } from "../data/sheets.js";
import { S, ui, save, notify } from "../state/store.js";
import { h, rc, copyCode } from "../utils/dom.js";
import { md } from "../utils/markdown.js";
import { glow } from "../utils/complexity.js";
import { qTags, aTags, toggleFav } from "../domain/patterns.js";
import { dlBlog } from "../domain/blogExport.js";
import { Code, CxPick, CodeEditor, RevDots } from "./components.js";
import { PatternModal } from "./modals.js";

let tocObserver = null;

export function ApproachPage() {
  const q = ui.AP.q;
  q.ap = q.ap || [];
  let ed = null;
  let ne = null;
  let ee = null;
  let showEdgePresets = false;
  const root = h("div", {});

  // Resolve breadcrumb metadata & problem index from sheets
  let sheetName = "DSA Sheet";
  let topicName = "Problem";
  let probIdx = 1;
  let sheetTotal = 0;
  for (const s of S.sheets) {
    let idx = 0;
    let found = false;
    for (const t of s.topics) {
      for (const item of t.qs) {
        idx++;
        if (item === q) {
          sheetName = s.name;
          topicName = t.n;
          probIdx = idx;
          found = true;
        }
      }
    }
    if (found) {
      sheetTotal = idx;
      break;
    }
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

  const embed = async (fs, ta) => {
    q.imgm = q.imgm || {};
    let t = "";
    for (const f of fs) {
      const d = await shrink(f);
      if (!d) continue;
      const id = "i" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      q.imgm[id] = d;
      t += `\n![image](img:${id})\n`;
    }
    if (!t) return;
    save();
    if (ta) {
      ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
    } else {
      q.ps = (q.ps || "") + t;
      save();
      draw();
    }
  };

  const imgs = (l) => [...(l || [])].filter((f) => f.type.startsWith("image/"));

  const ExView = (e, i) => {
    const b = h("div", { class: "md" });
    b.innerHTML = md(e.exp || "", q.imgm || {});
    return h(
      "div",
      { class: "example-card" },
      h(
        "div",
        { class: "aph", style: "margin-bottom:10px" },
        h("span", { class: "example-label" }, "EXAMPLE " + String(i + 1).padStart(2, "0")),
        h("span", { style: "flex:1" }),
        h("button", { class: "btn", onclick: () => { ee = e; draw(); } }, "Edit"),
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              if (confirm("Delete this example?")) {
                q.ex.splice(i, 1);
                save();
                draw();
              }
            },
          },
          "Delete"
        )
      ),
      e.inp ? h("div", { class: "example-line" }, h("span", {}, "Input"), h("pre", {}, e.inp)) : null,
      e.out ? h("div", { class: "example-line" }, h("span", {}, "Output"), h("pre", {}, e.out)) : null,
      e.exp && e.exp.trim()
        ? h("div", { class: "example-explanation" }, h("strong", {}, "Explanation"), b)
        : null
    );
  };

  const ExForm = () => {
    const a = ee.id ? ee : null;
    const inp = h("textarea", {
      rows: 3,
      class: "code",
      spellcheck: "false",
      placeholder: "Input (e.g. height = [3, 0, 2, 0, 4])",
    });
    const out = h("textarea", {
      rows: 2,
      class: "code",
      spellcheck: "false",
      placeholder: "Output",
    });
    const exp = h("textarea", {
      rows: 4,
      placeholder: "Explanation (optional, markdown). Drag & drop or paste images here.",
    });
    const pv = h("div", { class: "md" });
    inp.value = a ? a.inp || "" : "";
    out.value = a ? a.out || "" : "";
    exp.value = a ? a.exp || "" : "";
    const up = () => {
      pv.innerHTML = md(exp.value, q.imgm || {});
    };
    up();
    exp.addEventListener("input", up);
    const st = (ev) => ev.stopPropagation();

    return h(
      "div",
      {
        class: "ap",
        style: "margin-top:8px",
        ondragover: (ev) => {
          if ([...ev.dataTransfer.types].includes("Files")) {
            ev.preventDefault();
            ev.stopPropagation();
          }
        },
        ondrop: (ev) => {
          const f = imgs(ev.dataTransfer.files);
          if (!f.length) return;
          ev.preventDefault();
          st(ev);
          embed(f, exp);
        },
        onpaste: (ev) => {
          const f = imgs(ev.clipboardData && ev.clipboardData.files);
          if (f.length) {
            ev.preventDefault();
            st(ev);
            embed(f, exp);
          }
        },
      },
      h("b", {}, a ? "Edit example" : "New example"),
      inp,
      out,
      exp,
      pv,
      h(
        "div",
        { class: "row" },
        h("button", { class: "btn", onclick: () => { ee = null; draw(); } }, "Cancel"),
        h(
          "button",
          {
            class: "btn p",
            onclick: () => {
              const o = {
                id: a ? a.id : "e" + Date.now(),
                inp: inp.value.trim(),
                out: out.value.trim(),
                exp: exp.value,
              };
              if (!o.inp && !o.out && !o.exp.trim()) {
                return alert("Add an input, output or explanation.");
              }
              if (a) Object.assign(a, o);
              else (q.ex = q.ex || []).push(o);
              save();
              ee = null;
              draw();
            },
          },
          "Save"
        )
      )
    );
  };

  const Exs = () => {
    const l = (q.ex || []).map((e, i) => (ee === e ? ExForm() : ExView(e, i)));
    if (ee && !ee.id) l.push(ExForm());
    return h(
      "div",
      { class: "nt", id: "problem-examples" },
      h(
        "div",
        { class: "aph" },
        h("span", { class: "section-toggle" }, "Examples" + ((q.ex || []).length ? ` (${q.ex.length})` : "")),
        h("span", { style: "flex:1" }),
        ee && !ee.id ? null : h("button", { class: "btn", onclick: () => { ee = {}; draw(); } }, "＋ Add example")
      ),
      ...l
    );
  };

  const Notes = (
    a,
    f = "note",
    c = "nc",
    L = "Notes & observations",
    ph = "Write notes in markdown…",
    live = false,
    idAttr = null
  ) => {
    const has = !!(a[f] && a[f].trim());
    if (ne === a.id + f) {
      const ta = h("textarea", { rows: 8, spellcheck: "false", placeholder: ph });
      const pv = h("div", { class: "md", style: live ? "" : "display:none" });
      ta.value = a[f] || "";
      if (live) {
        pv.innerHTML = md(ta.value, a.imgm || {});
        ta.addEventListener("input", () => {
          pv.innerHTML = md(ta.value, a.imgm || {});
        });
      }
      const ins = (pre, post, fallback) => {
        const s = ta.selectionStart;
        const en = ta.selectionEnd;
        const sel = ta.value.slice(s, en) || fallback;
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
          ["Block", () => ins("\n```\n", "\n```\n", "code")],
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
            if (prev) pv.innerHTML = md(ta.value, a.imgm || {});
            tg.textContent = prev ? "Write" : "Preview";
          },
        },
        "Preview"
      );

      return h(
        "div",
        { class: "nt", id: idAttr || false },
        h("div", { class: "aph" }, h("b", {}, L), h("span", { style: "flex:1" }), live ? null : tg),
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
                a[f] = ta.value;
                a[c] = false;
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
    body.innerHTML = md(a[f] || "", a.imgm || {});
    return h(
      "div",
      { class: "nt", id: idAttr || false },
      h(
        "div",
        { class: "aph" },
        h(
          "button",
          {
            class: "section-toggle",
            "aria-expanded": String(!a[c]),
            onclick: () => {
              a[c] = !a[c];
              save();
              draw();
            },
          },
          h("span", { style: "color:var(--mut);font-size:12px" }, a[c] ? "▸" : "▾"),
          L + (has ? "" : " (empty)")
        ),
        h("span", { style: "flex:1" }),
        h("button", { class: "btn", onclick: () => { ne = a.id + f; draw(); } }, has ? "Edit" : "＋ Add")
      ),
      has && !a[c] ? body : null
    );
  };

  const PS = () => {
    if (q.imgs && q.imgs.length) {
      q.imgm = q.imgm || {};
      q.imgs.forEach((d, i) => {
        const id = "m" + i + Date.now().toString(36);
        q.imgm[id] = d;
        q.ps = (q.ps || "") + `\n![image](img:${id})\n`;
      });
      delete q.imgs;
      save();
    }
    let card;
    const fi = h("input", {
      type: "file",
      accept: "image/*",
      multiple: "multiple",
      style: "display:none",
      onchange: (e) => {
        const f = [...e.target.files];
        e.target.value = "";
        embed(f, card.querySelector("textarea"));
      },
    });
    card = h(
      "div",
      {
        class: "card psc",
        ondragover: (e) => {
          if ([...e.dataTransfer.types].includes("Files")) {
            e.preventDefault();
            card.style.borderColor = "var(--acc2)";
          }
        },
        ondragleave: () => {
          card.style.borderColor = "";
        },
        ondrop: (e) => {
          card.style.borderColor = "";
          const f = imgs(e.dataTransfer.files);
          if (!f.length) return;
          e.preventDefault();
          embed(f, e.target.tagName === "TEXTAREA" ? e.target : card.querySelector("textarea"));
        },
        onpaste: (e) => {
          const f = imgs(e.clipboardData && e.clipboardData.files);
          if (f.length) {
            e.preventDefault();
            embed(f, e.target.tagName === "TEXTAREA" ? e.target : card.querySelector("textarea"));
          }
        },
      },
      Notes(
        q,
        "ps",
        "pc",
        "Problem statement",
        "Write the problem statement (markdown). Drag & drop or paste images here.",
        true,
        "problem-statement"
      ),
      Exs(),
      Notes(
        q,
        "cons",
        "cc",
        "Constraints",
        "One per line, e.g.\n- 1 ≤ n ≤ 2 × 10⁴\n- 0 ≤ height[i] ≤ 10⁵",
        false,
        "problem-constraints"
      ),
      h(
        "div",
        { class: "aph", style: "margin-top:14px;padding-top:12px;border-top:1px solid var(--line-soft)" },
        h("button", { class: "btn", onclick: () => fi.click() }, "＋ Add image"),
        fi,
        h("small", { style: "color:var(--mut);font-size:12px" }, "or drag & drop / paste (Ctrl+V) an image")
      )
    );
    return card;
  };

  const back = () => {
    if (tocObserver) {
      tocObserver.disconnect();
      tocObserver = null;
    }
    const y = ui.AP.y;
    ui.AP = null;
    notify();
    scrollTo(0, y);
  };

  const Card = (a, i) =>
    h(
      "article",
      { class: "card apc", id: `approach-${i + 1}`, style: glow(a, q.ap, S.gl) },
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
          h("small", {}, `Approach ${i + 1}`)
        ),
        a.lang ? h("span", { class: "tag-pill" }, a.lang) : null,
        h("button", { class: "btn", title: "Tag approach patterns", onclick: () => PatternModal(q, a) }, `#${aTags(a).length ? ` ${aTags(a).length}` : ""}`),
        h("button", { class: "btn", onclick: () => { ed = a; draw(); scrollTo(0, 0); } }, "Edit"),
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              if (confirm("Delete this approach?")) {
                q.ap.splice(i, 1);
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
            title: a.fd ? "Expand" : "Collapse",
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
                { class: "ptag ptag-add", type: "button", onclick: () => PatternModal(q, a) },
                aTags(a).length ? "✎ Edit tags" : "＋ Approach tag"
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
            Notes(a, "note", "nc", "Notes & observations"),
            Notes(
              a,
              "exp",
              "xc",
              "Interview explanation",
              "Explain your thought process, dry run, and edge cases in your own words…"
            )
          )
    );

  const Form = () => {
    const a = ed.id ? ed : null;
    const t = h("input", {
      placeholder: "Approach title (e.g. Two Pointer, Prefix / Suffix)",
      value: a ? a.title : "",
    });
    const l = h(
      "select",
      {},
      ["C++", "Java", "Python", "JavaScript", "C", "Go", "Other"].map((x) =>
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
      h("h3", {}, a ? "Edit approach" : "New approach"),
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
                id: a ? a.id : "a" + Date.now(),
                title: t.value.trim(),
                lang: l.value,
                time: tc.get(),
                space: sc.get(),
                code: c.value,
                note: a ? a.note || "" : "",
              };
              if (a) Object.assign(a, o);
              else q.ap.push(o);
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

  const EdgeCasesCard = () => {
    q.ec = Array.isArray(q.ec) ? q.ec : [];
    const checkedCount = q.ec.filter((x) => x.done).length;
    const inp = h("input", {
      placeholder: "Add edge case…",
      "aria-label": "New edge case",
    });

    const addEdge = (raw) => {
      const text = (raw != null ? raw : inp.value).trim();
      if (!text) return;
      if (q.ec.some((x) => x.text.toLowerCase() === text.toLowerCase())) {
        inp.value = "";
        return;
      }
      q.ec.push({ id: "ec" + Date.now() + Math.random().toString(36).slice(2, 5), text, done: false });
      save();
      draw();
    };

    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addEdge();
      }
    });

    const availablePresets = EDGE_CASE_PRESETS.filter(
      (p) => !q.ec.some((x) => x.text.toLowerCase() === p.toLowerCase())
    );
    const presetsOpen = showEdgePresets || q.ec.length === 0;

    return h(
      "div",
      { class: "problem-side-card edge-card" },
      h(
        "div",
        { class: "edge-head" },
        h("div", { class: "problem-side-label" }, "EDGE CASES"),
        h(
          "div",
          { class: "edge-head-right" },
          q.ec.length
            ? h("span", { class: "edge-count", title: "Verified / Total" }, `${checkedCount}/${q.ec.length}`)
            : null,
          availablePresets.length
            ? h(
                "button",
                {
                  class: "edge-presets-btn" + (showEdgePresets ? " on" : ""),
                  type: "button",
                  title: "Toggle quick edge-case presets",
                  onclick: () => {
                    showEdgePresets = !showEdgePresets;
                    draw();
                  },
                },
                presetsOpen && q.ec.length ? "Hide" : "Presets"
              )
            : null
        )
      ),
      q.ec.length
        ? h(
            "div",
            { class: "edge-list" },
            q.ec.map((item, idx) =>
              h(
                "div",
                { class: "edge-item" + (item.done ? " done" : "") },
                h("input", {
                  type: "checkbox",
                  checked: !!item.done,
                  "aria-label": `Mark edge case "${item.text}" verified`,
                  onchange: (e) => {
                    item.done = e.target.checked;
                    save();
                    draw();
                  },
                }),
                h(
                  "span",
                  {
                    class: "edge-text",
                    title: "Click to edit edge case",
                    onclick: () => {
                      const next = prompt("Edit edge case", item.text);
                      if (next && next.trim()) {
                        item.text = next.trim();
                        save();
                        draw();
                      }
                    },
                  },
                  item.text
                ),
                h(
                  "button",
                  {
                    class: "edge-del",
                    type: "button",
                    title: "Delete edge case",
                    "aria-label": `Delete edge case "${item.text}"`,
                    onclick: () => {
                      q.ec.splice(idx, 1);
                      save();
                      draw();
                    },
                  },
                  "×"
                )
              )
            )
          )
        : h("p", { class: "problem-side-muted", style: "margin:0 0 10px" }, "Track corner cases to test before submitting."),
      h(
        "div",
        { class: "edge-form" },
        inp,
        h("button", { class: "btn p", type: "button", title: "Add edge case", onclick: () => addEdge() }, "＋")
      ),
      presetsOpen && availablePresets.length
        ? h(
            "div",
            { class: "edge-presets" },
            availablePresets.map((preset) =>
              h(
                "button",
                {
                  class: "edge-preset-chip",
                  type: "button",
                  title: `Add "${preset}"`,
                  onclick: () => addEdge(preset),
                },
                `+ ${preset}`
              )
            )
          )
        : null
    );
  };

  const draw = () => {
    const langs = [...new Set(q.ap.map((a) => a.lang).filter(Boolean))];
    const overview = PS();
    const tocLink = (id, label, first = false) =>
      h(
        "a",
        {
          href: `#${id}`,
          class: first ? "active-link" : "",
          onclick: (e) => {
            e.preventDefault();
            const el = document.getElementById(id);
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          },
        },
        label
      );

    const sidebar = h(
      "aside",
      { class: "problem-sidebar" },
      h(
        "div",
        { class: "problem-side-card problem-toc-card" },
        h("div", { class: "problem-side-label" }, "ON THIS PAGE"),
        tocLink("problem-statement", "Problem statement", true),
        tocLink("problem-examples", "Examples"),
        tocLink("problem-constraints", "Constraints"),
        tocLink("solutions-list", "Solution approaches"),
        ...q.ap.map((a, i) => tocLink(`approach-${i + 1}`, `${String(i + 1).padStart(2, "0")} · ${a.title}`)),
        tocLink("revision-box", "Revision checkpoint")
      ),
      h(
        "div",
        { class: "problem-side-card" },
        h("div", { class: "problem-side-label" }, "COMPLEXITY AT A GLANCE"),
        ...(q.ap.length
          ? q.ap.map((a) =>
              h(
                "div",
                { class: "problem-side-stat" },
                h("span", {}, a.title),
                h("strong", {}, `${a.time || "—"} / ${a.space || "—"}`)
              )
            )
          : [h("p", { class: "problem-side-muted" }, "Add an approach to compare complexity.")]),
        h("small", { class: "problem-side-muted" }, "Time / auxiliary space")
      ),
      EdgeCasesCard(),
      h(
        "div",
        { class: "problem-side-tip" },
        h("b", {}, "STUDY TIP"),
        h(
          "p",
          {},
          "Lock down the core invariant or boundary condition first. The code becomes mechanical once the observation is clear."
        )
      )
    );

    rc(
      root,
      h(
        "div",
        { class: "problem-page" },
        h(
          "div",
          { class: "problem-toolbar" },
          h("button", { class: "btn", onclick: back }, "← Back to sheet"),
          h(
            "div",
            { class: "problem-toolbar-actions" },
            h(
              "button",
              {
                class: "btn fav-btn" + (S.fav[q.id] ? " on" : ""),
                "aria-pressed": String(!!S.fav[q.id]),
                onclick: () => toggleFav(q.id),
              },
              S.fav[q.id] ? "♥ Favorited" : "♡ Favorite"
            ),
            h(
              "button",
              { class: "btn", onclick: () => PatternModal(q) },
              `# Patterns${qTags(q).length ? ` (${qTags(q).length})` : ""}`
            ),
            h("button", { class: "btn", onclick: () => dlBlog(q, "medium") }, "Medium .md"),
            h("button", { class: "btn", onclick: () => dlBlog(q, "li") }, "LinkedIn .md")
          )
        ),
        h(
          "div",
          { class: "breadcrumbs" },
          h("span", {}, sheetName),
          h("span", {}, "/"),
          h("span", {}, topicName),
          h("span", {}, "/"),
          h("strong", {}, q.t)
        ),
        h(
          "section",
          { class: "problem-hero" },
          h("div", { class: "eyebrow" }, h("span", { class: "eyebrow-line" }), topicName),
          h(
            "div",
            { class: "hero-row" },
            h(
              "div",
              {},
              h("h1", {}, q.t),
              h(
                "p",
                { class: "hero-description" },
                "Problem statement, examples, constraints and solution approaches in one place."
              )
            ),
            h(
              "div",
              { class: "problem-index" },
              h("span", {}, "PROBLEM"),
              h("strong", {}, String(probIdx).padStart(2, "0")),
              h("small", {}, `of ${sheetTotal || "—"}`)
            )
          ),
          h(
            "div",
            { class: "meta-row" },
            h("span", { class: "status-pill" }, h("i", {}), S.done[q.id] ? "Solved" : "In progress"),
            h("span", {}, "·"),
            h("span", {}, `${q.ap.length} approach${q.ap.length === 1 ? "" : "es"}`),
            ...(langs.length ? [h("span", {}, "·"), h("span", {}, langs.join(", "))] : []),
            ...(S.done[q.id] ? [h("span", {}, "·"), RevDots(q.id)] : [])
          ),
          h(
            "div",
            { class: "ptags", style: "margin-top:14px" },
            ...qTags(q).map((tg) => h("span", { class: "ptag" }, tg)),
            h(
              "button",
              { class: "ptag ptag-add", type: "button", onclick: () => PatternModal(q) },
              qTags(q).length ? "✎ Edit patterns" : "＋ Add pattern tag"
            )
          )
        ),
        h(
          "div",
          { class: "problem-layout" },
          h(
            "div",
            { class: "problem-main" },
            h("section", { class: "problem-overview" }, overview),
            h(
              "section",
              { class: "problem-solutions", id: "solutions-list" },
              h(
                "div",
                { class: "solutions-heading" },
                h(
                  "div",
                  {},
                  h("div", { class: "eyebrow" }, h("span", { class: "eyebrow-line" }), "IMPLEMENTATIONS"),
                  h("h2", {}, "Solution approaches"),
                  h("p", {}, "Compare approaches from intuition and preprocessing to optimal space.")
                ),
                h(
                  "span",
                  { class: "count-pill" },
                  `${String(q.ap.length).padStart(2, "0")} APPROACH${q.ap.length === 1 ? "" : "ES"}`
                )
              ),
              ed ? Form() : null,
              ...q.ap.map(Card),
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
                "＋ Add solution approach"
              )
            ),
            h(
              "div",
              { class: "problem-revision", id: "revision-box" },
              h("span", { class: "problem-revision-mark" }, "↗"),
              h(
                "div",
                {},
                h("b", {}, "Revision checkpoint"),
                h(
                  "p",
                  {},
                  "Can you explain the core observation, justify why it works, and state the time and auxiliary space complexity without looking at the code?"
                )
              )
            )
          ),
          sidebar
        )
      )
    );

    if (tocObserver) tocObserver.disconnect();
    const links = [...root.querySelectorAll('.problem-toc-card a[href^="#"]')];
    const targets = links.map((l) => root.querySelector(l.getAttribute("href"))).filter(Boolean);
    tocObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((l) =>
            l.classList.toggle("active-link", l.getAttribute("href") === `#${entry.target.id}`)
          );
        });
      },
      { rootMargin: "-90px 0px -65% 0px" }
    );
    targets.forEach((el) => tocObserver.observe(el));
  };

  draw();
  return root;
}
