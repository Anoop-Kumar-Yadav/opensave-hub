import { LANG_MAP, REV_DAYS } from "../data/sheets.js";
import { S, save, all, cnt, navigate } from "../state/store.js";
import { h, esc, pct, dk } from "../utils/dom.js";
import { revInfo, toggleRev, fmtShort } from "../domain/revision.js";

export const Meter = (p) => h("div", { class: "meter" }, h("div", { style: `width:${p}%` }));

export function Ring(p, size = 64) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const s = h("span");
  s.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--acc)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${(c * p) / 100} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" fill="var(--ink)" font-size="${size / 4.5}" font-weight="600">${p}%</text></svg>`;
  return s;
}

export const Stat = (v, l) => h("div", { class: "card stat" }, h("b", {}, v), h("span", {}, l));

export function Activity() {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  const counts = days.map((d) => Object.values(S.done).filter((t) => dk(t) === dk(d)).length);
  const max = Math.max(1, ...counts);
  return h(
    "div",
    { class: "card" },
    h(
      "div",
      { class: "chart" },
      days.map((d, i) =>
        h(
          "div",
          { title: `${counts[i]} solved` },
          counts[i] || "",
          h("em", { style: `height:${(counts[i] / max) * 80}%` }),
          d.getDate()
        )
      )
    )
  );
}

export function streak() {
  let n = 0;
  const d = new Date();
  if (!Object.values(S.done).some((t) => dk(t) === dk(d))) d.setDate(d.getDate() - 1);
  while (Object.values(S.done).some((t) => dk(t) === dk(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function SheetCard(s) {
  const q = all(s);
  const d = cnt(q);
  const p = pct(d, q.length);
  return h(
    "div",
    { class: "card sc", onclick: () => navigate(s.id) },
    Ring(p),
    h(
      "div",
      { style: "flex:1" },
      h("h3", {}, s.name),
      h("small", {}, `${d} / ${q.length} · ${s.topics.length} topics`),
      Meter(p)
    )
  );
}

export function RevDots(qid) {
  const info = revInfo(qid);
  return h(
    "div",
    { class: "rev-dots", role: "group", "aria-label": "1, 3, 7 day revision checkpoints" },
    info.stages.map((st, i) => {
      const tip = st.locked
        ? `Complete Day ${REV_DAYS[i - 1]} revision first`
        : st.done
        ? `Day ${st.day} revision completed (${fmtShort(st.ts)}) — click to undo`
        : `Day ${st.day} revision (${
            st.delta < 0
              ? `overdue by ${-st.delta}d`
              : st.delta === 0
              ? "due today"
              : `in ${st.delta}d`
          }) — click to mark done`;
      return h(
        "button",
        {
          class: `rev-dot ${st.state}`,
          type: "button",
          disabled: st.locked ? "disabled" : false,
          title: tip,
          "aria-pressed": String(st.done),
          onclick: (e) => {
            e.stopPropagation();
            if (!st.locked) toggleRev(qid, i);
          },
        },
        String(st.day)
      );
    })
  );
}

export function Code(a) {
  const pre = h("pre", {});
  const c = h("code", { class: "hljs" });
  let rendered;
  try {
    rendered = window.hljs
      ? LANG_MAP[a.lang]
        ? window.hljs.highlight(a.code, { language: LANG_MAP[a.lang] }).value
        : window.hljs.highlightAuto(a.code).value
      : esc(a.code);
  } catch {
    rendered = esc(a.code);
  }
  c.innerHTML = rendered;
  pre.append(c);
  return pre;
}

export function CxPick(list, val, label) {
  const sel = h(
    "select",
    {},
    h("option", { value: "" }, `${label}: not set`),
    ...list.map((x) => h("option", { value: x, selected: val === x }, x)),
    h("option", { value: "__c" }, "Custom…")
  );
  const inp = h("input", { placeholder: "Custom, e.g. O(n log k)", style: "display:none" });
  if (val && !list.includes(val)) {
    sel.value = "__c";
    inp.value = val;
    inp.style.display = "";
  }
  sel.onchange = () => {
    inp.style.display = sel.value === "__c" ? "" : "none";
  };
  const w = h("div", { class: "cx" }, sel, inp);
  w.get = () => (sel.value === "__c" ? inp.value.trim() : sel.value);
  return w;
}

export function CodeEditor(val, lsel) {
  const w = h("div", { class: "ce" });
  const pre = h("pre", { "aria-hidden": "true" });
  const code = h("code", { class: "hljs" });
  const ta = h("textarea", {
    spellcheck: "false",
    wrap: "off",
    placeholder: "Paste code here…",
  });
  pre.append(code);
  ta.value = val || "";

  const sy = () => {
    pre.scrollTop = ta.scrollTop;
    pre.scrollLeft = ta.scrollLeft;
  };
  const hl = () => {
    const v = ta.value;
    const lg = LANG_MAP[lsel.value];
    let rendered;
    try {
      rendered = window.hljs
        ? lg
          ? window.hljs.highlight(v, { language: lg }).value
          : window.hljs.highlightAuto(v).value
        : esc(v);
    } catch {
      rendered = esc(v);
    }
    code.innerHTML = rendered + "\n";
    sy();
  };

  ta.addEventListener("input", hl);
  ta.addEventListener("scroll", sy);
  lsel.addEventListener("change", hl);
  ta.addEventListener("keydown", (e) => {
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      ta.setRangeText("  ", ta.selectionStart, ta.selectionEnd, "end");
      hl();
    }
  });

  w.append(pre, ta);
  hl();
  w.ta = ta;
  return w;
}

export function GlowSettings() {
  const g = (S.gl = S.gl || { mode: "rel", int: 70 });
  const lab = (t, c) => h("label", { class: "cx" }, h("small", { style: "color:var(--mut)" }, t), c);
  const sel = h(
    "select",
    {
      onchange: (e) => {
        g.mode = e.target.value;
        save();
      },
    },
    [
      ["rel", "Relative: among a problem's approaches"],
      ["abs", "Absolute: by complexity class"],
      ["off", "Off"],
    ].map(([v, l]) => h("option", { value: v, selected: g.mode === v }, l))
  );
  const out = h("b", {}, `${g.int}%`);
  const range = h("input", {
    type: "range",
    min: 0,
    max: 100,
    step: 5,
    value: g.int,
    oninput: (e) => {
      g.int = +e.target.value;
      out.textContent = `${g.int}%`;
      save();
    },
  });

  return h(
    "div",
    {},
    h("div", { class: "sec" }, h("h2", {}, "Approach glow")),
    h(
      "div",
      { class: "card two" },
      lab("Glow levels", sel),
      lab("Intensity", h("div", { class: "aph" }, range, out)),
      h(
        "div",
        { class: "cx" },
        h("small", { style: "color:var(--mut)" }, "Slowest → fastest"),
        h("div", {
          style:
            "height:14px;border-radius:7px;background:linear-gradient(90deg,hsl(0 85% 50%),hsl(55 85% 46%),hsl(130 85% 46%))",
        })
      )
    )
  );
}
