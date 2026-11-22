/**
 * Detailed Developer Documentation Page for building, sideloading (.zip),
 * and publishing OpenSave mini-apps.
 */

export function renderDocsView(headerHtml) {
  const manifestExample = `{
  "id": "regex-lab",
  "name": "Regex Lab",
  "tagline": "Offline regular expression tester with live match groups.",
  "description": "Test JS and Java regex patterns 100% offline with saved snippets.",
  "category": "Dev Tools",
  "section": "tools",
  "version": "1.0.0",
  "developer": "Your Name",
  "accent": "#007aff",
  "tags": ["Regex", "Testing", "Offline"],
  "changelog": [
    "v1.0.0 — Initial release with live match highlighting"
  ]
}`;

  const themeSyncSnippet = `// Sync Light / Dark theme with the OpenSave Hub shell
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
});`;

  const publishContractSnippet = `// Backend Endpoint Contract (Node.js / Express + Multer)
// POST /api/v1/apps/publish
// Content-Type: multipart/form-data
//
// Fields sent by OpenSave Hub:
//   bundle   -> File (<app-id>-v<version>.zip)
//   manifest -> JSON string { id, name, tagline, description, category,
//                             section, version, developer, tags, releaseNotes }
//
// Expected JSON Response (200 OK):
//   { "ok": true, "submissionId": "sub_9f2a1c", "status": "queued_for_review" }`;

  const folderTree = `my-mini-app.zip
├── opensave.json          # App metadata & store listing (recommended)
├── index.html             # Entry point (REQUIRED at root or single subfolder)
├── styles/
│   └── app.css            # Use :root[data-theme="dark"] for dark mode
└── src/
    └── main.js            # Standard ES Modules with relative ./ paths`;

  const esc = (s) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  return `
    <div class="view-enter">
      ${headerHtml}

      <!-- Hero Banner -->
      <section class="story-card rounded-[26px] overflow-hidden p-6 sm:p-8 text-white mb-8" style="background: radial-gradient(circle at 85% 20%, rgba(10,132,255,0.45), transparent 45%), linear-gradient(135deg, #0b1220 0%, #172554 55%, #1e3a8a 100%);">
        <span class="inline-block text-[11px] font-bold uppercase tracking-[0.12em] text-white/80 mb-2">OPENSAVE DEVELOPER DOCS</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight max-w-2xl">
          Build, Sideload &amp; Publish Offline-First Mini-Apps
        </h2>
        <p class="text-sm text-white/80 mt-2.5 max-w-2xl leading-relaxed">
          Package any vanilla HTML/CSS/JS web app into a standard <code>.zip</code> file, install it permanently in your browser using the <strong>+</strong> button, and publish it to the OpenSave server for everyone.
        </p>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <button type="button" data-open-add-app class="px-5 py-2.5 rounded-full bg-white text-[#1d1d1f] hover:bg-white/90 font-bold text-xs transition">
            + Add .ZIP App Now
          </button>
          <button type="button" data-download-starter class="get-btn get-btn-glass px-5 py-2.5 rounded-full text-xs">
            Download Starter Template (.zip)
          </button>
        </div>
      </section>

      <!-- Step-by-Step Guide -->
      <div class="docs-stack">

        <!-- 1. Folder Structure -->
        <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-7 shadow-sm">
          <div class="docs-step-head">
            <span class="docs-step-num">01</span>
            <div>
              <h3 class="text-lg font-bold text-main">ZIP Package Structure</h3>
              <p class="text-xs text-sub">OpenSave automatically detects whether files are at the ZIP root or inside a single top-level folder.</p>
            </div>
          </div>
          <div class="docs-code-wrap">
            <pre class="docs-pre"><code>${esc(folderTree)}</code></pre>
          </div>
          <ul class="docs-bullets">
            <li><strong><code>index.html</code> is required</strong> — it is the launch entry point served offline at <code>./sideload/&lt;app-id&gt;/index.html</code>.</li>
            <li><strong>Always use relative paths</strong> (<code>./styles/app.css</code>, <code>./src/main.js</code>). Never use root-relative paths starting with <code>/</code>.</li>
            <li><strong>Standard ZIP compression</strong> — both Store (uncompressed) and Deflate (default on Linux, macOS, Windows) are unpacked locally in your browser with zero external servers.</li>
          </ul>
        </section>

        <!-- 2. opensave.json Manifest -->
        <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-7 shadow-sm">
          <div class="docs-step-head">
            <span class="docs-step-num">02</span>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-main"><code>opensave.json</code> Manifest Contract</h3>
              <p class="text-xs text-sub">Optional when sideloading (you can fill fields in the + modal), but recommended for 1-click imports and required for publishing.</p>
            </div>
            <button type="button" data-copy-code="manifest" class="get-btn px-3.5 py-1 rounded-full text-xs">Copy JSON</button>
          </div>
          <div class="docs-code-wrap">
            <pre class="docs-pre" id="doc-code-manifest"><code>${esc(manifestExample)}</code></pre>
          </div>

          <div class="docs-table-wrap">
            <table class="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr><td><code>id</code></td><td>Yes</td><td>Unique kebab-case slug (e.g. <code>regex-lab</code>). Used for persistent Cache Storage &amp; virtual URL.</td></tr>
                <tr><td><code>name</code></td><td>Yes</td><td>Display title shown on store cards, details modal, and workspace bar.</td></tr>
                <tr><td><code>tagline</code></td><td>Yes</td><td>Short 1-line summary shown under the title.</td></tr>
                <tr><td><code>category</code></td><td>Yes</td><td>Filter pill label (e.g. <code>Dev Tools</code>, <code>Interview Prep</code>, <code>Productivity</code>).</td></tr>
                <tr><td><code>section</code></td><td>No</td><td><code>"apps"</code> (default) or <code>"tools"</code> (places it in the Dev Tools tab).</td></tr>
                <tr><td><code>version</code></td><td>Yes</td><td>Semver string like <code>1.0.0</code>. Re-uploading with a higher version updates the app in place.</td></tr>
                <tr><td><code>accent</code></td><td>No</td><td>Hex color for the squircle icon gradient (default <code>#007aff</code>).</td></tr>
                <tr><td><code>tags</code></td><td>No</td><td>Array of keywords indexed by OpenSave Search.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- 3. Theme Sync & Persistent Storage -->
        <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-7 shadow-sm">
          <div class="docs-step-head">
            <span class="docs-step-num">03</span>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-main">Theme Sync &amp; Offline Persistence</h3>
              <p class="text-xs text-sub">Make your mini-app blend natively into OpenSave's Light and Dark modes.</p>
            </div>
            <button type="button" data-copy-code="theme" class="get-btn px-3.5 py-1 rounded-full text-xs">Copy JS</button>
          </div>
          <div class="docs-code-wrap">
            <pre class="docs-pre" id="doc-code-theme"><code>${esc(themeSyncSnippet)}</code></pre>
          </div>
          <ul class="docs-bullets">
            <li><strong>Persistent forever:</strong> When you add a <code>.zip</code> via <strong>+</strong>, OpenSave writes every file to Cache Storage (<code>opensave-sideload-&lt;id&gt;</code>) and saves the raw <code>.zip</code> in IndexedDB. The Service Worker serves it offline across reloads and restarts.</li>
            <li><strong>Namespace your app data:</strong> Prefix keys with your <code>app-id</code> (or use IndexedDB) so your mini-app never collides with other installed apps on the same origin.</li>
            <li><strong>Avoid mandatory CDNs:</strong> Bundle CSS/JS inside your <code>.zip</code> or degrade gracefully when offline.</li>
          </ul>
        </section>

        <!-- 4. Sideloading & Publishing to Server -->
        <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 sm:p-7 shadow-sm">
          <div class="docs-step-head">
            <span class="docs-step-num">04</span>
            <div class="flex-1">
              <h3 class="text-lg font-bold text-main">Publishing to the OpenSave Server</h3>
              <p class="text-xs text-sub">Share your sideloaded app with other OpenSave users via the Publish button in App Details.</p>
            </div>
            <button type="button" data-copy-code="publish" class="get-btn px-3.5 py-1 rounded-full text-xs">Copy Contract</button>
          </div>
          <div class="docs-code-wrap">
            <pre class="docs-pre" id="doc-code-publish"><code>${esc(publishContractSnippet)}</code></pre>
          </div>
          <ul class="docs-bullets">
            <li><strong>Direct Server Publish:</strong> Configure your Node.js/Express server endpoint in the Publish dialog (or Account &amp; Storage) to upload the <code>.zip</code> + <code>manifest</code> via <code>multipart/form-data</code>.</li>
            <li><strong>Zero-Cost Static Publish:</strong> Don't have a backend running yet? Use <strong>Copy catalog.json Entry</strong> + <strong>Download Verified .ZIP</strong> inside the Publish modal to add the app to your static GitHub/Cloudflare Pages repository.</li>
          </ul>
        </section>

      </div>
    </div>
  `;
}
