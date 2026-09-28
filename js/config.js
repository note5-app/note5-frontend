// Configuración global. Todo en un solo sitio.
export const CONFIG = {
  WORKER_URL: 'https://note5-worker.manuelvarelacaldas.workers.dev',
  APP_NAME: 'NOTE5',
  CHUNK_SIZE: 512 * 1024,          // 512 KB
  MAX_TOTAL_SIZE: 50 * 1024 * 1024, // 50 MB
  AUTOSAVE_DEFAULT_INTERVAL_MS: 30_000,
  AUTOBACKUP_DEFAULT: 'off',       // off | 12h | daily | weekly | monthly
  PBKDF2_ITERATIONS: 100_000,
  THEME_KEY: 'note5.theme',
  SESSION_KEY: 'note5.session',
  SETTINGS_KEY: 'note5.settings',
};
