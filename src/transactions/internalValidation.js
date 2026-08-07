const { AppError } = require('../core/errorHandler');
const {
  optionalText,
  requireOneOf,
  requirePositiveId,
  requirePositiveQuantity,
  requireText
} = require('../core/validation');

function validateInternalMovement(payload) {
  const quantity = requirePositiveQuantity(payload && payload.quantity);
  const movementType = requireOneOf(
    payload && payload.movementType,
    ['Χορήγηση', 'Επιστροφή'],
    'Είδος Κίνησης',
    'Το είδος κίνησης πρέπει να είναι Χορήγηση ή Επιστροφή.'
  );

  const documentDate = optionalText(payload && payload.documentDate) || new Date().toISOString().slice(0, 10);
  const composition = (Array.isArray(payload && payload.composition) ? payload.composition : []).map((item) => ({
    componentNominalNumber: optionalText(item && item.componentNominalNumber),
    componentDescription: optionalText(item && item.componentDescription),
    measurementUnit: optionalText(item && item.measurementUnit),
    quantity: Number(item && item.quantity)
  }));

  if (composition.some((item) => !Number.isFinite(item.quantity) || item.quantity < 0)) {
    throw new AppError('Η ποσότητα κάθε υλικού της σύνθεσης δεν μπορεί να είναι αρνητική.', 'VALIDATION_ERROR');
  }

  return {
    documentDate,
    fiscalYear: Number(documentDate.slice(0, 4)),
    departmentManagerId: requirePositiveId(payload && payload.departmentManagerId, 'Μερική Διαχείριση'),
    shareId: requirePositiveId(payload && payload.shareId, 'Μερίδα'),
    movementType,
    quantity,
    notes: optionalText(payload && payload.notes),
    composition
  };
}

module.exports = {
  validateInternalMovement
};
