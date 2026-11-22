import { registerDS } from './registry.js';
import { B, T, TL, hex, parseCSV } from '../core/primitives.js';

function ensureRoom(d) {
  const m = d.m;
  if (d.a.length < m.cap) return true;
  if (!+m.grow) {
    d.note = 'overflow: length == capacity';
    return false;
  }
  m.cap *= 2;
  d.note = `realloc ${m.cap / 2}→${m.cap} slots, copied ${d.a.length}; `;
  return true;
}

registerDS('array', {
  name: 'Array',
  sub: 'Contiguous memory',
  icon: 'view_week',
  defaultPrefix: 'arr',
  bulkPlaceholder: 'e.g. 10, 20, 30, 40',
  h: 'i = index',
  meta: [
    { k: 'cap', l: 'Capacity', n: 1 },
    { k: 'size', l: 'Elem bytes', n: 1 },
    { k: 'base', l: 'Base addr', n: 1 },
    { k: 'grow', l: 'Auto-grow (1/0)', n: 1 },
  ],
  dropOps: { append: 0, insert: 'index', update: 'index', search: 0 },
  init: () => ({ a: [], m: { cap: 4, size: 4, base: 4096, grow: 1 }, hi: null }),
  onMeta: (d) => {
    if (d.a.length > d.m.cap) d.a.length = d.m.cap;
  },
  bulkLoad: (d, raw) => {
    const vals = parseCSV(raw);
    d.a = [];
    if (vals.length > d.m.cap) d.m.cap = vals.length;
    vals.forEach((v) => d.a.push(v));
    d.hi = d.a.length ? d.a.length - 1 : null;
    d.note = `initialized ${vals.length} value(s)`;
  },
  ops: {
    append: (d, v) => {
      if (ensureRoom(d)) {
        d.a.push(v);
        d.hi = d.a.length - 1;
        d.note += `a[${d.hi}]=${v} at ${hex(d.m.base + d.hi * d.m.size)}`;
      }
    },
    insert: (d, v, i) => {
      i = Math.min(+i || 0, d.a.length);
      if (ensureRoom(d)) {
        d.a.splice(i, 0, v);
        d.hi = i;
        d.note += `shifted ${d.a.length - 1 - i} elements right`;
      }
    },
    remove: (d, v, i) => {
      i = i === '' ? d.a.length - 1 : +i;
      if (d.a[i] === undefined) return;
      d.a.splice(i, 1);
      d.note = `shifted ${d.a.length - i} elements left`;
    },
    update: (d, v, i) => {
      if (d.a[+i] !== undefined) {
        d.a[+i] = v;
        d.hi = +i;
      }
    },
    search: (d, v) => {
      const k = d.a.indexOf(v);
      d.hi = k;
      d.note = k < 0 ? `not found (scanned ${d.a.length})` : `found at index ${k}`;
    },
  },
  layout: (d) => {
    const m = d.m;
    const n = Math.min(m.cap, 24);
    return [
      ...Array.from({ length: n }, (_, i) => [
        B(i * 64, 0, 64, 40, d.a[i] ?? '', i === d.hi),
        T(i * 64 + 32, -12, i),
        T(i * 64 + 32, 56, hex(m.base + i * m.size)),
      ]).flat(),
      TL(0, 82, `len=${d.a.length}  cap=${m.cap}`),
    ];
  },
});
