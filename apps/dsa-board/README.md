# DSA Board (Modular v2)

Interactive Data Structures & Algorithms whiteboard with a 3-pane studio layout:
- **Left Sidebar:** Drag & drop Data Structures directly onto the canvas (or click to quick-add).
- **Center Canvas:** High-DPI, rAF-throttled infinite pan/zoom whiteboard.
- **Right Inspector Sidebar:** Opens automatically when selecting an element—edit **Variable Name**, load **comma-separated initial values**, tweak memory/structure properties, and run operations.

## Run Locally
ES Modules require HTTP(S):

```bash
npx serve .
# OR
python3 -m http.server 8080
```

## Comma-Separated Initial Values Format
- **Array / Stack / Queue / Linked Lists / BST / Heap:** `10, 20, 30, 40`
- **Hash Map:** `a:1, b:2, c:3` (or `key=val`, or plain keys)
- **Graph:** `A, B, C, A-B, B-C` (vertices and edges together)
