import { store } from '../core/store.js';
import { getDS } from '../ds/registry.js';
import { getBounds, hitTest } from '../core/geometry.js';
import { runOperation } from '../core/dsActions.js';
import { getCanvasRect, refreshCanvasRect, screenToWorld } from '../engine/renderer.js';

export function initBubblePalette() {
  const pal = document.querySelector('#pal');
  const pi = document.querySelector('#pv');
  const dr = document.querySelector('#dr');
  const tray = document.querySelector('#tray');
  const fl = document.querySelector('#fl');

  let activeFlow = null;

  const syncPreview = () => {
    const val = pi.value.trim();
    dr.textContent = dr.dataset.v = val;
    dr.hidden = !val;
  };

  const cancelFlow = () => {
    fl.hidden = true;
    activeFlow?.back();
    activeFlow = null;
  };

  const openFlow = (bubble, targetEl, cx, cy, back) => {
    const ds = getDS(targetEl.k);
    const dropOps = ds.dropOps || {};
    const extraPrompt = [...new Set(Object.values(dropOps).filter(Boolean))][0];

    store.select(targetEl.id);
    fl.innerHTML =
      `<b>"${bubble.dataset.v}" → ${targetEl.varName || ds.name}</b>` +
      (extraPrompt ? `<input data-x placeholder="${extraPrompt} (needed by some operations)">` : '') +
      `<div class="g">` +
      Object.entries(dropOps)
        .map(([n, req]) => `<button type="button" data-o="${n}" ${req ? 'disabled' : ''}>${n}</button>`)
        .join('') +
      `<button type="button" data-c>cancel</button></div>`;

    fl.hidden = false;
    fl.style.left = Math.max(4, Math.min(cx, innerWidth - 296)) + 'px';
    fl.style.top = Math.max(4, Math.min(cy + 14, innerHeight - fl.offsetHeight - 4)) + 'px';

    const xi = fl.querySelector('[data-x]');
    if (xi) {
      xi.focus();
      xi.oninput = () =>
        fl.querySelectorAll('button[data-o]').forEach((btn) => {
          btn.disabled = !!dropOps[btn.dataset.o] && !xi.value.trim();
        });
    }

    activeFlow = { bubble, targetEl, back };
  };

  pi.oninput = syncPreview;
  pi.onkeydown = (e) => {
    const v = pi.value.trim();
    if (e.key === 'Enter' && v) {
      const b = document.createElement('div');
      b.className = 'bub';
      b.textContent = b.dataset.v = v;
      tray.append(b);
      pi.value = '';
      syncPreview();
    }
  };

  pal.onpointerdown = (ev) => {
    const b = ev.target.closest('.bub');
    if (!b || activeFlow) return;
    ev.preventDefault();
    const cRect = refreshCanvasRect();
    const r = b.getBoundingClientRect();
    const ox = ev.clientX - r.left;
    const oy = ev.clientY - r.top;
    const home = b.parentNode;
    const nx = b.nextSibling;

    b.style.cssText = `position:fixed;z-index:20;left:${r.left}px;top:${r.top}px;margin:0`;
    document.body.append(b);

    const back = () => {
      b.style.cssText = '';
      home.insertBefore(b, nx);
    };

    const onMove = (e) => {
      b.style.left = e.clientX - ox + 'px';
      b.style.top = e.clientY - oy + 'px';
    };

    const onUp = (e) => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      let target = null;
      if (e.clientX > cRect.left && e.clientX < cRect.right && e.clientY > cRect.top && e.clientY < cRect.bottom) {
        const q = screenToWorld(e);
        for (let i = store.els.length - 1; i >= 0; i--) {
          const el = store.els[i];
          if (el.type === 'ds' && hitTest(el, q)) {
            target = el;
            break;
          }
        }
      }
      if (target) openFlow(b, target, e.clientX, e.clientY, back);
      else back();
    };

    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
  };

  fl.onkeydown = (e) => {
    if (e.key === 'Escape') cancelFlow();
  };

  fl.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const d = btn.dataset;
    if ('c' in d) return cancelFlow();
    if (!d.o || !activeFlow) return;

    const { bubble, targetEl, back } = activeFlow;
    const val = bubble.dataset.v;
    const xi = fl.querySelector('[data-x]');
    const arg = xi ? xi.value.trim() : '';
    const bx = getBounds(targetEl);
    const cRect = getCanvasRect();
    const { x: vx, y: vy, z: vz } = store.viewport;

    fl.hidden = true;
    Object.assign(bubble.style, {
      transition: 'all 0.35s ease-in',
      left: cRect.left + vx + (bx.x + bx.w / 2) * vz - 19 + 'px',
      top: cRect.top + vy + (bx.y + bx.h / 2) * vz - 19 + 'px',
      transform: 'scale(0.3)',
      opacity: 0,
    });

    setTimeout(() => {
      if (bubble === dr) {
        back();
        pi.value = '';
        syncPreview();
      } else {
        bubble.remove();
      }
      activeFlow = null;
      store.select(targetEl.id);
      runOperation(d.o, val, arg);
    }, 360);
  };
}
