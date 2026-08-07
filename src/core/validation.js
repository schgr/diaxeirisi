const { AppError } = require('./errorHandler');

function requireText(value, fieldName) {
  const text = String(value || '').trim();
  if (!text) {
    throw new AppError(`Το πεδίο "${fieldName}" είναι υποχρεωτικό.`, 'VALIDATION_ERROR', {
      field: fieldName
    });
  }
  return text;
}

function optionalText(value) {
  return String(value || '').trim();
}

function requirePositiveQuantity(value, message = 'Η ποσότητα πρέπει να είναι θετικός αριθμός.') {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError(message, 'VALIDATION_ERROR');
  }
  return quantity;
}

function requireNonNegativeQuantity(value, fieldName) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) {
    throw new AppError(`Το πεδίο "${fieldName}" πρέπει να είναι μη αρνητικός αριθμός.`, 'VALIDATION_ERROR', {
      field: fieldName
    });
  }
  return quantity;
}

function requireOneOf(value, allowedValues, fieldName, message) {
  const text = requireText(value, fieldName);
  if (!allowedValues.includes(text)) {
    throw new AppError(message, 'VALIDATION_ERROR', { field: fieldName });
  }
  return text;
}

function requirePositiveId(id, fieldName = 'id') {
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new AppError('Μη έγκυρο αναγνωριστικό εγγραφής.', 'VALIDATION_ERROR', {
      field: fieldName
    });
  }
  return numericId;
}

module.exports = {
  optionalText,
  requireNonNegativeQuantity,
  requireOneOf,
  requirePositiveId,
  requirePositiveQuantity,
  requireText
};
