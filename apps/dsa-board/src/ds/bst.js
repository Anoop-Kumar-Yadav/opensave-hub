import { registerDS } from './registry.js';
import { B, L, T, alloc, cmp, ptr, parseCSV } from '../core/primitives.js';

function deleteNode(d, a, v) {
  if (!a) return a;
  const n = d.mem[a];
  const c = cmp(v, n.v);
  if (c < 0) n.l = deleteNode(d, n.l, v);
  else if (c > 0) n.r = deleteNode(d, n.r, v);
  else {
    if (!n.l || !n.r) {
      const child = n.l || n.r;
      delete d.mem[a];
      return child;
    }
    let m = n.r;
    while (d.mem[m].l) m = d.mem[m].l;
    n.v = d.mem[m].v;
    n.r = deleteNode(d, n.r, n.v);
  }
  return a;
}

function traverse(d, a, order) {
  if (!a) return [];
  const n = d.mem[a];
  const l = traverse(d, n.l, order);
  const r = traverse(d, n.r, order);
  if (order === 0) return [n.v, ...l, ...r];
  if (order === 1) return [...l, n.v, ...r];
  return [...l, ...r, n.v];
}

function insertNode(d, v) {
  if (!v) return;
  if (!d.r) {
    d.r = alloc(d, { v, l: null, r: null });
    d.hi = d.r;
    d.note = 'root = new ' + d.r;
    return;
  }
  let c = d.r;
  for (;;) {
    const n = d.mem[c];
    const k = cmp(v, n.v);
    if (!k) return;
    const side = k < 0 ? 'l' : 'r';
    if (!n[side]) {
      const a = alloc(d, { v, l: null, r: null });
      n[side] = a;
      d.hi = a;
      d.note = `new=${a}; ${c}.${k < 0 ? 'left' : 'right'}=new`;
      return;
    }
    c = n[side];
  }
}

registerDS('bst', {
  name: 'Binary Search Tree',
  sub: 'Left / data / right',
  icon: 'account_tree',
  defaultPrefix: 'bst',
  bulkPlaceholder: 'e.g. 50, 30, 70, 20, 40',
  h: 'node = [left | data | right]',
  dropOps: { insert: 0, delete: 0, search: 0 },
  init: () => ({ r: null, mem: {}, hi: null }),
  bulkLoad: (d, raw) => {
    const vals = parseCSV(raw);
    d.r = null;
    d.mem = {};
    d.q = 240;
    d.hi = null;
    vals.forEach((v) => insertNode(d, v));
    d.note = `inserted ${vals.length} value(s)`;
  },
  ops: {
    insert: insertNode,
    delete: (d, v) => {
      d.r = deleteNode(d, d.r, v);
      d.note = 'unlinked node, free(), parent pointer rewired';
    },
    search: (d, v) => {
      let c = d.r;
      const path = [];
      while (c) {
        path.push(c);
        const k = cmp(v, d.mem[c].v);
        if (!k) break;
        c = k < 0 ? d.mem[c].l : d.mem[c].r;
      }
      d.hi = c;
      d.note = (c ? 'found' : 'not found') + ' | path: ' + path.join(' → ');
    },
    preorder: (d) => { d.note = 'preorder: ' + traverse(d, d.r, 0).join(' '); },
    inorder: (d) => { d.note = 'inorder: ' + traverse(d, d.r, 1).join(' '); },
    postorder: (d) => { d.note = 'postorder: ' + traverse(d, d.r, 2).join(' '); },
    bfs: (d) => {
      const q = [d.r];
      const out = [];
      while (q.length) {
        const a = q.shift();
        if (a) {
          out.push(d.mem[a].v);
          q.push(d.mem[a].l, d.mem[a].r);
        }
      }
      d.note = 'level-order: ' + out.join(' ');
    },
  },
  layout: (d) => {
    const P = [];
    const N = {};
    let i = 0;

    const place = (a, depth) => {
      if (!a) return;
      const n = d.mem[a];
      place(n.l, depth + 1);
      N[a] = { x: i++ * 130, y: depth * 110, n };
      place(n.r, depth + 1);
    };
    place(d.r, 0);

    P.push(B(0, -60, 120, 28, 'root = ' + (d.r || 'null')));
    Object.entries(N).forEach(([a, { x, y, n }]) => {
      P.push(
        T(x + 60, y - 8, a),
        B(x, y, 38, 36, ptr(n.l)),
        B(x + 38, y, 44, 36, n.v, a === d.hi),
        B(x + 82, y, 38, 36, ptr(n.r)),
      );
      if (n.l) P.push(L(x + 19, y + 36, N[n.l].x + 60, N[n.l].y - 18, 1));
      if (n.r) P.push(L(x + 101, y + 36, N[n.r].x + 60, N[n.r].y - 18, 1));
    });
    if (d.r) P.push(L(60, -32, N[d.r].x + 60, -20, 1));
    return P;
  },
});
