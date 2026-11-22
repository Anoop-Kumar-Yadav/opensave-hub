/**
 * Zero-Backend Google Login + Google Drive appDataFolder Cloud Sync.
 * Uses Google Identity Services (GIS) OAuth 2.0 Token Client.
 * Scope: https://www.googleapis.com/auth/drive.appdata (hidden app-only folder — cannot see user's other Drive files).
 */

const GIS_URL = "https://accounts.google.com/gsi/client";
const SCOPES = "https://www.googleapis.com/auth/drive.appdata openid profile email";
const BACKUP_FILENAME = "opensave-cloud-backup.json";

let gisLoadedPromise = null;
let accessToken = null;
let tokenExpiresAt = 0;

function loadGisScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadedPromise) return gisLoadedPromise;

  gisLoadedPromise = new Promise((resolve, reject) => {
    if (!navigator.onLine) {
      gisLoadedPromise = null;
      reject(new Error("You are offline. Connect to the internet to sign in with Google."));
      return;
    }
    const script = document.createElement("script");
    script.src = GIS_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gisLoadedPromise = null;
      reject(new Error("Failed to load Google Identity Services script."));
    };
    document.head.appendChild(script);
  });

  return gisLoadedPromise;
}

export function isDriveConnected() {
  return Boolean(accessToken && Date.now() < tokenExpiresAt - 30_000);
}

export function signOutGoogle() {
  if (accessToken && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    } catch {
      // Ignore revoke errors
    }
  }
  accessToken = null;
  tokenExpiresAt = 0;
}

export async function signInWithGoogle(clientId, { prompt = "consent", hint = "" } = {}) {
  const cleanId = String(clientId || "").trim();
  if (!cleanId || !cleanId.endsWith(".apps.googleusercontent.com")) {
    throw new Error("Enter a valid Google OAuth Web Client ID (*.apps.googleusercontent.com) first.");
  }

  await loadGisScript();

  const tokenResp = await new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: cleanId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) {
          reject(new Error(resp.error_description || resp.error));
          return;
        }
        resolve(resp);
      },
      error_callback: (err) => {
        reject(new Error(err?.message || "Google sign-in popup closed or blocked."));
      },
    });

    const reqOpts = { prompt };
    if (hint) reqOpts.hint = hint;
    client.requestAccessToken(reqOpts);
  });

  accessToken = tokenResp.access_token;
  tokenExpiresAt = Date.now() + Number(tokenResp.expires_in || 3600) * 1000;

  // Fetch basic user profile
  const profRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = profRes.ok ? await profRes.json() : {};

  return {
    name: profile.name || "Google User",
    email: profile.email || "",
    picture: profile.picture || "",
  };
}

async function ensureToken(clientId, emailHint = "") {
  if (isDriveConnected()) return accessToken;
  await signInWithGoogle(clientId, { prompt: "", hint: emailHint });
  return accessToken;
}

async function findBackupFileId(token) {
  const q = encodeURIComponent(`name='${BACKUP_FILENAME}' and 'appDataFolder' in parents and trashed=false`);
  const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime,size)`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive list failed (${res.status})`);
  const data = await res.json();
  return data.files && data.files.length ? data.files[0] : null;
}

/**
 * Uploads or updates opensave-cloud-backup.json inside the user's hidden Drive appDataFolder.
 */
export async function backupToGoogleDrive({ clientId, emailHint, payload }) {
  const token = await ensureToken(clientId, emailHint);
  const existing = await findBackupFileId(token);

  const jsonBody = JSON.stringify(payload);
  const boundary = "opensave_boundary_" + Date.now().toString(36);
  const metadata = existing
    ? { name: BACKUP_FILENAME, mimeType: "application/json" }
    : { name: BACKUP_FILENAME, parents: ["appDataFolder"], mimeType: "application/json" };

  const multipartBody =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${jsonBody}\r\n` +
    `--${boundary}--`;

  const uploadUrl = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=multipart&fields=id,modifiedTime,size`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime,size`;

  const res = await fetch(uploadUrl, {
    method: existing ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Drive upload failed (${res.status}) ${errText.slice(0, 120)}`);
  }

  return await res.json();
}

/**
 * Downloads opensave-cloud-backup.json from the user's hidden Drive appDataFolder.
 */
export async function restoreFromGoogleDrive({ clientId, emailHint }) {
  const token = await ensureToken(clientId, emailHint);
  const existing = await findBackupFileId(token);
  if (!existing) {
    throw new Error("No OpenSave backup found in your Google Drive appDataFolder yet.");
  }

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download failed (${res.status})`);
  const data = await res.json();
  return { file: existing, data };
}
