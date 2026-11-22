import { store } from '../core/store.js';
import { bus } from '../core/events.js';
import { getDS } from '../ds/registry.js';
import { loadBulkValues, runOperation, setVarName, updateMetaField } from '../core/dsActions.js';
import { icon } from './toolbar.js';

export function renderMetaInputs(el) {
  return (getDS(el.k).meta || [])
    .map((m) => {
      const val = el.d.m[m.k];
      if (m.options) {
        const opts = m.options
          .map((o) => `<option value="${o.v}" ${String(val) === String(o.v) ? 'selected' : ''}>${o.l}</option>`)
          .join('');
        return `
          <div class="insp-field">
            <label>${m.l}</label>
            <select data-m="${m.k}">${opts}</select>
          </div>`;
      }
      return `
        <div class="insp-field">
          <label>${m.l}</label>
          <input data-m="${m.k}" value="${val}">
        </div>`;
    })
    .join('');
}

export function initInspectorSidebar() {
  const panel = document.querySelector('#inspector');

  const render = () => {
    const sel = store.getSelected();
    panel.hidden = !sel;
    if (!sel) {
      panel.innerHTML = '';
      return;
    }

    if (sel.type === 'ds') {
      const ds = getDS(sel.k);
      const hasMeta = ds.meta && ds.meta.length > 0;
      const isWeighted = Boolean(sel.d.m && +sel.d.m.weighted);
      const opsButtons =
        Object.keys(ds.ops)
          .map((n) => `<button type="button" data-o="${n}">${n}</button>`)
          .join('') + `<button type="button" data-o="_r">reset</button>`;

      panel.innerHTML = `
        <div class="insp-header">
          <h3>${ds.name}</h3>
          <button type="button" class="insp-close" data-close title="Close inspector">${icon('close')}</button>
        </div>

        <div class="insp-section">
          <span class="insp-label">Variable Name</span>
          <input id="insp-varname" placeholder="e.g. ${ds.defaultPrefix || 'ds'}1" value="${sel.varName || ''}">
        </div>

        <div class="insp-section">
          <span class="insp-label">Initial Values (comma-separated)</span>
          <div class="insp-row">
            <input id="insp-bulk" placeholder="${ds.bulkPlaceholder || '10, 20, 30'}">
            <button type="button" class="primary" id="insp-bulk-btn">Load</button>
          </div>
          <span class="hint">Replaces current items with comma-separated values.</span>
        </div>

        ${
          hasMeta
            ? `<div class="insp-section">
                <span class="insp-label">Properties</span>
                <div class="insp-grid">${renderMetaInputs(sel)}</div>
              </div>`
            : ''
        }

        <div class="insp-section">
          <span class="insp-label">Operations</span>
          <div class="insp-row">
            <input id="insp-val" placeholder="value">
            <input id="insp-arg" placeholder="index / arg">
            ${isWeighted ? '<input id="insp-w" placeholder="weight" style="max-width:64px">' : ''}
          </div>
          <div class="insp-ops">${opsButtons}</div>
          <span class="hint">${ds.h || ''}</span>
        </div>

        <div class="insp-section">
          <span class="insp-label">Element Actions</span>
          <div class="insp-row">
            <button type="button" data-act="dup" style="flex:1">${icon('content_copy')}Duplicate</button>
            <button type="button" data-act="front" style="flex:1">${icon('flip_to_front')}Front</button>
          </div>
          <button type="button" class="danger" data-act="del">${icon('delete')}Delete Structure</button>
        </div>
      `;
    } else {
      panel.innerHTML = `
        <div class="insp-header">
          <h3>${sel.type.charAt(0).toUpperCase() + sel.type.slice(1)}</h3>
          <button type="button" class="insp-close" data-close title="Close inspector">${icon('close')}</button>
        </div>

        <div class="insp-section">
          <span class="insp-label">Appearance</span>
          <div class="insp-row">
            <label style="flex:1">Stroke Color</label>
            <input type="color" id="insp-color" value="${sel.c || '#1e1e2e'}">
          </div>
          ${
            sel.type === 'text'
              ? `<div class="insp-field">
                  <label>Text</label>
                  <input id="insp-text" value="${sel.s || ''}">
                </div>`
              : ''
          }
        </div>

        <div class="insp-section">
          <span class="insp-label">Element Actions</span>
          <div class="insp-row">
            <button type="button" data-act="dup" style="flex:1">${icon('content_copy')}Duplicate</button>
            <button type="button" data-act="front" style="flex:1">${icon('flip_to_front')}Front</button>
          </div>
          <button type="button" class="danger" data-act="del">${icon('delete')}Delete</button>
        </div>
      `;
    }
  };

  panel.onclick = (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;

    if ('close' in btn.dataset) {
      store.select(null);
      return;
    }
    if (btn.id === 'insp-bulk-btn') {
      const bulkInput = panel.querySelector('#insp-bulk');
      if (bulkInput) loadBulkValues(bulkInput.value);
      return;
    }
    if (btn.dataset.o) {
      const v = panel.querySelector('#insp-val')?.value.trim() || '';
      const a = panel.querySelector('#insp-arg')?.value.trim() || '';
      const w = panel.querySelector('#insp-w')?.value.trim() || '';
      runOperation(btn.dataset.o, v, a, w);
      return;
    }
    if (btn.dataset.act === 'dup') store.duplicateSelected();
    if (btn.dataset.act === 'front') store.bringSelectedToFront();
    if (btn.dataset.act === 'del') store.removeSelected();
  };

  panel.oninput = (ev) => {
    const target = ev.target;
    if (target.id === 'insp-varname') {
      setVarName(target.value, false);
    } else if (target.id === 'insp-color') {
      const sel = store.getSelected();
      if (sel) {
        sel.c = target.value;
        bus.emit('render');
      }
    } else if (target.id === 'insp-text') {
      const sel = store.getSelected();
      if (sel && sel.type === 'text') {
        sel.s = target.value;
        bus.emit('render');
      }
    }
  };

  panel.onchange = (ev) => {
    const target = ev.target;
    if (target.id === 'insp-varname') {
      setVarName(target.value, true);
    } else if (target.dataset?.m) {
      updateMetaField(target.dataset.m, target.value);
    } else if (target.id === 'insp-color' || target.id === 'insp-text') {
      store.snap();
    }
  };

  panel.onkeydown = (ev) => {
    if (ev.key === 'Enter' && ev.target.id === 'insp-bulk') {
      ev.preventDefault();
      loadBulkValues(ev.target.value);
    }
  };

  bus.on('selection:change', render);
  bus.on('ds:meta-updated', render);
  render();
}
