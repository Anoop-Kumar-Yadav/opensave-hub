/**
 * Drawing primitives and shared low-level memory helpers for Data Structure layouts.
 */
export const B = (x, y, w, h, s, hl) => ({ t: 'b', x, y, w, h, s, hl });
export const C = (x, y, s, hl) => ({ t: 'c', x, y, s, hl });
export const L = (x, y, x2, y2, ar, label = null, curve = 0) => ({ t: 'l', x, y, x2, y2, ar, label, curve });
export const T = (x, y, s) => ({ t: 't', x, y, s });
export const TL = (x, y, s) => T(x + 4 * s.length, y, s);
export const TAG = (x, y, s) => ({ t: 'tag', x, y, s });

export const cmp = (a, b) =>
  (+a == a && +b == b) ? a - b : (a < b ? -1 : a > b ? 1 : 0);

export const hex = (n) => '0x' + n.toString(16);

export const alloc = (d, obj) => {
  const addr = hex((d.q = (d.q || 240) + 16));
  d.mem[addr] = obj;
  return addr;
};

export const ptr = (addr) => (addr ? '●' : '∅');

/**
 * Splits a comma-separated string into trimmed non-empty tokens.
 */
export const parseCSV = (raw) =>
  String(raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/**
 * Shared layout: rows of [label | head ptr] -> chain of nodes [data.. | next ptr]
 */
export const rowsLayout = (rows, numFields) => {
  const P = [];
  const W = 56 * numFields + 44;
  const G = W + 50;

  rows.forEach((r, j) => {
    const y = j * 72;
    P.push(B(0, y, 44, 36, r.l, r.hl), B(44, y, 40, 36, ptr(r.h)));
    let px = 84;

    r.n.forEach((n, m) => {
      const x = 150 + m * G;
      P.push(L(px, y + 18, x, y + 18, 1), T(x + W / 2, y - 8, n.a));
      n.f.forEach((s, i) => P.push(B(x + i * 56, y, 56, 36, s, n.hl && i === 0)));
      P.push(B(x + numFields * 56, y, 44, 36, ptr(n.nx)));
      px = x + W;
    });
  });

  return P;
};

export const walkChain = (d, head, extractFields) => {
  const out = [];
  for (let a = head; a; a = d.mem[a].n) {
    out.push({ a, f: extractFields(d.mem[a]), nx: d.mem[a].n, hl: a === d.hi });
  }
  return out;
};
