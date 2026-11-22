import { registerDS } from './registry.js';
import { B, C, L, T, TL, cmp, hex, parseCSV } from '../core/primitives.js';

const getComparator = (d) => (d.m.order === 'max' ? (a, b) => cmp(b, a) : cmp);

function heapPush(d, v) {
  const a = d.a;
  const c = getComparator(d);
  a.push(v);
  let k = a.length - 1;
  while (k > 0) {
    const p = (k - 1) >> 1;
    if (c(a[k], a[p]) >= 0) break;
    [a[k], a[p]] = [a[p], a[k]];
    k = p;
  }
  return k;
}

registerDS('heap', {
  name: 'Binary Heap',
  sub: 'Array-backed min/max',
  icon: 'change_history',
  defaultPrefix: 'heap',
  bulkPlaceholder: 'e.g. 40, 10, 30, 5, 20',
  h: 'children of i: 2i+1, 2i+2',
  meta: [
    { k: 'order', l: 'Order (min/max)', w: 60 },
    { k: 'base', l: 'Base addr', n: 1 },
  ],
  dropOps: { insert: 0 },
  init: () => ({ a: [], m: { order: 'min', base: 4096 }, hi: null }),
  onMeta: (d) => {
    const items = d.a.slice();
    d.a = [];
    items.forEach((v) => heapPush(d, v));
    d.note = 're-heapified';
  },
  bulkLoad: (d, raw) => {
    const vals = parseCSV(raw);
    d.a = [];
    vals.forEach((v) => heapPush(d, v));
    d.hi = d.a.length ? 0 : null;
    d.note = `heapified ${vals.length} value(s)`;
  },
  ops: {
    insert: (d, v) => {
      if (v) {
        d.hi = heapPush(d, v);
        d.note = `append at index ${d.a.length - 1}, sift-up to ${d.hi}`;
      }
    },
    extract: (d) => {
      const a = d.a;
      const c = getComparator(d);
      if (!a.length) return;
      const top = a[0];
      const last = a.pop();
      if (a.length) {
        a[0] = last;
        let k = 0;
        for (;;) {
          let m = k;
          const left = 2 * k + 1;
          const right = left + 1;
          if (left < a.length && c(a[left], a[m]) < 0) m = left;
          if (right < a.length && c(a[right], a[m]) < 0) m = right;
          if (m === k) break;
          [a[k], a[m]] = [a[m], a[k]];
          k = m;
        }
      }
      d.note = `extracted root ${top}; last→root, sift-down`;
    },
    peek: (d) => { d.hi = 0; },
  },
  layout: (d) => {
    const a = d.a;
    const P = [TL(0, -34, `${d.m.order}-heap  size=${a.length}`)];
    const N = [];
    let k = 0;

    const place = (i, depth) => {
      if (i >= a.length) return;
      place(2 * i + 1, depth + 1);
      N[i] = { x: k++ * 50, y: depth * 70 };
      place(2 * i + 2, depth + 1);
    };
    place(0, 0);

    N.forEach((o, i) =>
      [2 * i + 1, 2 * i + 2].forEach((c) => N[c] && P.push(L(o.x, o.y, N[c].x, N[c].y))),
    );
    N.forEach((o, i) => P.push(C(o.x, o.y, a[i], i === d.hi)));

    const y = 70 * Math.ceil(Math.log2(a.length + 1)) + 10;
    return P.concat(
      a
        .map((v, i) => [
          B(i * 56, y, 56, 36, v, i === d.hi),
          T(i * 56 + 28, y - 8, i),
          T(i * 56 + 28, y + 52, hex(d.m.base + i * 4)),
        ])
        .flat(),
    );
  },
});
