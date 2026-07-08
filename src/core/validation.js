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
  requirePositiveId,
  requireText
};
