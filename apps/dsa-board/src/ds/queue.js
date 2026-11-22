import { registerDS } from './registry.js';
import { B, T, TL, parseCSV } from '../core/primitives.js';

registerDS('queue', {
  name: 'Queue',
  sub: 'Circular buffer',
  icon: 'linear_scale',
  defaultPrefix: 'q',
  bulkPlaceholder: 'e.g. A, B, C, D',
  h: 'head/tail indices',
  meta: [{ k: 'cap', l: 'Capacity', n: 1 }],
  dropOps: { enqueue: 0 },
  init: () => ({ b: [null, null, null, null], hd: 0, sz: 0, m: { cap: 4 }, hi: null }),
  onMeta: (d) => {
    const items = [];
    for (let i = 0; i < d.sz; i++) items.push(d.b[(d.hd + i) % d.b.length]);
    const cap = Math.max(1, d.m.cap | 0);
    d.m.cap = cap;
    d.b = Array(cap).fill(null);
    d.sz = Math.min(items.length, cap);
    items.slice(0, cap).forEach((v, i) => (d.b[i] = v));
    d.hd = 0;
  },
  bulkLoad: (d, raw) => {
    const vals = parseCSV(raw);
    const cap = Math.max(d.m.cap, vals.length, 1);
    d.m.cap = cap;
    d.b = Array(cap).fill(null);
    vals.forEach((v, i) => (d.b[i] = v));
    d.hd = 0;
    d.sz = vals.length;
    d.hi = vals.length ? vals.length - 1 : null;
    d.note = `enqueued ${vals.length} value(s)`;
  },
  ops: {
    enqueue: (d, v) => {
      if (d.sz >= d.m.cap) {
        d.note = 'queue full (size == capacity)';
        return;
      }
      const t = (d.hd + d.sz) % d.m.cap;
      d.b[t] = v;
      d.sz++;
      d.hi = t;
      d.note = `tail=(head+size)%cap=${t}; b[tail]=${v}; size++`;
    },
    dequeue: (d) => {
      if (!d.sz) {
        d.note = 'queue empty';
        return;
      }
      d.note = `returned ${d.b[d.hd]}; head=(head+1)%cap`;
      d.b[d.hd] = null;
      d.hd = (d.hd + 1) % d.m.cap;
      d.sz--;
    },
    peek: (d) => {
      d.hi = d.hd;
    },
  },
  layout: (d) => {
    const n = Math.min(d.m.cap, 24);
    const tl = (d.hd + d.sz) % d.m.cap;
    return [
      ...d.b.slice(0, n).flatMap((v, i) => [
        B(i * 60, 0, 60, 40, v ?? '', i === d.hi),
        T(i * 60 + 30, -12, i),
      ]),
      T(d.hd * 60 + 30, 58, '▲ head'),
      T(tl * 60 + 30, 76, '▲ tail'),
      TL(0, 102, `size=${d.sz} cap=${d.m.cap}`),
    ];
  },
});
