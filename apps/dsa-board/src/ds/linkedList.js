import { registerDS } from './registry.js';
import { B, L, T, alloc, parseCSV } from '../core/primitives.js';

function createOps(isDoubly) {
  const ops = {};

  ops.addHead = (d, v) => {
    const a = alloc(d, { v, n: d.h, p: null });
    if (d.h) d.mem[d.h].p = a;
    else d.t = a;
    d.h = a;
    d.hi = a;
    d.note = `new=${a}; new.next=head` + (isDoubly ? '; old.prev=new' : '') + '; head=new';
  };

  ops.addTail = (d, v) => {
    const a = alloc(d, { v, n: null, p: d.t || null });
    if (d.t) d.mem[d.t].n = a;
    else d.h = a;
    d.t = a;
    d.hi = a;
    d.note = (isDoubly ? '' : 'walk to last; ') + `new=${a}; last.next=new` + (isDoubly ? '; new.prev=tail; tail=new' : '');
  };

  ops.insertAt = (d, v, i) => {
    i = +i || 0;
    if (i <= 0 || !d.h) return ops.addHead(d, v);
    let c = d.h;
    while (--i > 0 && d.mem[c].n) c = d.mem[c].n;
    const x = d.mem[c].n;
    if (!x) return ops.addTail(d, v);
    const a = alloc(d, { v, n: x, p: c });
    d.mem[c].n = a;
    d.mem[x].p = a;
    d.hi = a;
    d.note = `new=${a}; new.next=${x}; ${c}.next=new` + (isDoubly ? `; new.prev=${c}; ${x}.prev=new` : '');
  };

  ops.remove = (d, v) => {
    let c = d.h;
    while (c && d.mem[c].v != v) c = d.mem[c].n;
    if (!c) {
      d.note = 'not found';
      return;
    }
    const n = d.mem[c];
    if (n.p) d.mem[n.p].n = n.n;
    else d.h = n.n;
    if (n.n) d.mem[n.n].p = n.p;
    else d.t = n.p;
    delete d.mem[c];
    d.note = `unlink ${c}; free(${c})`;
  };

  ops.reverse = (d) => {
    let c = d.h;
    while (c) {
      const n = d.mem[c];
      [n.n, n.p] = [n.p, n.n];
      c = n.p;
    }
    [d.h, d.t] = [d.t, d.h];
    d.note = 'swap next/prev in every node; swap head/tail';
  };

  ops.search = (d, v) => {
    let c = d.h;
    let k = 0;
    while (c && d.mem[c].v != v) {
      c = d.mem[c].n;
      k++;
    }
    d.hi = c;
    d.note = c ? `found at ${c} after ${k} hops` : 'not found';
  };

  return ops;
}

function createLayout(isDoubly) {
  return (d) => {
    const w = isDoubly ? 172 : 112;
    const g = w + 50;
    const P = [];
    const ns = [];
    for (let c = d.h; c; c = d.mem[c].n) ns.push(c);

    P.push(B(0, -52, 120, 28, 'head = ' + (d.h || 'null')));
    if (d.h) P.push(L(10, -24, 10, -2, 1));

    ns.forEach((a, i) => {
      const n = d.mem[a];
      const x = i * g;
      let f = x;
      P.push(T(x + w / 2, -8, a));
      if (isDoubly) {
        P.push(B(f, 0, 60, 36, n.p || '∅'));
        f += 60;
      }
      P.push(B(f, 0, 52, 36, n.v, a === d.hi));
      f += 52;
      P.push(B(f, 0, 60, 36, n.n || '∅'));
      if (n.n) P.push(L(x + w, 12, x + g, 12, 1));
      if (isDoubly && n.p) P.push(L(x, 26, x - 50, 26, 1));
    });

    if (isDoubly) {
      const xl = Math.max(ns.length - 1, 0) * g;
      P.push(B(xl, 66, 120, 28, 'tail = ' + (d.t || 'null')));
      if (d.t) P.push(L(xl + 10, 66, xl + 10, 40, 1));
    }
    return P;
  };
}

const dropOps = { addHead: 0, addTail: 0, insertAt: 'index', remove: 0, search: 0 };
const sllOps = createOps(false);
const dllOps = createOps(true);

const makeBulkLoad = (ops) => (d, raw) => {
  const vals = parseCSV(raw);
  d.h = null;
  d.t = null;
  d.mem = {};
  d.q = 240;
  d.hi = null;
  vals.forEach((v) => ops.addTail(d, v));
  d.note = `loaded ${vals.length} node(s)`;
};

registerDS('linkedlist', {
  name: 'Singly Linked List',
  sub: 'Nodes + next pointers',
  icon: 'arrow_right_alt',
  defaultPrefix: 'list',
  bulkPlaceholder: 'e.g. 10, 20, 30',
  h: 'insertAt: arg = index',
  dropOps,
  init: () => ({ h: null, t: null, mem: {}, hi: null }),
  bulkLoad: makeBulkLoad(sllOps),
  ops: sllOps,
  layout: createLayout(false),
});

registerDS('dll', {
  name: 'Doubly Linked List',
  sub: 'Nodes + prev/next',
  icon: 'sync_alt',
  defaultPrefix: 'dll',
  bulkPlaceholder: 'e.g. 10, 20, 30',
  h: 'insertAt: arg = index',
  dropOps,
  init: () => ({ h: null, t: null, mem: {}, hi: null }),
  bulkLoad: makeBulkLoad(dllOps),
  ops: dllOps,
  layout: createLayout(true),
});
