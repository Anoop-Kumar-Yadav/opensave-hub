/**
 * Tweens primitives between previous and next DS layouts over 600ms.
 */
const DURATION_MS = 600;
const easeOutCubic = (t) => 1 - (1 - t) ** 3;

let activeAnim = null;

export function startAnimation(id, oldPrimitives) {
  activeAnim = { id, old: oldPrimitives, t: performance.now() };
}

export function isAnimating() {
  if (!activeAnim) return false;
  if (performance.now() - activeAnim.t >= DURATION_MS) {
    activeAnim = null;
    return false;
  }
  return true;
}

export function animatePrimitives(id, primitives) {
  if (!activeAnim || activeAnim.id !== id) return primitives;
  const progress = Math.min(1, (performance.now() - activeAnim.t) / DURATION_MS);
  const k = easeOutCubic(progress);
  const pool = activeAnim.old.slice();

  return primitives.map((p) => {
    if (p.t === 'tag') return p;
    const j = pool.findIndex(
      (o) =>
        o.t === p.t &&
        (p.t === 'l'
          ? o.x === p.x && o.y === p.y && o.x2 === p.x2 && o.y2 === p.y2
          : o.s === p.s),
    );
    if (j >= 0) {
      const o = pool.splice(j, 1)[0];
      return { ...p, x: o.x + (p.x - o.x) * k, y: o.y + (p.y - o.y) * k };
    }
    return {
      ...p,
      a: k,
      y: p.y - (1 - k) * 30,
      y2: p.y2 != null ? p.y2 - (1 - k) * 30 : p.y2,
    };
  });
}
