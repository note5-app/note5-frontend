import { el, clear } from '../../utils/dom.js';
import { go, back } from '../router.js';
import { session } from '../../storage/session.js';
import { toggleTheme } from '../theme.js';

// MOCK — sustituir en Fase 5 por lectura desde IndexedDB
const MOCK_NOTES = [
  { id: 'n1', type: 'chat',        title: 'Project ideas', icon: '💡', updatedAt: Date.now() - 1000 * 60 * 5,  preview: 'How about a chrome extension that…', pinned: true },
  { id: 'n2', type: 'file',        title: 'Reading notes', icon: '📖', updatedAt: Date.now() - 1000 * 60 * 60 * 3, preview: 'Chapter 1 — On the nature of…', pinned: false },
  { id: 'n3', type: 'credentials', title: 'Router admin',  icon: '🔒', updatedAt: Date.now() - 1000 * 60 * 60 * 26, preview: '••••••••', pinned: false },
];

export function ListView(root) {
  clear(root);

  const items = [...MOCK_NOTES].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

  const header = el('header', { class: 'header' }, [
    el('button', { class: 'btn btn--ghost btn--icon', title: 'Settings', onclick: () => go('/settings') }, '⚙'),
    el('div', { class: 'header__title' }, [
      'NOTE5',
      el('div', { class: 'header__subtitle' }, session.user?.username || ''),
    ]),
    el('button', { class: 'btn btn--ghost btn--icon', title: 'Toggle theme', onclick: toggleTheme }, '◐'),
  ]);

  const search = el('div', { style: 'padding:12px 16px;border-bottom:1px solid var(--border)' }, [
    el('input', { class: 'input', type: 'search', placeholder: 'Search…  (name: / current: / global:)', autocomplete: 'off' }),
  ]);

  const list = el('div', { class: 'list' });
  if (items.length === 0) {
    list.appendChild(el('div', { class: 'list__empty' }, 'No notes yet. Tap + to create one.'));
  } else {
    for (const n of items) list.appendChild(renderItem(n));
  }

  const fab = el('button', { class: 'fab', title: 'New note', onclick: () => go('/note/new') }, '+');

  root.append(header, search, list, fab);
}

function renderItem(n) {
  const item = el('div', { class: 'list__item' + (n.pinned ? ' list__item--pinned' : ''), onclick: () => go('/note/' + n.id) }, [
    el('div', { class: 'list__icon' }, n.icon),
    el('div', { class: 'list__body' }, [
      el('div', { class: 'list__row1' }, [
        el('div', { class: 'list__title' }, n.title || 'Untitled'),
        el('div', { class: 'list__time' }, formatTime(n.updatedAt)),
      ]),
      el('div', { class: 'list__preview' }, n.type === 'credentials' ? '••••••••' : n.preview),
    ]),
  ]);
  return item;
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const diffDays = Math.floor((now - d) / 86400000);
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
}
