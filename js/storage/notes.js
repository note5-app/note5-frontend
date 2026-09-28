import { put, get, del, getAllByIndex } from './db.js';

export const NOTE_TYPES = ['chat', 'file', 'credentials'];

export const ICONS = [
  '💬','📄','🔒','📝','💡','📌','⭐','📖','🔑','🎯',
  '🎨','🎵','📷','🧪','⚙️','🗝️','🌱','📋','☕','🧠',
];

const DEFAULT_ICON = { chat: '💬', file: '📄', credentials: '🔒' };

export function createNote(type = 'chat') {
  const now = Date.now();
  const note = {
    id: crypto.randomUUID(),
    type,
    title: '',
    icon: DEFAULT_ICON[type] || '📝',
    pinned: false,
    createdAt: now,
    updatedAt: now,
  };
  if (type === 'chat') note.messages = [];
  else if (type === 'file') note.content = '';
  else if (type === 'credentials') {
    note.service = ''; note.username = ''; note.password = ''; note.notes = '';
  }
  return note;
}

export function switchType(note, type) {
  if (note.type === type) return note;
  note.type = type;
  // Preservar lo que ya exista; inicializar lo que falte
  if (type === 'chat' && !Array.isArray(note.messages)) note.messages = [];
  if (type === 'file' && typeof note.content !== 'string') note.content = '';
  if (type === 'credentials') {
    if (typeof note.service !== 'string') note.service = '';
    if (typeof note.username !== 'string') note.username = '';
    if (typeof note.password !== 'string') note.password = '';
    if (typeof note.notes !== 'string') note.notes = '';
  }
  return note;
}

export function hasContent(note) {
  if (note.title && note.title.trim()) return true;
  if (note.type === 'chat') return Array.isArray(note.messages) && note.messages.length > 0;
  if (note.type === 'file') return !!(note.content && note.content.trim());
  if (note.type === 'credentials')
    return !!(note.service || note.username || note.password || note.notes);
  return false;
}

export async function listNotes(userId) {
  const all = await getAllByIndex('notes', 'userId', userId);
  return all.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

export async function getNote(userId, id) {
  const n = await get('notes', id);
  if (!n || n.userId !== userId) return null;
  return n;
}

export async function saveNote(userId, note) {
  note.userId = userId;
  note.updatedAt = Date.now();
  await put('notes', note);
  return note;
}

export async function deleteNote(id) {
  return del('notes', id);
}

export async function deleteAllForUser(userId) {
  const notes = await listNotes(userId);
  for (const n of notes) await del('notes', n.id);
}

export function previewOf(note) {
  if (note.type === 'chat') {
    const last = note.messages[note.messages.length - 1];
    if (!last) return note.title || 'Empty chat';
    return last.text.replace(/\s+/g, ' ').slice(0, 80);
  }
  if (note.type === 'file') {
    return (note.content || '').replace(/\s+/g, ' ').slice(0, 80);
  }
  if (note.type === 'credentials') {
    return note.service ? `${note.service}` : '••••••••';
  }
  return '';
}
