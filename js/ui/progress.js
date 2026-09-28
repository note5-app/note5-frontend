import { el } from '../utils/dom.js';

let overlay = null;
let stageEl, detailEl, barInner, techEl, techLog = [];

export function showProgress({ title = 'Working…', tech = false } = {}) {
  hideProgress();
  techLog = [];

  stageEl  = el('div', { class: 'progress__stage' }, title);
  detailEl = el('div', { class: 'progress__detail' }, '');
  barInner = el('div', { class: 'progress__bar-inner' });
  techEl   = tech ? el('pre', { class: 'progress__tech' }, '') : null;

  const card = el('div', { class: 'progress' }, [
    stageEl,
    el('div', { class: 'progress__bar' }, [barInner]),
    detailEl,
    techEl,
  ].filter(Boolean));

  overlay = el('div', { class: 'progress-overlay' }, [card]);
  document.body.appendChild(overlay);
}

export function updateProgress(msg) {
  if (!overlay) return;
  const { stage, pct, detail } = msg;
  if (stage && stageEl) stageEl.textContent = humanStage(stage);
  if (typeof pct === 'number' && barInner) barInner.style.width = Math.min(100, pct) + '%';
  if (detail && detailEl) detailEl.textContent = detail;

  if (techEl) {
    const t = new Date().toISOString().slice(11, 23);
    techLog.push(`${t}  ${(stage || '').padEnd(16)}  ${pct != null ? String(pct).padStart(3) + '%' : '   '}  ${detail || ''}`);
    if (techLog.length > 14) techLog.shift();
    techEl.textContent = techLog.join('\n');
  }
}

export function hideProgress() {
  if (overlay) overlay.remove();
  overlay = stageEl = detailEl = barInner = techEl = null;
}

export function progressError(message) {
  if (!overlay) return;
  if (stageEl) stageEl.textContent = '⚠ Error';
  if (detailEl) {
    detailEl.textContent = message;
    detailEl.style.color = 'var(--danger)';
  }
  if (barInner) barInner.style.background = 'var(--danger)';
}

function humanStage(s) {
  const map = {
    'pbkdf2-master': 'Deriving master key',
    'userid':        'Deriving identity',
    'hkdf':          'Deriving sub-keys',
    'iv':            'Generating IV',
    'ede':           'Running AES-CTR-EDE',
    'hmac':          'Authenticating',
    'envelope':      'Building envelope',
    'plaintext':     'Recovering plaintext',
  };
  return map[s] || s;
}
