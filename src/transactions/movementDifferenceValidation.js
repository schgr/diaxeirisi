const { AppError } = require('../core/errorHandler');
const {
  optionalText,
  requireNonNegativeQuantity: requireQuantity,
  requireOneOf,
  requirePositiveId,
  requireText
} = require('../core/validation');

function validateMovementDifference(payload) {
  const documentQuantity = requireQuantity(payload && payload.documentQuantity, 'Ποσότητα δικαιολογητικού');
  const actualQuantity = requireQuantity(payload && payload.actualQuantity, 'Πραγματική ποσότητα');
  if (documentQuantity === actualQuantity) {
    throw new AppError('Δεν υπάρχει διαφορά μεταξύ δικαιολογητικού και πραγματικής ποσότητας.', 'VALIDATION_ERROR');
  }

  const protocolDate = requireText(payload && payload.protocolDate, 'Ημερομηνία Πρωτοκόλλου');
  const movementDirection = requireOneOf(
    payload && payload.movementDirection,
    ['Παραλαβή', 'Αποστολή'],
    'Κατεύθυνση Διακίνησης',
    'Η κατεύθυνση πρέπει να είναι Παραλαβή ή Αποστολή.'
  );

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
  const responseStatus = requireOneOf(
    payload && payload.responseStatus,
    ['Έγινε δεκτή', 'Δεν έγινε δεκτή'],
    'Απάντηση',
    'Η απάντηση πρέπει να είναι αποδοχή ή μη αποδοχή της διαφοράς.'
  );
  return {
    responseDate: requireText(payload && payload.responseDate, 'Ημερομηνία Απάντησης'),
    responseStatus,
    responseNotes: optionalText(payload && payload.responseNotes)
  };
}

module.exports = {
  validateMovementDifference,
  validateResponse
};
