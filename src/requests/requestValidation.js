const { AppError } = require('../core/errorHandler');
const { optionalText, requirePositiveQuantity, requireText } = require('../core/validation');

function validateSupplyRequest(payload) {
  const items = Array.isArray(payload && payload.items) ? payload.items : [];

  if (!items.length) {
    throw new AppError('Πρέπει να προστεθεί τουλάχιστον ένα υλικό στην αίτηση.', 'VALIDATION_ERROR');
  }

  if (items.length > 10) {
    throw new AppError('Η αίτηση μπορεί να έχει μέχρι 10 καταχωρήσεις.', 'VALIDATION_ERROR');
  }

  const requestDate = requireText(payload && payload.requestDate, 'Ημερομηνία');
  const year = Number(requestDate.slice(0, 4));

  return {
    requestDate,
    year,
    requestingUnit: requireText(payload && payload.requestingUnit, 'Αιτούσα Μονάδα'),
    issuingUnit: optionalText(payload && payload.issuingUnit),
    protocolNumber: optionalText(payload && payload.protocolNumber),
    notes: optionalText(payload && payload.notes),
    items: items.map(validateSupplyRequestItem)
  };
}

function validateSupplyRequestItem(item) {
  const quantity = requirePositiveQuantity(item && item.quantity);

  return {
    nominalNumber: requireText(item && item.nominalNumber, 'Αριθμός Ονομαστικού'),
    description: requireText(item && item.description, 'Περιγραφή'),
    quantity,
    measurementUnit: requireText(item && item.measurementUnit, 'Μονάδα Μέτρησης'),
    justificationCode: requireText(item && item.justificationCode, 'Κωδικός Αιτιολογίας'),
    priorityCode: requireText(item && item.priorityCode, 'Κωδικός Προτεραιότητας'),
    notes: optionalText(item && item.notes)
  };
}

module.exports = {
  validateSupplyRequest
};
