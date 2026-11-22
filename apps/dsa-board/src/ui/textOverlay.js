import { store } from '../core/store.js';
import { bus } from '../core/events.js';

export function openTextOverlay(worldPt) {
  const input = document.querySelector('#ti');
  const { x: vx, y: vy, z: vz } = store.viewport;

  input.style.left = worldPt.x * vz + vx + 'px';
  input.style.top = worldPt.y * vz + vy + 'px';
  input.value = '';
  input.hidden = false;
  setTimeout(() => input.focus());

  input.onkeydown = (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = '';
      input.blur();
    }
  };

  input.onblur = () => {
    const v = input.value.trim();
    input.onblur = null;
    input.hidden = true;
    if (v) {
      const created = store.add({ type: 'text', x: worldPt.x, y: worldPt.y, s: v });
      store.snap();
      store.select(created.id);
    } else {
      bus.emit('render');
    }
  };
}
