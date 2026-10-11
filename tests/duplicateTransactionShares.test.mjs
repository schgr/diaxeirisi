import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { EXP_AITIOLOGIES } from '../src/exhpForm/aitiologies.js';

const require = createRequire(import.meta.url);
const { validateAddy } = require('../src/transactions/addyValidation.js');
const { validateExhp } = require('../src/transactions/exhpValidation.js');
const item = {
  shareNumber: 'Ab-13', nominalNumber: '1005-13', description: 'Υλικό',
  measurementUnit: 'Τεμάχια', materialType: 'Υλικό', quantity: 1,
  transactionType: 'Πίστωση'
};
const duplicate = { ...item, shareNumber: ' ab-13 ' };
const rejectsDuplicate = (action) => assert.throws(action,
  (error) => error.code === 'VALIDATION_ERROR' && error.message.includes('υπάρχει ήδη'));

for (const transactionType of ['Χρέωση', 'Πίστωση']) {
  rejectsDuplicate(() => validateAddy({ transactionUnit: 'Μονάδα',
    items: [{ ...item, transactionType }, { ...duplicate, transactionType }] }));
}
for (const reason of EXP_AITIOLOGIES) {
  rejectsDuplicate(() => validateExhp({ serviceUnit: 'Μονάδα', issueReason: reason.label,
    items: [item, duplicate] }));
  rejectsDuplicate(() => validateExhp({ serviceUnit: 'Μονάδα', issueReason: reason.label,
    items: [item, { ...duplicate, transactionType: 'Χρέωση' }] }));
}
assert.equal(validateAddy({ transactionUnit: 'Μονάδα',
  items: [item, { ...item, shareNumber: '14' }] }).items.length, 2);
console.log('Duplicate share prevention passed for ADDY and every EXHP reason.');
