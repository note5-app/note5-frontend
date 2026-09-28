import { CONFIG } from '../config.js';
import { listNotes, saveNote, deleteAllForUser } from '../storage/notes.js';
import { cryptoClient } from '../crypto/client.js';
import { serializeNotes, deserializeNotes, humanSize } from './serializer.js';
import { splitIntoChunks, joinChunks, chunkName, versionName } from './chunker.js';
import * as api from './api.js';

const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- Backup ----------

export async function backupToCloud({ userId, onProgress = () => {} }) {
  // 1) Leer notas locales
  onProgress({ stage: 'read', pct: 3, detail: 'Reading local notes…' });
  const notes = await listNotes(userId);
  onProgress({ stage: 'read', pct: 6, detail: `${notes.length} notes loaded` });

  // 2) Serializar
  const payload = serializeNotes(notes, userId);
  const json = JSON.stringify(payload);
  onProgress({ stage: 'serialize', pct: 10,
    detail: `Serialized JSON · ${humanSize(json.length)}` });

  // 3) Cifrar (con progreso del worker mapeado a 10-45%)
  const plainBytes = enc.encode(json);
  const prevHandler = cryptoClient.progressHandler;
  cryptoClient.onProgress(m => onProgress({
    stage: 'encrypt',
    pct: 10 + Math.round(m.pct * 0.35),
    detail: m.detail,
  }));
  let envelope;
  try {
    envelope = await cryptoClient.encrypt(plainBytes);
  } finally {
    cryptoClient.onProgress(prevHandler || null);
  }
  const envBytes = new Uint8Array(envelope);
  onProgress({ stage: 'encrypt', pct: 45,
    detail: `Envelope ready · ${humanSize(envBytes.byteLength)}` });

  // 4) Chunking
  const chunks = splitIntoChunks(envBytes);
  onProgress({ stage: 'chunk', pct: 50,
    detail: `${chunks.length} chunk${chunks.length === 1 ? '' : 's'} × ≤512 KB` });

  // 5) Leer current.json para saber versión previa (para cleanup)
  let previous = null;
  try {
    previous = await api.getCurrent(userId);
  } catch (err) {
    // Si el GET falla por otra cosa que no sea 404, abortamos
    throw err;
  }

  // 6) Nueva versión por timestamp
  const versionTs = Date.now();
  const version = versionName(versionTs);

  // 7) Subir chunks
  for (let i = 0; i < chunks.length; i++) {
    const pct = 50 + Math.round(((i + 1) / chunks.length) * 30); // 50-80%
    onProgress({ stage: 'upload', pct,
      detail: `Uploading ${chunkName(i)} · ${humanSize(chunks[i].byteLength)}` });
    try {
      await api.putChunk(userId, version, i, chunks[i]);
    } catch (err) {
      onProgress({ stage: 'error', pct,
        detail: `Chunk ${i + 1}/${chunks.length} failed: ${err.message}` });
      throw new Error(`upload_failed_at_chunk_${i}: ${err.message}`);
    }
  }

  // 8) Actualizar current.json SOLO después de que todos los chunks subieron
  onProgress({ stage: 'commit', pct: 85, detail: 'Committing current.json…' });
  const newCurrent = {
    version: CONFIG.BACKUP_SCHEMA,
    appVersion: CONFIG.APP_VERSION,
    backupVersion: version,
    chunkCount: chunks.length,
    envelopeSize: envBytes.byteLength,
    updatedAt: versionTs,
    notesCount: notes.length,
  };
  await api.putCurrent(userId, newCurrent, previous?._sha || null);
  onProgress({ stage: 'commit', pct: 92, detail: 'Pointer updated · backup is live' });

  // 9) Cleanup de la versión anterior (best-effort, no bloquea el éxito)
  if (previous?.backupVersion && previous.backupVersion !== version) {
    onProgress({ stage: 'cleanup', pct: 96,
      detail: `Removing previous version ${previous.backupVersion}…` });
    try {
      await api.deleteVersion(userId, previous.backupVersion);
      onProgress({ stage: 'cleanup', pct: 98, detail: 'Previous version removed' });
    } catch (err) {
      onProgress({ stage: 'cleanup', pct: 98,
        detail: `Cleanup skipped: ${err.message}` });
      // no re-lanzamos
    }
  }

  onProgress({ stage: 'done', pct: 100,
    detail: `${notes.length} notes · ${chunks.length} chunk(s) · ${humanSize(envBytes.byteLength)}` });
  return { version, chunkCount: chunks.length, envelopeSize: envBytes.byteLength, notesCount: notes.length };
}

// ---------- Restore ----------

