import { S, save } from "../state/store.js";
import { h, rc } from "../utils/dom.js";
import { md } from "../utils/markdown.js";
import { DEFAULT_TEMPLATES, blog, aiPrompt } from "../domain/blogExport.js";
import {
  BLOCK_CATALOG,
  CONDITION_OPTIONS,
  createBlock,
  defaultBlocks,
  compileBlocks,
} from "../domain/templateBlocks.js";

const SAMPLE_PROBLEM = {
  id: "__sample__",
  t: "Trapping Rain Water",
  ps: "Given **n non-negative integers** representing an elevation map where the width of each bar is 1, compute how much water it can trap after raining.",
  cons: "- 1 <= n <= 2 * 10^4\n- 0 <= height[i] <= 10^5",
  ex: [
    {
      inp: "height = [3, 0, 2, 0, 4]",
      out: "7",
      exp: "The elevation map traps a total of 7 units of rainwater.",
    },
  ],
  ap: [
    {
      id: "sa1",
      title: "Prefix & Suffix Max Arrays",
      lang: "Java",
      time: "O(n)",
      space: "O(n)",
      code: "int[] left = new int[n], right = new int[n];\n// precompute leftMax and rightMax",
      note: "Precompute maximum boundaries on both sides in O(n) time.",
      exp: "Instead of scanning left and right for every index, precompute prefix and suffix maximums.",
      tags: ["Prefix / Suffix"],
    },
    {
      id: "sa2",
      title: "Two Pointers",
      lang: "Java",
      time: "O(n)",
      space: "O(1)",
      code: "int l = 0, r = height.length - 1, lMax = 0, rMax = 0, water = 0;\nwhile (l <= r) { /* process smaller boundary */ }",
      note: "Process the side with the smaller current max boundary.",
      exp: "Once leftMax <= rightMax, the water level at left is strictly bounded by leftMax.",
      tags: ["Two Pointers"],
    },
  ],
};

function resolvePreviewProblem(q) {
  if (q) return { prob: q, isSample: false };
  for (const s of S.sheets || []) {
    for (const t of s.topics || []) {
      const rich = (t.qs || []).find((x) => (x.ap && x.ap.length) || x.ps);
      if (rich) return { prob: rich, isSample: false };
    }
  }
  return { prob: SAMPLE_PROBLEM, isSample: true };
}

