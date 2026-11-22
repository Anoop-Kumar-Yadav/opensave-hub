export const BLOCK_CATALOG = [
  {
    type: "header",
    label: "Title & Meta",
    desc: "Article title and topic/sheet subtitle",
    defaultBlock: (kind) => ({
      id: uid(),
      type: "header",
      label: "Title & Meta",
      enabled: true,
      heading: "",
      cond: "",
      body: kind === "li" ? "# {{title}}\n\n🚀 {{title}}: {{hook}}" : "# {{title}}\n\n*{{topic}} · {{sheet}}*",
    }),
  },
  {
    type: "tldr",
    label: "TL;DR Summary",
    desc: "One-line optimal approach highlight",
    defaultBlock: () => ({
      id: uid(),
      type: "tldr",
      label: "TL;DR Summary",
      enabled: true,
      heading: "",
      cond: "tldr",
      body: "> **TL;DR:** {{tldr}}",
    }),
  },
  {
    type: "problem",
    label: "Problem Statement",
    desc: "Main problem description",
    defaultBlock: (kind) => ({
      id: uid(),
      type: "problem",
      label: "Problem Statement",
      enabled: true,
      heading: kind === "li" ? "## 🧩 Problem Statement" : "## Problem Statement",
      cond: "problem",
      body: "{{problem}}",
    }),
  },
  {
    type: "examples",
    label: "Examples Loop",
    desc: "Repeats for each input/output example",
    defaultBlock: (kind) => ({
      id: uid(),
      type: "examples",
      label: "Examples Loop",
      enabled: true,
      heading: kind === "li" ? "## 🧪 Examples" : "## Examples",
      cond: "examples_count",
      body:
        "{{#examples}}**Example {{n}}**\n\n{{#if e_input}}Input:\n```\n{{e_input}}\n```\n\n{{/if}}{{#if e_output}}Output:\n```\n{{e_output}}\n```\n\n{{/if}}{{#if e_explain}}**Explanation:** {{e_explain}}\n\n{{/if}}{{/examples}}",
    }),
  },
  {
    type: "constraints",
    label: "Constraints",
    desc: "Input limits and bounds",
    defaultBlock: (kind) => ({
      id: uid(),
      type: "constraints",
      label: "Constraints",
      enabled: true,
      heading: kind === "li" ? "## 📏 Constraints" : "## Constraints",
      cond: "constraints",
      body: "{{constraints}}",
    }),
  },
  {
    type: "approaches",
    label: "Approaches Loop",
    desc: "Repeats for each solution approach & code",
    defaultBlock: (kind) => ({
      id: uid(),
      type: "approaches",
      label: "Approaches Loop",
      enabled: true,
      heading: kind === "li" ? "## 💡 Approaches" : "## Approaches",
      cond: "approaches_count",
      body:
        kind === "li"
          ? "{{#approaches}}### {{n}}. {{a_title}}\n\n{{#if a_time}}⏱ Time: {{a_time}}\n{{/if}}{{#if a_space}}💾 Space: {{a_space}}\n{{/if}}\n{{#if a_note}}{{a_note}}\n\n{{/if}}```{{a_lang}}\n{{a_code}}\n```\n\n{{#if a_explain}}🎤 **How I'd explain it in an interview**\n\n{{a_explain}}\n\n{{/if}}{{/approaches}}"
          : "{{#approaches}}### {{n}}. {{a_title}}\n\n{{#if a_time}}- **Time:** {{a_time}}\n{{/if}}{{#if a_space}}- **Space:** {{a_space}}\n{{/if}}\n{{#if a_note}}{{a_note}}\n\n{{/if}}```{{a_lang}}\n{{a_code}}\n```\n\n{{#if a_explain}}**How I'd explain it in an interview**\n\n{{a_explain}}\n\n{{/if}}{{/approaches}}",
    }),
  },
  {
    type: "comparison",
    label: "Complexity Comparison",
    desc: "Table (Medium) or bullets (LinkedIn)",
    defaultBlock: (kind) => ({
      id: uid(),
      type: "comparison",
      label: "Complexity Comparison",
      enabled: true,
      heading: kind === "li" ? "## 📊 Comparison" : "## Complexity Comparison",
      cond: "has_many",
      body: "{{comparison}}",
    }),
  },
  {
    type: "cta",
    label: "Custom / CTA",
    desc: "Custom markdown, takeaway, or call to action",
    defaultBlock: (kind) => ({
      id: uid(),
      type: "cta",
      label: "Custom / CTA",
      enabled: true,
      heading: "",
      cond: "",
      body:
        kind === "li"
          ? "🔁 Which approach would you pick? Share your thoughts in the comments!"
          : "Thanks for reading! If this helped you build intuition, consider bookmarking it for revision.",
    }),
  },
  {
    type: "tags",
    label: "Tags / Hashtags",
    desc: "Auto-filled topic & pattern tags",
    defaultBlock: (kind) => ({
      id: uid(),
      type: "tags",
      label: "Tags / Hashtags",
      enabled: true,
      heading: "",
      cond: "",
      body: kind === "li" ? "{{hashtags}}" : "---\n*Tags: {{tags}}*",
    }),
  },
  {
    type: "divider",
    label: "Divider",
    desc: "Horizontal rule separator",
    defaultBlock: () => ({
      id: uid(),
      type: "divider",
      label: "Divider",
      enabled: true,
      heading: "",
      cond: "",
      body: "---",
    }),
  },
];

export const CONDITION_OPTIONS = [
  ["", "Always show"],
  ["tldr", "If TL;DR exists"],
  ["problem", "If Problem Statement exists"],
  ["examples_count", "If Examples exist"],
  ["constraints", "If Constraints exist"],
  ["approaches_count", "If Approaches exist"],
  ["has_many", "If > 1 Approach"],
];

function uid() {
  return "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function createBlock(type, kind = "medium") {
  const entry = BLOCK_CATALOG.find((b) => b.type === type) || BLOCK_CATALOG[7];
  return entry.defaultBlock(kind);
}

export function defaultBlocks(kind = "medium") {
  const order =
    kind === "li"
      ? ["header", "problem", "examples", "constraints", "approaches", "comparison", "cta", "tags"]
      : ["header", "tldr", "problem", "examples", "constraints", "approaches", "comparison", "tags"];
  return order.map((type) => createBlock(type, kind));
}

export function compileBlocks(blocks) {
  return (blocks || [])
    .filter((b) => b.enabled !== false)
    .map((b) => {
      const parts = [];
      if (b.heading && b.heading.trim()) parts.push(b.heading.trim());
      if (b.body && b.body.trim()) parts.push(b.body.trim());
      const inner = parts.join("\n\n");
      if (!inner) return "";
      if (b.cond && b.cond.trim()) {
        return `{{#if ${b.cond.trim()}}}${inner}\n\n{{/if}}`;
      }
      return inner;
    })
    .filter(Boolean)
    .join("\n\n") + "\n";
}
