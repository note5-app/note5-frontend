export const CONFIG = {
  WORKER_URL: 'https://note5-worker.manuelvarelacaldas.workers.dev',
  APP_NAME: 'NOTE5',
  CHUNK_SIZE: 512 * 1024,
  ENVELOPE_OVERHEAD: 45,                 // 1 version + 16 salt + 12 nonce + 16 tag
  MAX_PLAINTEXT_PER_CHUNK: 512 * 1024 - 45,
  MAX_TOTAL_SIZE: 50 * 1024 * 1024,
  AUTOSAVE_DEFAULT_INTERVAL_MS: 30_000,
  AUTOBACKUP_DEFAULT: 'off',
  PBKDF2_ITERATIONS: 100_000,
  ENVELOPE_VERSION: 0x01,
  THEME_KEY: 'note5.theme',
  SESSION_KEY: 'note5.session',
  SETTINGS_KEY: 'note5.settings',
};
