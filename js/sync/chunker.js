import { CONFIG } from '../config.js';

export function splitIntoChunks(envelopeBytes, chunkSize = CONFIG.CHUNK_SIZE) {
  const chunks = [];
  for (let i = 0; i < envelopeBytes.byteLength; i += chunkSize) {
    chunks.push(envelopeBytes.subarray(i, Math.min(i + chunkSize, envelopeBytes.byteLength)));
  }
  if (chunks.length === 0) chunks.push(new Uint8Array(0));
  return chunks;
}

export function joinChunks(chunks, totalSize) {
  const out = new Uint8Array(totalSize);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  if (offset !== totalSize) {
    throw new Error(`chunk_size_mismatch: got ${offset}, expected ${totalSize}`);
  }
  return out;
}

export function chunkName(index) {
  return `chunk_${String(index).padStart(3, '0')}.enc`;
}

export function versionName(ts) {
  return `v${ts}`;
}
