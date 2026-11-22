import { LANG_MAP } from "../data/sheets.js";
import { S } from "../state/store.js";
import { cxScore } from "../utils/complexity.js";
import { h } from "../utils/dom.js";
import { qTags } from "./patterns.js";

export const DEFAULT_TEMPLATES = {
  medium:
    "# {{title}}\n\n*{{topic}} · {{sheet}}*\n\n{{#if tldr}}> **TL;DR:** {{tldr}}\n\n{{/if}}{{#if problem}}## Problem Statement\n\n{{problem}}\n\n{{/if}}{{#if examples_count}}## Examples\n\n{{#examples}}**Example {{n}}**\n\n{{#if e_input}}Input:\n```\n{{e_input}}\n```\n\n{{/if}}{{#if e_output}}Output:\n```\n{{e_output}}\n```\n\n{{/if}}{{#if e_explain}}**Explanation:** {{e_explain}}\n\n{{/if}}{{/examples}}{{/if}}{{#if constraints}}## Constraints\n\n{{constraints}}\n\n{{/if}}{{#if approaches_count}}## Approaches\n\n{{#approaches}}### {{n}}. {{a_title}}\n\n{{#if a_time}}- **Time:** {{a_time}}\n{{/if}}{{#if a_space}}- **Space:** {{a_space}}\n{{/if}}\n{{#if a_note}}{{a_note}}\n\n{{/if}}```{{a_lang}}\n{{a_code}}\n```\n\n{{#if a_explain}}**How I'd explain it in an interview**\n\n{{a_explain}}\n\n{{/if}}{{/approaches}}{{/if}}{{#if has_many}}## Complexity Comparison\n\n{{comparison}}\n\n{{/if}}---\n*Tags: {{tags}}*\n",
  li:
    "# {{title}}\n\n🚀 {{title}}: {{hook}}\n\n{{#if problem}}## 🧩 Problem Statement\n\n{{problem}}\n\n{{/if}}{{#if examples_count}}## 🧪 Examples\n\n{{#examples}}**Example {{n}}**\n\n{{#if e_input}}Input:\n```\n{{e_input}}\n```\n\n{{/if}}{{#if e_output}}Output:\n```\n{{e_output}}\n```\n\n{{/if}}{{#if e_explain}}**Explanation:** {{e_explain}}\n\n{{/if}}{{/examples}}{{/if}}{{#if constraints}}## 📏 Constraints\n\n{{constraints}}\n\n{{/if}}{{#if approaches_count}}## 💡 Approaches\n\n{{#approaches}}### {{n}}. {{a_title}}\n\n{{#if a_time}}⏱ Time: {{a_time}}\n{{/if}}{{#if a_space}}💾 Space: {{a_space}}\n{{/if}}\n{{#if a_note}}{{a_note}}\n\n{{/if}}```{{a_lang}}\n{{a_code}}\n```\n\n{{#if a_explain}}🎤 **How I'd explain it in an interview**\n\n{{a_explain}}\n\n{{/if}}{{/approaches}}{{/if}}{{#if has_many}}## 📊 Comparison\n\n{{comparison}}\n\n{{/if}}🔁 Which approach would you pick? Share your thoughts in the comments!\n\n{{hashtags}}\n",
};

