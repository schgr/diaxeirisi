import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { canAddItem } from '../src/ui/transactions/entryHelpers.js';

const require = createRequire(import.meta.url);
const { validateAddy } = require('../src/transactions/addyValidation.js');

function controls(overrides = {}) {
  const values = {
    unit: 'ΜΟΝΑΔΑ',
    shareNumber: '1',
    nominalNumber: 'N-1',
    description: 'Υλικό',
    quantity: '1',
    unitPrice: '',
    measurementUnit: 'ΤΕΜ',
    transactionType: 'Χρέωση',
    materialType: 'Υλικό',
    ...overrides
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, {
    value,
    dataset: key === 'shareNumber' ? {} : undefined
  }]));
}

function payload(overrides = {}) {
  return {
    documentDate: '2026-08-29',
    transactionUnit: 'ΜΟΝΑΔΑ',
    items: [{
      shareNumber: '1',
      nominalNumber: 'N-1',
      description: 'Υλικό',
      quantity: 1,
      unitPrice: '',
      measurementUnit: 'ΤΕΜ',
      transactionType: 'Χρέωση',
      materialType: 'Υλικό',
      ...overrides.item
    }],
    ...overrides,
    item: undefined
  };
}

assert.ok(canAddItem(controls(), { items: [], addyEditingIndex: null }));
assert.doesNotThrow(() => validateAddy(payload()));

assert.ok(!canAddItem(controls({ quantity: '0' }), { items: [], addyEditingIndex: null }));
assert.throws(() => validateAddy(payload({ item: { quantity: 0 } })), /θετικός αριθμός/u);

assert.ok(!canAddItem(controls(), { items: Array.from({ length: 10 }), addyEditingIndex: null }));
assert.doesNotThrow(() => validateAddy({
  ...payload(),
  items: Array.from({ length: 10 }, (_unused, index) => ({
    ...payload().items[0],
    shareNumber: String(index + 1)
  }))
}));
assert.throws(() => validateAddy({
  ...payload(),
  items: Array.from({ length: 11 }, (_unused, index) => ({
    ...payload().items[0],
    shareNumber: String(index + 1)
  }))
}), /μέχρι 10/u);

assert.ok(!canAddItem(controls({ unit: 'ΕΜΠΟΡΙΟ', unitPrice: '' }), { items: [], addyEditingIndex: null }));
assert.throws(
  () => validateAddy(payload({ transactionUnit: 'ΕΜΠΟΡΙΟ', item: { unitPrice: '' } })),
  /τιμή είναι υποχρεωτική/u
);

assert.ok(
  canAddItem(controls({ unit: 'ΕΜΠΟΡΙΟ', unitPrice: '-1' }), { items: [], addyEditingIndex: null }),
  'Characterization: UI currently checks only that commerce price is non-empty.'
);
assert.throws(
  () => validateAddy(payload({ transactionUnit: 'ΕΜΠΟΡΙΟ', item: { unitPrice: '-1' } })),
  /τιμή πρέπει να είναι θετικός αριθμός/u,
  'Backend must remain the authoritative numeric-price validator.'
);

console.log('addyValidationParity.test.mjs: core limits aligned; existing commerce-price UI/backend enforcement gap characterized.');
