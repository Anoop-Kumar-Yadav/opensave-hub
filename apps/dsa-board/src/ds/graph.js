import { registerDS } from './registry.js';
import { B, C, L, T, TL, alloc, rowsLayout, walkChain, parseCSV } from '../core/primitives.js';
import { primitivesBounds } from '../core/geometry.js';

const NODE_R = 20;

const edgeNodes = (d, u) => {
  const out = [];
  for (let a = d.h[u]; a; a = d.mem[a].n) {
    out.push(d.mem[a]);
  }
  return out;
};

const findEdgeAddr = (d, u, v) => {
  for (let a = d.h[u]; a; a = d.mem[a].n) {
    if (d.mem[a].t == v) return a;
  }
  return null;
};

const neighbors = (d, u) => edgeNodes(d, u).map((n) => n.t);

const unlinkEdge = (d, u, v) => {
  let prev = null;
  let a = d.h[u];
  while (a && d.mem[a].t != v) {
    prev = a;
    a = d.mem[a].n;
  }
  if (!a) return;
  const next = d.mem[a].n;
  if (prev) d.mem[prev].n = next;
  else d.h[u] = next;
  delete d.mem[a];
};

const upsertDirectedEdge = (d, u, v, w = 1) => {
  const existing = findEdgeAddr(d, u, v);
  if (existing) {
    d.mem[existing].w = w;
    return false;
  }
  d.h[u] = alloc(d, { t: v, w, n: d.h[u] });
  return true;
};

const arrangeCircle = (d) => {
  const n = d.v.length;
  if (!n) return;
  const r = n === 1 ? 0 : Math.max(82, n * 24);
  const cx = r + 24;
  const cy = r + 24;
  d.v.forEach((u, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    d.pos[u] = {
      x: Math.round(cx + r * Math.cos(angle)),
      y: Math.round(cy + r * Math.sin(angle)),
    };
  });
};

const ensureVertexPos = (d, u) => {
  if (!d.pos) d.pos = {};
  if (d.pos[u]) return;
  const n = d.v.length;
  if (n <= 1) {
    d.pos[u] = { x: 80, y: 80 };
    return;
  }
  // Place new vertex on a clean ring around existing centroid
  const coords = d.v.filter((k) => d.pos[k]).map((k) => d.pos[k]);
  if (coords.length < n - 1) {
    arrangeCircle(d);
    return;
  }
  const cx = coords.reduce((s, p) => s + p.x, 0) / coords.length;
  const cy = coords.reduce((s, p) => s + p.y, 0) / coords.length;
  const r = Math.max(82, n * 24);
  const angle = (2 * Math.PI * (n - 1)) / n - Math.PI / 2;
  d.pos[u] = { x: Math.round(cx + r * Math.cos(angle)), y: Math.round(cy + r * Math.sin(angle)) };
};

const ensureVertex = (d, v) => {
  if (v && !d.v.includes(v)) {
    d.v.push(v);
    d.h[v] = null;
    ensureVertexPos(d, v);
  }
};

const parseTargetAndWeight = (vRaw, wRaw) => {
  let target = String(vRaw || '').trim();
  let weight = wRaw !== undefined && String(wRaw).trim() !== '' ? String(wRaw).trim() : null;
  if (target.includes(':')) {
    const [dest, inlineW] = target.split(':').map((s) => s.trim());
    target = dest;
    if (inlineW && !weight) weight = inlineW;
  }
  const parsedW = weight !== null ? (isNaN(+weight) ? weight : +weight) : 1;
  return { target, weight: parsedW, hasExplicitWeight: weight !== null };
};

function buildVisualPrimitives(d) {
  if (!d.v.length) {
    return [TL(0, 12, 'empty graph — add vertices or load e.g. A, B, C, A-B:5')];
  }

  // Ensure all vertices have coordinates
  d.v.forEach((u) => ensureVertexPos(d, u));

  const P = [
    TL(0, -28, `${+d.m.directed ? 'directed' : 'undirected'} · ${+d.m.weighted ? 'weighted' : 'unweighted'} (drag nodes to reposition)`),
  ];

  const directed = !!+d.m.directed;
  const weighted = !!+d.m.weighted;
  const drawnUndirected = new Set();

  // 1. Draw edges first (behind nodes)
  for (const u of d.v) {
    const p1 = d.pos[u];
    for (const edge of edgeNodes(d, u)) {
      const v = edge.t;
      const p2 = d.pos[v];
      if (!p2) continue;

      if (!directed) {
        const key = u < v ? `${u}||${v}` : `${v}||${u}`;
        if (drawnUndirected.has(key)) continue;
        drawnUndirected.add(key);
      }

      if (u === v) {
        // Self-loop label above node
        const loopLbl = weighted ? `↺ ${edge.w ?? 1}` : '↺';
        P.push(T(p1.x, p1.y - NODE_R - 14, loopLbl));
        continue;
      }

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.hypot(dx, dy) || 1;
      const ux = dx / dist;
      const uy = dy / dist;

      // Curve slightly if directed and reverse edge also exists
      const hasReverse = directed && findEdgeAddr(d, v, u) !== null;
      const curve = hasReverse ? 24 : 0;

      // Trim endpoints to circle border so arrows touch cleanly
      const startX = p1.x + ux * NODE_R;
      const startY = p1.y + uy * NODE_R;
      const endX = p2.x - ux * (NODE_R + (directed ? 2 : 0));
      const endY = p2.y - uy * (NODE_R + (directed ? 2 : 0));

      const label = weighted ? String(edge.w ?? 1) : null;
      P.push(L(startX, startY, endX, endY, directed ? 1 : 0, label, curve));
    }
  }

  // 2. Draw vertex circles on top
  for (const u of d.v) {
    const p = d.pos[u];
    P.push(C(p.x, p.y, u, u === d.hi));
  }

  return P;
}

