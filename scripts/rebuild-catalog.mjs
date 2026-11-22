#!/usr/bin/env node
/**
 * OpenSave Automated Store Builder (runs in GitHub Actions or locally).
 * 1. Unpacks any .zip submitted into ./submissions/ into ./apps/<id>/
 * 2. Validates index.html + opensave.json
 * 3. Rebuilds ./registry/catalog.json with exact offline asset lists
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const SUBMISSIONS_DIR = path.join(ROOT, "submissions");
const APPS_DIR = path.join(ROOT, "apps");
const CATALOG_PATH = path.join(ROOT, "registry", "catalog.json");

function walkFiles(dir, baseDir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name === "__MACOSX") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, baseDir));
    } else if (/\.(html|css|js|mjs|json|svg|png|jpg|jpeg|webp|woff2)$/i.test(entry.name)) {
      out.push("./" + path.relative(baseDir, full).replace(/\\/g, "/"));
    }
  }
  return out.sort();
}

function folderBytes(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    total += entry.isDirectory() ? folderBytes(full) : fs.statSync(full).size;
  }
  return total;
}

function fmtSize(bytes) {
  if (bytes < 1024 * 1024) return `~${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `~${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 1. Process any .zip files in submissions/
if (fs.existsSync(SUBMISSIONS_DIR)) {
  const zips = fs.readdirSync(SUBMISSIONS_DIR).filter((f) => f.endsWith(".zip"));
  for (const zipName of zips) {
    const zipPath = path.join(SUBMISSIONS_DIR, zipName);
    const tmpDir = path.join(ROOT, ".tmp-unpack-" + Date.now());
    fs.mkdirSync(tmpDir, { recursive: true });
    try {
      execFileSync("unzip", ["-q", zipPath, "-d", tmpDir]);
      // Handle single top-level folder inside ZIP
      const top = fs.readdirSync(tmpDir).filter((n) => n !== "__MACOSX" && !n.startsWith("."));
      const srcDir =
        top.length === 1 && fs.statSync(path.join(tmpDir, top[0])).isDirectory()
          ? path.join(tmpDir, top[0])
          : tmpDir;

      if (!fs.existsSync(path.join(srcDir, "index.html"))) {
        throw new Error(`Submission ${zipName} is missing index.html`);
      }

      const manifestPath = path.join(srcDir, "opensave.json");
      if (!fs.existsSync(manifestPath)) {
        throw new Error(`Submission ${zipName} is missing opensave.json`);
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      const appId = String(manifest.id || "").toLowerCase().replace(/[^a-z0-9-]/g, "");
      if (!appId) throw new Error(`Invalid manifest.id in ${zipName}`);

      const destDir = path.join(APPS_DIR, appId);
      fs.rmSync(destDir, { recursive: true, force: true });
      fs.cpSync(srcDir, destDir, { recursive: true });
      fs.unlinkSync(zipPath);
      console.log(`Unpacked submission ${zipName} -> apps/${appId}/`);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

// 2. Sync catalog.json with all apps in apps/ that contain opensave.json
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf-8"));
const byId = new Map(catalog.apps.map((a) => [a.id, a]));

for (const dirName of fs.readdirSync(APPS_DIR)) {
  const appDir = path.join(APPS_DIR, dirName);
  if (!fs.statSync(appDir).isDirectory()) continue;
  const manifestPath = path.join(appDir, "opensave.json");
  if (!fs.existsSync(manifestPath)) continue;

  const m = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  const id = m.id || dirName;
  const assets = walkFiles(appDir, ROOT);
  const sizeBytes = folderBytes(appDir);
  const existing = byId.get(id) || {};

  const accent = m.accent || existing.accent || "#007aff";
  byId.set(id, {
    ...existing,
    id,
    name: m.name || existing.name || id,
    tagline: m.tagline || existing.tagline || "",
    description: m.description || m.tagline || existing.description || "",
    category: m.category || existing.category || "Utilities",
    section: m.section === "tools" ? "tools" : "apps",
    version: m.version || existing.version || "1.0.0",
    developer: m.developer || existing.developer || "Community",
    sizeLabel: fmtSize(sizeBytes),
    status: "available",
    supportsOffline: true,
    url: `./apps/${dirName}/index.html`,
    accent,
    iconBg: existing.iconBg || `linear-gradient(145deg, ${accent} 0%, #5856d6 100%)`,
    tags: Array.isArray(m.tags) ? m.tags : existing.tags || ["Offline"],
    changelog: Array.isArray(m.changelog) ? m.changelog : existing.changelog || [],
    assets,
  });
}

catalog.updatedAt = new Date().toISOString().slice(0, 10);
catalog.apps = [...byId.values()];
fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2) + "\n", "utf-8");
console.log(`Updated registry/catalog.json (${catalog.apps.length} apps).`);
