const SVG_PATHS = {
  // Brand
  logo: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 6.5v2M12 15.5v2M6.5 12h2M15.5 12h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',

  // Navigation
  compass: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>',
  package: '<path d="M16.5 9.4 7.55 4.24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><polyline points="3.27 6.96 12 12.01 20.73 6.96" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><line x1="12" y1="22.08" x2="12" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
  sliders: '<line x1="4" y1="21" x2="4" y2="14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="4" y1="10" x2="4" y2="3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="12" y1="21" x2="12" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="12" y1="8" x2="12" y2="3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="20" y1="21" x2="20" y2="16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="20" y1="12" x2="20" y2="3" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="1" y1="14" x2="7" y2="14" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="9" y1="8" x2="15" y2="8" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="17" y1="16" x2="23" y2="16" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',

  // App Icons
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="14" y="3" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="3" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.75"/><rect x="14" y="14" width="7" height="7" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.75"/>',
  braces: '<path d="M8 3H6a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v5a2 2 0 0 0 2 2 2 2 0 0 0-2 2v5a2 2 0 0 1-2 2h-2" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><polyline points="2 12 12 17 22 12" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><polyline points="2 17 12 22 22 17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>',
  clock: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.75"/><polyline points="12 7 12 12 15.5 14" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
  code: '<polyline points="16 18 22 12 16 6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><polyline points="8 6 2 12 8 18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',

  // UI Actions & System
  search: '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="1.75"/><line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
  download: '<path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowLeft: '<line x1="19" y1="12" x2="5" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><polyline points="12 19 5 12 12 5" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  arrowUpRight: '<line x1="7" y1="17" x2="17" y2="7" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><polyline points="7 7 17 7 17 17" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
  check: '<polyline points="20 6 9 17 4 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  refresh: '<polyline points="23 4 23 10 17 10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  trash: '<polyline points="3 6 5 6 21 6" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>',
  folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>',
  hardDrive: '<line x1="22" y1="12" x2="2" y2="12" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/><line x1="6" y1="16" x2="6.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="10" y1="16" x2="10.01" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/><line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
  sun: '<circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.75"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"/>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linejoin="round"/>',
};

export function icon(name, size = 16) {
  const span = document.createElement("span");
  span.className = "os-icon";
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">${SVG_PATHS[name] || SVG_PATHS.grid}</svg>`;
  return span;
}
