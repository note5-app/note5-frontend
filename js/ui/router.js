const routes = [];

export function register(pattern, handler) {
  const parts = pattern.split('/').filter(Boolean);
  const keys = [];
  const regex = new RegExp('^/' + parts.map(p => {
    if (p.startsWith(':')) { keys.push(p.slice(1)); return '([^/]+)'; }
    return p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('/') + '/?$');
  routes.push({ regex, keys, handler });
}

export function go(path) {
  if (location.hash.slice(1) === path) render();
  else location.hash = path;
}

export function back() { history.back(); }

export async function render() {
  // Cleanup de la vista anterior, si dejó uno
  if (window.__viewCleanup) {
    try { window.__viewCleanup(); } catch (e) { console.warn(e); }
    window.__viewCleanup = null;
  }

  const hash = location.hash.slice(1) || '/';
  const [path, queryStr] = hash.split('?');
  const query = Object.fromEntries(new URLSearchParams(queryStr || ''));

  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.keys.forEach((k, i) => params[k] = decodeURIComponent(m[i + 1]));
      await r.handler({ params, query });
      return;
    }
  }
  go('/');
}

export function start() {
  window.addEventListener('hashchange', render);
  render();
}
