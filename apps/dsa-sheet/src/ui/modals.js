import { PATTERNS, ACCENTS, DEFAULT_ACCENT } from "../data/sheets.js";
import { S, save, notify, navigate, all, cnt, applyAccent } from "../state/store.js";
import { h, rc, pct } from "../utils/dom.js";
import { qOwnTags, aTags, allUsedTags, toggleTag, toggleApproachTag } from "../domain/patterns.js";
import { algoOwnTags, toggleAlgoTag } from "../domain/algorithms.js";
export { TplModal } from "./templateBuilder.js";

export const SHEET_CONVERTER_PROMPT = `ROLE: You are a precise data-formatting assistant.

TASK: Convert the DSA / coding problem sheet I provide below (regardless of whether it is a CSV, Markdown table, JSON, Notion export, Excel copy-paste, PDF text, HTML, or numbered list) into the exact plain-text format required by my DSA.sheet Tracker app.

STRICT OUTPUT FORMAT RULES:
1. Output ONE question per line using this exact syntax:
   Topic :: Question Title
2. Use a double colon with single spaces around it (" :: ") to separate the topic name from the question title.
3. Preserve the original topic grouping and question order from the input sheet.
4. If the input has no topics/categories, use "General" as the topic name.
5. Clean every line:
   - Remove numbering prefixes (e.g., "1.", "Q2)", "#3", "- ", "* ").
   - Remove URLs, LeetCode/GFG links, status checkboxes, difficulty tags, and extra columns unless they are part of the actual problem name.
   - Do NOT include " :: " inside the question title itself (replace any internal "::" with "-").
   - Remove duplicate blank lines, table headers, and summary rows.
6. Output ONLY the formatted lines inside a single plain-text code block (no introduction, no explanation, no notes before or after) so I can copy and paste it directly into my app.

EXAMPLE OUTPUT:
Arrays :: Two Sum
Arrays :: Trapping Rain Water
Strings :: Longest Palindromic Substring
Dynamic Programming :: Coin Change

HERE IS MY SHEET TO CONVERT:
[PASTE YOUR SHEET HERE]`;

export function AddModal() {
  const n = h("input", { placeholder: "Sheet name (e.g. Blind 75)" });
  const t = h("textarea", {
    rows: 9,
    placeholder:
      "One question per line.\nOptional topic: Topic :: Question\n\nArrays :: Two Sum\nArrays :: 3Sum\nGraphs :: Clone Graph",
  });

  const copyPromptBtn = h(
    "button",
    {
      class: "btn",
      type: "button",
      title: "Copy a ready-to-use AI prompt to convert any sheet into Topic :: Question format",
      onclick: () => {
        const done = (msg) => {
          copyPromptBtn.textContent = msg;
          setTimeout(() => (copyPromptBtn.textContent = "Copy AI Converter Prompt"), 1800);
        };
        if (navigator.clipboard) {
          navigator.clipboard.writeText(SHEET_CONVERTER_PROMPT).then(
            () => done("Prompt Copied ✓"),
            () => done("Copy failed")
          );
        } else {
          const ta = h("textarea", { style: "position:fixed;opacity:0" });
          ta.value = SHEET_CONVERTER_PROMPT;
          document.body.append(ta);
          ta.select();
          try {
            document.execCommand("copy");
            done("Prompt Copied ✓");
          } catch {
            done("Copy failed");
          }
          ta.remove();
        }
      },
    },
    "Copy AI Converter Prompt"
  );

  const m = h(
    "div",
    { class: "mask", onclick: (e) => { if (e.target === m) m.remove(); } },
    h(
      "div",
      { class: "card" },
      h(
        "div",
        { class: "row", style: "justify-content:space-between;align-items:center" },
        h("h3", {}, "Add new sheet"),
        copyPromptBtn
      ),
      n,
      t,
      h(
        "div",
        { class: "row" },
        h("button", { class: "btn", onclick: () => m.remove() }, "Cancel"),
        h(
          "button",
          {
            class: "btn p",
            onclick: () => {
              const id = "c" + Date.now();
              const map = {};
              t.value
                .split("\n")
                .map((x) => x.trim())
                .filter((x) => x && !x.startsWith("```"))
                .forEach((l) => {
                  const [a, ...b] = l.split("::");
                  const tp = b.length ? a.trim() : "General";
                  const tx = b.length ? b.join("::").trim() : l;
                  if (tx) (map[tp || "General"] = map[tp || "General"] || []).push(tx);
                });
              if (!n.value.trim() || !Object.keys(map).length) {
                return alert("Add a name and at least one question.");
              }
              S.sheets.push({
                id,
                name: n.value.trim(),
                topics: Object.entries(map).map(([k, v]) => ({
                  n: k,
                  qs: v.map((x, i) => ({ id: `${id}-${k}-${i}`, t: x })),
                })),
              });
              save();
              m.remove();
              navigate(id);
            },
          },
          "Create"
        )
      )
    )
  );
  document.body.append(m);
  n.focus();
}

