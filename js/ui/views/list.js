import { el, clear } from '../../utils/dom.js';
import { go } from '../router.js';
import { session } from '../../storage/session.js';
import { toggleTheme } from '../theme.js';
import { listNotes, previewOf } from '../../storage/notes.js';

export async function ListView(root) {
  clear(root);

  const userId = session.user.userId;

  const header = el('header', { class: 'header' }, [
    el('button', { class: 'btn btn--ghost btn--icon', title: 'Settings', onclick: () => go('/settings') }, '⚙'),
    el('div', { class: 'header__title' }, [
      'NOTE5',
      el('div', { class: 'header__subtitle' }, session.user?.username || ''),
    ]),
    el('button', { class: 'btn btn--ghost btn--icon', title: 'Toggle theme', onclick: toggleTheme }, '◐'),
  ]);

  const searchInput = el('input', {
    class: 'input', type: 'search', placeholder: 'Search…  (name: / current: / global:)',
    autocomplete: 'off',
  });
  const search = el('div', {
    style: 'padding:12px 16px;border-bottom:1px solid var(--border)'
  }, [searchInput]);

  const list = el('div', { class: 'list' });

  const fab = el('button', { class: 'fab', title: 'New note', onclick: () => go('/note/new') }, '+');

  root.append(header, search, list, fab);

  // Cargar notas
  const notes = await listNotes(userId);

  if (notes.length === 0) {
    list.appendChild(el('div', { class: 'list__empty' }, [
      el('div', { style: 'font-size:40px;margin-bottom:12px' }, '📝'),
      el('div', {}, 'No notes yet'),
      el('div', { style: 'font-size:13px;margin-top:8px;opacity:0.7' }, 'Tap + to create your first note'),
    ]));
    return;
  }

  for (const n of notes) list.appendChild(renderItem(n));
}

function renderItem(n) {
  const title = n.title && n.title.trim() ? n.title : 'Untitled';
  return el('div', {
    class: 'list__item' + (n.pinned ? ' list__item--pinned' : ''),
    onclick: () => go('/note/' + n.id),
  }, [
    el('div', { class: 'list__icon' }, n.icon || '📝'),
    el('div', { class: 'list__body' }, [
      el('div', { class: 'list__row1' }, [
        el('div', { class: 'list__title' }, title),
        el('div', { class: 'list__time' }, formatTime(n.updatedAt)),
      ]),
      el('div', { class: 'list__preview' }, previewOf(n)),
    ]),
  ]);
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
