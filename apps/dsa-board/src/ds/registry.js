/**
 * Plugin registry for Data Structures.
 * Each DS module registers its own state, operations, bulk loader, drop-bubble config, and layout.
 */
const registry = new Map();

export function registerDS(key, definition) {
  if (registry.has(key)) {
    throw new Error(`Data structure "${key}" is already registered.`);
  }
  registry.set(key, definition);
}

export function getDS(key) {
  const ds = registry.get(key);
  if (!ds) throw new Error(`Unknown data structure "${key}".`);
  return ds;
}

export function listDS() {
  return [...registry.entries()];
}
