const { requireOneOf } = require('../core/validation');

const TRANSACTION_TYPES = Object.freeze(['Χρέωση', 'Πίστωση']);

function requireTransactionType(value) {
  return requireOneOf(
    value,
    TRANSACTION_TYPES,
    'Είδος Δοσοληψίας',
    'Το είδος δοσοληψίας πρέπει να είναι Χρέωση ή Πίστωση.'
  );
}

module.exports = {
  TRANSACTION_TYPES,
  requireTransactionType
};
