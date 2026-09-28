import { loadSettings } from '../storage/settings.js';
import { listNotes } from '../storage/notes.js';
import { session } from '../storage/session.js';
import { backupToCloud } from './backup.js';
import * as api from './api.js';
import { setStatus } from '../ui/status.js';
import { toast } from '../ui/toast.js';

const KEY_LAST = 'note5.lastBackupAt';
const KEY_SYNCED_VERSION = 'note5.lastSyncedVersion';

const INTERVALS = {
  '12h':    12 * 3600 * 1000,
  daily:    24 * 3600 * 1000,
  weekly:   7 * 24 * 3600 * 1000,
  monthly: 30 * 24 * 3600 * 1000,
};

let timer = null;
let running = false;

export function getLastBackupAt(userId) {
  return Number(localStorage.getItem(`${KEY_LAST}.${userId}`) || 0);
}
export function setLastBackupAt(userId, ts) {
  localStorage.setItem(`${KEY_LAST}.${userId}`, String(ts));
}
export function getLastSyncedVersion(userId) {
  return localStorage.getItem(`${KEY_SYNCED_VERSION}.${userId}`) || null;
}
export function setLastSyncedVersion(userId, v) {
  localStorage.setItem(`${KEY_SYNCED_VERSION}.${userId}`, v);
}

export function startScheduler() {
  stopScheduler();
  const settings = loadSettings();
  if (settings.autobackup === 'off') return;
  timer = setInterval(tick, 60_000);
  setTimeout(tick, 30_000);
}

export function stopScheduler() {
  if (timer) { clearInterval(timer); timer = null; }
}

export function rescheduleScheduler() {
  stopScheduler();
  startScheduler();
}

async function tick() {
  if (running) return;
  const settings = loadSettings();
  if (settings.autobackup === 'off') return;
  const user = session.user;
  if (!user) return;
  const interval = INTERVALS[settings.autobackup] || INTERVALS.daily;
  const last = getLastBackupAt(user.userId);
  if (Date.now() - last < interval) return;
  await runAutoBackup();
}

async function runAutoBackup() {
  running = true;
  try {
    const user = session.user;
    const notes = await listNotes(user.userId);
    const maxUpdated = notes.reduce((m, n) => Math.max(m, n.updatedAt || 0), 0);
    const last = getLastBackupAt(user.userId);

    // Sin cambios → no subir, pero refrescar el timestamp para no comprobar cada minuto
    if (maxUpdated <= last) {
      setLastBackupAt(user.userId, Date.now());
      return;
    }

    // ¿Conflicto? El remoto cambió desde la última vez que sincronizamos
    const remote = await api.getCurrent(user.userId);
    const lastSynced = getLastSyncedVersion(user.userId);
    if (remote && lastSynced && remote.backupVersion !== lastSynced) {
      setStatus('error', 'Remote has newer backup — resolve in Settings');
      return;
    }

    setStatus('syncing', 'Auto-backup…');
    const res = await backupToCloud({
      userId: user.userId,
      onProgress: (m) => setStatus('syncing', m.detail || 'Auto-backup…'),
    });
    setLastBackupAt(user.userId, Date.now());
    setLastSyncedVersion(user.userId, res.version);
    setStatus('idle', '');
    toast(`Auto-backup · ${res.notesCount} notes`);
  } catch (err) {
    console.warn('[scheduler]', err);
    setStatus('error', 'Auto-backup failed: ' + err.message);
  } finally {
    running = false;
  }
}

export async function checkConflict(userId) {
  try {
    const remote = await api.getCurrent(userId);
    const lastSynced = getLastSyncedVersion(userId);
    if (!remote) return { conflict: false, remote: null };
    if (!lastSynced) return { conflict: false, remote };
    return { conflict: remote.backupVersion !== lastSynced, remote };
  } catch (err) {
    return { conflict: false, remote: null, error: err.message };
  }
}
