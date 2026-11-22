import { store } from '../core/store.js';
import { getBounds } from '../core/geometry.js';
import { renderScene } from './renderer.js';
import { toast } from '../ui/toast.js';

function renderToOffscreenCanvas() {
  let boxes = store.els.map(getBounds);
  if (!boxes.length) boxes = [{ x: 0, y: 0, w: 100, h: 100 }];

  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const w = Math.max(...boxes.map((b) => b.x + b.w)) - x0;
  const h = Math.max(...boxes.map((b) => b.y + b.h)) - y0;
  const pad = 30;
  const scale = 2;

  const canvas = document.createElement('canvas');
  canvas.width = (w + 2 * pad) * scale;
  canvas.height = (h + 2 * pad) * scale;
  const x = canvas.getContext('2d');
  x.fillStyle = store.theme.bg;
  x.fillRect(0, 0, canvas.width, canvas.height);
  x.setTransform(scale, 0, 0, scale, (pad - x0) * scale, (pad - y0) * scale);
  renderScene(x, store.els, null, store.theme.ink);
  return canvas;
}

const canvasToBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve));

function downloadBlob(filename, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const exporter = {
  async png() {
    const blob = await canvasToBlob(renderToOffscreenCanvas());
    downloadBlob('dsa-diagram.png', blob);
  },

  async pdf() {
    const c = renderToOffscreenCanvas();
    const w = c.width / 2;
    const h = c.height / 2;
    const doc = new window.jspdf.jsPDF({ orientation: w > h ? 'l' : 'p', unit: 'px', format: [w, h] });
    doc.addImage(c.toDataURL('image/png'), 'PNG', 0, 0, w, h);
    downloadBlob('dsa-diagram.pdf', doc.output('blob'));
  },

  async copy() {
    try {
      const blob = await canvasToBlob(renderToOffscreenCanvas());
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      toast('Copied to clipboard');
    } catch {
      toast('Clipboard blocked here — saving PNG instead');
      this.png();
    }
  },
};
