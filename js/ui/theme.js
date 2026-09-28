import { CONFIG } from '../config.js';

export function initTheme() {
  const saved = localStorage.getItem(CONFIG.THEME_KEY);
  const prefersLight = window.matchMedia?.('(prefers-color-scheme: light)').matches;
  const theme = saved || (prefersLight ? 'light' : 'dark');
  apply(theme);
}

export function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  apply(current === 'dark' ? 'light' : 'dark');
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(CONFIG.THEME_KEY, theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#17212b' : '#f6f8fa');
}
