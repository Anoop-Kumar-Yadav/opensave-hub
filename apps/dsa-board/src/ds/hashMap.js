import { registerDS } from './registry.js';
import { B, L, T, TL, alloc, rowsLayout, walkChain, parseCSV } from '../core/primitives.js';
import { evalExpr } from '../core/expr.js';

const HASH_PRESETS = {
  sum: 'sum(k) % n',
  poly: 'poly(k, 31) % n',
  num: 'num(k) % n',
  len: 'len(k) % n',
};

const makeHasher = (d) => (k) => {
  const n = Math.max(1, +d.m.cap | 0);
  const r = evalExpr(d.m.fn, { k, n });
  if (!isFinite(r)) throw Error('hash not finite');
  return [r, ((r % n) + n) % n];
};

const isProbing = (strategy) => strategy === 'linear' || strategy === 'quadratic';

const probeIndex = (base, step, n, strategy) =>
  strategy === 'quadratic' ? (base + step * step) % n : (base + step) % n;

/* ===== Storage Extraction & Migration ===== */
function extractAllEntries(d) {
  const strat = d._strat || 'chaining';
  if (isProbing(strat)) {
    return (d.slots || [])
      .filter((s) => s && !s.tomb)
      .map((s) => [s.k, s.v]);
  }
  return (d.b || []).flatMap((h) => walkChain(d, h, (n) => [n.k, n.v]).map((x) => x.f));
}

function resetStorage(d, n) {
  d.m.cap = n;
  d._strat = d.m.strategy;
  d.b = Array(n).fill(null);
  d.mem = {};
  d.slots = Array(n).fill(null);
  d.q = 240;
  d.hi = null;
  d.hiBucket = null;
}

function getEntryCount(d) {
  if (isProbing(d._strat)) {
    return (d.slots || []).filter((s) => s && !s.tomb).length;
  }
  return Object.keys(d.mem || {}).length;
}

function getCollisionCount(d) {
  const n = Math.max(1, +d.m.cap | 0);
  if (isProbing(d._strat)) {
    let collisions = 0;
    const hash = makeHasher(d);
    (d.slots || []).forEach((s, idx) => {
      if (s && !s.tomb) {
        try {
          if (hash(s.k)[1] !== idx) collisions++;
        } catch { /* ignore invalid expr */ }
      }
    });
    return collisions;
  }
  let collisions = 0;
  (d.b || []).forEach((h) => {
    const len = walkChain(d, h, (x) => [x.k]).length;
    if (len > 1) collisions += len - 1;
  });
  return collisions;
}

/* ===== Chaining Helpers ===== */
const findInBucket = (d, i, k) => {
  let a = d.b[i];
  while (a && d.mem[a].k != k) a = d.mem[a].n;
  return a;
};

const putInBucket = (d, k, v, i) => {
  const a = findInBucket(d, i, k);
  if (a) {
    d.mem[a].v = v;
    return { addr: a, updated: true, collided: false };
  }
  const collided = d.b[i] !== null;
  const addr = alloc(d, { k, v, n: d.b[i] });
  d.b[i] = addr;
  return { addr, updated: false, collided };
};

/* ===== Open Addressing (Linear / Quadratic Probing) Helpers ===== */
function putProbing(d, k, v, hashFn) {
  const n = Math.max(1, +d.m.cap | 0);
  const strat = d._strat;
  const [raw, base] = hashFn(k);
  let firstTomb = -1;
  const path = [];

  for (let step = 0; step < n; step++) {
    const idx = probeIndex(base, step, n, strat);
    path.push(idx);
    const slot = d.slots[idx];

    if (!slot) {
      const target = firstTomb >= 0 ? firstTomb : idx;
      d.slots[target] = { k, v };
      return { raw, base, idx: target, updated: false, path };
    }
    if (slot.tomb) {
      if (firstTomb < 0) firstTomb = idx;
    } else if (slot.k == k) {
      slot.v = v;
      return { raw, base, idx, updated: true, path };
    }
  }

  if (firstTomb >= 0) {
    d.slots[firstTomb] = { k, v };
    return { raw, base, idx: firstTomb, updated: false, path };
  }
  throw Error('hash table full (increase buckets or enable auto-rehash)');
}

