export const $ = (id) => document.getElementById(id);

export const h = (tag, props = {}, ...children) => {
  const el = document.createElement(tag);
  for (const k in props) {
    if (k.startsWith("on")) {
      el.addEventListener(k.slice(2), props[k]);
    } else if (k === "class") {
      el.className = props[k];
    } else if (props[k] !== false) {
      el.setAttribute(k, props[k]);
    }
  }
  children.flat().forEach((child) => {
    if (child != null) {
      el.append(child.nodeType ? child : document.createTextNode(child));
    }
  });
  return el;
};

export const rc = (el, ...children) =>
  el.replaceChildren(...children.filter((x) => x != null));

export const esc = (s) =>
  s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

export const dk = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${x.getMonth() + 1}-${x.getDate()}`;
};

export function shadeHex(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (n & 255) + amount));
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

export function copyCode(code, btn) {
  const orig = btn.textContent;
  const done = (msg) => {
    btn.textContent = msg;
    setTimeout(() => {
      btn.textContent = orig;
    }, 1500);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(code).then(
      () => done("Copied!"),
      () => done("Copy failed")
    );
  } else {
    const ta = h("textarea", { style: "position:fixed;opacity:0" });
    ta.value = code;
    document.body.append(ta);
    ta.select();
    try {
      document.execCommand("copy");
      done("Copied!");
    } catch {
      done("Copy failed");
    }
    ta.remove();
  }
}
