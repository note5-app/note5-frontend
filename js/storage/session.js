import { CONFIG } from '../config.js';

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
    // TODO Fase 4: derivar userId con PBKDF2(username + ":" + password)
    const userId = await sha256Hex(`${username}:${password}`);
    this.user = { username, userId, createdAt: Date.now() };
    const store = remember ? localStorage : sessionStorage;
    store.setItem(CONFIG.SESSION_KEY, JSON.stringify(this.user));
    return this.user;
  },

  logout() {
    this.user = null;
    localStorage.removeItem(CONFIG.SESSION_KEY);
    sessionStorage.removeItem(CONFIG.SESSION_KEY);
  },

  isLoggedIn() { return !!this.user; },
};

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
