import { el, clear } from '../../utils/dom.js';
import { back, go } from '../router.js';
import { session } from '../../storage/session.js';
import {
  createNote, switchType, getNote, saveNote, deleteNote, hasContent, ICONS,
} from '../../storage/notes.js';
import { toast } from '../toast.js';
import { startAutosave, stopAutosave } from '../../storage/autosave.js';
import { loadSettings, updateSettings } from '../../storage/settings.js';
import { confirmDialog } from '../dialog.js';
import { rememberLastOpened } from '../search.js';

export async function EditorView(root, { params }) {
  clear(root);

  const userId = session.user.userId;
  let isNew = params.id === 'new';

  let note;
  if (isNew) note = createNote('chat');
  else {
    note = await getNote(userId, params.id);
    if (!note) { go('/notes'); return; }
    rememberLastOpened(note.id);
  }

  let dirty = false;
  let persistTimer = null;

  // ---------- Header ----------
  const backBtn = el('button', { class: 'btn btn--ghost btn--icon', title: 'Back', onclick: onBack }, '←');

  const titleInput = el('input', {
    class: 'header__title',
    style: 'background:transparent;border:none;font-size:17px;font-weight:600;color:var(--text-strong);min-width:0',
    value: note.title || '',
    placeholder: 'Untitled',
    oninput: () => { note.title = titleInput.value; markDirty(); debouncedPersist(); },
  });

  const pinBtn = el('button', {
    class: 'btn btn--ghost btn--icon' + (note.pinned ? ' pin-active' : ''),
    title: note.pinned ? 'Unpin' : 'Pin',
    onclick: togglePin,
  }, '📌');

  const iconBtn = el('button', {
    class: 'btn btn--ghost btn--icon', title: 'Change icon', onclick: openIconPicker,
  }, note.icon);

  const menuBtn = el('button', {
    class: 'btn btn--ghost btn--icon', title: 'More', onclick: openNoteMenu,
  }, '⋯');

  const header = el('header', { class: 'header' }, [
    backBtn, titleInput, pinBtn, iconBtn, menuBtn,
  ]);

  const body = el('div', { class: 'chat' });
  const composer = el('div', { class: 'composer' });

  root.append(header, body, composer);

  render();

  // ---------- Render ----------
  function render() {
    clear(body); clear(composer);
    if (note.type === 'chat') renderChat();
    else if (note.type === 'file') renderFile();
    else if (note.type === 'credentials') renderCredentials();
  }

  function renderChat() {
    clear(body); clear(composer);
    if (note.messages.length === 0) {
      body.appendChild(el('div', { class: 'list__empty' }, 'No messages yet. Send the first one below.'));
    } else {
      for (const m of note.messages) body.appendChild(renderBubble(m));
    }
    composer.append(
      buildComposerTextarea(),
      el('button', { class: 'btn btn--primary btn--icon', title: 'Send', onclick: sendMessage }, '➤'),
    );
    requestAnimationFrame(() => { body.scrollTop = body.scrollHeight; });
  }

  function renderBubble(m) {
    const time = new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return el('div', {
      class: 'bubble bubble--out',
      onclick: () => openMessageSheet(m),
    }, [
      el('div', { class: 'bubble__text' }, m.text),
      el('div', { class: 'bubble__meta' }, [
        m.edited ? el('span', { class: 'bubble__edited' }, 'edited') : null,
        el('span', {}, time),
      ].filter(Boolean)),
    ]);
  }

  function buildComposerTextarea() {
    const ta = el('textarea', {
      class: 'textarea', placeholder: 'Write a message…', rows: 1,
      oninput: () => {
        ta.style.height = 'auto';
        ta.style.height = Math.min(ta.scrollHeight, window.innerHeight * 0.4) + 'px';
      },
      onkeydown: (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
      },
    });
    return ta;
  }

  async function sendMessage() {
    const ta = composer.querySelector('textarea');
    const text = ta?.value.trim();
    if (!text) return;
    note.messages.push({ id: crypto.randomUUID(), text, ts: Date.now() });
    ta.value = ''; ta.style.height = 'auto';
    await persist();
    renderChat();
  }

  function renderFile() {
    clear(body); clear(composer);
    const ta = el('textarea', { class: 'textarea editor-file', placeholder: 'Start writing…' });
    ta.value = note.content || '';
    ta.addEventListener('input', () => {
      note.content = ta.value;
      markDirty();
      debouncedPersist();
    });
    body.appendChild(ta);
  }

  function renderCredentials() {
    clear(body); clear(composer);
    body.append(
      field('Service', note.service, (v) => { note.service = v; debouncedPersist(); }),
      field('Username', note.username, (v) => { note.username = v; debouncedPersist(); },
        { autocapitalize: 'off', spellcheck: false }),
      secretField('Password', note.password, (v) => { note.password = v; debouncedPersist(); }),
      textareaField('Notes', note.notes, (v) => { note.notes = v; debouncedPersist(); }),
    );
  }

  function field(label, value, oninput, opts = {}) {
    const input = el('input', {
      class: 'input', value: value || '',
      oninput: (e) => oninput(e.target.value),
      ...opts,
    });
    return el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, label),
      input,
    ]);
  }

  function secretField(label, value, oninput) {
    const wrap = el('div', { style: 'display:flex;gap:8px;align-items:stretch' });
    const input = el('input', {
      class: 'input', type: 'password', value: value || '',
      autocapitalize: 'off', spellcheck: false,
      oninput: (e) => oninput(e.target.value),
      style: 'flex:1',
    });
    const showBtn = el('button', {
      class: 'btn btn--ghost btn--icon', type: 'button', title: 'Show/hide',
      onclick: () => { input.type = input.type === 'password' ? 'text' : 'password'; },
    }, '👁');
    const copyBtn = el('button', {
      class: 'btn btn--ghost btn--icon', type: 'button', title: 'Copy',
      onclick: async () => {
        try { await navigator.clipboard.writeText(input.value); toast('Copied'); }
        catch { toast('Clipboard unavailable'); }
      },
    }, '📋');
    wrap.append(input, showBtn, copyBtn);
    return el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, label),
      wrap,
    ]);
  }

  function textareaField(label, value, oninput) {
    const ta = el('textarea', { class: 'textarea', oninput: (e) => oninput(e.target.value) });
    ta.value = value || '';
    return el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, label),
      ta,
    ]);
  }

  // ---------- Message sheet ----------
  function openMessageSheet(m) {
    const sheet = el('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) sheet.remove(); } });
    const card = el('div', { class: 'sheet' });
    sheet.appendChild(card);

    function showActions() {
      clear(card);
      card.append(
        el('button', { class: 'sheet__btn', onclick: async () => {
          try { await navigator.clipboard.writeText(m.text); toast('Copied'); } catch {}
          sheet.remove();
        } }, '📋 Copy'),
        el('button', { class: 'sheet__btn', onclick: () => showEdit() }, '✏️ Edit'),
        el('button', { class: 'sheet__btn sheet__btn--danger', onclick: async () => {
          note.messages = note.messages.filter(x => x.id !== m.id);
          await persist(); sheet.remove(); renderChat();
        } }, '🗑 Delete'),
        el('button', { class: 'sheet__btn sheet__btn--ghost', onclick: () => sheet.remove() }, 'Cancel'),
      );
    }

    function showEdit() {
      clear(card);
      const ta = el('textarea', { class: 'textarea', style: 'margin-bottom:12px' });
      ta.value = m.text;
      card.append(
        ta,
        el('button', { class: 'sheet__btn sheet__btn--primary', onclick: async () => {
          const text = ta.value.trim();
          if (!text) return;
          m.text = text; m.edited = true;
          await persist(); sheet.remove(); renderChat();
        } }, 'Save'),
        el('button', { class: 'sheet__btn sheet__btn--ghost', onclick: () => sheet.remove() }, 'Cancel'),
      );
      requestAnimationFrame(() => ta.focus());
    }

    showActions();
    document.body.appendChild(sheet);
  }

  // ---------- Icons / menu ----------
  function openIconPicker() {
    const sheet = el('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) sheet.remove(); } });
    const card = el('div', { class: 'sheet' });
    card.append(
      el('div', { class: 'sheet__title' }, 'Choose icon'),
      el('div', { class: 'icon-grid' }, ICONS.map(ic =>
        el('button', {
          class: 'icon-grid__item' + (note.icon === ic ? ' active' : ''),
          onclick: async () => {
            note.icon = ic;
            iconBtn.textContent = ic;
            await persist();
            sheet.remove();
          },
        }, ic)
      )),
      el('button', { class: 'sheet__btn sheet__btn--ghost', onclick: () => sheet.remove() }, 'Cancel'),
    );
    sheet.appendChild(card);
    document.body.appendChild(sheet);
  }

  function openNoteMenu() {
    const sheet = el('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) sheet.remove(); } });
    const card = el('div', { class: 'sheet' });

    for (const o of [
      { t: 'chat', label: '💬 Chat' },
      { t: 'file', label: '📄 File' },
      { t: 'credentials', label: '🔒 Credentials' },
    ]) {
      card.append(el('button', {
        class: 'sheet__btn' + (note.type === o.t ? ' sheet__btn--primary' : ''),
        onclick: async () => {
          switchType(note, o.t);
          render();
          await persist();
          sheet.remove();
        },
      }, o.label));
    }

    card.append(
      el('button', {
        class: 'sheet__btn sheet__btn--danger',
        onclick: async () => {
          if (!confirm('Delete this note? This cannot be undone.')) return;
          await deleteNote(note.id);
          sheet.remove();
          dirty = false;
          go('/notes');
        },
      }, '🗑 Delete note'),
      el('button', { class: 'sheet__btn sheet__btn--ghost', onclick: () => sheet.remove() }, 'Cancel'),
    );
    sheet.appendChild(card);
    document.body.appendChild(sheet);
  }

  // ---------- Actions ----------
  function markDirty() {
    if (dirty) return;
    dirty = true;
    document.title = '● NOTE5';
  }

  async function persist() {
    clearTimeout(persistTimer);
    if (isNew && !hasContent(note)) return;
    await saveNote(userId, note);
    dirty = false;
    document.title = 'NOTE5';
    if (isNew) {
      isNew = false; // la nota ya existe
      history.replaceState(null, '', `#/note/${note.id}`);
      rememberLastOpened(note.id);
    }
  }

  function debouncedPersist() {
    markDirty();
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => persist(), 800);
  }

  async function onBack() {
    if (dirty && hasContent(note)) {
      const settings = loadSettings();
      if (settings.warnUnsaved) {
        const { choice, dontAsk } = await confirmDialog({
          title: 'Unsaved changes',
          message: 'You have unsaved changes. What do you want to do?',
          confirmLabel: 'Save & leave',
          cancelLabel: 'Stay',
          altLabel: 'Discard',
          showDontAsk: true,
        });
        if (dontAsk) updateSettings({ warnUnsaved: false });
        if (choice === 'cancel') return;
        if (choice === 'confirm') await persist();
        // 'alt' → discard, salimos sin guardar
        if (choice === 'alt') { dirty = false; }
      } else {
        await persist();
      }
    } else if (dirty) {
      // contenido vacío, no guardamos
      dirty = false;
    }
    back();
  }

  async function togglePin() {
    note.pinned = !note.pinned;
    pinBtn.classList.toggle('pin-active', note.pinned);
    pinBtn.title = note.pinned ? 'Unpin' : 'Pin';
    await persist();
  }

  // ---------- Autosave + beforeunload + cleanup ----------
  const beforeUnloadHandler = (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = '';
  };
  window.addEventListener('beforeunload', beforeUnloadHandler);

  startAutosave(
    () => ({ dirty, note, userId }),
    async (s) => { if (s.dirty && hasContent(s.note)) await persist(); }
  );

  window.__viewCleanup = () => {
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    clearTimeout(persistTimer);
    stopAutosave();
  };
}
