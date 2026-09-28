import { CONFIG } from '../config.js';

export function serializeNotes(notes, userId) {
  return {
    magic: CONFIG.BACKUP_MAGIC,
    schema: CONFIG.BACKUP_SCHEMA,
    appVersion: CONFIG.APP_VERSION,
    exportedAt: Date.now(),
    userId,
    notes: notes.map(cleanForExport),
    meta: {
      count: notes.length,
      byType: countByType(notes),
    },
  };
}

export function deserializeNotes(obj, expectedUserId) {
  if (!obj || typeof obj !== 'object') throw new Error('invalid_backup');
  if (obj.magic !== CONFIG.BACKUP_MAGIC) throw new Error('bad_magic');
  if (obj.schema !== CONFIG.BACKUP_SCHEMA) {
    throw new Error(`unsupported_schema:${obj.schema} (expected ${CONFIG.BACKUP_SCHEMA})`);
  }
  if (obj.userId && expectedUserId && obj.userId !== expectedUserId) {
    throw new Error('userid_mismatch: this backup belongs to a different account');
  }
  const notes = Array.isArray(obj.notes) ? obj.notes : [];
  return notes.map(n => ({ ...n, userId: expectedUserId }));
}

function cleanForExport(note) {
  const { userId, ...rest } = note;
  return rest;
}

function countByType(notes) {
  const out = {};
  for (const n of notes) out[n.type] = (out[n.type] || 0) + 1;
  return out;
}

export function bytesToBase64(bytes) {
  let binary = '';
  const S = 0x8000;
  for (let i = 0; i < bytes.length; i += S) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + S));
  }
  return btoa(binary);
}

export function base64ToBytes(b64) {
  const clean = b64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
