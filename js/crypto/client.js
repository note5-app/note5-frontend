export class CryptoClient {
  constructor() {
    this.worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    this.pending = new Map();
    this.progressHandler = null;
    this.msgId = 0;

    this.worker.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        this.progressHandler?.(msg);
        return;
      }
      const { id, ok, result, error } = msg;
      const p = this.pending.get(id);
      if (!p) return;
      this.pending.delete(id);
      if (ok) p.resolve(result);
      else p.reject(new Error(error || 'crypto_error'));
    });

    this.worker.addEventListener('error', (e) => {
      console.error('[crypto worker fatal]', e.message);
      for (const p of this.pending.values()) p.reject(new Error('worker_fatal:' + e.message));
      this.pending.clear();
    });
  }

  onProgress(fn) { this.progressHandler = fn; }

  _send(type, payload) {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, payload });
    });
  }

  deriveIdentity(username, password) { return this._send('deriveIdentity', { username, password }); }
  encrypt(plaintextBytes)            { return this._send('encrypt', { plaintext: plaintextBytes }); }
  decrypt(envelopeBytes)             { return this._send('decrypt', { envelope: envelopeBytes }); }
  rehydrate(masterBitsB64, userId)   { return this._send('rehydrate', { masterBitsB64, userId }); }
  lock()                             { return this._send('lock', {}); }
  status()                           { return this._send('status', {}); }
}

// Singleton: una instancia por pestaña.
export const cryptoClient = new CryptoClient();
