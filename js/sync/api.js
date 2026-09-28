import { CONFIG } from '../config.js';
import { bytesToBase64, base64ToBytes } from './serializer.js';

const BASE = CONFIG.WORKER_URL;

async function req(method, path, body) {
  const url = `${BASE}/api/user/${path}`;
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(url, opts);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }

  if (!res.ok) {
    const err = new Error(data?.error || `http_${res.status}`);
    err.status = res.status;
    err.detail = data;
    throw err;
  }
  return data;
}

export async function getCurrent(userId) {
  try {
    const { content, sha } = await req('GET', `${userId}/current`);
    const bytes = base64ToBytes(content);
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    return { ...obj, _sha: sha };
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

export async function putCurrent(userId, obj, sha = null) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const content = bytesToBase64(bytes);
  return req('PUT', `${userId}/current`, {
    content,
    sha,
    message: `current.json · v${obj.backupVersion || '?'}`,
  });
}

export async function getChunk(userId, version, index) {
  const { content } = await req('GET', `${userId}/${version}/chunk_${String(index).padStart(3, '0')}.enc`);
  return base64ToBytes(content);
}

export async function putChunk(userId, version, index, bytes) {
  const content = bytesToBase64(bytes);
  return req('PUT', `${userId}/${version}/chunk_${String(index).padStart(3, '0')}.enc`, {
    content,
    message: `backup · v${version} · chunk ${String(index).padStart(3, '0')}`,
  });
}

export async function deleteVersion(userId, version) {
  return req('DELETE', `${userId}/${version}`);
}
