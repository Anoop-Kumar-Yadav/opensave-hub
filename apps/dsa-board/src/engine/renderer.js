import { store } from '../core/store.js';
import { bus } from '../core/events.js';
import { getBounds, getPrimitives } from '../core/geometry.js';
import { animatePrimitives, isAnimating } from './animator.js';

let cv, ctx, cRect;
let rafId = 0;

function drawArrowHead(x, tipX, tipY, angle) {
  [-0.4, 0.4].forEach((s) => {
    x.moveTo(tipX, tipY);
    x.lineTo(tipX - 10 * Math.cos(angle + s), tipY - 10 * Math.sin(angle + s));
  });
}

function drawArrow(x, a, b, c, d) {
  x.beginPath();
  x.moveTo(a, b);
  x.lineTo(c, d);
  drawArrowHead(x, c, d, Math.atan2(d - b, c - a));
  x.stroke();
}

function drawEdge(x, p) {
  const { x: x1, y: y1, x2, y2, ar, label, curve } = p;
  let midX = (x1 + x2) / 2;
  let midY = (y1 + y2) / 2;

  x.beginPath();
  x.moveTo(x1, y1);

  if (curve) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const cx = midX - (dy / len) * curve;
    const cy = midY + (dx / len) * curve;
    x.quadraticCurveTo(cx, cy, x2, y2);
    if (ar) drawArrowHead(x, x2, y2, Math.atan2(y2 - cy, x2 - cx));
    // Point on quadratic Bezier at t = 0.5
    midX = 0.25 * x1 + 0.5 * cx + 0.25 * x2;
    midY = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  } else {
    x.lineTo(x2, y2);
    if (ar) drawArrowHead(x, x2, y2, Math.atan2(y2 - y1, x2 - x1));
  }
  x.stroke();

  if (label !== null && label !== undefined && label !== '') {
    const txt = String(label);
    x.save();
    x.font = '600 12px system-ui, sans-serif';
    const tw = x.measureText(txt).width;
    const pw = Math.max(20, tw + 10);
    const ph = 18;
    x.fillStyle = '#fff';
    x.strokeStyle = '#6965db';
    x.lineWidth = 1.25;
    x.beginPath();
    if (x.roundRect) x.roundRect(midX - pw / 2, midY - ph / 2, pw, ph, 5);
    else x.rect(midX - pw / 2, midY - ph / 2, pw, ph);
    x.fill();
    x.stroke();
    x.fillStyle = '#1e1e2e';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(txt, midX, midY);
    x.restore();
  }
}

function drawPrimitive(x, p, ink) {
  x.save();
  if (p.a != null) x.globalAlpha = p.a;
  x.strokeStyle = ink;
  x.lineWidth = 2;
  x.textAlign = 'center';
  x.textBaseline = 'middle';

  if (p.t === 'tag') {
    x.font = 'bold 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    const tw = x.measureText(p.s).width;
    const pw = Math.max(40, tw + 14);
    const ph = 22;
    x.fillStyle = '#6965db';
    x.beginPath();
    if (x.roundRect) x.roundRect(p.x, p.y, pw, ph, 6);
    else x.rect(p.x, p.y, pw, ph);
    x.fill();
    x.fillStyle = '#ffffff';
    x.textAlign = 'left';
    x.fillText(p.s, p.x + 7, p.y + ph / 2);
    x.restore();
    return;
  }

  if (p.t === 'l') {
    drawEdge(x, p);
  } else {
    x.fillStyle = p.hl ? '#ffd8a8' : '#fff';
    if (p.t === 'b') {
      x.fillRect(p.x, p.y, p.w, p.h);
      x.strokeRect(p.x, p.y, p.w, p.h);
    } else if (p.t === 'c') {
      x.beginPath();
      x.arc(p.x, p.y, 20, 0, Math.PI * 2);
      x.fill();
      x.stroke();
    }
    x.fillStyle = p.t === 't' ? '#6b6b80' : '#1e1e2e';
    x.font = (p.t === 't' ? '13' : '16') + 'px sans-serif';
    x.fillText(p.s, p.x + (p.t === 'b' ? p.w / 2 : 0), p.y + (p.t === 'b' ? p.h / 2 : 0));
  }
  x.restore();
}