export function TplModal(q = null) {
  const { prob: previewQ, isSample } = resolvePreviewProblem(q);
  let kind = "medium";
  let mode = "visual"; // "visual" | "raw" | "ai"
  let previewMode = "raw"; // "raw" | "rendered"
  let expandedId = null;
  let dragIdx = null;
  let dragCatalogType = null;

  const getBlocks = (k) => {
    S.tplBlocks = S.tplBlocks || {};
    if (!Array.isArray(S.tplBlocks[k]) || !S.tplBlocks[k].length) {
      S.tplBlocks[k] = defaultBlocks(k);
    }
    return S.tplBlocks[k];
  };

  let blocks = JSON.parse(JSON.stringify(getBlocks(kind)));
  let rawText = (S.tpl && S.tpl[kind]) || compileBlocks(blocks);

  const m = h("div", {
    class: "mask",
    onclick: (e) => {
      if (e.target === m) m.remove();
    },
  });
  const box = h("div", { class: "card tpl-modal" });
  m.append(box);

  const activeTemplate = () => (mode === "visual" ? compileBlocks(blocks) : rawText);

  const loadKind = (nextKind) => {
    kind = nextKind;
    blocks = JSON.parse(JSON.stringify(getBlocks(kind)));
    rawText = (S.tpl && S.tpl[kind]) || compileBlocks(blocks);
    expandedId = null;
    draw();
  };

  const syncPreview = (pvEl) => {
    if (!pvEl) return;
    try {
      const renderedMd = blog(previewQ, kind, activeTemplate()).md.slice(0, 12000);
      if (previewMode === "rendered") {
        pvEl.className = "tpl-preview-rendered md";
        pvEl.innerHTML = md(renderedMd, previewQ.imgm || {});
      } else {
        pvEl.className = "tpl-preview-raw";
        pvEl.textContent = renderedMd;
      }
    } catch (e) {
      pvEl.className = "tpl-preview-raw";
      pvEl.textContent = "Preview error: " + e.message;
    }
  };

  const moveBlock = (from, to) => {
    if (from === to || from < 0 || to < 0 || from >= blocks.length || to >= blocks.length) return;
    const [item] = blocks.splice(from, 1);
    blocks.splice(to, 0, item);
    rawText = compileBlocks(blocks);
    draw();
  };

  const insertBlockAt = (type, index) => {
    const nb = createBlock(type, kind);
    const pos = index != null ? Math.max(0, Math.min(blocks.length, index)) : blocks.length;
    blocks.splice(pos, 0, nb);
    expandedId = nb.id;
    rawText = compileBlocks(blocks);
    draw();
  };

  const draw = () => {
    const pvEl = h("div", { class: "tpl-preview-raw" });
    syncPreview(pvEl);

    // Header bar
    const saveBtn = h(
      "button",
      {
        class: "btn p",
        onclick: () => {
          S.tpl = S.tpl || {};
          S.tplBlocks = S.tplBlocks || {};
          if (mode === "visual") {
            S.tplBlocks[kind] = JSON.parse(JSON.stringify(blocks));
            rawText = compileBlocks(blocks);
          }
          S.tpl[kind] = rawText;
          save();
          saveBtn.textContent = "Saved ✓";
          setTimeout(() => (saveBtn.textContent = "Save template"), 1200);
        },
      },
      "Save template"
    );

    const header = h(
      "div",
      { class: "tpl-top" },
      h(
        "div",
        {},
        h("div", { class: "eyebrow" }, h("span", { class: "eyebrow-line" }), "TEMPLATE STUDIO"),
        h("h3", { style: "margin-top:4px" }, "Visual Blog Template Editor")
      ),
      h(
        "div",
        { class: "tpl-top-controls" },
        h(
          "select",
          {
            style: "width:auto",
            "aria-label": "Platform",
            onchange: (e) => loadKind(e.target.value),
          },
          h("option", { value: "medium", selected: kind === "medium" }, "Medium"),
          h("option", { value: "li", selected: kind === "li" }, "LinkedIn")
        ),
        h(
          "div",
          { class: "tpl-mode-tabs", role: "tablist" },
          [
            ["visual", "Visual Builder"],
            ["raw", "Raw Markdown"],
            ["ai", "AI Prompt"],
          ].map(([k, lbl]) =>
            h(
              "button",
              {
                class: "tpl-mode-tab" + (mode === k ? " on" : ""),
                type: "button",
                role: "tab",
                "aria-selected": String(mode === k),
                onclick: () => {
                  if (mode === "visual" && k !== "visual") {
                    rawText = compileBlocks(blocks);
                  }
                  mode = k;
                  draw();
                },
              },
              lbl
            )
          )
        ),
        saveBtn,
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              if (confirm(`Reset ${kind === "li" ? "LinkedIn" : "Medium"} template to default?`)) {
                if (S.tpl) delete S.tpl[kind];
                if (S.tplBlocks) delete S.tplBlocks[kind];
                save();
                blocks = defaultBlocks(kind);
                rawText = DEFAULT_TEMPLATES[kind];
                expandedId = null;
                draw();
              }
            },
          },
          "Reset"
        ),
        h("button", { class: "btn", onclick: () => m.remove() }, "Close")
      )
    );

    // Left pane content depending on mode
    let leftPane;

    if (mode === "visual") {
      // Palette of draggable / clickable blocks
      const palette = h(
        "div",
        { class: "tpl-palette" },
        h("div", { class: "tpl-sub-label" }, "ADD BLOCK (CLICK OR DRAG INTO CANVAS)"),
        h(
          "div",
          { class: "tpl-palette-grid" },
          BLOCK_CATALOG.map((item) =>
            h(
              "button",
              {
                class: "tpl-pal-chip",
                type: "button",
                draggable: "true",
                title: item.desc,
                onclick: () => insertBlockAt(item.type),
                ondragstart: (e) => {
                  dragCatalogType = item.type;
                  dragIdx = null;
                  e.dataTransfer.effectAllowed = "copy";
                },
                ondragend: () => {
                  dragCatalogType = null;
                },
              },
              `+ ${item.label}`
            )
          )
        )
      );

      // Canvas of active blocks
      const canvas = h(
        "div",
        {
          class: "tpl-canvas",
          ondragover: (e) => {
            if (dragCatalogType || dragIdx !== null) e.preventDefault();
          },
          ondrop: (e) => {
            if (dragCatalogType) {
              e.preventDefault();
              const t = dragCatalogType;
              dragCatalogType = null;
              insertBlockAt(t);
            }
          },
        },
        blocks.length
          ? blocks.map((b, i) => {
              const isOpen = expandedId === b.id;
              const condLabel =
                (CONDITION_OPTIONS.find(([v]) => v === (b.cond || "")) || ["", b.cond])[1] || "";

              const card = h("div", {
                class: `tpl-block${b.enabled === false ? " disabled" : ""}${isOpen ? " open" : ""}`,
                draggable: "true",
                ondragstart: (e) => {
                  // Don't start dragging when selecting text inside inputs
                  if (["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)) {
                    e.preventDefault();
                    return;
                  }
                  dragIdx = i;
                  dragCatalogType = null;
                  card.classList.add("dragging");
                  e.dataTransfer.effectAllowed = "move";
                },
                ondragend: () => {
                  dragIdx = null;
                  card.classList.remove("dragging");
                  canvas.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
                },
                ondragover: (e) => {
                  if (dragIdx === null && !dragCatalogType) return;
                  e.preventDefault();
                  e.stopPropagation();
                  card.classList.add("drag-over");
                },
                ondragleave: () => {
                  card.classList.remove("drag-over");
                },
                ondrop: (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  card.classList.remove("drag-over");
                  if (dragCatalogType) {
                    const t = dragCatalogType;
                    dragCatalogType = null;
                    insertBlockAt(t, i);
                  } else if (dragIdx !== null && dragIdx !== i) {
                    const from = dragIdx;
                    dragIdx = null;
                    moveBlock(from, i);
                  }
                },
              });

              const head = h(
                "div",
                { class: "tpl-block-head" },
                h("span", { class: "tpl-drag-handle", title: "Drag to reorder" }, "⋮⋮"),
                h("input", {
                  type: "checkbox",
                  checked: b.enabled !== false,
                  title: b.enabled !== false ? "Disable block" : "Enable block",
                  onclick: (e) => e.stopPropagation(),
                  onchange: (e) => {
                    b.enabled = e.target.checked;
                    rawText = compileBlocks(blocks);
                    syncPreview(pvEl);
                    card.classList.toggle("disabled", !b.enabled);
                  },
                }),
                h(
                  "button",
                  {
                    class: "tpl-block-title",
                    type: "button",
                    onclick: () => {
                      expandedId = isOpen ? null : b.id;
                      draw();
                    },
                  },
                  h("b", {}, b.label || b.type),
                  b.heading ? h("small", {}, b.heading) : condLabel ? h("small", {}, condLabel) : null
                ),
                h(
                  "div",
                  { class: "tpl-block-actions" },
                  h(
                    "button",
                    {
                      class: "st",
                      type: "button",
                      title: "Move up",
                      disabled: i === 0 ? "disabled" : false,
                      onclick: () => moveBlock(i, i - 1),
                    },
                    "↑"
                  ),
                  h(
                    "button",
                    {
                      class: "st",
                      type: "button",
                      title: "Move down",
                      disabled: i === blocks.length - 1 ? "disabled" : false,
                      onclick: () => moveBlock(i, i + 1),
                    },
                    "↓"
                  ),
                  h(
                    "button",
                    {
                      class: "st",
                      type: "button",
                      title: isOpen ? "Collapse editor" : "Edit block",
                      onclick: () => {
                        expandedId = isOpen ? null : b.id;
                        draw();
                      },
                    },
                    isOpen ? "▾" : "✎"
                  ),
                  h(
                    "button",
                    {
                      class: "st",
                      type: "button",
                      title: "Remove block",
                      onclick: () => {
                        blocks.splice(i, 1);
                        if (expandedId === b.id) expandedId = null;
                        rawText = compileBlocks(blocks);
                        draw();
                      },
                    },
                    "×"
                  )
                )
              );

              card.append(head);

              if (isOpen) {
                const headingInp = h("input", {
                  value: b.heading || "",
                  placeholder: "Optional section heading (e.g. ## Approaches)",
                  oninput: (e) => {
                    b.heading = e.target.value;
                    rawText = compileBlocks(blocks);
                    syncPreview(pvEl);
                  },
                });
                const condSel = h(
                  "select",
                  {
                    onchange: (e) => {
                      b.cond = e.target.value;
                      rawText = compileBlocks(blocks);
                      syncPreview(pvEl);
                    },
                  },
                  CONDITION_OPTIONS.map(([v, lbl]) =>
                    h("option", { value: v, selected: (b.cond || "") === v }, lbl)
                  )
                );
                const bodyTa = h("textarea", {
                  rows: 5,
                  class: "code",
                  spellcheck: "false",
                  placeholder: "Markdown & {{placeholders}}…",
                  oninput: (e) => {
                    b.body = e.target.value;
                    rawText = compileBlocks(blocks);
                    syncPreview(pvEl);
                  },
                });
                bodyTa.value = b.body || "";

                const quickVars =
                  b.type === "examples"
                    ? ["{{n}}", "{{e_input}}", "{{e_output}}", "{{e_explain}}"]
                    : b.type === "approaches"
                    ? ["{{n}}", "{{a_title}}", "{{a_time}}", "{{a_space}}", "{{a_lang}}", "{{a_code}}", "{{a_note}}", "{{a_explain}}"]
                    : ["{{title}}", "{{topic}}", "{{sheet}}", "{{tldr}}", "{{hook}}", "{{problem}}", "{{constraints}}", "{{comparison}}", "{{tags}}", "{{hashtags}}"];

                const editorBody = h(
                  "div",
                  { class: "tpl-block-body" },
                  h(
                    "div",
                    { class: "two" },
                    h("label", { class: "cx" }, h("small", { style: "color:var(--mut)" }, "Heading"), headingInp),
                    h("label", { class: "cx" }, h("small", { style: "color:var(--mut)" }, "Condition"), condSel)
                  ),
                  h("label", { class: "cx" }, h("small", { style: "color:var(--mut)" }, "Content"), bodyTa),
                  h(
                    "div",
                    { class: "tb" },
                    quickVars.map((v) =>
                      h(
                        "button",
                        {
                          class: "btn",
                          type: "button",
                          onclick: () => {
                            bodyTa.setRangeText(v, bodyTa.selectionStart, bodyTa.selectionEnd, "end");
                            bodyTa.focus();
                            b.body = bodyTa.value;
                            rawText = compileBlocks(blocks);
                            syncPreview(pvEl);
                          },
                        },
                        v
                      )
                    )
                  )
                );
                card.append(editorBody);
              }

              return card;
            })
          : [h("div", { class: "empty" }, "Drag or click any block above to start building your template.")]
      );

      leftPane = h("div", { class: "tpl-left" }, palette, canvas);
    } else if (mode === "raw") {
      const ta = h("textarea", {
        class: "code",
        spellcheck: "false",
        style: "min-height:360px;white-space:pre",
        oninput: (e) => {
          rawText = e.target.value;
          syncPreview(pvEl);
        },
      });
      ta.value = rawText;

      const ins = (t) =>
        h(
          "button",
          {
            class: "btn",
            type: "button",
            title: t,
            onclick: () => {
              ta.setRangeText(t, ta.selectionStart, ta.selectionEnd, "end");
              ta.focus();
              rawText = ta.value;
              syncPreview(pvEl);
            },
          },
          t.length > 26 ? t.slice(0, 24).replace(/\n/g, " ") + "…" : t.replace(/\n/g, " ")
        );

      const G = "title topic sheet date count tldr hook best_title best_time best_space problem constraints comparison tags hashtags".split(" ");
      leftPane = h(
        "div",
        { class: "tpl-left" },
        h("small", { style: "color:var(--mut)" }, "Direct Mustache-style template editor. Empty fields and {{#if x}}…{{/if}} blocks vanish automatically."),
        h("div", { class: "tb" }, G.map((k) => ins(`{{${k}}}`))),
        ta
      );
    } else {
      const st = h("textarea", {
        rows: 4,
        placeholder:
          "Describe your style (optional): e.g. crisp storytelling, intuition first, clean headings, end with a takeaway...",
      });
      const pr = h("textarea", {
        rows: 10,
        readonly: "readonly",
        class: "code",
        style: "display:none",
      });
      const cp = h(
        "button",
        {
          class: "btn p",
          onclick: (e) => {
            const b = e.target;
            const t = aiPrompt(kind, st.value, rawText);
            pr.value = t;
            pr.style.display = "";
            const done = (x) => {
              b.textContent = x;
              setTimeout(() => (b.textContent = "Copy AI prompt"), 1800);
            };
            try {
              navigator.clipboard.writeText(t).then(
                () => done("Copied ✓"),
                () => {
                  pr.select();
                  done("Copy from box below");
                }
              );
            } catch {
              pr.select();
              done("Copy from box below");
            }
          },
        },
        "Copy AI prompt"
      );
      leftPane = h(
        "div",
        { class: "tpl-left" },
        h("p", { class: "note" }, "Generate a ready-to-paste prompt with all app rules and placeholders. Paste the AI's output into the Raw Markdown tab."),
        st,
        h("div", { class: "aph" }, cp),
        pr
      );
    }

    // Right pane: Live Preview
    const rightPane = h(
      "div",
      { class: "tpl-right" },
      h(
        "div",
        { class: "tpl-preview-head" },
        h("span", { class: "tpl-sub-label", style: "margin:0" }, `LIVE PREVIEW · ${previewQ.t}${isSample ? " (Sample)" : ""}`),
        h(
          "div",
          { class: "tpl-mode-tabs" },
          [
            ["raw", "Markdown"],
            ["rendered", "Rendered"],
          ].map(([k, lbl]) =>
            h(
              "button",
              {
                class: "tpl-mode-tab" + (previewMode === k ? " on" : ""),
                type: "button",
                onclick: () => {
                  previewMode = k;
                  draw();
                },
              },
              lbl
            )
          )
        )
      ),
      pvEl
    );

    rc(box, header, h("div", { class: "tpl-split" }, leftPane, rightPane));
  };

  draw();
  document.body.append(m);
}
