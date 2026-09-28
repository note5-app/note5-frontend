import { loadSettings } from './settings.js';

let timer = null;

export function startAutosave(stateProvider, onTick) {
  stopAutosave();
  const s = loadSettings();
  if (!s.autosaveLocal) return;
  const interval = Math.max(2_000, s.autosaveLocalInterval || 30_000);

  timer = setInterval(async () => {
    try {
      const state = stateProvider();
      if (!state || !state.dirty) return;
      await onTick(state);
    } catch (err) {
      console.warn('[autosave]', err);
    }
  }, interval);
}

export function stopAutosave() {
  if (timer) { clearInterval(timer); timer = null; }
}
