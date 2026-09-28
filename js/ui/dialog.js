import { el, clear } from '../utils/dom.js';

export function confirmDialog({
  title = 'Confirm',
  message = '',
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  altLabel = null,
  showDontAsk = false,
  dontAskLabel = "Don't ask again",
} = {}) {
  return new Promise((resolve) => {
    const backdrop = el('div', { class: 'dialog-backdrop' });
    const card = el('div', { class: 'dialog' });

    card.append(
      el('div', { class: 'dialog__title' }, title),
      el('div', { class: 'dialog__msg' }, message),
    );

    let dontAsk = false;
    if (showDontAsk) {
      const cb = el('input', { type: 'checkbox' });
      cb.addEventListener('change', () => { dontAsk = cb.checked; });
      card.append(el('label', { class: 'dialog__check' }, [cb, el('span', {}, dontAskLabel)]));
    }

    const actions = el('div', { class: 'dialog__actions' });
    const close = (choice) => { backdrop.remove(); resolve({ choice, dontAsk }); };

    if (altLabel) actions.append(
      el('button', { class: 'btn btn--danger', onclick: () => close('alt') }, altLabel),
    );
    actions.append(
      el('button', { class: 'btn', onclick: () => close('cancel') }, cancelLabel),
      el('button', { class: 'btn btn--primary', onclick: () => close('confirm') }, confirmLabel),
    );
    card.append(actions);

    backdrop.append(card);
    document.body.append(backdrop);
  });
}
