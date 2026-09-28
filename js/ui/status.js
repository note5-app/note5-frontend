import { el } from '../utils/dom.js';

let el$ = null;
let current = { state: 'idle', detail: '' };
const handlers = new Set();

export function mount(container) {
  if (!el$) {
    el$ = el('div', { class: 'status-pill', 'data-state': 'idle' });
  }
  container.appendChild(el$);
  render();
  window.addEventListener('online',  onNet);
  window.addEventListener('offline', onNet);
  onNet();
}

export function setStatus(state, detail = '') {
  if (state === 'idle' && !navigator.onLine) state = 'offline';
  current = { state, detail };
  render();
  for (const h of handlers) { try { h(current); } catch {} }
}

export function getStatus() { return current; }

export function subscribe(fn) {
  handlers.add(fn);
  return () => handlers.delete(fn);
}

function onNet() {
  if (!navigator.onLine) setStatus('offline', 'No internet');
  else if (current.state === 'offline') setStatus('idle', '');
}

function render() {
  if (!el$) return;
  el$.dataset.state = current.state;
  el$.textContent = labelFor(current.state);
  el$.title = current.detail || '';
}

function labelFor(s) {
  switch (s) {
    case 'idle':    return '';
    case 'dirty':   return 'unsaved';
    case 'saving':  return 'saving…';
    case 'syncing': return 'syncing…';
    case 'error':   return 'sync error';
    case 'offline': return 'offline';
    default:        return s;
  }
}
