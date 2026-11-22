/**
 * Shared mutation commands for Data Structure elements.
 * Decouples Inspector Sidebar, Context Menu, and Bubble Palette from each other.
 */
import { store } from './store.js';
import { bus } from './events.js';
import { getDS } from '../ds/registry.js';
import { getPrimitives, invalidateLayout } from './geometry.js';
import { startAnimation } from '../engine/animator.js';

export function runOperation(opName, val, arg, arg2) {
  const el = store.getSelectedDS();
  if (!opName || !el) return;
  const ds = getDS(el.k);
  const oldPrims = getPrimitives(el);

  if (opName === '_r') {
    el.d = ds.init();
  } else {
    el.d.note = '';
    el.d.hi = null;
    try {
      ds.ops[opName](el.d, val, arg, arg2);
    } catch (err) {
      el.d.note = 'error: ' + err.message;
    }
  }

  invalidateLayout(el);
  store.snap();
  startAnimation(el.id, oldPrims);
  bus.emit('ds:meta-updated', el);
  bus.emit('render');
}

export function loadBulkValues(rawCsv) {
  const el = store.getSelectedDS();
  if (!el) return;
  const ds = getDS(el.k);
  const oldPrims = getPrimitives(el);

  el.d.note = '';
  el.d.hi = null;
  try {
    if (ds.bulkLoad) {
      ds.bulkLoad(el.d, rawCsv);
    }
  } catch (err) {
    el.d.note = 'error: ' + err.message;
  }

  invalidateLayout(el);
  store.snap();
  startAnimation(el.id, oldPrims);
  bus.emit('ds:meta-updated', el);
  bus.emit('render');
}

export function updateMetaField(key, rawValue) {
  const el = store.getSelectedDS();
  if (!key || !el) return;
  const ds = getDS(el.k);
  const field = ds.meta?.find((x) => x.k === key);
  if (!field) return;

  el.d.note = '';
  el.d.m[key] = field.n ? +rawValue || 0 : rawValue;
  try {
    ds.onMeta?.(el.d, key);
  } catch (err) {
    el.d.note = 'error: ' + err.message;
  }

  invalidateLayout(el);
  store.snap();
  bus.emit('ds:meta-updated', el);
  bus.emit('render');
}

export function setVarName(name, commitSnapshot = false) {
  const el = store.getSelectedDS();
  if (!el) return;
  el.varName = name;
  invalidateLayout(el);
  if (commitSnapshot) store.snap();
  bus.emit('render');
}
