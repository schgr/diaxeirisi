const {
  optionalText,
  requireNonNegativeQuantity: requireQuantity,
  requireText
} = require('../core/validation');

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

module.exports = {
  validateShare
};
