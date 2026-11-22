import { S, save, notify } from "../state/store.js";
import { aTags } from "./patterns.js";

const uid = (prefix) =>
  prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function defaultAlgoTree() {
  return [
    {
      id: "alg-sec-sorting",
      type: "folder",
      name: "Sorting",
      children: [
        { id: "alg-bubble-sort", type: "algo", name: "Bubble Sort", desc: "Repeatedly swap adjacent out-of-order elements.", tags: ["Sorting"], ap: [] },
        { id: "alg-merge-sort", type: "algo", name: "Merge Sort", desc: "Divide array in half, recursively sort, and merge.", tags: ["Divide & Conquer"], ap: [] },
        { id: "alg-quick-sort", type: "algo", name: "Quick Sort", desc: "Partition around a pivot and sort subarrays in place.", tags: ["Divide & Conquer"], ap: [] },
      ],
    },
    {
      id: "alg-sec-searching",
      type: "folder",
      name: "Searching",
      children: [
        { id: "alg-binary-search", type: "algo", name: "Binary Search", desc: "Halve the sorted search space on each step.", tags: ["Binary Search"], ap: [] },
      ],
    },
    {
      id: "alg-sec-trees",
      type: "folder",
      name: "Trees",
      children: [
        {
          id: "alg-sec-binary-trees",
          type: "folder",
          name: "Binary Trees",
          children: [
            { id: "alg-tree-traversals", type: "algo", name: "DFS & BFS Traversals", desc: "Inorder, Preorder, Postorder, and Level Order implementations.", tags: ["BFS / DFS"], ap: [] },
          ],
        },
      ],
    },
    {
      id: "alg-sec-graphs",
      type: "folder",
      name: "Graphs",
      children: [
        {
          id: "alg-sec-shortest-path",
          type: "folder",
          name: "Shortest Path",
          children: [
            { id: "alg-dijkstra", type: "algo", name: "Dijkstra's Algorithm", desc: "Single-source shortest path on non-negative weighted graphs.", tags: ["Shortest Path", "Heap / PQ"], ap: [] },
          ],
        },
      ],
    },
  ];
}

export function ensureAlgoTree() {
  if (!Array.isArray(S.algoTree)) {
    S.algoTree = defaultAlgoTree();
    save();
  }
  return S.algoTree;
}

export function findNodeWithParent(nodes, id, path = []) {
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.id === id) {
      return { node, parentList: nodes, index: i, path };
    }
    if (node.type === "folder" && Array.isArray(node.children)) {
      const found = findNodeWithParent(node.children, id, [...path, node]);
      if (found) return found;
    }
  }
  return null;
}

export function listAllAlgos(nodes, path = []) {
  const out = [];
  for (const node of nodes || []) {
    if (node.type === "algo") {
      out.push({ algo: node, path });
    } else if (node.type === "folder" && Array.isArray(node.children)) {
      out.push(...listAllAlgos(node.children, [...path, node]));
    }
  }
  return out;
}

export function countAlgos(node) {
  if (!node) return 0;
  if (node.type === "algo") return 1;
  return (node.children || []).reduce((acc, child) => acc + countAlgos(child), 0);
}

export function countSubfolders(node) {
  if (!node || node.type !== "folder") return 0;
  return (node.children || []).reduce(
    (acc, child) => acc + (child.type === "folder" ? 1 + countSubfolders(child) : 0),
    0
  );
}

export function algoOwnTags(algo) {
  return algo && Array.isArray(algo.tags) ? algo.tags : [];
}

export function algoTags(algo) {
  if (!algo) return [];
  const out = [];
  const seen = new Set();
  const add = (t) => {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
    }
  };
  algoOwnTags(algo).forEach(add);
  (algo.ap || []).forEach((a) => aTags(a).forEach(add));
  return out;
}

export function toggleAlgoTag(algo, tag) {
  const t = tag.trim();
  if (!t || !algo) return;
  const cur = [...algoOwnTags(algo)];
  const idx = cur.findIndex((x) => x.toLowerCase() === t.toLowerCase());
  if (idx >= 0) cur.splice(idx, 1);
  else cur.push(t);
  algo.tags = cur;
  save();
}

export function addFolder(parentList, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const folder = { id: uid("af-"), type: "folder", name: trimmed, children: [] };
  parentList.push(folder);
  save();
  notify();
  return folder;
}

export function addAlgo(parentList, name) {
  const trimmed = (name || "").trim();
  if (!trimmed) return null;
  const algo = { id: uid("al-"), type: "algo", name: trimmed, desc: "", tags: [], ap: [] };
  parentList.push(algo);
  save();
  notify();
  return algo;
}

export function renameNode(node, name) {
  const trimmed = (name || "").trim();
  if (!trimmed || !node) return;
  node.name = trimmed;
  save();
  notify();
}

export function deleteNode(parentList, index) {
  if (!Array.isArray(parentList) || index < 0 || index >= parentList.length) return;
  parentList.splice(index, 1);
  save();
  notify();
}
