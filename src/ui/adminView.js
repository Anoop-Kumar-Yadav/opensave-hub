/**
 * OpenSave Admin Dashboard — Manage uploaded user apps, GitHub submissions queue,
 * and app lifecycle states (pending, in_review, available, coming_soon, rejected, archived).
 */

export const APP_STATES = [
  { id: "available", label: "Live (Published)", badgeClass: "admin-badge-live" },
  { id: "pending", label: "Pending Review", badgeClass: "admin-badge-pending" },
  { id: "in_review", label: "In Review", badgeClass: "admin-badge-review" },
  { id: "coming_soon", label: "Coming Soon", badgeClass: "admin-badge-soon" },
  { id: "rejected", label: "Rejected", badgeClass: "admin-badge-rejected" },
  { id: "archived", label: "Archived", badgeClass: "admin-badge-archived" },
];

function esc(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getStateMeta(status) {
  return APP_STATES.find((s) => s.id === status) || APP_STATES[0];
}

export function renderAdminView({
  headerHtml,
  apps,
  filterStatus,
  searchQuery,
  githubRepo,
  githubQueue,
  githubLoading,
  githubError,
  renderAppIcon,
}) {
  const counts = {
    all: apps.length,
    available: apps.filter((a) => a.status === "available").length,
    pending: apps.filter((a) => a.status === "pending" || a.status === "in_review").length,
    coming_soon: apps.filter((a) => a.status === "coming_soon").length,
    rejected: apps.filter((a) => a.status === "rejected" || a.status === "archived").length,
  };

  const q = (searchQuery || "").trim().toLowerCase();
  const filtered = apps.filter((a) => {
    const matchStatus =
      filterStatus === "all"
        ? true
        : filterStatus === "review_queue"
        ? a.status === "pending" || a.status === "in_review"
        : a.status === filterStatus;
    const matchQ =
      !q ||
      a.name.toLowerCase().includes(q) ||
      a.id.toLowerCase().includes(q) ||
      (a.developer || "").toLowerCase().includes(q) ||
      (a.category || "").toLowerCase().includes(q);
    return matchStatus && matchQ;
  });

  const filterPills = [
    ["all", `All (${counts.all})`],
    ["review_queue", `Review Queue (${counts.pending})`],
    ["available", `Live (${counts.available})`],
    ["coming_soon", `Coming Soon (${counts.coming_soon})`],
    ["rejected", "Rejected"],
    ["archived", "Archived"],
  ];

  return `
    <div class="view-enter">
      ${headerHtml}

      <!-- KPI Summary Cards -->
      <section class="admin-kpi-grid mb-6">
        <div class="surface-elevated rounded-2xl border border-hairline-subtle p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-sub">Total Apps</p>
          <p class="text-2xl font-extrabold text-main mt-1">${counts.all}</p>
        </div>
        <div class="surface-elevated rounded-2xl border border-hairline-subtle p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-sub">Live in Store</p>
          <p class="text-2xl font-extrabold text-[#34c759] mt-1">${counts.available}</p>
        </div>
        <div class="surface-elevated rounded-2xl border border-hairline-subtle p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-sub">Pending / Review</p>
          <p class="text-2xl font-extrabold accent-text mt-1">${counts.pending}</p>
        </div>
        <div class="surface-elevated rounded-2xl border border-hairline-subtle p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-sub">Rejected / Archived</p>
          <p class="text-2xl font-extrabold text-[#ff3b30] mt-1">${counts.rejected}</p>
        </div>
      </section>

      <!-- Admin Actions Bar -->
      <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 shadow-sm mb-6 space-y-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-base font-bold text-main">Store Catalog &amp; Lifecycle Controls</h2>
            <p class="text-xs text-sub">Approve, reject, feature, or archive apps. Export updated <code>registry/catalog.json</code> when ready to deploy.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-open-add-app class="get-btn px-3.5 py-1.5 rounded-full text-xs">+ Upload .ZIP</button>
            <button type="button" id="adminCopyCatalogBtn" class="get-btn px-3.5 py-1.5 rounded-full text-xs">Copy catalog.json</button>
            <button type="button" id="adminDownloadCatalogBtn" class="get-btn get-btn-solid px-4 py-1.5 rounded-full text-xs">Download catalog.json</button>
          </div>
        </div>

        <!-- GitHub Submissions Queue -->
        <div class="pt-4 border-t border-hairline-subtle">
          <div class="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-sub">GitHub Submissions Queue (<code>submissions/</code>)</h3>
              <p class="text-[11px] text-sub">Repo: <code>${esc(githubRepo || "Not configured")}</code></p>
            </div>
            <div class="flex gap-2">
              <button type="button" id="adminFetchGithubQueueBtn" ${githubLoading ? "disabled" : ""} class="get-btn px-3.5 py-1 rounded-full text-xs">
                ${githubLoading ? "Checking..." : "Refresh Queue"}
              </button>
              ${githubRepo ? `<a href="https://github.com/${esc(githubRepo)}/actions" target="_blank" rel="noopener" class="get-btn px-3.5 py-1 rounded-full text-xs" style="text-decoration:none">Open Actions</a>` : ""}
            </div>
          </div>

          ${githubError ? `<p class="text-xs text-[#ff3b30]">${esc(githubError)}</p>` : ""}
          ${Array.isArray(githubQueue) && githubQueue.length > 0 ? `
            <div class="divide-y divide-[var(--hairline-subtle)] surface-secondary rounded-2xl px-4">
              ${githubQueue.map((item) => `
                <div class="py-2.5 flex items-center justify-between gap-3 flex-wrap">
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-main truncate">${esc(item.name)}</p>
                    <p class="text-[11px] text-sub">${Math.max(1, Math.round((item.size || 0) / 1024))} KB · Waiting in <code>submissions/</code></p>
                  </div>
                  <div class="flex gap-2">
                    <a href="${esc(item.download_url)}" target="_blank" rel="noopener" class="get-btn px-3 py-1 rounded-full text-[11px]" style="text-decoration:none">Download .ZIP</a>
                    <a href="${esc(item.html_url)}" target="_blank" rel="noopener" class="get-btn px-3 py-1 rounded-full text-[11px]" style="text-decoration:none">View on GitHub</a>
                  </div>
                </div>
              `).join("")}
            </div>
          ` : `
            <p class="text-xs text-sub">${githubQueue === null ? "Click Refresh Queue to check pending .zip uploads on GitHub." : "No pending .zip files in submissions/ right now."}</p>
          `}
        </div>
      </section>

      <!-- Filter Pills + Search -->
      <div class="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div class="flex items-center gap-2 overflow-x-auto no-scrollbar" role="group" aria-label="Admin status filters">
          ${filterPills.map(([key, label]) => `
            <button
              type="button"
              data-admin-filter="${key}"
              aria-pressed="${filterStatus === key}"
              class="cat-pill shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold"
            >
              ${label}
            </button>
          `).join("")}
        </div>
        <input
          type="search"
          id="adminSearchInput"
          value="${esc(searchQuery || "")}"
          placeholder="Filter by name, id, developer..."
          class="px-3.5 py-1.5 rounded-xl text-xs surface-secondary text-main placeholder:text-muted border border-hairline-subtle focus:outline-none focus:ring-2 focus:ring-[#007aff]"
          style="min-width:220px"
        />
      </div>

      <!-- Apps Management List -->
      <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-4 sm:p-5 shadow-sm">
        ${filtered.length === 0 ? `
          <p class="py-10 text-center text-sm text-sub">No apps match this filter.</p>
        ` : `
          <div class="divide-y divide-[var(--hairline-subtle)]">
            ${filtered.map((app) => {
              const stMeta = getStateMeta(app.status);
              return `
                <div class="admin-app-row py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div class="flex items-start gap-3.5 min-w-0 flex-1">
                    ${renderAppIcon(app, "w-12 h-12")}
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-[15px] font-bold text-main truncate">${esc(app.name)}</h3>
                        <span class="admin-badge ${stMeta.badgeClass}">${stMeta.label}</span>
                        ${app.isCustom ? `<span class="admin-badge admin-badge-custom">User Upload</span>` : ""}
                        ${app.featured ? `<span class="admin-badge admin-badge-featured">Featured</span>` : ""}
                      </div>
                      <p class="text-xs text-sub mt-0.5 truncate">${esc(app.id)} · v${esc(app.version)} · ${esc(app.category)} · by ${esc(app.developer || "OpenSave")}</p>
                      ${app.reviewNote ? `<p class="text-[11px] text-[#ff3b30] mt-1">Review note: ${esc(app.reviewNote)}</p>` : ""}
                    </div>
                  </div>

                  <div class="flex items-center gap-2 flex-wrap shrink-0">
                    <select
                      data-admin-status-select="${esc(app.id)}"
                      aria-label="Change status for ${esc(app.name)}"
                      class="admin-select"
                    >
                      ${APP_STATES.map((s) => `<option value="${s.id}" ${app.status === s.id ? "selected" : ""}>${s.label}</option>`).join("")}
                    </select>

                    ${app.url ? `<button type="button" data-admin-preview="${esc(app.id)}" class="get-btn px-3 py-1.5 rounded-full text-xs">Test</button>` : ""}

                    ${app.status !== "available" ? `
                      <button type="button" data-admin-approve="${esc(app.id)}" class="get-btn get-btn-solid px-3 py-1.5 rounded-full text-xs">Approve</button>
                    ` : ""}

                    ${app.status !== "rejected" ? `
                      <button type="button" data-admin-reject="${esc(app.id)}" class="get-btn px-3 py-1.5 rounded-full text-xs text-[#ff3b30]">Reject</button>
                    ` : ""}

                    <button type="button" data-admin-feature="${esc(app.id)}" class="get-btn px-3 py-1.5 rounded-full text-xs" title="Toggle Featured">
                      ${app.featured ? "Unfeature" : "Feature"}
                    </button>

                    ${app.isCustom ? `
                      <button type="button" data-admin-delete="${esc(app.id)}" class="get-btn px-3 py-1.5 rounded-full text-xs text-[#ff3b30]">Delete</button>
                    ` : ""}
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        `}
      </section>
    </div>
  `;
}
