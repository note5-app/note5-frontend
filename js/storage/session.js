import { CONFIG } from '../config.js';
import { cryptoClient } from '../crypto/client.js';

const MASTER_KEY = 'note5.masterKeyBits';

export const session = {
  user: null,

  init() {
    const raw = localStorage.getItem(CONFIG.SESSION_KEY)
             || sessionStorage.getItem(CONFIG.SESSION_KEY);
    if (raw) {
      try { this.user = JSON.parse(raw); } catch { this.user = null; }
    }
  },

  async login(username, password, remember) {
    const { userId, masterBitsB64 } = await cryptoClient.deriveIdentity(username, password);
    this.user = { username, userId, createdAt: Date.now() };
    const store = remember ? localStorage : sessionStorage;
    store.setItem(CONFIG.SESSION_KEY, JSON.stringify(this.user));
    // Cache en sessionStorage → sobrevive recargas dentro de la pestaña
    sessionStorage.setItem(MASTER_KEY, masterBitsB64);
    return this.user;
  },

  // Devuelve true si consiguió rehidratar; false si hay que pedir la contraseña
  async rehydrate() {
    if (!this.user) return false;
    const b64 = sessionStorage.getItem(MASTER_KEY);
    if (!b64) return false;
    try {
      const { userId } = await cryptoClient.rehydrate(b64, this.user.userId);
      if (userId !== this.user.userId) throw new Error('userid_mismatch');
      return true;
    } catch (err) {
      console.warn('[session] rehydrate failed:', err);
      return false;
    }
  },

  async logout() {
    this.user = null;
    localStorage.removeItem(CONFIG.SESSION_KEY);
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
    sessionStorage.removeItem(MASTER_KEY);
    await cryptoClient.lock();
  },

  isLoggedIn() { return !!this.user; },
};