function findProbing(d, k, hashFn) {
  const n = Math.max(1, +d.m.cap | 0);
  const strat = d._strat;
  const [, base] = hashFn(k);
  const path = [];

  for (let step = 0; step < n; step++) {
    const idx = probeIndex(base, step, n, strat);
    path.push(idx);
    const slot = d.slots[idx];
    if (!slot) return { base, idx: -1, path };
    if (!slot.tomb && slot.k == k) return { base, idx, path };
  }
  return { base, idx: -1, path };
}

/* ===== Rehash ===== */
function rehashAll(d, targetCap) {
  const entries = extractAllEntries(d);
  const n = Math.max(1, targetCap | 0);
  const hash = makeHasher({ ...d, m: { ...d.m, cap: n } });
  // Pre-validate hash expression before mutating storage
  entries.forEach(([k]) => hash(k));

  resetStorage(d, n);
  if (isProbing(d._strat)) {
    entries.forEach(([k, v]) => putProbing(d, k, v, hash));
  } else {
    entries.forEach(([k, v]) => {
      const [, i] = hash(k);
      putInBucket(d, k, v, i);
    });
  }
  return entries.length;
}

function maybeAutoRehash(d, extraCount = 0) {
  if (!+d.m.autoRehash) return null;
  const cap = Math.max(1, +d.m.cap | 0);
  const maxLoad = Math.min(1, Math.max(0.1, +d.m.maxLoad || 0.75));
  const nextSize = getEntryCount(d) + extraCount;
  if (nextSize / cap > maxLoad) {
    const newCap = cap * 2;
    rehashAll(d, newCap);
    return `${cap}→${newCap}`;
  }
  return null;
}

/* ===== Layouts ===== */
function buildChainingCompact(d) {
  const P = [];
  d.b.forEach((h, j) => {
    const y = j * 50;
    P.push(B(0, y, 42, 34, j, j === d.hiBucket));
    const nodes = walkChain(d, h, (n) => [n.k, n.v]);
    let px = 42;
    nodes.forEach((n, m) => {
      const text = `${n.f[0]}: ${n.f[1]}`;
      const w = Math.max(66, text.length * 8 + 18);
      const x = px + (m === 0 ? 34 : 26);
      P.push(L(px, y + 17, x, y + 17, 1));
      P.push(B(x, y, w, 34, text, n.hl));
      px = x + w;
    });
    if (!nodes.length) {
      P.push(T(64, y + 17, '∅'));
    }
  });
  return P;
}

function buildProbingLayout(d) {
  const compact = d.m.view === 'compact';
  const P = [];
  const n = d.slots.length;
  const colW = compact ? 78 : 96;
  const cellH = 42;

  for (let i = 0; i < n; i++) {
    const x = i * colW;
    const slot = d.slots[i];
    const isHi = i === d.hi;
    const isBase = i === d.hiBucket && !isHi;

    let label = '';
    if (slot) {
      label = slot.tomb ? 'TOMB' : `${slot.k}: ${slot.v}`;
    }

    P.push(T(x + colW / 2, -12, isBase ? `${i} ★` : String(i)));
    P.push(B(x, 0, colW, cellH, label, isHi));

    if (!compact) {
      const status = !slot ? 'empty' : slot.tomb ? 'deleted' : 'used';
      P.push(T(x + colW / 2, cellH + 14, status));
    }
  }
  return P;
}

