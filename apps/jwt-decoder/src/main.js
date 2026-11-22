const SAMPLE_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c3Jfb3BlbnNhdmVfNDIiLCJuYW1lIjoiT3BlblNhdmUgRGV2ZWxvcGVyIiwicm9sZSI6ImJhY2tlbmRfZW5naW5lZXIiLCJpc3MiOiJodHRwczovL29wZW5zYXZlLmxvY2FsIiwiaWF0IjoxNzk1MzMzOTkzLCJleHAiOjE3OTc5MjU5OTMsInNjb3BlIjpbImFwcHM6cmVhZCIsImFwcHM6cHVibGlzaCJdfQ.wTzM25PaCwIOXZ4NPb0pOjiEW3tQmyb5LiZc5GT5_eA";
const SAMPLE_SECRET = "opensave-secret";
const STORAGE_KEY = "opensave-app-jwt-decoder-v1";

const $ = (id) => document.getElementById(id);

// Sync Light / Dark theme with OpenSave Hub shell
const applyTheme = (theme) => {
  document.documentElement.dataset.theme =
    theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
};
applyTheme(localStorage.getItem("opensave-theme"));
window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) return;
  if (event.data?.type === "OPENSAVE_THEME") {
    applyTheme(event.data.theme);
  }
});

function base64UrlToBytes(str) {
  const norm = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function decodeJsonSegment(seg, label) {
  try {
    const bytes = base64UrlToBytes(seg);
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Invalid ${label} segment (${err.message})`);
  }
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function fmtEpoch(sec) {
  if (typeof sec !== "number" || !Number.isFinite(sec)) return String(sec);
  const d = new Date(sec * 1000);
  return `${d.toLocaleString("en-IN")} (${sec})`;
}

function formatRelative(diffSec) {
  const abs = Math.abs(diffSec);
  if (abs < 60) return `${abs}s`;
  if (abs < 3600) return `${Math.round(abs / 60)}m`;
  if (abs < 86400) return `${Math.round(abs / 3600)}h`;
  return `${Math.round(abs / 86400)}d`;
}

let currentParts = null;
let currentHeader = null;

function renderClaims(payload) {
  const el = $("claimsList");
  const expBadge = $("expBadge");
  expBadge.hidden = true;

  if (!payload || typeof payload !== "object") {
    el.innerHTML = '<p class="empty">Payload is not a JSON object.</p>';
    return;
  }

  const rows = [];
  const nowSec = Math.floor(Date.now() / 1000);

  if (typeof payload.exp === "number") {
    const delta = payload.exp - nowSec;
    expBadge.hidden = false;
    if (delta > 0) {
      expBadge.className = "badge ok";
      expBadge.textContent = `Valid · expires in ${formatRelative(delta)}`;
    } else {
      expBadge.className = "badge err";
      expBadge.textContent = `Expired ${formatRelative(delta)} ago`;
    }
    rows.push(["exp (Expires)", fmtEpoch(payload.exp)]);
  }

  if (typeof payload.iat === "number") rows.push(["iat (Issued At)", fmtEpoch(payload.iat)]);
  if (typeof payload.nbf === "number") rows.push(["nbf (Not Before)", fmtEpoch(payload.nbf)]);
  if (payload.iss !== undefined) rows.push(["iss (Issuer)", String(payload.iss)]);
  if (payload.sub !== undefined) rows.push(["sub (Subject)", String(payload.sub)]);
  if (payload.aud !== undefined) rows.push(["aud (Audience)", Array.isArray(payload.aud) ? payload.aud.join(", ") : String(payload.aud)]);
  if (payload.jti !== undefined) rows.push(["jti (JWT ID)", String(payload.jti)]);

  if (!rows.length) {
    el.innerHTML = '<p class="empty">No standard registered claims (exp, iat, nbf, iss, sub, aud) present.</p>';
    return;
  }

  el.innerHTML = rows
    .map(([k, v]) => `<div class="claim-row"><span class="claim-key">${esc(k)}</span><span class="claim-val">${esc(v)}</span></div>`)
    .join("");
}

function resetVerifyBadge() {
  const vs = $("verifyStatus");
  vs.className = "verify-pill";
  vs.textContent = "Not verified";
}

function decode() {
  const raw = $("tokenInput").value.trim().replace(/^Bearer\s+/i, "");
  $("tokenMeta").textContent = `${raw.length} chars`;
  try {
    localStorage.setItem(STORAGE_KEY, raw);
  } catch {}

  const preview = $("tokenPreview");
  const statusBar = $("statusBar");
  const statusText = $("statusText");
  const algBadge = $("algBadge");

  resetVerifyBadge();

  if (!raw) {
    currentParts = null;
    currentHeader = null;
    preview.classList.remove("visible");
    preview.innerHTML = "";
    statusBar.className = "status-bar";
    statusText.textContent = "Paste a JWT to decode locally";
    algBadge.hidden = true;
    $("headerOut").textContent = "{}";
    $("payloadOut").textContent = "{}";
    $("sigOut").textContent = "—";
    $("claimsList").innerHTML = '<p class="empty">No standard time or identity claims detected yet.</p>';
    $("expBadge").hidden = true;
    return;
  }

  const parts = raw.split(".");
  if (parts.length !== 3) {
    currentParts = null;
    currentHeader = null;
    preview.classList.remove("visible");
    statusBar.className = "status-bar err";
    statusText.textContent = `Expected 3 dot-separated segments, found ${parts.length}`;
    algBadge.hidden = true;
    return;
  }

  preview.innerHTML = `<span class="seg-h">${esc(parts[0])}</span><span class="seg-dot">.</span><span class="seg-p">${esc(parts[1])}</span><span class="seg-dot">.</span><span class="seg-s">${esc(parts[2])}</span>`;
  preview.classList.add("visible");

  try {
    const header = decodeJsonSegment(parts[0], "header");
    const payload = decodeJsonSegment(parts[1], "payload");
    currentParts = parts;
    currentHeader = header;

    $("headerOut").textContent = JSON.stringify(header, null, 2);
    $("payloadOut").textContent = JSON.stringify(payload, null, 2);
    $("sigOut").textContent = parts[2] || "(empty signature)";
    renderClaims(payload);

    statusBar.className = "status-bar ok";
    statusText.textContent = "Valid JWT structure";
    if (header.alg) {
      algBadge.hidden = false;
      algBadge.className = "badge ok";
      algBadge.textContent = String(header.alg);
    } else {
      algBadge.hidden = true;
    }
  } catch (err) {
    currentParts = null;
    currentHeader = null;
    statusBar.className = "status-bar err";
    statusText.textContent = err.message;
    algBadge.hidden = true;
  }
}

const HMAC_HASH_MAP = {
  HS256: "SHA-256",
  HS384: "SHA-384",
  HS512: "SHA-512",
};

async function verifySignature() {
  const vs = $("verifyStatus");
  if (!currentParts || !currentHeader) {
    vs.className = "verify-pill warn";
    vs.textContent = "Decode a valid JWT first";
    return;
  }
  const alg = String(currentHeader.alg || "").toUpperCase();
  const hashAlg = HMAC_HASH_MAP[alg];
  if (!hashAlg) {
    vs.className = "verify-pill warn";
    vs.textContent = `Only HS256/384/512 supported offline (got ${alg || "none"})`;
    return;
  }
  if (!window.crypto?.subtle) {
    vs.className = "verify-pill err";
    vs.textContent = "Web Crypto requires HTTPS or localhost";
    return;
  }

  const secret = $("secretInput").value;
  if (!secret) {
    vs.className = "verify-pill warn";
    vs.textContent = "Enter a secret key";
    return;
  }

  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: { name: hashAlg } },
      false,
      ["verify"]
    );
    const sigBytes = base64UrlToBytes(currentParts[2]);
    const dataBytes = enc.encode(`${currentParts[0]}.${currentParts[1]}`);
    const valid = await crypto.subtle.verify("HMAC", key, sigBytes, dataBytes);
    vs.className = valid ? "verify-pill ok" : "verify-pill err";
    vs.textContent = valid ? `Signature Verified (${alg})` : "Invalid Signature";
  } catch (err) {
    vs.className = "verify-pill err";
    vs.textContent = "Verification failed";
  }
}

function wireCopy(btnId, sourceId) {
  const btn = $(btnId);
  btn.addEventListener("click", () => {
    const text = $(sourceId).textContent;
    if (!text || text === "—") return;
    navigator.clipboard?.writeText(text).then(() => {
      const prev = btn.textContent;
      btn.textContent = "Copied";
      setTimeout(() => (btn.textContent = prev), 1200);
    });
  });
}

$("tokenInput").addEventListener("input", decode);
$("verifyBtn").addEventListener("click", verifySignature);
$("secretInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") verifySignature();
});

$("sampleBtn").addEventListener("click", () => {
  $("tokenInput").value = SAMPLE_JWT;
  $("secretInput").value = SAMPLE_SECRET;
  decode();
  verifySignature();
});

$("clearBtn").addEventListener("click", () => {
  $("tokenInput").value = "";
  $("secretInput").value = "";
  decode();
});

wireCopy("copyHeaderBtn", "headerOut");
wireCopy("copyPayloadBtn", "payloadOut");
wireCopy("copySigBtn", "sigOut");

// Restore last token if present
const saved = localStorage.getItem(STORAGE_KEY);
if (saved) {
  $("tokenInput").value = saved;
}
decode();
