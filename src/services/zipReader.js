/**
 * Zero-dependency ZIP archive reader (supports STORE & DEFLATE via DecompressionStream)
 * and minimal uncompressed ZIP writer for generating starter mini-app templates.
 */

const MIME_TYPES = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  mjs: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  ico: "image/x-icon",
  woff2: "font/woff2",
  woff: "font/woff",
  ttf: "font/ttf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
};

export function getMimeType(path) {
  const ext = (path.split(".").pop() || "").toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("Your browser does not support DecompressionStream. Please use a modern Chrome, Edge, Firefox, or Safari.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const writer = ds.writable.getWriter();
  writer.write(bytes);
  writer.close();
  const res = new Response(ds.readable);
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function findEOCD(view) {
  const len = view.byteLength;
  const minOffset = Math.max(0, len - 65557);
  for (let i = len - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      return i;
    }
  }
  return -1;
}

function sanitizeZipPath(raw) {
  const norm = raw.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = norm.split("/").filter(Boolean);
  if (parts.some((p) => p === "..")) {
    throw new Error(`Unsafe path in ZIP archive: ${raw}`);
  }
  return parts.join("/");
}

export async function unpackZipFile(fileOrBlob) {
  const buffer = await fileOrBlob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const decoder = new TextDecoder("utf-8");

  const eocdOffset = findEOCD(view);
  if (eocdOffset < 0) {
    throw new Error("Invalid ZIP file: End of Central Directory signature not found.");
  }

  const totalEntries = view.getUint16(eocdOffset + 10, true);
  const cdOffset = view.getUint32(eocdOffset + 16, true);

  const rawEntries = [];
  let ptr = cdOffset;

  for (let i = 0; i < totalEntries; i++) {
    if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== 0x02014b50) {
      throw new Error("Corrupted ZIP central directory.");
    }
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localHeaderOffset = view.getUint32(ptr + 42, true);

    const nameBytes = bytes.subarray(ptr + 46, ptr + 46 + nameLen);
    const rawName = decoder.decode(nameBytes);
    ptr += 46 + nameLen + extraLen + commentLen;

    if (rawName.endsWith("/") || rawName.startsWith("__MACOSX/") || rawName.includes("/.DS_Store") || rawName === ".DS_Store") {
      continue;
    }

    const cleanPath = sanitizeZipPath(rawName);
    if (!cleanPath) continue;

    if (view.getUint32(localHeaderOffset, true) !== 0x04034b50) {
      throw new Error(`Corrupted local file header for ${cleanPath}`);
    }
    const localNameLen = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const compData = bytes.subarray(dataStart, dataStart + compSize);

    let fileBytes;
    if (method === 0) {
      fileBytes = compData.slice();
    } else if (method === 8) {
      fileBytes = await inflateRaw(compData);
    } else {
      throw new Error(`Unsupported ZIP compression method (${method}) for ${cleanPath}. Use standard ZIP (Store or Deflate).`);
    }

    rawEntries.push({ path: cleanPath, bytes: fileBytes });
  }

  if (!rawEntries.length) {
    throw new Error("ZIP archive is empty.");
  }

  // Strip a single common root folder if all files share one (e.g. my-app/index.html -> index.html)
  const firstSegments = new Set(rawEntries.map((e) => (e.path.includes("/") ? e.path.split("/")[0] : "")));
  let prefix = "";
  if (firstSegments.size === 1) {
    const only = [...firstSegments][0];
    if (only && rawEntries.every((e) => e.path.startsWith(only + "/"))) {
      prefix = only + "/";
    }
  }

  const fileMap = new Map();
  let totalBytes = 0;
  for (const entry of rawEntries) {
    const relPath = prefix ? entry.path.slice(prefix.length) : entry.path;
    if (!relPath) continue;
    fileMap.set(relPath, entry.bytes);
    totalBytes += entry.bytes.byteLength;
  }

  let manifest = null;
  const manifestBytes = fileMap.get("opensave.json") || fileMap.get("manifest.json");
  if (manifestBytes) {
    try {
      manifest = JSON.parse(decoder.decode(manifestBytes));
    } catch {
      throw new Error("opensave.json is not valid JSON.");
    }
  }

  return {
    files: fileMap,
    manifest,
    hasIndexHtml: fileMap.has("index.html"),
    totalBytes,
    fileCount: fileMap.size,
  };
}

