import { store } from '../core/store.js';
import { bus } from '../core/events.js';
import { getDS } from '../ds/registry.js';
import { hitTest, invalidateLayout } from '../core/geometry.js';
import { getCanvasRect, refreshCanvasRect, screenToWorld } from '../engine/renderer.js';
import { KEYMAP } from '../ui/toolbar.js';
import { openTextOverlay } from '../ui/textOverlay.js';
import { hideContextMenu } from '../ui/contextMenu.js';

function hitForEraser(el, pt, radius) {
  if (el.type === 'pen') {
    return el.p.some((p) => Math.hypot(el.x + p[0] - pt.x, el.y + p[1] - pt.y) < radius);
  }
  return hitTest(el, pt);
}

export function initInteraction(canvasEl) {
  let drag = null;

  const eraseAt = (q) => {
    const prevLen = store.els.length;
    const radius = 10 / store.viewport.z;
    store.els = store.els.filter((e) => !hitForEraser(e, q, radius));
    if (store.els.length < prevLen) {
      drag.changed = true;
      store.select(null);
    } else {
      bus.emit('render');
    }
  };

  canvasEl.onpointerdown = (ev) => {
    if (ev.button === 2) return;
    refreshCanvasRect();
    if (ev.button === 1) store.setTool('hand');
    canvasEl.setPointerCapture(ev.pointerId);

    const q = screenToWorld(ev);
    drag = { q, sx: ev.clientX, sy: ev.clientY, v: { ...store.viewport } };

    if (store.tool === 'text') {
      drag = null;
      return openTextOverlay(q);
    }
    if (store.tool === 'eraser') {
      drag.er = true;
      return eraseAt(q);
    }
    if (store.tool === 'select') {
      let h = null;
      for (let i = store.els.length - 1; i >= 0; i--) {
        if (hitTest(store.els[i], q)) {
          h = store.els[i];
          break;
        }
      }
      if (h) {
        drag.el = h;
        drag.origin = [h.x, h.y];
        if (h.type === 'ds') {
          const ds = getDS(h.k);
          if (ds.hitSubItem) {
            drag.sub = ds.hitSubItem(h, { x: q.x - h.x, y: q.y - h.y });
          }
        }
      }
      store.select(h ? h.id : null);
    } else if (store.tool === 'pen') {
      drag.el = store.add({ type: 'pen', x: q.x, y: q.y, p: [[0, 0]] });
    } else if (store.tool !== 'hand') {
      drag.el = store.add({ type: store.tool, x: q.x, y: q.y, w: 0, h: 0 });
    }
  };

  canvasEl.onpointermove = (ev) => {
    if (!drag) return;
    const q = screenToWorld(ev);
    if (drag.er) return eraseAt(q);

    if (store.tool === 'hand' || (store.tool === 'select' && !drag.el)) {
      store.viewport.x = drag.v.x + ev.clientX - drag.sx;
      store.viewport.y = drag.v.y + ev.clientY - drag.sy;
    } else if (store.tool === 'select') {
      if (drag.sub && drag.el.type === 'ds') {
        const ds = getDS(drag.el.k);
        ds.dragSubItem?.(drag.el, drag.sub, q.x - drag.q.x, q.y - drag.q.y);
        invalidateLayout(drag.el);
      } else {
        drag.el.x = drag.origin[0] + q.x - drag.q.x;
        drag.el.y = drag.origin[1] + q.y - drag.q.y;
      }
      drag.moved = true;
    } else if (store.tool === 'pen') {
      const last = drag.el.p.at(-1);
      if (Math.hypot(q.x - drag.el.x - last[0], q.y - drag.el.y - last[1]) > 2 / store.viewport.z) {
        drag.el.p.push([q.x - drag.el.x, q.y - drag.el.y]);
      }
    } else {
      drag.el.w = q.x - drag.q.x;
      drag.el.h = q.y - drag.q.y;
    }
    bus.emit('render');
  };

  canvasEl.onpointerup = () => {
    if (!drag) return;
    if (drag.er) {
      if (drag.changed) store.snap();
      drag = null;
      bus.emit('render');
      return;
    }

    const el = drag.el;
    if (el && store.tool !== 'select') {
      if (store.tool !== 'pen' && Math.abs(el.w) + Math.abs(el.h) < 4) {
        store.els.pop();
      } else {
        store.snap();
        store.select(el.id);
        if (store.tool !== 'pen') store.setTool('select');
      }
    } else if (drag.moved) {
      store.snap();
    }
    drag = null;
    bus.emit('render');
  };

  canvasEl.onwheel = (ev) => {
    ev.preventDefault();
    const cRect = getCanvasRect();
    const q = screenToWorld(ev);
    const z = Math.min(4, Math.max(0.2, store.viewport.z * (ev.deltaY < 0 ? 1.1 : 0.9)));
    store.viewport.x = ev.clientX - cRect.left - q.x * z;
    store.viewport.y = ev.clientY - cRect.top - q.y * z;
    store.viewport.z = z;
    bus.emit('render');
  };

  document.onkeydown = (ev) => {
    if (ev.target.tagName === 'INPUT' || ev.target.tagName === 'TEXTAREA' || ev.target.tagName === 'SELECT') return;
    const mod = ev.ctrlKey || ev.metaKey;
    if (mod && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) store.redo();
      else store.undo();
    } else if (mod && ev.key.toLowerCase() === 'y') {
      ev.preventDefault();
      store.redo();
    } else if (ev.key === 'Delete' || ev.key === 'Backspace') {
      store.removeSelected();
    } else if (ev.key === 'Escape') {
      hideContextMenu();
      store.setTool('select');
    } else if (!mod && KEYMAP[ev.key.toLowerCase()]) {
      store.setTool(KEYMAP[ev.key.toLowerCase()]);
    }
  };
}
