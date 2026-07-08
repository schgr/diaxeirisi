export function showToast(message, type = 'success') {
  const root = document.querySelector('#toast-root');
  if (!root) {
    return;
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  root.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 2800);
}
