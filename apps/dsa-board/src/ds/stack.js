import { registerDS } from './registry.js';
import { B, T, hex, parseCSV } from '../core/primitives.js';

registerDS('stack', {
  name: 'Stack',
  sub: 'Array + stack pointer',
  icon: 'stacked_bar_chart',
  defaultPrefix: 'stk',
  bulkPlaceholder: 'e.g. 5, 10, 15 (bottom → top)',
  h: 'LIFO',
  meta: [
    { k: 'cap', l: 'Capacity', n: 1 },
    { k: 'base', l: 'Base addr', n: 1 },
  ],
  dropOps: { push: 0 },
  init: () => ({ a: [], m: { cap: 5, base: 4096 }, hi: null }),
  onMeta: (d) => {
    if (d.a.length > d.m.cap) d.a.length = d.m.cap;
  },
  bulkLoad: (d, raw) => {
    const vals = parseCSV(raw);
    d.a = [];
    if (vals.length > d.m.cap) d.m.cap = vals.length;
    vals.forEach((v) => d.a.push(v));
    d.hi = d.a.length ? d.a.length - 1 : null;
    d.note = `pushed ${vals.length} value(s)`;
  },
  ops: {
    push: (d, v) => {
      if (d.a.length >= d.m.cap) {
        d.note = 'stack overflow (sp == capacity)';
        return;
      }
      d.a.push(v);
      d.hi = d.a.length - 1;
      d.note = `a[sp]=${v}; sp++`;
    },
    pop: (d) => {
      if (!d.a.length) {
        d.note = 'stack underflow (sp == 0)';
        return;
      }
      d.note = 'sp--; returned ' + d.a.pop();
    },
    peek: (d) => {
      d.hi = d.a.length - 1;
    },
  },
  layout: (d) => {
    const n = Math.min(d.m.cap, 20);
    return [
      ...Array.from({ length: n }, (_, i) => [
        B(0, (n - 1 - i) * 40, 70, 40, d.a[i] ?? '', i === d.hi),
        T(-30, (n - 1 - i) * 40 + 20, hex(d.m.base + i * 4)),
      ]).flat(),
      T(125, (n - 1 - Math.min(d.a.length, n - 1)) * 40 + 20, '◄ sp=' + d.a.length),
    ];
  },
});
