let timer = null;

export function toast(message) {
  const el = document.querySelector('#ms');
  if (!el) return;
  el.textContent = message;
  el.style.opacity = 1;
  clearTimeout(timer);
  timer = setTimeout(() => {
    el.style.opacity = 0;
  }, 2200);
}
