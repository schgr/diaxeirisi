import { findShareByNumber } from '../shared.js';

export function buildToolCompositionChargeItems(rows, referenceShares) {
  return rows
    .filter((item) => Number(item.movementQuantity ?? item.quantity) > 0)
    .map((item) => {
      const shareNumber = String(item.shareNumber || '').trim();
      const existingShare = findShareByNumber(referenceShares, shareNumber);
      return {
        shareNumber,
        nominalNumber: item.componentNominalNumber,
        description: item.componentDescription,
        measurementUnit: item.measurementUnit || existingShare?.measurementUnit || '',
        materialType: existingShare?.materialType || 'Υλικό',
        materialCode: existingShare?.materialCode || '',
        quantity: Number(item.movementQuantity ?? item.quantity),
        transactionType: 'Χρέωση',
        supportingDocuments: '',
        transferGroup: ''
      };
    });
}

export function formatAddyShareBalance(value) {
  const balance = Number(value || 0);
  return Number.isFinite(balance)
    ? balance.toLocaleString('el-GR', { maximumFractionDigits: 3 })
    : '0';
}

export function exceedsDepartmentCreditBalance(requestedQuantity, availableQuantity) {
  const requested = Number(requestedQuantity || 0);
  const available = Number(availableQuantity || 0);
  if (!Number.isFinite(requested) || !Number.isFinite(available)) return true;
  return requested - available > 0.000001;
}