function buildListPrimitives(d) {
  const weighted = !!+d.m.weighted;
  const header = weighted
    ? 'adjacency list: [vertex | head] → [dest | w | next]'
    : 'adjacency list: [vertex | head] → [dest | next]';

  if (!d.v.length) return [TL(0, -28, header), TL(0, 12, '(no vertices)')];

  return [
    TL(0, -28, header),
    ...rowsLayout(
      d.v.map((u) => ({
        l: u,
        h: d.h[u],
        hl: u === d.hi,
        n: walkChain(d, d.h[u], (n) => (weighted ? [n.t, n.w ?? 1] : [n.t])),
      })),
      weighted ? 2 : 1,
    ),
  ];
}

function buildMatrixPrimitives(d) {
  const weighted = !!+d.m.weighted;
  const n = d.v.length;
  const P = [TL(0, -28, `adjacency matrix (${n}×${n})`)];
  if (!n) {
    P.push(TL(0, 12, '(no vertices)'));
    return P;
  }

  const cell = 42;
  const startX = 46;
  const startY = 28;

  // Column & row headers
  d.v.forEach((u, idx) => {
    P.push(T(startX + idx * cell + cell / 2, startY - 12, u));
    P.push(T(startX - 18, startY + idx * cell + cell / 2, u));
  });

  // Matrix cells
  d.v.forEach((u, r) => {
    d.v.forEach((v, c) => {
      const addr = findEdgeAddr(d, u, v);
      const hasEdge = addr !== null;
      const val = hasEdge ? (weighted ? String(d.mem[addr].w ?? 1) : '1') : weighted ? '∞' : '0';
      P.push(B(startX + c * cell, startY + r * cell, cell, cell, val, hasEdge || u === d.hi));
    });
  });

  return P;
}

function shiftPrimitives(prims, dx, dy) {
  return prims.map((p) =>
    p.t === 'l'
      ? { ...p, x: p.x + dx, y: p.y + dy, x2: p.x2 + dx, y2: p.y2 + dy }
      : { ...p, x: p.x + dx, y: p.y + dy },
  );
}

