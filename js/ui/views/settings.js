import { el, clear } from '../../utils/dom.js';
import { go, back } from '../router.js';
import { toggleTheme } from '../theme.js';
import { session } from '../../storage/session.js';
import { toast } from '../toast.js';
import { CONFIG } from '../../config.js';

export function SettingsView(root) {
  clear(root);

  const settings = loadSettings();
  const save = () => localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(settings));

  const header = el('header', { class: 'header' }, [
    el('button', { class: 'btn btn--ghost btn--icon', onclick: back, title: 'Back' }, '←'),
    el('div', { class: 'header__title' }, 'Settings'),
  ]);

  const body = el('div', { class: 'settings' }, [

    section('Account', [
      row('Signed in as', session.user?.username || '—'),
      rowButton('Log out', () => {
        session.logout();
        go('/login');
      }, 'danger'),
    ]),

    section('Appearance', [
      checkbox('Dark mode', document.documentElement.dataset.theme === 'dark', (v) => {
        if ((v && document.documentElement.dataset.theme !== 'dark') ||
            (!v && document.documentElement.dataset.theme !== 'light')) toggleTheme();
      }),
    ]),

    section('Autosave', [
      checkbox('Save current note locally every few seconds',
        settings.autosaveLocal, (v) => { settings.autosaveLocal = v; save(); }),
      selectRow('Interval',
        [{ v: 10_000, l: '10 s' }, { v: 30_000, l: '30 s' }, { v: 60_000, l: '1 min' }, { v: 300_000, l: '5 min' }],
        settings.autosaveLocalInterval, (v) => { settings.autosaveLocalInterval = v; save(); }),
    ]),

    section('Cloud backup', [
      checkbox('Automatic backup to cloud',
        settings.autobackup !== 'off', (v) => { settings.autobackup = v ? 'daily' : 'off'; save(); refreshBackupSelect(); }),
      selectRow('Frequency',
        [{ v: '12h', l: 'Every 12 hours' }, { v: 'daily', l: 'Daily' },
         { v: 'weekly', l: 'Weekly' }, { v: 'monthly', l: 'Monthly' }],
        settings.autobackup === 'off' ? 'daily' : settings.autobackup,
        (v) => { settings.autobackup = v; save(); }),
    ]),

    section('Manual backup', [
      rowButton('Export backup to file…', () => toast('Coming in Phase 7')),
      rowButton('Import backup from file…', () => toast('Coming in Phase 7')),
    ]),

    section('Advanced', [
      checkbox('Show technical panel (progress details, timings, chunk info)',
        settings.showTechPanel, (v) => { settings.showTechPanel = v; save(); }),
      checkbox('Show warn on unsaved changes',
        settings.warnUnsaved, (v) => { settings.warnUnsaved = v; save(); }),
    ]),

    section('Danger zone', [
      rowButton('Delete all notes (local only)', () => {
        if (confirm('This will delete every note stored on this device. Your cloud backup will NOT be affected. Continue?')) {
          // TODO Fase 5: indexedDB.deleteDatabase
          toast('All local notes deleted');
        }
      }, 'danger'),
    ]),
  ]);

  root.append(header, body);
}

function section(title, children) {
  return el('div', { class: 'settings__section' }, [el('h2', {}, title), ...children]);
}

function row(title, value) {
  return el('div', { class: 'settings__row' }, [
    el('div', { class: 'settings__row-text' }, [
      el('div', { class: 'settings__row-title' }, title),
      value ? el('div', { class: 'settings__row-desc' }, value) : null,
    ]),
  ]);
}

function rowButton(label, onclick, variant) {
  return el('div', { class: 'settings__row' }, [
    el('button', { class: 'btn btn--ghost' + (variant === 'danger' ? ' btn--danger' : ''), onclick, style: 'width:100%;justify-content:flex-start' }, label),
  ]);
}

function checkbox(label, checked, onchange) {
  const input = el('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onchange(input.checked));
  return el('label', { class: 'checkbox' }, [input, el('span', { class: 'checkbox__text' }, label)]);
}

function selectRow(label, options, value, onchange) {
  const sel = el('select');
  for (const o of options) {
    const opt = el('option', { value: o.v }, o.l);
    if (String(o.v) === String(value)) opt.selected = true;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', () => {
    const raw = sel.value;
    const num = Number(raw);
    onchange(Number.isNaN(num) ? raw : num);
  });
  return el('div', { class: 'settings__row' }, [
    el('div', { class: 'settings__row-text' }, [el('div', { class: 'settings__row-title' }, label)]),
    sel,
  ]);
}

function loadSettings() {
  try { return JSON.parse(localStorage.getItem(CONFIG.SETTINGS_KEY)) || defaults(); }
  catch { return defaults(); }
}
function defaults() {
  return {
    autosaveLocal: false,
    autosaveLocalInterval: CONFIG.AUTOSAVE_DEFAULT_INTERVAL_MS,
    autobackup: 'off',
    showTechPanel: false,
    warnUnsaved: true,
  };
}
