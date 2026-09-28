import { session } from '../storage/session.js';

const LAST_KEY = 'note5.lastOpened';

export function rememberLastOpened(noteId) {
  try { localStorage.setItem(LAST_KEY, noteId); } catch {}
}
export function getLastOpened() {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

export function parseQuery(input) {
  const raw = (input || '').trim();
  if (!raw) return { scope: 'all', terms: [] };

  const m = raw.match(/^(name|current|global):\s*(.*)$/i);
  if (m) {
    return {
      scope: m[1].toLowerCase(),
      terms: m[2].toLowerCase().split(/\s+/).filter(Boolean),
    };
  }
  return {
    scope: 'all',
    terms: raw.toLowerCase().split(/\s+/).filter(Boolean),
  };
}

export function fullTextOf(note) {
  if (!note) return '';
  if (note.type === 'chat') return (note.messages || []).map(m => m.text || '').join(' ');
  if (note.type === 'file') return note.content || '';
  if (note.type === 'credentials') {
    // NUNCA incluimos la contraseña en el índice de búsqueda
    return [note.service, note.username, note.notes].filter(Boolean).join(' ');
  }
  return '';
}

export function matchesNote(note, query) {
  if (!query.terms.length) return true;

  let haystack = '';
  if (query.scope === 'name') {
    haystack = note.title || '';
  } else if (query.scope === 'current') {
    if (getLastOpened() !== note.id) return false;
    haystack = (note.title || '') + ' ' + fullTextOf(note);
  } else {
    // 'global' y 'all'
    haystack = (note.title || '') + ' ' + fullTextOf(note);
  }
  haystack = haystack.toLowerCase();
  return query.terms.every(t => haystack.includes(t));
}

export function filterNotes(notes, input) {
  const q = parseQuery(input);
  if (!q.terms.length) return notes;
  return notes.filter(n => matchesNote(n, q));
}
