

export function validateSharedMaterialPayload(payload, showToast) {
  payload.items = (payload.items || []).filter((item) => String(item.shareNumber || '').trim());
  if (payload.items.length) return true;
  showToast('Προσθέστε τουλάχιστον ένα υλικό με αριθμό μερίδας', 'error');
  return false;
}
