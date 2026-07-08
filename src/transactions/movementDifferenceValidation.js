const { AppError } = require('../core/errorHandler');
const { optionalText, requirePositiveId, requireText } = require('../core/validation');

function validateMovementDifference(payload) {
  const documentQuantity = requireQuantity(payload && payload.documentQuantity, 'Ποσότητα δικαιολογητικού');
  const actualQuantity = requireQuantity(payload && payload.actualQuantity, 'Πραγματική ποσότητα');
  if (documentQuantity === actualQuantity) {
    throw new AppError('Δεν υπάρχει διαφορά μεταξύ δικαιολογητικού και πραγματικής ποσότητας.', 'VALIDATION_ERROR');
  }

  const protocolDate = requireText(payload && payload.protocolDate, 'Ημερομηνία Πρωτοκόλλου');
  const movementDirection = requireText(payload && payload.movementDirection, 'Κατεύθυνση Διακίνησης');
  if (!['Παραλαβή', 'Αποστολή'].includes(movementDirection)) {
    throw new AppError('Η κατεύθυνση πρέπει να είναι Παραλαβή ή Αποστολή.', 'VALIDATION_ERROR');
  }

  return {
    protocolDate,
    fiscalYear: Number(protocolDate.slice(0, 4)),
    addyDocumentId: payload && payload.addyDocumentId ? requirePositiveId(payload.addyDocumentId) : null,
    counterpartyUnit: requireText(payload && payload.counterpartyUnit, 'Συναλλασσόμενη Μονάδα'),
    movementDirection,
    shareId: requirePositiveId(payload && payload.shareId, 'Μερίδα'),
    documentQuantity,
    actualQuantity,
    differenceQuantity: Math.abs(actualQuantity - documentQuantity),
    differenceType: actualQuantity > documentQuantity ? 'Πλεόνασμα' : 'Έλλειμμα',
    dispatchDate: optionalText(payload && payload.dispatchDate),
    notes: optionalText(payload && payload.notes)
  };
}

function validateResponse(payload) {
  const responseStatus = requireText(payload && payload.responseStatus, 'Απάντηση');
  if (!['Έγινε δεκτή', 'Δεν έγινε δεκτή'].includes(responseStatus)) {
    throw new AppError('Η απάντηση πρέπει να είναι αποδοχή ή μη αποδοχή της διαφοράς.', 'VALIDATION_ERROR');
  }
  return {
    responseDate: requireText(payload && payload.responseDate, 'Ημερομηνία Απάντησης'),
    responseStatus,
    responseNotes: optionalText(payload && payload.responseNotes)
  };
}

function requireQuantity(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(`Το πεδίο "${fieldName}" πρέπει να είναι μη αρνητικός αριθμός.`, 'VALIDATION_ERROR');
  }
  return number;
}

module.exports = {
  validateMovementDifference,
  validateResponse
};