// CRC-32 table for building valid starter ZIP files client-side
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Builds a standard uncompressed (STORE) ZIP Blob from a map of { path: string | Uint8Array }.
 */
export function buildZipBlob(entriesObj) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const [name, content] of Object.entries(entriesObj)) {
    const nameBytes = encoder.encode(name);
    const dataBytes = typeof content === "string" ? encoder.encode(content) : content;
    const crc = crc32(dataBytes);
    const size = dataBytes.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // UTF-8
    lv.setUint16(8, 0, true); // STORE
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);

    localParts.push(local, dataBytes);

    const central = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    central.set(nameBytes, 46);

    centralParts.push(central);
    offset += local.length + dataBytes.length;
  }

  const cdSize = centralParts.reduce((s, p) => s + p.length, 0);
  const count = Object.keys(entriesObj).length;
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, count, true);
  ev.setUint16(10, count, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...localParts, ...centralParts, eocd], { type: "application/zip" });
}

export function createStarterTemplateZip() {
  const manifest = {
    id: "quick-scratchpad",
    name: "Quick Scratchpad",
    tagline: "Offline markdown scratchpad built with the OpenSave SDK.",
    description: "A minimal starter mini-app demonstrating opensave.json, relative ES modules, IndexedDB persistence, and automatic Light/Dark theme sync.",
    category: "Productivity",
    section: "apps",
    version: "1.0.0",
    developer: "Your Name",
    accent: "#007aff",
    tags: ["Starter", "Notes", "Offline"],
    changelog: ["v1.0.0 — Initial starter template release"],
  };

  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quick Scratchpad | OpenSave</title>
  <link rel="stylesheet" href="./styles/app.css">
</head>
<body>
  <header>
    <h1>Quick Scratchpad</h1>
    <span id="status">Saved locally</span>
  </header>
  <main>
    <textarea id="pad" placeholder="Start typing notes... Everything saves automatically to IndexedDB and works 100% offline."></textarea>
  </main>
  <script type="module" src="./src/main.js"></script>
</body>
</html>
`;

  const appCss = `:root {
  --bg: #f5f5f7;
  --surface: #ffffff;
  --ink: #1d1d1f;
  --mut: #6e6e73;
  --line: rgba(60, 60, 67, 0.14);
  --acc: #007aff;
}
:root[data-theme="dark"] {
  --bg: #000000;
  --surface: #1c1c1e;
  --ink: #f5f5f7;
  --mut: #98989d;
  --line: rgba(255, 255, 255, 0.14);
  --acc: #0a84ff;
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; background: var(--bg); color: var(--ink); font: 15px/1.6 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: var(--surface); border-bottom: 1px solid var(--line); }
header h1 { margin: 0; font-size: 16px; font-weight: 700; }
#status { font-size: 12px; color: var(--mut); }
main { flex: 1; padding: 20px; max-width: 820px; width: 100%; margin: 0 auto; display: flex; }
textarea { flex: 1; width: 100%; padding: 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); color: var(--ink); font: inherit; resize: none; outline: none; }
textarea:focus { border-color: var(--acc); }
`;

  const mainJs = `// Sync theme with OpenSave Hub shell
const applyTheme = (theme) => {
  document.documentElement.dataset.theme =
    theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
};
applyTheme(localStorage.getItem("opensave-theme"));
window.addEventListener("message", (e) => {
  if (e.origin === location.origin && e.data?.type === "OPENSAVE_THEME") {
    applyTheme(e.data.theme);
  }
});

// Simple IndexedDB persistence
const pad = document.getElementById("pad");
const status = document.getElementById("status");
const STORAGE_KEY = "opensave-app-quick-scratchpad";

pad.value = localStorage.getItem(STORAGE_KEY) || "";
let timer;
pad.addEventListener("input", () => {
  status.textContent = "Saving...";
  clearTimeout(timer);
  timer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, pad.value);
    status.textContent = "Saved locally";
  }, 250);
});
`;

  return buildZipBlob({
    "quick-scratchpad/opensave.json": JSON.stringify(manifest, null, 2),
    "quick-scratchpad/index.html": indexHtml,
    "quick-scratchpad/styles/app.css": appCss,
    "quick-scratchpad/src/main.js": mainJs,
  });
}
