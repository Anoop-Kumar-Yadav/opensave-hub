# DSA.sheet — Modular Sheet Tracker

Zero-dependency vanilla ES Modules architecture for tracking DSA sheets, 1/3/7 spaced-repetition revisions (min-heap priority queue), favorites, pattern tags, code approaches, and Medium/LinkedIn markdown exports.

## Running Locally

Because this project uses native ES Modules (`<script type="module">`), serve it over HTTP rather than opening `index.html` via `file://` (browsers block `file://` module imports due to CORS).

```bash
# Option 1: Python
python3 -m http.server 8080

# Option 2: Node
npx serve .
```

Then open `http://localhost:8080`. Or use the **Live Server** extension in VS Code.

## Folder Structure

```text
dsa-sheet-tracker/
├── index.html
├── README.md
├── styles/
│   ├── tokens.css         # Design tokens, light/dark themes, base reset & a11y
│   ├── layout.css         # Topbar, cards, buttons, forms, modals, accent picker
│   ├── sheet.css          # Home layout, 1/3/7 revision queue sidebar, sheet/topic/question rows, favorites & pattern tags
│   └── workspace.css      # Problem workspace, breadcrumbs, dark code shell, syntax highlighting, sticky sidebar
└── src/
    ├── main.js            # Entry point, router, topbar & backup event wiring
    ├── data/
    │   └── sheets.js      # Built-in DSA sheets, pattern presets, complexity presets, constants
    ├── state/
    │   └── store.js       # Persisted state (localStorage), UI state, theme/accent, render pub/sub
    ├── utils/
    │   ├── dom.js         # h(), $(), rc(), esc(), shadeHex(), copyCode(), pct(), dk()
    │   ├── markdown.js    # Markdown renderer with embedded image map support
    │   └── complexity.js  # Time complexity scoring & relative/absolute glow styling
    ├── domain/
    │   ├── revision.js    # Strict 1 -> 3 -> 7 sequential revision rules & Min-Heap priority queue
    │   ├── patterns.js    # Favorites & pattern tag helpers
    │   └── blogExport.js  # Medium / LinkedIn template engine & markdown/image downloader
    └── ui/
        ├── components.js  # Reusable UI primitives (Ring, Meter, Activity, RevDots, Code, CodeEditor, GlowSettings)
        ├── modals.js      # AddModal, PatternModal, TplModal, AccentModal, ManageModal
        ├── homeView.js    # Home dashboard & sticky RevisionSidebar
        ├── sheetView.js   # SheetView, Topic accordions, Question rows
        └── workspaceView.js # ApproachPage (problem overview, examples, approaches, scroll-spy)
```