export function PatternModal(q, approach = null) {
  const isApproach = !!approach;
  const m = h("div", {
    class: "mask",
    onclick: (e) => {
      if (e.target === m) {
        m.remove();
        notify();
      }
    },
  });
  const box = h("div", { class: "card" });
  m.append(box);

  const getCur = () => (isApproach ? aTags(approach) : qOwnTags(q.id));
  const toggle = (tag) => (isApproach ? toggleApproachTag(approach, tag) : toggleTag(q.id, tag));

  const draw = () => {
    const cur = getCur();
    const allPats = [...new Set([...PATTERNS, ...allUsedTags()])];
    const inp = h("input", { placeholder: "Add custom pattern (e.g. Meet in the Middle)…" });
    const addCustom = () => {
      const v = inp.value.trim();
      if (!v) return;
      if (!cur.some((x) => x.toLowerCase() === v.toLowerCase())) toggle(v);
      inp.value = "";
      draw();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCustom();
      }
    });

    // Show inherited approach tags when editing problem-level tags
    const inherited = !isApproach
      ? [...new Set((q.ap || []).flatMap((a) => aTags(a)))].filter(
          (tg) => !cur.some((x) => x.toLowerCase() === tg.toLowerCase())
        )
      : [];

    rc(
      box,
      h(
        "div",
        { class: "row", style: "justify-content:space-between;align-items:center" },
        h(
          "div",
          {},
          h(
            "div",
            { class: "eyebrow" },
            h("span", { class: "eyebrow-line" }),
            isApproach ? "APPROACH PATTERNS" : "PROBLEM PATTERNS"
          ),
          h("h3", { style: "margin-top:4px" }, isApproach ? approach.title : q.t)
        ),
        h("button", { class: "btn", onclick: () => { m.remove(); notify(); } }, "Done")
      ),
      cur.length
        ? h(
            "div",
            { class: "ptags" },
            cur.map((t) =>
              h(
                "button",
                {
                  class: "ptag",
                  type: "button",
                  title: `Remove ${t}`,
                  onclick: () => {
                    toggle(t);
                    draw();
                  },
                },
                `${t} ×`
              )
            )
          )
        : h(
            "div",
            { class: "note" },
            isApproach
              ? "Tag this approach (e.g. Greedy, Two Pointers). Its tags are automatically included on the problem."
              : "No problem-level tags selected. Pick from presets below or tag individual approaches."
          ),
      inherited.length
        ? h(
            "div",
            { class: "note", style: "font-size:12px" },
            `Auto-included from approaches: ${inherited.join(", ")}`
          )
        : null,
      h(
        "div",
        { class: "pat-grid" },
        allPats.map((p) => {
          const on = cur.some((x) => x.toLowerCase() === p.toLowerCase());
          return h(
            "button",
            {
              class: "pat-chip" + (on ? " on" : ""),
              type: "button",
              "aria-pressed": String(on),
              onclick: () => {
                toggle(p);
                draw();
              },
            },
            (on ? "✓ " : "") + p
          );
        })
      ),
      h(
        "div",
        { class: "pat-custom-row" },
        inp,
        h("button", { class: "btn p", type: "button", onclick: addCustom }, "Add")
      )
    );
  };

  draw();
  document.body.append(m);
}

