const routes = [];

export function register(pattern, handler) {
  // pattern: "/note/:id" → regex con capturas
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
  // 404 → home
  go('/');
}

export function start() {
  window.addEventListener('hashchange', render);
  render();
}
