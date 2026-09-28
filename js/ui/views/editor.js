import { el, clear } from '../../utils/dom.js';
import { back, go } from '../router.js';
import { toggleTheme } from '../theme.js';
import { toast } from '../toast.js';

export function EditorView(root, { params }) {
  clear(root);
  const id = params.id;
  const isNew = id === 'new';

  // MOCK — sustituir en Fase 5
  const note = isNew
    ? { id: null, type: 'chat', title: '', icon: '💡', messages: [] }
    : { id, type: 'chat', title: 'Project ideas', icon: '💡', messages: [
        { id: 'm1', text: 'How about a chrome extension that…', ts: Date.now() - 3600_000 },
        { id: 'm2', text: 'Yeah, and encrypt the payload client-side.', ts: Date.now() - 3000_000, edited: true },
      ] };

  const header = el('header', { class: 'header' }, [
    el('button', { class: 'btn btn--ghost btn--icon', onclick: back, title: 'Back' }, '←'),
    el('input', {
      class: 'header__title',
      style: 'background:transparent;border:none;font-size:17px;font-weight:600;color:var(--text-strong)',
      value: note.title, placeholder: 'Untitled', oninput: () => markDirty(),
    }),
    el('button', { class: 'btn btn--ghost btn--icon', title: 'Note type', onclick: () => cycleType() }, note.icon),
  ]);

  const body = el('div', { class: 'chat' });
  const composer = el('div', { class: 'composer' }, [
    el('textarea', { class: 'textarea', placeholder: 'Write a message…', rows: 1, oninput: (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = Math.min(e.target.scrollHeight, window.innerHeight * 0.4) + 'px';
      markDirty();
    }}),
    el('button', { class: 'btn btn--primary btn--icon', title: 'Send', onclick: () => sendMessage() }, '➤'),
  ]);

  function renderBody() {
    clear(body);
    if (note.type === 'chat') {
      for (const m of note.messages) body.appendChild(renderBubble(m));
    } else if (note.type === 'file') {
      const ta = el('textarea', {
        class: 'textarea', style: 'flex:1;min-height:60vh',
        placeholder: 'Start writing…',
        oninput: markDirty,
      });
      ta.value = note.content || '';
      body.appendChild(ta);
      composer.replaceChildren();
    } else if (note.type === 'credentials') {
      body.appendChild(el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, 'Service'),
        el('input', { class: 'input', oninput: markDirty, value: note.service || '' }),
      ]));
      body.appendChild(el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, 'Username'),
        el('input', { class: 'input', oninput: markDirty, value: note.username || '', autocapitalize: 'off', spellcheck: 'false' }),
      ]));
      body.appendChild(el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, 'Password'),
        secretInput(note.password || ''),
      ]));
      body.appendChild(el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, 'Notes'),
        el('textarea', { class: 'textarea', oninput: markDirty }, note.notes || ''),
      ]));
      composer.replaceChildren();
    }
  }

  function secretInput(value) {
    const wrap = el('div', { style: 'position:relative;display:flex;gap:8px' });
    const inp = el('input', {
      class: 'input', type: 'password', value,
      autocapitalize: 'off', spellcheck: 'false',
      style: 'flex:1',
      oninput: markDirty,
    });
    const btn = el('button', {
      class: 'btn btn--ghost btn--icon', type: 'button', title: 'Show / hide',
      onclick: () => { inp.type = inp.type === 'password' ? 'text' : 'password'; },
    }, '👁');
    wrap.append(inp, btn);
    return wrap;
  }

  function renderBubble(m) {
    const b = el('div', { class: 'bubble bubble--out' }, [
      el('div', { class: 'bubble__text' }, m.text),
      el('div', { class: 'bubble__meta' }, [
        m.edited ? el('span', { class: 'bubble__edited' }, 'edited') : null,
        el('span', {}, formatTime(m.ts)),
      ]),
    ]);
    return b;
  }

  function sendMessage() {
    const ta = composer.querySelector('textarea');
    const text = ta?.value.trim();
    if (!text) return;
    note.messages.push({ id: crypto.randomUUID(), text, ts: Date.now() });
    ta.value = ''; ta.style.height = 'auto';
    renderBody();
    markDirty();
  }

  function cycleType() {
    const types = [
      { type: 'chat',        icon: '💡' },
      { type: 'file',        icon: '📄' },
      { type: 'credentials', icon: '🔒' },
    ];
    const idx = types.findIndex(t => t.type === note.type);
    const next = types[(idx + 1) % types.length];
    note.type = next.type; note.icon = next.icon;
    header.querySelector('button:last-child').textContent = note.icon;
    renderBody();
    markDirty();
  }

  let dirty = false;
  function markDirty() {
    if (dirty) return;
    dirty = true;
    toast('Unsaved changes');
  }

  renderBody();
  root.append(header, body, composer);
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
