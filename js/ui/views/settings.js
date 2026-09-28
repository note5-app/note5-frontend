import { el, clear } from '../../utils/dom.js';
import { go, back } from '../router.js';
import { toggleTheme } from '../theme.js';
import { session } from '../../storage/session.js';
import { toast } from '../toast.js';
import { loadSettings, saveSettings } from '../../storage/settings.js';
import { deleteAllForUser } from '../../storage/notes.js';
import { showProgress, updateProgress, hideProgress, progressError } from '../progress.js';
import {
  backupToCloud, restoreFromCloud, exportToFile, importFromFile,
} from '../../sync/backup.js';

export function SettingsView(root) {
  clear(root);

  const settings = loadSettings();
  const save = () => saveSettings(settings);

  const header = el('header', { class: 'header' }, [
    el('button', { class: 'btn btn--ghost btn--icon', onclick: back, title: 'Back' }, '←'),
    el('div', { class: 'header__title' }, 'Settings'),
  ]);

  const body = el('div', { class: 'settings' }, [
    section('Account', [
      row('Signed in as', session.user?.username || '—'),
      rowButton('Log out', async () => {
        await session.logout();
        go('/login');
      }, 'danger'),
    ]),

    section('Appearance', [
      checkbox('Dark mode', document.documentElement.dataset.theme === 'dark', (v) => {
        const cur = document.documentElement.dataset.theme;
        if ((v && cur !== 'dark') || (!v && cur !== 'light')) toggleTheme();
      }),
    ]),

    section('Autosave', [
      checkbox('Save current note locally every few seconds',
        settings.autosaveLocal, (v) => { settings.autosaveLocal = v; save(); }),
      selectRow('Interval',
        [{ v: 10_000, l: '10 s' }, { v: 30_000, l: '30 s' },
         { v: 60_000, l: '1 min' }, { v: 300_000, l: '5 min' }],
        settings.autosaveLocalInterval, (v) => { settings.autosaveLocalInterval = v; save(); }),
    ]),

    section('Cloud backup', [
      checkbox('Automatic backup to cloud',
        settings.autobackup !== 'off',
        (v) => { settings.autobackup = v ? 'daily' : 'off'; save(); }),
      selectRow('Frequency',
        [{ v: '12h', l: 'Every 12 hours' }, { v: 'daily', l: 'Daily' },
         { v: 'weekly', l: 'Weekly' }, { v: 'monthly', l: 'Monthly' }],
        settings.autobackup === 'off' ? 'daily' : settings.autobackup,
        (v) => { settings.autobackup = v; save(); }),
      rowButton('Cloud backup now', () => runWithOverlay('Backing up…', async () => {
        const res = await backupToCloud({ userId: session.user.userId, onProgress: updateProgress });
        return `Backup done · ${res.notesCount} notes · ${res.chunkCount} chunk(s)`;
      }), 'primary'),
      rowButton('Cloud restore now', () => runWithOverlay('Restoring…', async () => {
        const res = await restoreFromCloud({ userId: session.user.userId, onProgress: updateProgress });
        return `Restored ${res.notesCount} notes from ${res.version}`;
      })),
    ]),

    section('Manual backup', [
      rowButton('Export backup to file…', () => runWithOverlay('Exporting…', async () => {
        const res = await exportToFile({ userId: session.user.userId, onProgress: updateProgress });
        downloadBlob(res.bytes, res.filename);
        return `Exported · ${res.filename}`;
      })),
      rowButton('Import backup from file…', () => pickFileAndImport()),
    ]),

    section('Advanced', [
      checkbox('Show technical panel (progress details, timings, chunk info)',
        settings.showTechPanel, (v) => { settings.showTechPanel = v; save(); }),
      checkbox('Warn on unsaved changes',
        settings.warnUnsaved, (v) => { settings.warnUnsaved = v; save(); }),
    ]),

    section('Danger zone', [
      rowButton('Delete all notes (local only)', async () => {
        if (!confirm('This will delete every note stored on this device. Your cloud backup will NOT be affected. Continue?')) return;
        await deleteAllForUser(session.user.userId);
        toast('All local notes deleted');
      }, 'danger'),
    ]),
  ]);

  root.append(header, body);

  // ---------- Overlay helper ----------

  async function runWithOverlay(title, fn) {
    const { showTechPanel } = loadSettings();
    showProgress({ title, tech: showTechPanel });
    try {
      const msg = await fn();
      updateProgress({ stage: 'done', pct: 100, detail: msg });
      setTimeout(() => hideProgress(), 900);
    } catch (err) {
      progressError(err.message || String(err));
      setTimeout(() => hideProgress(), 2400);
    }
  }

  function pickFileAndImport() {
    const input = el('input', { type: 'file', accept: '.note5,application/octet-stream' });
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      const buf = await file.arrayBuffer();
      await runWithOverlay('Importing…', async () => {
        const res = await importFromFile({
          userId: session.user.userId,
          bytes: new Uint8Array(buf),
          onProgress: updateProgress,
        });
        return `Imported ${res.notesCount} notes`;
      });
    });
    input.click();
  }
}

function downloadBlob(bytes, filename) {
  const blob = new Blob([bytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function section(title, children) {
  return el('div', { class: 'settings__section' }, [el('h2', {}, title), ...children]);
}
function row(title, value) {
  return el('div', { class: 'settings__row' }, [
    el('div', { class: 'settings__row-text' }, [
      el('div', { class: 'settings__row-title' }, title),
      value ? el('div', { class: 'settings__row-desc' }, value) : null,
    ].filter(Boolean)),
  ]);
}
function rowButton(label, onclick, variant) {
  return el('div', { class: 'settings__row' }, [
    el('button', {
      class: 'btn btn--ghost' + (variant === 'danger' ? ' btn--danger' : variant === 'primary' ? ' btn--primary' : ''),
      onclick, style: 'width:100%;justify-content:flex-start',
    }, label),
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