export function AlgoPatternModal(algo, approach = null) {
  const isApproach = !!approach;
  const m = h("div", {
    class: "mask",
    onclick: (e) => {
      if (e.target === m) {
        m.remove();
        notify();
      }
    },
  });
  const box = h("div", { class: "card" });
  m.append(box);

  const getCur = () => (isApproach ? aTags(approach) : algoOwnTags(algo));
  const toggle = (tag) => (isApproach ? toggleApproachTag(approach, tag) : toggleAlgoTag(algo, tag));

  const draw = () => {
    const cur = getCur();
    const allPats = [...new Set([...PATTERNS, ...allUsedTags(), ...cur])];
    const inp = h("input", { placeholder: "Add custom tag (e.g. Stable, In-Place, Comparison)…" });
    const addCustom = () => {
      const v = inp.value.trim();
      if (!v) return;
      if (!cur.some((x) => x.toLowerCase() === v.toLowerCase())) toggle(v);
      inp.value = "";
      draw();
    };
    inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCustom();
      }
    });

    const inherited = !isApproach
      ? [...new Set((algo.ap || []).flatMap((a) => aTags(a)))].filter(
          (tg) => !cur.some((x) => x.toLowerCase() === tg.toLowerCase())
        )
      : [];

    rc(
      box,
      h(
        "div",
        { class: "row", style: "justify-content:space-between;align-items:center" },
        h(
          "div",
          {},
          h(
            "div",
            { class: "eyebrow" },
            h("span", { class: "eyebrow-line" }),
            isApproach ? "IMPLEMENTATION TAGS" : "ALGORITHM TAGS"
          ),
          h("h3", { style: "margin-top:4px" }, isApproach ? approach.title : algo.name)
        ),
        h("button", { class: "btn", onclick: () => { m.remove(); notify(); } }, "Done")
      ),
      cur.length
        ? h(
            "div",
            { class: "ptags" },
            cur.map((t) =>
              h(
                "button",
                {
                  class: "ptag",
                  type: "button",
                  title: `Remove ${t}`,
                  onclick: () => {
                    toggle(t);
                    draw();
                  },
                },
                `${t} ×`
              )
            )
          )
        : h(
            "div",
            { class: "note" },
            isApproach
              ? "Tag this implementation (e.g. Iterative, Space-Optimized). Tags automatically roll up to the algorithm."
              : "No algorithm-level tags selected. Pick from presets below or add custom tags."
          ),
      inherited.length
        ? h(
            "div",
            { class: "note", style: "font-size:12px" },
            `Auto-included from implementations: ${inherited.join(", ")}`
          )
        : null,
      h(
        "div",
        { class: "pat-grid" },
        allPats.map((p) => {
          const on = cur.some((x) => x.toLowerCase() === p.toLowerCase());
          return h(
            "button",
            {
              class: "pat-chip" + (on ? " on" : ""),
              type: "button",
              "aria-pressed": String(on),
              onclick: () => {
                toggle(p);
                draw();
              },
            },
            (on ? "✓ " : "") + p
          );
        })
      ),
      h(
        "div",
        { class: "pat-custom-row" },
        inp,
        h("button", { class: "btn p", type: "button", onclick: addCustom }, "Add")
      )
    );
  };

  draw();
  document.body.append(m);
}

