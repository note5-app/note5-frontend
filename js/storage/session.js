import { CONFIG } from '../config.js';
import { cryptoClient } from '../crypto/client.js';

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
    const { userId } = await cryptoClient.deriveIdentity(username, password);
    this.user = { username, userId, createdAt: Date.now() };
    const store = remember ? localStorage : sessionStorage;
    store.setItem(CONFIG.SESSION_KEY, JSON.stringify(this.user));
    return this.user;
  },

  async logout() {
    this.user = null;
    localStorage.removeItem(CONFIG.SESSION_KEY);
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
    await cryptoClient.lock();
  },

  isLoggedIn() { return !!this.user; },
};
