import { CONFIG } from '../config.js';

export function defaults() {
  return {
    autosaveLocal: false,
    autosaveLocalInterval: CONFIG.AUTOSAVE_DEFAULT_INTERVAL_MS,
    autobackup: 'off',
    showTechPanel: false,
    warnUnsaved: true,
  };
}

export function loadSettings() {
  try {
    const raw = localStorage.getItem(CONFIG.SETTINGS_KEY);
    return Object.assign(defaults(), raw ? JSON.parse(raw) : {});
  } catch { return defaults(); }
}

export function saveSettings(s) {
  localStorage.setItem(CONFIG.SETTINGS_KEY, JSON.stringify(s));
}

export function updateSettings(patch) {
  const s = loadSettings();
  Object.assign(s, patch);
  saveSettings(s);
  return s;
}
