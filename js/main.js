import { session } from './storage/session.js';
import { initTheme } from './ui/theme.js';
import * as router from './ui/router.js';
import { LoginView } from './ui/views/login.js';
import { ListView } from './ui/views/list.js';
import { EditorView } from './ui/views/editor.js';
import { SettingsView } from './ui/views/settings.js';
import { toast } from './ui/toast.js';

const app = document.getElementById('app');

async function boot() {
  initTheme();
  await session.init();
  registerRoutes();

  // Aviso al salir con cambios sin guardar (se activará en Fase 5)
  window.addEventListener('beforeunload', (e) => {
    // TODO: consultar estado dirty real
  });


  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[sw] register failed', err);
    });
  }

  window.addEventListener('online', () => {
    // Si vuelve la conexión y hay auto-backup pendiente, el scheduler se encarga.
  });

  router.start();
}

function registerRoutes() {
  router.register('/', async () => {
    if (session.isLoggedIn()) router.go('/notes');
    else LoginView(app);
  });
  router.register('/login', async () => LoginView(app));
  router.register('/notes', async () => {
    if (!session.isLoggedIn()) return router.go('/login');
    ListView(app);
  });
  router.register('/note/:id', async (ctx) => {
    if (!session.isLoggedIn()) return router.go('/login');
    EditorView(app, ctx);
  });
  router.register('/settings', async () => {
    if (!session.isLoggedIn()) return router.go('/login');
    SettingsView(app);
  });
}

boot().catch(err => {
  console.error(err);
  toast('Boot error: ' + err.message);
});
