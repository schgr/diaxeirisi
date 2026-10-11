export function showToast(message, type = 'success') {
  if (type === 'error') {
    console.error('Σφάλμα εφαρμογής.', message);
  }

  // Τα σφάλματα και οι ενημερώσεις που απαιτούν προσοχή δεν χάνονται πλέον
  // ως προσωρινό «συννεφάκι»: εμφανίζονται στο κεντρικό modal της εφαρμογής.
  if (type === 'error') {
    document.querySelector('.notice-dialog-backdrop')?.remove();
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop confirm-dialog-backdrop notice-dialog-backdrop';
    backdrop.innerHTML = '<section class="confirm-dialog" role="dialog" aria-modal="true"><p class="confirm-dialog-message"></p><div class="row-actions confirm-dialog-actions"><button type="button" class="primary" data-notice-close>Εντάξει</button></div></section>';
    backdrop.querySelector('.confirm-dialog-message').textContent = message;
    const close = () => backdrop.remove();
    backdrop.querySelector('[data-notice-close]').addEventListener('click', close);
    backdrop.addEventListener('click', (event) => { if (event.target === backdrop) close(); });
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-notice-close]').focus({ preventScroll: true });
    return;
  }

  const root = document.querySelector('#toast-root');
  if (!root) {
    return;
  }

  root.replaceChildren();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  root.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2800);
}
