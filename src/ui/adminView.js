/**
 * OpenSave Admin Dashboard — Review user-uploaded .ZIP apps, manage lifecycle states,
 * and submit approved apps to the store/GitHub.
 */

export const APP_STATES = [
  { id: "pending", label: "Pending Review", badgeClass: "admin-badge-pending" },
  { id: "in_review", label: "In Review", badgeClass: "admin-badge-review" },
  { id: "approved_ready", label: "Approved (Ready to Submit)", badgeClass: "admin-badge-approved" },
  { id: "available", label: "Live (Published)", badgeClass: "admin-badge-live" },
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
    review_queue: apps.filter((a) => a.status === "pending" || a.status === "in_review").length,
    approved_ready: apps.filter((a) => a.status === "approved_ready").length,
    available: apps.filter((a) => a.status === "available").length,
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
    ["review_queue", `Pending Review (${counts.review_queue})`],
    ["approved_ready", `Approved / Ready (${counts.approved_ready})`],
    ["available", `Live (${counts.available})`],
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
          <p class="text-[11px] font-bold uppercase tracking-wider text-sub">Pending Review</p>
          <p class="text-2xl font-extrabold accent-text mt-1">${counts.review_queue}</p>
        </div>
        <div class="surface-elevated rounded-2xl border border-hairline-subtle p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-sub">Approved (To Submit)</p>
          <p class="text-2xl font-extrabold text-[#0a84ff] mt-1">${counts.approved_ready}</p>
        </div>
        <div class="surface-elevated rounded-2xl border border-hairline-subtle p-4 shadow-sm">
          <p class="text-[11px] font-bold uppercase tracking-wider text-sub">Live / Rejected</p>
          <p class="text-2xl font-extrabold text-main mt-1">${counts.available} <span class="text-sm font-semibold text-[#ff3b30]">/ ${counts.rejected}</span></p>
        </div>
      </section>

      <!-- Admin Actions Bar -->
      <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-5 shadow-sm mb-6 space-y-4">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 class="text-base font-bold text-main">Upload Review &amp; Submission Pipeline</h2>
            <p class="text-xs text-sub">User .ZIP uploads arrive in <strong>Pending Review</strong>. Test and <strong>Approve</strong> first, then <strong>Submit</strong> to push live.</p>
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
              <h3 class="text-xs font-bold uppercase tracking-wider text-sub">GitHub Submissions Folder (<code>submissions/</code>)</h3>
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

      <!-- Apps Review & Approval List -->
      <section class="surface-elevated rounded-[24px] border border-hairline-subtle p-4 sm:p-5 shadow-sm">
        ${filtered.length === 0 ? `
          <p class="py-10 text-center text-sm text-sub">No apps match this filter.</p>
        ` : `
          <div class="divide-y divide-[var(--hairline-subtle)]">
            ${filtered.map((app) => {
              const stMeta = getStateMeta(app.status);
              const isApproved = app.status === "approved_ready";
              const isLive = app.status === "available";
              return `
                <div class="admin-app-row py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div class="flex items-start gap-3.5 min-w-0 flex-1">
                    ${renderAppIcon(app, "w-12 h-12")}
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2 flex-wrap">
                        <h3 class="text-[15px] font-bold text-main truncate">${esc(app.name)}</h3>
                        <span class="admin-badge ${stMeta.badgeClass}">${stMeta.label}</span>
                        ${app.isCustom ? `<span class="admin-badge admin-badge-custom">User Upload</span>` : ""}
                        ${app.submittedAt ? `<span class="admin-badge admin-badge-live">Submitted</span>` : ""}
                        ${app.featured ? `<span class="admin-badge admin-badge-featured">Featured</span>` : ""}
                      </div>
                      <p class="text-xs text-sub mt-0.5 truncate">${esc(app.id)} · v${esc(app.version)} · ${esc(app.category)} · by ${esc(app.developer || "User")}</p>
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

                    ${!isApproved && !isLive ? `
                      <button type="button" data-admin-approve="${esc(app.id)}" class="get-btn get-btn-solid px-3 py-1.5 rounded-full text-xs">Approve</button>
                    ` : ""}

                    ${isApproved ? `
                      <button type="button" data-admin-submit-approved="${esc(app.id)}" class="get-btn get-btn-solid px-3.5 py-1.5 rounded-full text-xs">Submit App</button>
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
