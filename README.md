# OpenSave — Free Hosted PWA Hub

A sleek, offline-first productivity & developer tools hub built for students and engineers. Hosts independent mini-apps with per-app Service Worker offline caching, optional auto-updates, and a shared IndexedDB SDK ready for future online sync.

## Included Mini-Apps
1. **DSA.sheet (`v1.8.0`)** — Full spaced-repetition DSA tracker, 1/3/7 revision priority queue, topic tiles, pure algorithms vault, edge-case tracker, and visual Medium/LinkedIn template builder.
2. **JSON Studio (`v1.0.0`)** — Zero-latency offline JSON formatter, validator, minifier, and key sorter using `@opensave/sdk`.

## Run Locally
Serve over HTTP (required for ES Modules and Service Workers):

```bash
cd opensave-hub
python3 -m http.server 8080
```
Open `http://127.0.0.1:8080`.

## Deploy Free (₹0)
- **Cloudflare Pages:** Push `opensave-hub/` to a GitHub repo → Connect to Cloudflare Pages → Build command: *(leave empty)*, Output directory: `.` (root).
- **GitHub Pages:** Push to GitHub → Settings → Pages → Deploy from branch (`main` / root).

## Adding a New Mini-App
1. Drop your mini-app folder into `apps/<app-id>/`.
2. Add its entry + asset list to `registry/catalog.json` and bump its `version` whenever you ship an update.
