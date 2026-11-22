import { esc } from "./dom.js";

export function md(s, imgMap = {}) {
  const inl = (x) =>
    esc(x)
      .replace(/!\[([^\]]*)\]\((img:(\w+)|https?:\/\/[^\s)]+)\)/g, (m, alt, url, id) => {
        const src = id ? imgMap[id] || "" : url;
        return `<img alt="${alt.replace(/"/g, "")}" src="${src}">`;
      })
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/\*([^*]+)\*/g, "<i>$1</i>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  let out = "";
  const lines = (s || "").split("\n");
  let i = 0;
  let list = null;

  const closeList = () => {
    if (list) {
      out += `</${list}>`;
      list = null;
    }
  };

  while (i < lines.length) {
    const l = lines[i];
    if (/^```/.test(l)) {
      closeList();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) codeLines.push(lines[i++]);
      i++;
      out += `<pre><code>${esc(codeLines.join("\n"))}</code></pre>`;
      continue;
    }

    let m;
    if ((m = l.match(/^(#{1,3})\s+(.*)/))) {
      closeList();
      const level = m[1].length + 2;
      out += `<h${level}>${inl(m[2])}</h${level}>`;
    } else if ((m = l.match(/^\s*[-*]\s+(.*)/))) {
      if (list !== "ul") {
        closeList();
        out += "<ul>";
        list = "ul";
      }
      out += `<li>${inl(m[1])}</li>`;
    } else if ((m = l.match(/^\s*\d+\.\s+(.*)/))) {
      if (list !== "ol") {
        closeList();
        out += "<ol>";
        list = "ol";
      }
      out += `<li>${inl(m[1])}</li>`;
    } else if ((m = l.match(/^>\s?(.*)/))) {
      closeList();
      out += `<blockquote>${inl(m[1])}</blockquote>`;
    } else if (!l.trim()) {
      closeList();
    } else {
      closeList();
      out += `<p>${inl(l)}</p>`;
    }
    i++;
  }

  closeList();
  return out;
}
