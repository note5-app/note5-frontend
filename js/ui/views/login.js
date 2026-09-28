import { el, clear } from '../../utils/dom.js';
import { session } from '../../storage/session.js';
import { go } from '../router.js';
import { toast } from '../toast.js';

import { showProgress, updateProgress, hideProgress, progressError } from '../progress.js';
import { cryptoClient } from '../../crypto/client.js';
import { CONFIG } from '../../config.js';


export function LoginView(root) {
  clear(root);
  const form = el('form', { class: 'login' }, [
    el('div', { class: 'login__brand' }, [
      el('h1', {}, 'NOTE5'),
      el('p', {}, 'Encrypted notes · offline-first'),
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'login-user' }, 'Username'),
      el('input', { class: 'input', id: 'login-user', type: 'text', autocomplete: 'username', required: true, autocapitalize: 'off', spellcheck: 'false' }),
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label', for: 'login-pass' }, 'Master password'),
      el('input', { class: 'input', id: 'login-pass', type: 'password', autocomplete: 'current-password', required: true }),
    ]),
    el('label', { class: 'checkbox' }, [
      el('input', { type: 'checkbox', id: 'login-remember' }),
      el('span', { class: 'checkbox__text' }, 'Remember me on this device'),
    ]),
    el('button', { class: 'btn btn--primary', type: 'submit' }, 'Unlock'),
    el('p', { style: 'font-size:12px;color:var(--text-muted);text-align:center;margin-top:12px' },
      'Your password never leaves this device. If you lose it, your notes cannot be recovered.'),
  ]);


form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = form.querySelector('#login-user').value.trim();
  const password = form.querySelector('#login-pass').value;
  const remember = form.querySelector('#login-remember').checked;
  if (!username || !password) return;

  let showTech = false;
  try { showTech = !!JSON.parse(localStorage.getItem(CONFIG.SETTINGS_KEY) || '{}').showTechPanel; } catch {}

  showProgress({ title: 'Unlocking NOTE5…', tech: showTech });
  cryptoClient.onProgress(updateProgress);

  try {
    await session.login(username, password, remember);
    updateProgress({ stage: 'done', pct: 100, detail: 'Identity ready · unlocking' });
    setTimeout(() => { hideProgress(); go('/notes'); }, 250);
  } catch (err) {
    progressError(err.message);
    setTimeout(() => {
      hideProgress();
      toast('Unlock failed: ' + err.message);
    }, 2200);
  }
});

  root.appendChild(form);
}