export function AccentModal() {
  const overlay = h("div", {
    class: "accent-panel",
    onclick: (e) => {
      if (e.target === overlay) overlay.remove();
    },
  });
  const dialog = h("div", { class: "accent-dialog", role: "dialog", "aria-modal": "true" });
  const current = () => S.accent || DEFAULT_ACCENT;

  const draw = () => {
    const swatches = h("div", { class: "accent-swatches" });
    ACCENTS.forEach(([name, color]) =>
      swatches.append(
        h("button", {
          class: "accent-swatch" + (current().toLowerCase() === color.toLowerCase() ? " active" : ""),
          style: `--swatch:${color}`,
          title: name,
          "aria-label": name,
          onclick: () => {
            S.accent = color;
            save();
            applyAccent();
            draw();
          },
        })
      )
    );
    const picker = h("input", {
      type: "color",
      value: current(),
      "aria-label": "Custom accent color",
      oninput: (e) => {
        S.accent = e.target.value;
        save();
        applyAccent();
        draw();
      },
    });

    rc(
      dialog,
      h("h2", {}, "Choose accent color"),
      h("p", {}, "Change the highlight color used across buttons, progress, links and problem markers."),
      swatches,
      h(
        "div",
        { class: "accent-custom" },
        h("div", {}, h("b", {}, "Custom color"), h("div", { class: "note" }, "Choose any color")),
        picker
      ),
      h(
        "div",
        { class: "row" },
        h(
          "button",
          {
            class: "btn",
            onclick: () => {
              S.accent = DEFAULT_ACCENT;
              save();
              applyAccent();
              draw();
            },
          },
          "Reset"
        ),
        h("button", { class: "btn p", onclick: () => overlay.remove() }, "Done")
      )
    );
  };

  draw();
  overlay.append(dialog);
  document.body.append(overlay);
}

export function ManageModal() {
  const m = h("div", { class: "mask", onclick: (e) => { if (e.target === m) m.remove(); } });
  const box = h("div", { class: "card big" });
  m.append(box);

  const row = (s) => {
    const q = all(s);
    const hid = S.hidden.includes(s.id);
    return h(
      "div",
      { class: "ap" },
      h(
        "div",
        { class: "aph" },
        h("b", {}, s.name),
        h("small", { style: "color:var(--mut)" }, `${cnt(q)} / ${q.length} · ${pct(cnt(q), q.length)}%`),
        h("span", { style: "flex:1" }),
        hid ? null : h("button", { class: "btn", onclick: () => { m.remove(); navigate(s.id); } }, "Open"),
        hid
          ? null
          : h(
              "button",
              {
                class: "btn",
                onclick: () => {
                  S.hidden = S.sheets.filter((x) => x.id !== s.id).map((x) => x.id);
                  save();
                  notify();
                  draw();
                },
              },
              "Focus"
            ),
        h(
          "button",
          {
            class: "btn" + (hid ? " p" : ""),
            onclick: () => {
              if (hid) S.hidden = S.hidden.filter((x) => x !== s.id);
              else S.hidden.push(s.id);
              save();
              notify();
              draw();
            },
          },
          hid ? "Unhide" : "Hide"
        )
      )
    );
  };

  const draw = () => {
    const v = S.sheets.filter((s) => !S.hidden.includes(s.id));
    const x = S.sheets.filter((s) => S.hidden.includes(s.id));
    rc(
      box,
      h(
        "div",
        { class: "row", style: "justify-content:space-between;align-items:center" },
        h("h3", {}, "Manage sheets"),
        h("button", { class: "btn", onclick: () => m.remove() }, "Close")
      ),
      h("b", {}, `Visible (${v.length})`),
      ...(v.length ? v.map(row) : [h("div", { class: "empty" }, "No visible sheets.")]),
      h("b", {}, `Hidden (${x.length})`),
      ...(x.length ? x.map(row) : [h("div", { class: "empty" }, "No hidden sheets.")]),
      x.length
        ? h(
            "button",
            {
              class: "btn",
              onclick: () => {
                S.hidden = [];
                save();
                notify();
                draw();
              },
            },
            "Unhide all"
          )
        : null
    );
  };

  draw();
  document.body.append(m);
}
