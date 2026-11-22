import { getDS } from '../ds/registry.js';
import { T, TAG } from './primitives.js';

/**
 * Computes tight bounding box of a list of primitives.
 */
export function primitivesBounds(p) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  const expand = (x, y) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  for (let i = 0; i < p.length; i++) {
    const q = p[i];
    if (q.t === 'b') {
      expand(q.x, q.y);
      expand(q.x + q.w, q.y + q.h);
    } else if (q.t === 'c') {
      expand(q.x - 20, q.y - 20);
      expand(q.x + 20, q.y + 20);
    } else if (q.t === 'l') {
      expand(q.x, q.y);
      expand(q.x2, q.y2);
      if (q.curve) {
        const dx = q.x2 - q.x;
        const dy = q.y2 - q.y;
        const len = Math.hypot(dx, dy) || 1;
        const mx = (q.x + q.x2) / 2 - (dy / len) * q.curve * 0.5;
        const my = (q.y + q.y2) / 2 + (dx / len) * q.curve * 0.5;
        expand(mx - 12, my - 12);
        expand(mx + 12, my + 12);
      }
    } else if (q.t === 'tag') {
      const w = Math.max(48, ('' + q.s).length * 8.5 + 16);
      expand(q.x, q.y);
      expand(q.x + w, q.y + 22);
    } else {
      const hw = 4 * ('' + q.s).length;
      expand(q.x - hw, q.y - 9);
      expand(q.x + hw, q.y + 9);
    }
  }
  return p.length ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : { x: 0, y: 0, w: 50, h: 40 };
}

/**
 * Invalidates cached layout primitives and bounds on a DS element.
 * Must be called whenever a DS mutates or its variable name changes.
 */
export function invalidateLayout(el) {
  if (el) {
    el._prims = null;
    el._pb = null;
  }
}

export function getPrimitives(el) {
  if (el._prims) return el._prims;
  const p = getDS(el.k).layout(el.d).filter(Boolean);
  const b = primitivesBounds(p);

  if (el.varName && el.varName.trim()) {
    p.unshift(TAG(b.x, b.y - 30, el.varName.trim()));
  }

  if (el.d.note) {
    p.push(T(b.x + b.w / 2, b.y + b.h + 22, el.d.note));
  }

  el._prims = p;
  el._pb = primitivesBounds(p);
  return p;
}

export function getBounds(el) {
  if (el.type === 'ds') {
    getPrimitives(el);
    return { x: el._pb.x + el.x, y: el._pb.y + el.y, w: el._pb.w, h: el._pb.h };
  }
  if (el.type === 'text') {
    return { x: el.x, y: el.y, w: Math.max(20, el.s.length * 10.5), h: 24 };
  }
  if (el.type === 'pen') {
    let x1 = 1e9, y1 = 1e9, x2 = -1e9, y2 = -1e9;
    for (const q of el.p) {
      if (q[0] < x1) x1 = q[0];
      if (q[0] > x2) x2 = q[0];
      if (q[1] < y1) y1 = q[1];
      if (q[1] > y2) y2 = q[1];
    }
    return { x: el.x + x1, y: el.y + y1, w: x2 - x1, h: y2 - y1 };
  }
  return {
    x: Math.min(el.x, el.x + el.w),
    y: Math.min(el.y, el.y + el.h),
    w: Math.abs(el.w),
    h: Math.abs(el.h),
  };
}

export function hitTest(el, pt) {
  const b = getBounds(el);
  return pt.x >= b.x - 8 && pt.x <= b.x + b.w + 8 && pt.y >= b.y - 8 && pt.y <= b.y + b.h + 8;
}
