import { store } from '../core/store.js';
import { getDS, listDS } from '../ds/registry.js';
import { hitTest } from '../core/geometry.js';
import { runOperation, updateMetaField } from '../core/dsActions.js';
import { refreshCanvasRect, screenToWorld } from '../engine/renderer.js';
import { TOOLS, icon } from './toolbar.js';

let cmEl = null;

export function hideContextMenu() {
  if (cmEl) cmEl.hidden = true;
}

export function initContextMenu(canvasEl) {
  cmEl = document.querySelector('#cm');

  addEventListener(
    'pointerdown',
    (e) => {
      if (!cmEl.contains(e.target)) hideContextMenu();
    },
    true,
  );

  canvasEl.oncontextmenu = (ev) => {
    ev.preventDefault();
    refreshCanvasRect();
    const q = screenToWorld(ev);
    let h = null;
    for (let i = store.els.length - 1; i >= 0; i--) {
      if (hitTest(store.els[i], q)) {
        h = store.els[i];
        break;
      }
    }
    store.select(h ? h.id : null);

    let html = '';
    if (h && h.type === 'ds') {
      const ds = getDS(h.k);
      const metaHtml = (ds.meta || [])
        .map((m) => {
          const val = h.d.m[m.k];
          if (m.options) {
            const opts = m.options
              .map((o) => `<option value="${o.v}" ${String(val) === String(o.v) ? 'selected' : ''}>${o.l}</option>`)
              .join('');
            return `<label>${m.l} <select data-m="${m.k}">${opts}</select></label>`;
          }
          return `<label>${m.l} <input data-m="${m.k}" value="${val}" style="width:${m.w || 80}px"></label>`;
        })
        .join('');
      html =
        `<b>${h.varName ? `${h.varName} (${ds.name})` : ds.name}</b><span class="hint">${ds.h}</span>${metaHtml}` +
        `<input id="c1" placeholder="value"><input id="c2" placeholder="index / arg"><div class="g">` +
        Object.keys(ds.ops)
          .map((n) => `<button type="button" data-o="${n}">${n}</button>`)
          .join('') +
        `<button type="button" data-o="_r">reset</button></div>`;
    }

    if (h) {
      html +=
        `<div class="g">` +
        `<button type="button" data-a="dup">${icon('content_copy')}Duplicate</button>` +
        `<button type="button" data-a="front">${icon('flip_to_front')}To front</button>` +
        `<button type="button" data-a="del">${icon('delete')}Delete</button></div>`;
    } else {
      html =
        `<div class="g">` +
        Object.entries(TOOLS)
          .map(([t, ic]) => `<button type="button" data-t="${t}" title="${t}">${icon(ic)}</button>`)
          .join('') +
        `</div><div class="g">` +
        listDS()
          .map(([k, def]) => `<button type="button" data-k="${k}">+ ${def.name}</button>`)
          .join('') +
        `</div>`;
    }

    cmEl.q = q;
    cmEl.innerHTML = html;
    cmEl.hidden = false;
    cmEl.style.left = Math.max(4, Math.min(ev.clientX, innerWidth - cmEl.offsetWidth - 4)) + 'px';
    cmEl.style.top = Math.max(4, Math.min(ev.clientY, innerHeight - cmEl.offsetHeight - 4)) + 'px';
  };

  cmEl.onchange = (ev) => {
    if (ev.target.dataset?.m) {
      updateMetaField(ev.target.dataset.m, ev.target.value);
    }
  };

  cmEl.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    const d = btn.dataset;

    if (d.o) {
      return runOperation(d.o, cmEl.querySelector('#c1').value.trim(), cmEl.querySelector('#c2').value.trim());
    }
    if (d.t) store.setTool(d.t);
    if (d.k) store.createDS(d.k, cmEl.q.x, cmEl.q.y);
    if (d.a === 'dup') store.duplicateSelected();
    if (d.a === 'front') store.bringSelectedToFront();
    if (d.a === 'del') store.removeSelected();
    hideContextMenu();
  };
}