export function renderScene(x, els, sel, ink) {
  for (const e of els) {
    x.save();
    x.lineWidth = 2;
    x.lineCap = x.lineJoin = 'round';
    x.strokeStyle = x.fillStyle = e.c && e.c !== '#1e1e2e' ? e.c : ink;

    if (e.type === 'ds') {
      x.translate(e.x, e.y);
      const ps = animatePrimitives(e.id, getPrimitives(e));
      for (let i = 0; i < ps.length; i++) drawPrimitive(x, ps[i], ink);
    } else if (e.type === 'rect') {
      x.strokeRect(e.x, e.y, e.w, e.h);
    } else if (e.type === 'ellipse') {
      x.beginPath();
      x.ellipse(e.x + e.w / 2, e.y + e.h / 2, Math.abs(e.w / 2), Math.abs(e.h / 2), 0, 0, Math.PI * 2);
      x.stroke();
    } else if (e.type === 'arrow') {
      drawArrow(x, e.x, e.y, e.x + e.w, e.y + e.h);
    } else if (e.type === 'pen') {
      const p = e.p;
      x.beginPath();
      x.moveTo(e.x + p[0][0], e.y + p[0][1]);
      if (p.length < 3) {
        for (let i = 0; i < p.length; i++) x.lineTo(e.x + p[i][0], e.y + p[i][1]);
      } else {
        for (let i = 1; i < p.length - 1; i++) {
          x.quadraticCurveTo(
            e.x + p[i][0],
            e.y + p[i][1],
            e.x + (p[i][0] + p[i + 1][0]) / 2,
            e.y + (p[i][1] + p[i + 1][1]) / 2,
          );
        }
        const last = p[p.length - 1];
        x.lineTo(e.x + last[0], e.y + last[1]);
      }
      x.stroke();
    } else {
      x.font = '20px sans-serif';
      x.textBaseline = 'top';
      x.fillText(e.s, e.x, e.y);
    }
    x.restore();
  }

  if (sel) {
    const b = getBounds(sel);
    x.save();
    x.strokeStyle = '#6965db';
    x.lineWidth = 1.5;
    x.setLineDash([5, 4]);
    x.strokeRect(b.x - 6, b.y - 6, b.w + 12, b.h + 12);
    x.restore();
  }
}

function drawFrame() {
  rafId = 0;
  const dpr = devicePixelRatio || 1;
  const { x: vx, y: vy, z: vz } = store.viewport;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = store.theme.bg;
  ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.setTransform(dpr * vz, 0, 0, dpr * vz, vx * dpr, vy * dpr);
  renderScene(ctx, store.els, store.getSelected(), store.theme.ink);

  if (isAnimating()) {
    scheduleRender();
  }
}

export function scheduleRender() {
  if (!rafId) {
    rafId = requestAnimationFrame(drawFrame);
  }
}

export function refreshCanvasRect() {
  cRect = cv.getBoundingClientRect();
  return cRect;
}

export function getCanvasRect() {
  return cRect || refreshCanvasRect();
}

export function screenToWorld(ev) {
  const r = getCanvasRect();
  const { x, y, z } = store.viewport;
  return { x: (ev.clientX - r.left - x) / z, y: (ev.clientY - r.top - y) / z };
}

export function initRenderer(canvasEl, wrapperEl) {
  cv = canvasEl;
  ctx = cv.getContext('2d', { alpha: false });

  const resize = () => {
    const r = refreshCanvasRect();
    const dpr = devicePixelRatio || 1;
    const nw = Math.round(r.width * dpr);
    const nh = Math.round(r.height * dpr);
    if (cv.width !== nw || cv.height !== nh) {
      cv.width = nw;
      cv.height = nh;
    }
    scheduleRender();
  };

  new ResizeObserver(resize).observe(wrapperEl);
  bus.on('render', scheduleRender);
  bus.on('tool:change', (t) => {
    cv.style.cursor = { eraser: 'cell', hand: 'grab', select: 'default' }[t] || 'crosshair';
  });

  resize();
}
