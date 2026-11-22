import { getDS } from '../ds/registry.js';
import { bus } from './events.js';

export const cloneElements = (els) =>
  els.map(({ _prims, _pb, ...rest }) => structuredClone(rest));

export const store = {
  els: [],
  history: [],
  future: [],
  sel: null,
  uid: 100,
  tool: 'select',
  color: '#1e1e2e',
  viewport: { x: 0, y: 0, z: 1 },
  theme: { ink: '#1e1e2e', bg: '#fff' },

  init() {
    this.els = [
      { id: 1, type: 'ds', k: 'bst', varName: 'bst1', x: 180, y: 120, d: getDS('bst').init() },
    ];
    this.snap();
  },

  nextVarName(dsKey) {
    const prefix = getDS(dsKey).defaultPrefix || dsKey;
    const used = new Set(this.els.filter((e) => e.type === 'ds').map((e) => e.varName));
    let n = 1;
    while (used.has(`${prefix}${n}`)) n++;
    return `${prefix}${n}`;
  },

  createDS(dsKey, x, y) {
    const el = this.add({
      type: 'ds',
      k: dsKey,
      varName: this.nextVarName(dsKey),
      x,
      y,
      d: getDS(dsKey).init(),
    });
    this.snap();
    this.setTool('select');
    this.select(el.id);
    return el;
  },

  snap() {
    this.history.push(cloneElements(this.els));
    this.future = [];
    if (this.history.length > 100) this.history.shift();
  },

  undo() {
    if (this.history.length > 1) {
      this.future.push(this.history.pop());
      this.els = cloneElements(this.history.at(-1));
      this.sel = null;
      bus.emit('selection:change');
      bus.emit('render');
    }
  },

  redo() {
    const next = this.future.pop();
    if (next) {
      this.history.push(next);
      this.els = cloneElements(next);
      bus.emit('selection:change');
      bus.emit('render');
    }
  },

  add(el) {
    el.id = ++this.uid;
    el.c = this.color;
    this.els.push(el);
    return el;
  },

  getSelected() {
    return this.els.find((e) => e.id === this.sel) || null;
  },

  getSelectedDS() {
    return this.els.find((e) => e.id === this.sel && e.type === 'ds') || null;
  },

  select(id) {
    const changed = this.sel !== id;
    this.sel = id;
    if (changed) bus.emit('selection:change');
    bus.emit('render');
  },

  duplicateSelected() {
    const sel = this.getSelected();
    if (!sel) return;
    const copy = cloneElements([sel])[0];
    copy.id = ++this.uid;
    copy.x += 30;
    copy.y += 30;
    if (copy.type === 'ds') {
      copy.varName = this.nextVarName(copy.k);
    }
    this.els.push(copy);
    this.snap();
    this.select(copy.id);
  },

  bringSelectedToFront() {
    const sel = this.getSelected();
    if (!sel) return;
    this.els = this.els.filter((x) => x !== sel);
    this.els.push(sel);
    this.snap();
    bus.emit('render');
  },

  removeSelected() {
    if (!this.sel) return;
    this.els = this.els.filter((e) => e.id !== this.sel);
    this.sel = null;
    this.snap();
    bus.emit('selection:change');
    bus.emit('render');
  },

  setTool(t) {
    if (this.tool === t) return;
    this.tool = t;
    bus.emit('tool:change', t);
  },

  toggleBoardTheme() {
    const isLight = this.theme.bg === '#fff';
    this.theme.bg = isLight ? '#1b1b22' : '#fff';
    this.theme.ink = isLight ? '#eee' : '#1e1e2e';
    bus.emit('render');
  },
};