registerDS('hashmap', {
  name: 'Hash Map',
  sub: 'Chaining & Open Addressing',
  icon: 'tag',
  defaultPrefix: 'map',
  bulkPlaceholder: 'e.g. a:1, b:2, c:3, d:4',
  h: 'put: value=key, arg=val. fn vars: k, n',
  meta: [
    {
      k: 'strategy',
      l: 'Collision Strategy',
      options: [
        { v: 'chaining', l: 'Separate Chaining' },
        { v: 'linear', l: 'Linear Probing' },
        { v: 'quadratic', l: 'Quadratic Probing' },
      ],
    },
    {
      k: 'view',
      l: 'View Mode',
      options: [
        { v: 'memory', l: 'Memory (Pointers)' },
        { v: 'compact', l: 'Compact' },
      ],
    },
    {
      k: 'preset',
      l: 'Hash Preset',
      options: [
        { v: 'sum', l: 'Sum of chars' },
        { v: 'poly', l: 'Polynomial (31)' },
        { v: 'num', l: 'Numeric' },
        { v: 'len', l: 'String length' },
        { v: 'custom', l: 'Custom' },
      ],
    },
    { k: 'fn', l: 'hash(k) =', w: 220 },
    { k: 'cap', l: 'Buckets (n)', n: 1 },
    {
      k: 'autoRehash',
      l: 'Auto-Rehash',
      n: 1,
      options: [
        { v: 1, l: 'On' },
        { v: 0, l: 'Off' },
      ],
    },
    { k: 'maxLoad', l: 'Max Load', n: 1 },
  ],
  dropOps: { put: 'value', get: 0, remove: 0 },
  init: () => ({
    _strat: 'chaining',
    b: Array(5).fill(null),
    mem: {},
    slots: Array(5).fill(null),
    m: {
      strategy: 'chaining',
      view: 'memory',
      preset: 'sum',
      fn: 'sum(k) % n',
      cap: 5,
      autoRehash: 1,
      maxLoad: 0.75,
    },
    hi: null,
    hiBucket: null,
  }),
  onMeta: (d, changedKey) => {
    if (changedKey === 'preset' && HASH_PRESETS[d.m.preset]) {
      d.m.fn = HASH_PRESETS[d.m.preset];
    } else if (changedKey === 'fn') {
      const match = Object.entries(HASH_PRESETS).find(([, expr]) => expr === d.m.fn.trim());
      d.m.preset = match ? match[0] : 'custom';
    }

    if (changedKey === 'view' || changedKey === 'autoRehash' || changedKey === 'maxLoad') {
      if (changedKey === 'autoRehash' || changedKey === 'maxLoad') {
        const resized = maybeAutoRehash(d, 0);
        if (resized) d.note = `auto-rehashed ${resized}`;
      }
      return;
    }

    const n = Math.max(1, +d.m.cap | 0);
    const count = rehashAll(d, n);
    d.note = `rehashed ${count} entry(ies) (${d.m.strategy})`;
  },
  bulkLoad: (d, raw) => {
    const tokens = parseCSV(raw);
    let n = Math.max(1, +d.m.cap | 0);
    const maxLoad = Math.min(1, Math.max(0.1, +d.m.maxLoad || 0.75));
    if (+d.m.autoRehash && tokens.length / n > maxLoad) {
      while (tokens.length / n > maxLoad) n *= 2;
    } else if (isProbing(d.m.strategy) && tokens.length > n) {
      n = tokens.length;
    }

    resetStorage(d, n);
    const hash = makeHasher(d);
    tokens.forEach((tok, idx) => {
      const sep = tok.includes(':') ? ':' : tok.includes('=') ? '=' : null;
      const [k, v] = sep ? tok.split(sep).map((s) => s.trim()) : [tok, String(idx)];
      if (!k) return;
      if (isProbing(d._strat)) {
        const res = putProbing(d, k, v ?? '', hash);
        d.hi = res.idx;
        d.hiBucket = res.base;
      } else {
        const [, i] = hash(k);
        const res = putInBucket(d, k, v ?? '', i);
        d.hi = res.addr;
        d.hiBucket = i;
      }
    });
    d.note = `loaded ${tokens.length} entry(ies) into ${n} buckets`;
  },
  ops: {
    put: (d, k, v) => {
      if (!k) return;
      let resizedNote = '';

      if (isProbing(d._strat)) {
        const existing = findProbing(d, k, makeHasher(d));
        if (existing.idx < 0) {
          const resized = maybeAutoRehash(d, 1);
          if (resized) resizedNote = `auto-rehash ${resized}; `;
        }
        const res = putProbing(d, k, v, makeHasher(d));
        d.hi = res.idx;
        d.hiBucket = res.base;
        const probeTxt = res.path.length > 1 ? `probed [${res.path.join('→')}]` : `slot ${res.idx}`;
        d.note = `${resizedNote}h("${k}")=${res.raw} mod ${d.m.cap}=${res.base}; ${probeTxt}` + (res.updated ? ' (updated)' : '');
      } else {
        const hash0 = makeHasher(d);
        const [, i0] = hash0(k);
        if (!findInBucket(d, i0, k)) {
          const resized = maybeAutoRehash(d, 1);
          if (resized) resizedNote = `auto-rehash ${resized}; `;
        }
        const [r, i] = makeHasher(d)(k);
        const res = putInBucket(d, k, v, i);
        d.hi = res.addr;
        d.hiBucket = i;
        d.note =
          `${resizedNote}h("${k}")=${r}; ${r} mod ${d.m.cap} = ${i}; ` +
          (res.updated ? 'key exists → updated' : res.collided ? `collision at bucket[${i}] → prepended ${res.addr}` : `bucket[${i}] = ${res.addr}`);
      }
    },
    get: (d, k) => {
      if (!k) return;
      if (isProbing(d._strat)) {
        const res = findProbing(d, k, makeHasher(d));
        d.hi = res.idx >= 0 ? res.idx : null;
        d.hiBucket = res.base;
        d.note =
          `probes [${res.path.join('→')}]; ` +
          (res.idx >= 0 ? `found value=${d.slots[res.idx].v}` : 'not found');
      } else {
        const i = makeHasher(d)(k)[1];
        let a = d.b[i];
        let hops = 0;
        while (a && d.mem[a].k != k) {
          a = d.mem[a].n;
          hops++;
        }
        d.hi = a;
        d.hiBucket = i;
        d.note = `bucket ${i}; ` + (a ? `found after ${hops + 1} compare(s): value=${d.mem[a].v}` : 'not found');
      }
    },
    remove: (d, k) => {
      if (!k) return;
      if (isProbing(d._strat)) {
        const res = findProbing(d, k, makeHasher(d));
        d.hiBucket = res.base;
        if (res.idx < 0) {
          d.note = 'not found';
          return;
        }
        d.slots[res.idx] = { tomb: true };
        d.hi = res.idx;
        d.note = `marked slot ${res.idx} as TOMB (tombstone)`;
      } else {
        const i = makeHasher(d)(k)[1];
        let prev = null;
        let a = d.b[i];
        while (a && d.mem[a].k != k) {
          prev = a;
          a = d.mem[a].n;
        }
        d.hiBucket = i;
        if (!a) {
          d.note = 'not found';
          return;
        }
        if (prev) d.mem[prev].n = d.mem[a].n;
        else d.b[i] = d.mem[a].n;
        delete d.mem[a];
        d.note = `unlinked ${a} from bucket ${i}`;
      }
    },
    rehash: (d) => {
      const newCap = Math.max(1, +d.m.cap | 0) * 2;
      const count = rehashAll(d, newCap);
      d.note = `manual rehash → ${newCap} buckets (${count} entries)`;
    },
  },
  layout: (d) => {
    const cap = Math.max(1, +d.m.cap | 0);
    const size = getEntryCount(d);
    const pct = Math.round((size / cap) * 100);
    const collisions = getCollisionCount(d);
    const header = TL(
      0,
      -34,
      `${d.m.strategy}  |  h(k) = ${d.m.fn}  |  load = ${size}/${cap} (${pct}%)  |  collisions = ${collisions}`,
    );

    if (isProbing(d._strat)) {
      return [header, ...buildProbingLayout(d)];
    }

    if (d.m.view === 'compact') {
      return [header, ...buildChainingCompact(d)];
    }

    return [
      header,
      ...rowsLayout(
        d.b.map((h, j) => ({
          l: j,
          h,
          hl: j === d.hiBucket,
          n: walkChain(d, h, (n) => [n.k, n.v]),
        })),
        2,
      ),
    ];
  },
});
