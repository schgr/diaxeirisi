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

  const validated = {
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
  if (isNominalNumberTransferReason(validated.issueReason)) {
    validateNominalTransferItems(validated.items);
  }
  return validated;
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
    sourceShareNumber: optionalText(item && item.sourceShareNumber),
    transferGroup: optionalText(item && item.transferGroup),
    collectionTransfer: Boolean(item && item.collectionTransfer),
    collectionVirtualCredit: Boolean(item && item.collectionVirtualCredit),
    collectionParentShareNumber: optionalText(item && item.collectionParentShareNumber),
    transactionType,
    quantity,
    supportingDocuments: optionalText(item && item.supportingDocuments)
  };
}

function validateNominalTransferItems(items) {
  const credits = items.filter((item) => item.transactionType === 'Πίστωση');
  const charges = items.filter((item) => item.transactionType === 'Χρέωση');
  if (!credits.length || credits.length !== charges.length || items.length !== credits.length * 2) {
    throw new AppError(
      'Κάθε πίστωση μεταβολής Αριθμού Ονομαστικού πρέπει να έχει μία αντίστοιχη χρέωση.',
      'VALIDATION_ERROR'
    );
  }
  const newNumbers = new Set();
  for (const credit of credits) {
    const charge = charges.find((item) =>
      item.sourceShareNumber === credit.shareNumber &&
      (!credit.transferGroup || item.transferGroup === credit.transferGroup)
    );
    if (!charge) {
      throw new AppError(`Δεν βρέθηκε νέα μερίδα για τη μερίδα ${credit.shareNumber}.`, 'VALIDATION_ERROR');
    }
    if (charge.shareNumber === credit.shareNumber) {
      throw new AppError('Ο νέος Αριθμός Μερίδας πρέπει να διαφέρει από τον παλιό.', 'VALIDATION_ERROR');
    }
    if (charge.nominalNumber === credit.nominalNumber) {
      throw new AppError('Ο νέος Αριθμός Ονομαστικού πρέπει να διαφέρει από τον παλιό.', 'VALIDATION_ERROR');
    }
    if (Math.abs(charge.quantity - credit.quantity) > 0.000001) {
      throw new AppError('Η ποσότητα πίστωσης και χρέωσης πρέπει να είναι ίδια.', 'VALIDATION_ERROR');
    }
    const key = charge.shareNumber.toLocaleLowerCase('el-GR');
    if (newNumbers.has(key)) {
      throw new AppError(`Ο νέος Αριθμός Μερίδας ${charge.shareNumber} χρησιμοποιείται περισσότερες από μία φορές.`, 'VALIDATION_ERROR');
    }
    newNumbers.add(key);
  }
}

function isNominalNumberTransferReason(value) {
  const normalized = String(value || '')
    .toLocaleLowerCase('el-GR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[().,;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized === 'μεταβολη υλικων λογω αλλαγης του αριθμου ονομαστικου';
}

function getLocalDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  validateExhp,
  isNominalNumberTransferReason
};