export function blog(q, kind, tpl) {
  const li = kind === "li";
  const imgs = [];
  let T = "";
  let Sh = "";
  S.sheets.forEach((s) =>
    s.topics.forEach((t) => {
      if (t.qs.includes(q)) {
        T = t.n;
        Sh = s.name;
      }
    })
  );

  tpl = tpl != null ? tpl : (S.tpl && S.tpl[kind]) || DEFAULT_TEMPLATES[kind];

  const fx = (t) =>
    (t || "").trim().replace(/!\[([^\]]*)\]\(img:(\w+)\)/g, (m, al, id) => {
      const d = (q.imgm || {})[id];
      if (!d) return "";
      imgs.push(d);
      const n = imgs.length;
      return li ? `🖼 [Insert image-${n}.jpg here]` : `![${al || "Image " + n}](image-${n}.jpg)`;
    });

  const ap = q.ap || [];
  const ex = q.ex || [];
  const best = ap
    .filter((a) => a.time)
    .sort((x, y) => cxScore(x.time) - cxScore(y.time))[0];
  const tg = T.replace(/[^A-Za-z0-9]/g, "");
  const n2 = (x) => (x || "–").replace(/\|/g, "\\|");

  const V = {
    title: q.t,
    topic: T,
    sheet: Sh,
    date: new Date().toISOString().slice(0, 10),
    count: ap.length,
    approaches_count: ap.length || "",
    examples_count: ex.length || "",
    has_many: ap.length > 1 ? "1" : "",
    best_title: best ? best.title : "",
    best_time: best ? best.time : "",
    best_space: (best && best.space) || "",
    tldr: best
      ? `The best approach here is ${best.title} — Time ${best.time}${
          best.space ? ", Space " + best.space : ""
        }.`
      : "",
    hook: `${ap.length} approach${ap.length === 1 ? "" : "es"}${
      best ? ", best in " + best.time + " time." : "."
    }`,
    tags: ["DSA", T, ...qTags(q), "Algorithms", "Interview Prep"]
      .filter(Boolean)
      .join(", "),
    hashtags: `#DSA ${tg ? "#" + tg + " " : ""}#CodingInterview #Algorithms #ProblemSolving`,
    comparison: li
      ? ap.map((a) => `- ${a.title} → Time ${a.time || "–"}, Space ${a.space || "–"}`).join("\n")
      : "| Approach | Time | Space |\n|---|---|---|\n" +
        ap.map((a) => `| ${n2(a.title)} | ${n2(a.time)} | ${n2(a.space)} |`).join("\n"),
  };
  V.problem = fx(q.ps);
  V.constraints = fx(q.cons);

  const items = {
    examples: ex.map((e, i) => ({
      n: i + 1,
      e_input: e.inp,
      e_output: e.out,
      e_explain: fx(e.exp),
    })),
    approaches: ap.map((a, i) => ({
      n: i + 1,
      a_title: a.title,
      a_time: a.time,
      a_space: a.space,
      a_lang: LANG_MAP[a.lang] || "",
      a_lang_name: a.lang,
      a_code: a.code,
      a_note: fx(a.note),
      a_explain: fx(a.exp),
    })),
  };

  const fill = (t, v) =>
    t
      .replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, k, b) =>
        String(v[k] == null ? "" : v[k]).trim() ? b : ""
      )
      .replace(/\{\{(\w+)\}\}/g, (m, k) =>
        k in v ? String(v[k] == null ? "" : v[k]).replace(/\{\{/g, "\u0001") : m
      );

  let out = tpl.replace(
    /\{\{#(approaches|examples)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (m, k, inner) => items[k].map((it) => fill(inner, Object.assign({}, V, it))).join("")
  );
  out = fill(out, V)
    .split("```")
    .map((p, i) => (i % 2 ? p : p.replace(/\n{3,}/g, "\n\n")))
    .join("```")
    .replace(/\u0001/g, "{{");

  return { md: out.trim() + "\n", imgs };
}

export function aiPrompt(kind, style, cur) {
  const li = kind === "li";
  const L = [
    "ROLE: You are an expert technical blog writer and template designer.",
    "",
    "TASK: Design a reusable %KIND% TEMPLATE for a DSA (data structures and algorithms) problem write-up. My app fills the template with the data of one problem and exports a markdown (.md) file. Do NOT write an actual article. Write the TEMPLATE, using placeholders for all data.",
    "",
    "STRICT RULES OF MY APP",
    "1. Placeholders use double curly braces and are case-sensitive, for example {{title}}. The app replaces them with real data. Unknown placeholders are printed as they are, so use ONLY the names listed below.",
    "2. Loops: {{#examples}} ... {{/examples}} repeats its content once per example, and {{#approaches}} ... {{/approaches}} once per approach. Item placeholders work ONLY inside their own loop. Loops cannot be nested inside each other.",
    "3. Conditions: {{#if NAME}} ... {{/if}} keeps the content only when NAME is not empty. Use it around optional parts together with their headings so empty sections disappear. There is no else. An {{#if}} must not contain another {{#if}}, but an {{#if}} may contain a loop and a loop may contain {{#if}} blocks.",
    "4. Values are already markdown. {{problem}}, {{constraints}}, {{a_note}}, {{a_explain}} and {{e_explain}} may contain lists, bold text, code and images (images appear as image-N.jpg references). Do not wrap them in quotes or code fences. DO put {{a_code}}, {{e_input}} and {{e_output}} inside fenced code blocks, and use {{a_lang}} after the opening fence of the approach code.",
    "5. Never invent data or hardcode anything specific to one problem. Static text must be generic (headings, transitions, calls to action).",
    "6. The app collapses 3 or more blank lines into one outside code blocks, so spacing does not need to be perfect.",
    "",
    "AVAILABLE DATA",
    "Global: {{title}} problem name | {{topic}} topic like Arrays | {{sheet}} sheet name | {{date}} export date | {{count}} number of approaches | {{tldr}} one sentence about the best approach (may be empty) | {{hook}} short summary like '3 approaches, best in O(n) time.' | {{best_title}} {{best_time}} {{best_space}} best approach details | {{problem}} problem statement | {{constraints}} constraints | {{comparison}} ready-made comparison of approaches (a table in Medium, bullets in LinkedIn) | {{tags}} comma separated tags | {{hashtags}} hashtags line.",
    "Inside {{#examples}}: {{n}} number | {{e_input}} | {{e_output}} | {{e_explain}} (optional).",
    "Inside {{#approaches}}: {{n}} number | {{a_title}} | {{a_time}} time complexity (optional) | {{a_space}} space complexity (optional) | {{a_lang}} code fence language | {{a_lang_name}} display name | {{a_code}} | {{a_note}} (optional) | {{a_explain}} interview explanation (optional).",
    "Flags for conditions: examples_count, approaches_count, has_many (more than one approach), plus any placeholder above.",
    "",
    "%PLAT%",
    "",
  ];
  const P = li
    ? "PLATFORM NOTES (LinkedIn newsletter): markdown is NOT rendered and tables are not supported, so use short paragraphs, emoji section markers, simple bullets and hashtags at the end. Code blocks are pasted as plain text. Start with a strong hook and end with a question or call to action."
    : "PLATFORM NOTES (Medium): markdown headings, bold, quotes, tables and fenced code blocks are all fine. Aim for a readable, story-like technical post with a clear intro, problem, examples, step by step approaches from brute force to optimal, a comparison and a short conclusion.";

  return L.map((x) =>
    x
      .replace("%KIND%", li ? "LinkedIn newsletter article" : "Medium blog post")
      .replace("%PLAT%", P)
  )
    .concat([
      "MY STYLE REQUEST: " +
        ((style || "").trim() ||
          "Engaging, beginner friendly and well structured, with a short intro and a closing call to action."),
      "",
      "CURRENT TEMPLATE (for reference; restyle or improve it, keeping the rules above):",
      "````",
      cur,
      "````",
      "",
      "OUTPUT FORMAT: Reply with ONLY the finished template inside ONE code block fenced with four backticks (````), with no explanation before or after, so I can copy and paste it directly. Before answering, double-check that every {{#...}} has a matching {{/...}} and that only the listed placeholders are used.",
    ])
    .join("\n");
}

export function dlBlog(q, kind) {
  const r = blog(q, kind);
  const slug =
    q.t
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "problem";
  const dl = (href, name, delay) =>
    setTimeout(() => {
      const a = h("a", { href, download: name });
      document.body.append(a);
      a.click();
      a.remove();
    }, delay);

  dl(
    URL.createObjectURL(new Blob([r.md], { type: "text/markdown" })),
    `${slug}-${kind === "li" ? "linkedin" : "medium"}.md`,
    0
  );
  r.imgs.forEach((d, i) => dl(d, `image-${i + 1}.jpg`, 400 * (i + 1)));
}
