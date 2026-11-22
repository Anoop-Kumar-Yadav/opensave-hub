import { store } from '../core/store.js';
import { bus } from '../core/events.js';
import { exporter } from '../engine/exporter.js';

export const TOOLS = {
  hand: 'pan_tool',
  select: 'near_me',
  rect: 'rectangle',
  ellipse: 'circle',
  arrow: 'arrow_right_alt',
  pen: 'edit',
  text: 'title',
  eraser: 'ink_eraser',
};

export const KEYMAP = {
  h: 'hand',
  v: 'select',
  r: 'rect',
  o: 'ellipse',
  a: 'arrow',
  p: 'pen',
  t: 'text',
  e: 'eraser',
};

export const icon = (name) => `<span class="material-symbols-outlined">${name}</span>`;

export function initToolbar() {
  const tb = document.querySelector('#tb');

  const toolButtonsHtml = Object.entries(TOOLS)
    .map(([k, ic]) => {
      const shortcut = Object.keys(KEYMAP).find((c) => KEYMAP[c] === k).toUpperCase();
      return `<button type="button" data-t="${k}" title="${k} (${shortcut})">${icon(ic)}</button>`;
    })
    .join('');

  tb.innerHTML =
    toolButtonsHtml +
    `<input type="color" id="co" value="#1e1e2e" title="Stroke color">` +
    `<span class="tb-sep"></span>` +
    `<button type="button" id="un" title="Undo (Ctrl+Z)">${icon('undo')}</button>` +
    `<button type="button" id="re" title="Redo (Ctrl+Y)">${icon('redo')}</button>` +
    `<button type="button" id="dl" title="Delete (Del)">${icon('delete')}</button>` +
    `<button type="button" id="bg" title="Toggle board color">${icon('contrast')}</button>` +
    `<span class="sp"></span>` +
    `<button type="button" id="e1">${icon('image')}PNG</button>` +
    `<button type="button" id="e2">${icon('picture_as_pdf')}PDF</button>` +
    `<button type="button" id="e3">${icon('content_copy')}Copy</button>`;

  const toolBtns = [...tb.querySelectorAll('[data-t]')];
  const syncActiveTool = (active) => {
    for (const b of toolBtns) b.classList.toggle('on', b.dataset.t === active);
  };

  // pointerdown + closest() for instant, zero-lag tool switching
  tb.onpointerdown = (ev) => {
    const btn = ev.target.closest('[data-t]');
    if (btn) {
      ev.preventDefault();
      store.setTool(btn.dataset.t);
    }
  };

  tb.querySelector('#co').oninput = (e) => {
    store.color = e.target.value;
    const sel = store.getSelected();
    if (sel && sel.type !== 'ds') {
      sel.c = store.color;
      store.snap();
      bus.emit('render');
    }
  };

  tb.querySelector('#un').onclick = () => store.undo();
  tb.querySelector('#re').onclick = () => store.redo();
  tb.querySelector('#dl').onclick = () => store.removeSelected();
  tb.querySelector('#bg').onclick = () => store.toggleBoardTheme();
  tb.querySelector('#e1').onclick = () => exporter.png();
  tb.querySelector('#e2').onclick = () => exporter.pdf();
  tb.querySelector('#e3').onclick = () => exporter.copy();

  bus.on('tool:change', syncActiveTool);
  syncActiveTool(store.tool);
}
