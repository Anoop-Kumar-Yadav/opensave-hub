/**
 * Lightweight Pub/Sub event bus to decouple UI, interaction, and rendering layers.
 */
class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    this._listeners.get(event)?.delete(handler);
  }

  emit(event, payload) {
    const handlers = this._listeners.get(event);
    if (!handlers) return;
    for (const fn of handlers) {
      fn(payload);
    }
  }
}

export const bus = new EventBus();