registerDS('graph', {
  name: 'Graph',
  sub: 'Visual, Adj List & Matrix',
  icon: 'hub',
  defaultPrefix: 'graph',
  bulkPlaceholder: 'e.g. A, B, C, A-B:5, B->C:3',
  h: 'addEdge: value=u, arg=v (or v:w). Drag nodes directly in Visual mode.',
  meta: [
    {
      k: 'view',
      l: 'View Mode',
      options: [
        { v: 'both', l: 'Visual + List' },
        { v: 'visual', l: 'Visual Only' },
        { v: 'list', l: 'Adj List' },
        { v: 'matrix', l: 'Adj Matrix' },
      ],
    },
    {
      k: 'directed',
      l: 'Direction',
      n: 1,
      options: [
        { v: 0, l: 'Undirected' },
        { v: 1, l: 'Directed' },
      ],
    },
    {
      k: 'weighted',
      l: 'Weights',
      n: 1,
      options: [
        { v: 0, l: 'Unweighted' },
        { v: 1, l: 'Weighted' },
      ],
    },
  ],
  dropOps: {
    addVertex: 0,
    addEdge: 'to vertex (or v:w)',
    removeEdge: 'to vertex',
    removeVertex: 0,
    bfs: 0,
    dfs: 0,
  },
  init: () => ({
    v: [],
    h: {},
    mem: {},
    pos: {},
    m: { view: 'both', directed: 0, weighted: 0 },
    hi: null,
  }),
  bulkLoad: (d, raw) => {
    const tokens = parseCSV(raw);
    d.v = [];
    d.h = {};
    d.mem = {};
    d.pos = {};
    d.q = 240;
    d.hi = null;

    // Auto-detect directed (->) or weighted (:w) syntax from input
    if (tokens.some((t) => t.includes('->'))) d.m.directed = 1;
    if (tokens.some((t) => t.includes(':'))) d.m.weighted = 1;

    tokens.forEach((tok) => {
      if (tok.includes('->') || tok.includes('-')) {
        const [edgePart, wPart] = tok.split(':').map((s) => s.trim());
        const parts = edgePart.split(/->|-/).map((s) => s.trim()).filter(Boolean);
        if (parts.length === 2) {
          const [u, v] = parts;
          const weight = wPart !== undefined && wPart !== '' ? (isNaN(+wPart) ? wPart : +wPart) : 1;
          ensureVertex(d, u);
          ensureVertex(d, v);
          upsertDirectedEdge(d, u, v, weight);
          if (!+d.m.directed) upsertDirectedEdge(d, v, u, weight);
        }
      } else {
        ensureVertex(d, tok);
      }
    });

    arrangeCircle(d);
    d.note = `loaded ${d.v.length} vertex(es)`;
  },
  ops: {
    addVertex: (d, v) => {
      if (v && !d.v.includes(v)) {
        d.v.push(v);
        d.h[v] = null;
        ensureVertexPos(d, v);
        d.hi = v;
        d.note = `added vertex ${v}`;
      }
    },
    addEdge: (d, u, vRaw, wRaw) => {
      const { target: v, weight, hasExplicitWeight } = parseTargetAndWeight(vRaw, wRaw);
      if (!u || !v) {
        d.note = 'specify u (value) and v (arg)';
        return;
      }
      if (!d.v.includes(u) || !d.v.includes(v)) {
        d.note = 'vertex missing';
        return;
      }
      if (hasExplicitWeight) d.m.weighted = 1;
      upsertDirectedEdge(d, u, v, weight);
      if (!+d.m.directed) upsertDirectedEdge(d, v, u, weight);
      const wTxt = +d.m.weighted ? ` (w=${weight})` : '';
      d.note = `edge ${u}${+d.m.directed ? '→' : '—'}${v}${wTxt}`;
    },
    removeEdge: (d, u, vRaw) => {
      const { target: v } = parseTargetAndWeight(vRaw);
      unlinkEdge(d, u, v);
      if (!+d.m.directed) unlinkEdge(d, v, u);
      d.note = `removed edge ${u}–${v}`;
    },
    removeVertex: (d, v) => {
      d.v.forEach((u) => unlinkEdge(d, u, v));
      for (let a = d.h[v]; a;) {
        const next = d.mem[a].n;
        delete d.mem[a];
        a = next;
      }
      d.v = d.v.filter((x) => x != v);
      delete d.h[v];
      if (d.pos) delete d.pos[v];
      d.note = `removed vertex ${v}`;
    },
    autoLayout: (d) => {
      arrangeCircle(d);
      d.note = 're-arranged vertices in circle';
    },
    bfs: (d, s) => {
      if (!d.v.includes(s)) return;
      const order = [s];
      const q = [s];
      while (q.length) {
        for (const y of neighbors(d, q.shift())) {
          if (!order.includes(y)) {
            order.push(y);
            q.push(y);
          }
        }
      }
      d.note = 'BFS: ' + order.join(' → ');
    },
    dfs: (d, s) => {
      if (!d.v.includes(s)) return;
      const order = [];
      const visit = (x) => {
        order.push(x);
        neighbors(d, x).forEach((y) => order.includes(y) || visit(y));
      };
      visit(s);
      d.note = 'DFS: ' + order.join(' → ');
    },
  },
  // Sub-item hit-testing for dragging individual vertices on canvas
  hitSubItem: (el, localPt) => {
    const view = el.d.m?.view || 'both';
    if (view !== 'visual' && view !== 'both') return null;
    if (!el.d.pos) return null;
    for (let i = el.d.v.length - 1; i >= 0; i--) {
      const u = el.d.v[i];
      const p = el.d.pos[u];
      if (p && Math.hypot(localPt.x - p.x, localPt.y - p.y) <= NODE_R + 3) {
        return { vertex: u, ox: p.x, oy: p.y };
      }
    }
    return null;
  },
  dragSubItem: (el, sub, dx, dy) => {
    el.d.pos[sub.vertex] = {
      x: Math.round(sub.ox + dx),
      y: Math.round(sub.oy + dy),
    };
    el.d.hi = sub.vertex;
  },
  layout: (d) => {
    const view = d.m?.view || 'both';
    if (view === 'visual') return buildVisualPrimitives(d);
    if (view === 'list') return buildListPrimitives(d);
    if (view === 'matrix') return buildMatrixPrimitives(d);

    // Dual mode: Visual on left, Adjacency List on right
    const visual = buildVisualPrimitives(d);
    if (!d.v.length) return visual;
    const vb = primitivesBounds(visual);
    const list = shiftPrimitives(buildListPrimitives(d), vb.x + vb.w + 64, 0);
    return [...visual, ...list];
  },
});
