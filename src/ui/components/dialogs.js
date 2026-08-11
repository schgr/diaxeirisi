import { escapeHtml } from './forms.js';

export function showConfirmDialog(message, options = {}) {
  return openApplicationDialog({
    message,
    title: options.title || 'Επιβεβαίωση',
    confirmLabel: options.confirmLabel || 'Συνέχεια',
    cancelLabel: options.cancelLabel || 'Ακύρωση',
    danger: Boolean(options.danger),
    showCancel: true
  });
}

export function showAlertDialog(message, options = {}) {
  return openApplicationDialog({
    message,
    title: options.title || 'Ενημέρωση',
    confirmLabel: options.confirmLabel || 'Εντάξει',
    showCancel: false
  });
}

function openApplicationDialog({ message, title, confirmLabel, cancelLabel, danger, showCancel }) {
  return new Promise((resolve) => {
    const previouslyFocused = document.activeElement;
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop app-dialog-backdrop';
    backdrop.innerHTML = `
      <section class="app-dialog" role="dialog" aria-modal="true" aria-labelledby="app-dialog-title">
        <header>
          <p class="eyebrow">ΜΗΝΥΜΑ ΕΦΑΡΜΟΓΗΣ</p>
          <h2 id="app-dialog-title">${escapeHtml(title)}</h2>
        </header>
        <p class="app-dialog-message">${escapeHtml(message)}</p>
        <div class="row-actions app-dialog-actions">
          ${showCancel ? `<button class="secondary-button" data-app-dialog-cancel type="button">${escapeHtml(cancelLabel)}</button>` : ''}
          <button class="${danger ? 'danger-button' : 'primary-button'}" data-app-dialog-confirm type="button">${escapeHtml(confirmLabel)}</button>
        </div>
      </section>`;

    const finish = (accepted) => {
      document.removeEventListener('keydown', onKeyDown, true);
      backdrop.remove();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
        previouslyFocused.focus({ preventScroll: true });
      }
      resolve(accepted);
    };
    const onKeyDown = (event) => {
      if (event.key !== 'Escape' && event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation();
      finish(event.key === 'Enter');
    };
    backdrop.addEventListener('click', (event) => {
      if (event.target.closest('[data-app-dialog-confirm]')) finish(true);
      else if (event.target === backdrop || event.target.closest('[data-app-dialog-cancel]')) finish(false);
    });
    document.addEventListener('keydown', onKeyDown, true);
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-app-dialog-confirm]').focus({ preventScroll: true });
  });
}
