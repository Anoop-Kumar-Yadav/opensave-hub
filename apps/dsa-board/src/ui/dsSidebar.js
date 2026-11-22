import { store } from '../core/store.js';
import { listDS } from '../ds/registry.js';
import { refreshCanvasRect, screenToWorld } from '../engine/renderer.js';
import { icon } from './toolbar.js';

export function initDSSidebar() {
  const sidebar = document.querySelector('#ds-sidebar');
  const wrapper = document.querySelector('#w');

  const cardsHtml = listDS()
    .map(
      ([k, def]) => `
        <div class="ds-card" data-ds="${k}" title="Drag onto board or click to add">
          <span class="ds-card-icon">${icon(def.icon || 'data_object')}</span>
          <div class="ds-card-info">
            <span class="ds-card-name">${def.name}</span>
            <span class="ds-card-sub">${def.sub || ''}</span>
          </div>
        </div>`,
    )
    .join('');

  sidebar.innerHTML = `<div class="sidebar-title"><span>Data Structures</span><span>Drag</span></div>${cardsHtml}`;

  sidebar.onpointerdown = (ev) => {
    const card = ev.target.closest('.ds-card');
    if (!card || ev.button !== 0) return;
    ev.preventDefault();

    const dsKey = card.dataset.ds;
    const startX = ev.clientX;
    const startY = ev.clientY;
    const rect = card.getBoundingClientRect();
    const ox = startX - rect.left;
    const oy = startY - rect.top;

    let ghost = null;
    let dragging = false;
    let cRect = refreshCanvasRect();

    const isOverCanvas = (x, y) =>
      x >= cRect.left && x <= cRect.right && y >= cRect.top && y <= cRect.bottom;

    const onMove = (e) => {
      if (!dragging && Math.hypot(e.clientX - startX, e.clientY - startY) > 5) {
        dragging = true;
        cRect = refreshCanvasRect();
        ghost = card.cloneNode(true);
        ghost.classList.add('ds-ghost');
        document.body.append(ghost);
      }
      if (!dragging) return;

      ghost.style.left = e.clientX - ox + 'px';
      ghost.style.top = e.clientY - oy + 'px';
      wrapper.classList.toggle('drop-active', isOverCanvas(e.clientX, e.clientY));
    };

    const onUp = (e) => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      wrapper.classList.remove('drop-active');

      if (ghost) {
        ghost.remove();
        ghost = null;
      }

      if (dragging) {
        if (isOverCanvas(e.clientX, e.clientY)) {
          const pt = screenToWorld(e);
          store.createDS(dsKey, pt.x - 40, pt.y - 20);
        }
      } else {
        // Quick-click fallback: place at center of current viewport
        const r = refreshCanvasRect();
        const { x: vx, y: vy, z: vz } = store.viewport;
        store.createDS(dsKey, (r.width / 2 - vx) / vz - 80, (r.height / 2 - vy) / vz - 40);
      }
    };

    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
  };
}