export async function restoreFromCloud({ userId, onProgress = () => {} }) {
  // 1) current.json
  onProgress({ stage: 'read', pct: 3, detail: 'Reading remote pointer…' });
  const current = await api.getCurrent(userId);
  if (!current) throw new Error('no_backup_found');
  onProgress({ stage: 'read', pct: 8,
    detail: `Found ${current.backupVersion} · ${current.chunkCount} chunk(s)` });

  // 2) Descargar chunks
  const chunks = [];
  for (let i = 0; i < current.chunkCount; i++) {
    const pct = 8 + Math.round(((i + 1) / current.chunkCount) * 27); // 8-35%
    onProgress({ stage: 'download', pct,
      detail: `Downloading ${chunkName(i)} (${i + 1}/${current.chunkCount})…` });
    const bytes = await api.getChunk(userId, current.backupVersion, i);
    chunks.push(bytes);
  }

  // 3) Reensamblar
  onProgress({ stage: 'join', pct: 38,
    detail: `Joining ${chunks.length} chunk(s)…` });
  const envelope = joinChunks(chunks, current.envelopeSize);

  // 4) Descifrar (con progreso del worker mapeado a 38-70%)
  const prevHandler = cryptoClient.progressHandler;
  cryptoClient.onProgress(m => onProgress({
    stage: 'decrypt',
    pct: 38 + Math.round(m.pct * 0.32),
    detail: m.detail,
  }));
  let plain;
  try {
    plain = await cryptoClient.decrypt(envelope.buffer);
  } finally {
    cryptoClient.onProgress(prevHandler || null);
  }
  onProgress({ stage: 'decrypt', pct: 72, detail: 'Envelope decrypted' });

  // 5) Deserializar
  let obj;
  try {
    obj = JSON.parse(dec.decode(plain));
  } catch (err) {
    throw new Error('json_parse_failed: ' + err.message);
  }
  const remoteNotes = deserializeNotes(obj, userId);
  onProgress({ stage: 'parse', pct: 78,
    detail: `Parsed ${remoteNotes.length} notes` });

  // 6) Reemplazo destructivo
  onProgress({ stage: 'write', pct: 82, detail: 'Replacing local notes…' });
  await deleteAllForUser(userId);
  for (let i = 0; i < remoteNotes.length; i++) {
    const n = remoteNotes[i];
    const pct = 82 + Math.round(((i + 1) / remoteNotes.length) * 15); // 82-97%
    if (i % 5 === 0 || i === remoteNotes.length - 1) {
      onProgress({ stage: 'write', pct, detail: `Restoring note ${i + 1}/${remoteNotes.length}…` });
    }
    await saveNote(userId, n);
  }

  onProgress({ stage: 'done', pct: 100,
    detail: `${remoteNotes.length} notes restored from ${current.backupVersion}` });
  return { notesCount: remoteNotes.length, version: current.backupVersion };
}

// ---------- Export / Import a archivo ----------

export async function exportToFile({ userId, onProgress = () => {} }) {
  onProgress({ stage: 'read', pct: 5, detail: 'Reading local notes…' });
  const notes = await listNotes(userId);
  const payload = serializeNotes(notes, userId);
  const json = JSON.stringify(payload);

  onProgress({ stage: 'serialize', pct: 20,
    detail: `Serialized · ${humanSize(json.length)}` });

  const prevHandler = cryptoClient.progressHandler;
  cryptoClient.onProgress(m => onProgress({
    stage: 'encrypt',
    pct: 25 + Math.round(m.pct * 0.6),
    detail: m.detail,
  }));
  let envelope;
  try {
    envelope = await cryptoClient.encrypt(enc.encode(json));
  } finally {
    cryptoClient.onProgress(prevHandler || null);
  }

  const bytes = new Uint8Array(envelope);
  onProgress({ stage: 'done', pct: 100,
    detail: `Envelope · ${humanSize(bytes.byteLength)}` });
  return { bytes, filename: buildExportFilename(userId, bytes.byteLength), notesCount: notes.length };
}

export async function importFromFile({ userId, bytes, onProgress = () => {} }) {
  const envBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  onProgress({ stage: 'read', pct: 5,
    detail: `File loaded · ${humanSize(envBytes.byteLength)}` });

  const prevHandler = cryptoClient.progressHandler;
  cryptoClient.onProgress(m => onProgress({
    stage: 'decrypt',
    pct: 10 + Math.round(m.pct * 0.6),
    detail: m.detail,
  }));
  let plain;
  try {
    plain = await cryptoClient.decrypt(envBytes.buffer);
  } finally {
    cryptoClient.onProgress(prevHandler || null);
  }

  onProgress({ stage: 'parse', pct: 75, detail: 'Parsing JSON…' });
  let obj;
  try { obj = JSON.parse(dec.decode(plain)); }
  catch (err) { throw new Error('json_parse_failed: ' + err.message); }

  const notes = deserializeNotes(obj, userId);
  onProgress({ stage: 'write', pct: 82,
    detail: `Replacing ${notes.length} notes…` });
  await deleteAllForUser(userId);
  for (let i = 0; i < notes.length; i++) {
    if (i % 5 === 0 || i === notes.length - 1) {
      const pct = 82 + Math.round(((i + 1) / notes.length) * 15);
      onProgress({ stage: 'write', pct, detail: `Note ${i + 1}/${notes.length}…` });
    }
    await saveNote(userId, notes[i]);
  }
  onProgress({ stage: 'done', pct: 100, detail: `${notes.length} notes imported` });
  return { notesCount: notes.length };
}

function buildExportFilename(userId, size) {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  return `note5-${userId.slice(0, 8)}-${stamp}${CONFIG.BACKUP_FILE_EXT}`;
}
