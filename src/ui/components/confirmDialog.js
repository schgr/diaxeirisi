export function confirmDialog({ message, confirmLabel = 'Επιβεβαίωση', cancelLabel = 'Άκυρο' } = {}) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop confirm-dialog-backdrop';
    backdrop.innerHTML = `
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-message">
        <p id="confirm-dialog-message" class="confirm-dialog-message"></p>
        <div class="row-actions confirm-dialog-actions">
          <button type="button" class="secondary" data-confirm-cancel></button>
          <button type="button" class="primary" data-confirm-accept></button>
        </div>
      </section>
    `;
    backdrop.querySelector('.confirm-dialog-message').textContent = message;
    const cancelButton = backdrop.querySelector('[data-confirm-cancel]');
    const acceptButton = backdrop.querySelector('[data-confirm-accept]');
    cancelButton.textContent = cancelLabel;
    acceptButton.textContent = confirmLabel;

    const cleanup = (result) => {
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      resolve(result);
    };
    const onKeydown = (event) => {
      if (event.key === 'Escape') cleanup(false);
      if (event.key === 'Enter') cleanup(true);
    };

    cancelButton.addEventListener('click', () => cleanup(false));
    acceptButton.addEventListener('click', () => cleanup(true));
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) cleanup(false);
    });
    document.addEventListener('keydown', onKeydown);

    document.body.appendChild(backdrop);
    acceptButton.focus({ preventScroll: true });
  });
}
