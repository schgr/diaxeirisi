const { optionalText, requireText } = require('../core/validation');
const { AppError } = require('../core/errorHandler');

function validateShare(payload) {
  return {
    shareNumber: requireText(payload && payload.shareNumber, 'Αριθμός μερίδας'),
    nominalNumber: optionalText(payload && payload.nominalNumber),
    description: requireText(payload && payload.description, 'Περιγραφή'),
    materialType: requireText(payload && payload.materialType, 'Είδος υλικού'),
    materialCode: optionalText(payload && payload.materialCode),
    projectedQuantity: requireQuantity(payload && payload.projectedQuantity, 'Προβλεπόμενη ποσότητα'),
    accountingBalance: requireQuantity(payload && payload.accountingBalance, 'Λογιστικό υπόλοιπο'),
    chargedQuantity: requireQuantity(payload && payload.chargedQuantity, 'Χρεωμένη ποσότητα')
  };
}

function requireQuantity(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(`Το πεδίο "${fieldName}" πρέπει να είναι μη αρνητικός αριθμός.`, 'VALIDATION_ERROR', {
      field: fieldName
    });
  }
  return number;
}

module.exports = {
  validateShare
};
