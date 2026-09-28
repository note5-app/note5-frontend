import { el, clear } from '../../utils/dom.js';
import { back, go } from '../router.js';
import { session } from '../../storage/session.js';
import {
  createNote, switchType, getNote, saveNote, deleteNote, hasContent, ICONS, NOTE_TYPES,
} from '../../storage/notes.js';
import { toast } from '../toast.js';

export async function EditorView(root, { params }) {
  clear(root);

  const userId = session.user.userId;
  const isNew = params.id === 'new';

  let note;
  if (isNew) {
    note = createNote('chat');
  } else {
    note = await getNote(userId, params.id);
    if (!note) { go('/notes'); return; }
  }

  let dirty = false;

  // ---------- Header ----------
  const backBtn = el('button', { class: 'btn btn--ghost btn--icon', title: 'Back', onclick: onBack }, '←');

  const titleInput = el('input', {
    class: 'header__title',
    style: 'background:transparent;border:none;font-size:17px;font-weight:600;color:var(--text-strong);min-width:0',
    value: note.title || '',
    placeholder: 'Untitled',
    oninput: () => { note.title = titleInput.value; markDirty(); },
    onblur: () => { if (note.title.trim()) persist(); },
  });

  const pinBtn = el('button', {
    class: 'btn btn--ghost btn--icon' + (note.pinned ? ' pin-active' : ''),
    title: note.pinned ? 'Unpin' : 'Pin',
    onclick: togglePin,
  }, '📌');

  const iconBtn = el('button', {
    class: 'btn btn--ghost btn--icon',
    title: 'Change icon',
    onclick: openIconPicker,
  }, note.icon);

  const menuBtn = el('button', {
    class: 'btn btn--ghost btn--icon',
    title: 'More',
    onclick: openNoteMenu,
  }, '⋯');

  const header = el('header', { class: 'header' }, [
    backBtn, titleInput, pinBtn, iconBtn, menuBtn,
  ]);

  // ---------- Body & composer (se rellenan en render) ----------
  const body = el('div', { class: 'chat' });
  const composer = el('div', { class: 'composer' });

  root.append(header, body, composer);

  render();

  // ---------- Render by type ----------

  function render() {
    clear(body);
    clear(composer);
    if (note.type === 'chat') renderChat();
    else if (note.type === 'file') renderFile();
    else if (note.type === 'credentials') renderCredentials();
  }

  // --- chat ---
    function renderChat() {
    clear(body);
    clear(composer);

    if (note.messages.length === 0) {
      body.appendChild(el('div', { class: 'list__empty' },
        'No messages yet. Send the first one below.'));
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
    const bubble = el('div', {
      class: 'bubble bubble--out',
      onclick: () => openMessageSheet(m),
    }, [
      el('div', { class: 'bubble__text' }, m.text),
      el('div', { class: 'bubble__meta' }, [
        m.edited ? el('span', { class: 'bubble__edited' }, 'edited') : null,
        el('span', {}, time),
      ].filter(Boolean)),
    ]);
    return bubble;
  }

  function buildComposerTextarea() {
    const ta = el('textarea', {
      class: 'textarea',
      placeholder: 'Write a message…',
      rows: 1,
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

  function openMessageSheet(m) {
    const isEditing = { v: false };
    const sheet = el('div', { class: 'sheet-backdrop', onclick: (e) => { if (e.target === sheet) sheet.remove(); } });
    const card = el('div', { class: 'sheet' });
    sheet.appendChild(card);

    function showActions() {
      clear(card);
      card.append(
        el('button', { class: 'sheet__btn', onclick: () => { copyText(m.text); sheet.remove(); toast('Copied'); } }, '📋 Copy'),
        el('button', { class: 'sheet__btn', onclick: () => { isEditing.v = true; showEdit(); } }, '✏️ Edit'),
        el('button', { class: 'sheet__btn sheet__btn--danger', onclick: () => { removeMessage(m); sheet.remove(); } }, '🗑 Delete'),
        el('button', { class: 'sheet__btn sheet__btn--ghost', onclick: () => sheet.remove() }, 'Cancel'),
      );
    }

    function showEdit() {
      clear(card);
      const ta = el('textarea', { class: 'textarea', style: 'margin-bottom:12px' });
      ta.value = m.text;
      card.append(
        ta,
        el('button', {
          class: 'sheet__btn sheet__btn--primary',
          onclick: async () => {
            const text = ta.value.trim();
            if (!text) return;
            m.text = text; m.edited = true;
            await persist();
            sheet.remove();
            renderChat();
          },
        }, 'Save'),
        el('button', { class: 'sheet__btn sheet__btn--ghost', onclick: () => sheet.remove() }, 'Cancel'),
      );
      requestAnimationFrame(() => ta.focus());
    }

    showActions();
    document.body.appendChild(sheet);
  }

  async function removeMessage(m) {
    note.messages = note.messages.filter(x => x.id !== m.id);
    await persist();
    renderChat();
  }

  // --- file ---
  function renderFile() {
    const ta = el('textarea', { class: 'textarea editor-file', placeholder: 'Start writing…' });
    ta.value = note.content || '';
    let timer = null;
    ta.addEventListener('input', () => {
      note.content = ta.value;
      markDirty();
      clearTimeout(timer);
      timer = setTimeout(() => persist(), 800);
    });
    ta.addEventListener('blur', () => { if (note.content !== ta.value) { note.content = ta.value; persist(); } });
    body.appendChild(ta);
    // Sin composer
  }

  // --- credentials ---
  function renderCredentials() {
    body.append(
      field('Service', note.service, (v) => { note.service = v; debouncedPersist(); }),
      field('Username', note.username, (v) => { note.username = v; debouncedPersist(); }, { autocapitalize: 'off', spellcheck: false }),
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
      onclick: () => { copyText(input.value); toast('Copied'); },
    }, '📋');
    wrap.append(input, showBtn, copyBtn);
    return el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, label),
      wrap,
    ]);
  }

  function textareaField(label, value, oninput) {
    const ta = el('textarea', {
      class: 'textarea',
      oninput: (e) => oninput(e.target.value),
    });
    ta.value = value || '';
    return el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, label),
      ta,
    ]);
  }

  // ---------- Actions ----------

  function markDirty() {
    dirty = true;
    document.title = '● NOTE5';
  }

  async function persist() {
    if (!hasContent(note) && isNew) {
      // No guardar drafts completamente vacíos
      return;
    }
    await saveNote(userId, note);
    dirty = false;
    document.title = 'NOTE5';
    if (isNew) {
      // Cambiar la URL para que un refresh cargue la nota guardada
      history.replaceState(null, '', `#/note/${note.id}`);
    }
  }

  let persistTimer = null;
  function debouncedPersist() {
    markDirty();
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => persist(), 800);
  }

  async function onBack() {
    if (dirty && hasContent(note)) await persist();
    back();
  }

  async function togglePin() {
    note.pinned = !note.pinned;
    pinBtn.classList.toggle('pin-active', note.pinned);
    pinBtn.title = note.pinned ? 'Unpin' : 'Pin';
    await persist();
  }

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

    const typeOptions = [
      { t: 'chat', label: '💬 Chat' },
      { t: 'file', label: '📄 File' },
      { t: 'credentials', label: '🔒 Credentials' },
    ];
    for (const o of typeOptions) {
      card.append(el('button', {
        class: 'sheet__btn' + (note.type === o.t ? ' sheet__btn--primary' : ''),
        onclick: async () => {
          switchType(note, o.t);
          if (o.t !== 'chat' && !note.icon) note.icon = { file: '📄', credentials: '🔒' }[o.t];
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
          go('/notes');
        },
      }, '🗑 Delete note'),
      el('button', { class: 'sheet__btn sheet__btn--ghost', onclick: () => sheet.remove() }, 'Cancel'),
    );
    sheet.appendChild(card);
    document.body.appendChild(sheet);
  }
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch { toast('Clipboard unavailable'); }
}
