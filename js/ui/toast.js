let timer;
export function toast(message, ms = 2600) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { node.hidden = true; }, ms);
}
