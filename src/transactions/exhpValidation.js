const { AppError } = require('../core/errorHandler');
const { optionalText, requireText } = require('../core/validation');

function validateExhp(payload) {
  const items = Array.isArray(payload && payload.items) ? payload.items : [];
  if (!items.length) {
    throw new AppError('Πρέπει να προστεθεί τουλάχιστον ένα υλικό στην ΕΧΠ.', 'VALIDATION_ERROR');
  }

  if (items.length > 280) {
    throw new AppError('Η ΕΧΠ δέχεται έως 280 υλικά.', 'VALIDATION_ERROR');
  }

  const documentDate = optionalText(payload && payload.documentDate) || getLocalDate();
  const fiscalYear = Number(documentDate.slice(0, 4));

  return {
    documentDate,
    fiscalYear,
    serviceUnit: requireText(payload && payload.serviceUnit, 'Μονάδα'),
    issueReason: requireText(payload && payload.issueReason, 'Αιτιολογία Εκδόσεως'),
    approvalReference: optionalText(payload && payload.approvalReference),
    otherSupportDocument: optionalText(payload && payload.otherSupportDocument),
    notes: optionalText(payload && payload.notes),
    supports: Array.isArray(payload && payload.supports)
      ? payload.supports.map((support) => ({
        templateId: Number(support.templateId),
        completed: Boolean(support.completed),
        documentReference: optionalText(support.documentReference),
        notes: optionalText(support.notes),
        formData: sanitizeFormData(support.formData)
      }))
      : [],
    status: 'Οριστική',
    items: items.map(validateItem)
  };
}

function sanitizeFormData(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => [
      String(key),
      typeof fieldValue === 'string' ? fieldValue.trim() : fieldValue
    ])
  );
}

function validateItem(item) {
  const quantity = Number(item && item.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError('Η ποσότητα πρέπει να είναι θετικός αριθμός.', 'VALIDATION_ERROR');
  }

  const transactionType = requireText(item && item.transactionType, 'Είδος Δοσοληψίας');
  if (!['Χρέωση', 'Πίστωση'].includes(transactionType)) {
    throw new AppError('Το είδος δοσοληψίας πρέπει να είναι Χρέωση ή Πίστωση.', 'VALIDATION_ERROR');
  }

  return {
    shareNumber: requireText(item && item.shareNumber, 'Αριθμός Μερίδας'),
    nominalNumber: requireText(item && item.nominalNumber, 'Αριθμός Ονομαστικού'),
    description: requireText(item && item.description, 'Περιγραφή'),
    measurementUnit: requireText(item && item.measurementUnit, 'Μονάδα Μέτρησης'),
    materialType: optionalText(item && item.materialType),
    materialCode: optionalText(item && item.materialCode),
    transactionType,
    quantity,
    supportingDocuments: optionalText(item && item.supportingDocuments)
  };
}

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  validateExhp
};
