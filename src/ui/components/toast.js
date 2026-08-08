export function showToast(message, type = 'success') {
  if (type === 'error') {
    console.error('Σφάλμα εφαρμογής.', message);
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
