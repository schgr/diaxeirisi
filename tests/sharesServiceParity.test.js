'use strict';

const assert = require('node:assert/strict');
const { createSharesService, formatCardRegistryNumber } = require('../src/services/sharesService');

const expectedOperations = [
  'listShares', 'getShareByNumber', 'addShare', 'deleteShare', 'updateShareDetails',
  'getShareCard', 'listMovedShareCards', 'getShareCardsBatch', 'saveComposition',
  'saveChangeSheet', 'listSerialNumberRegistry', 'saveSerialNumbers',
  'listAmmunitionBatchRegistry', 'saveAmmunitionBatches',
  'listTrainingAmmunitionBatchRegistry', 'saveTrainingAmmunitionBatches',
  'listWeaponRegistry', 'saveWeaponRegistry'
];

const fakeRepositoryDb = {};
const service = createSharesService(fakeRepositoryDb);
assert.deepEqual(Object.keys(service), expectedOperations);
assert.equal(formatCardRegistryNumber('ΑΔΔΥ 12 / 29-08-2026', 'Χρέωση'), 'Χ-12');
assert.equal(formatCardRegistryNumber('ΕΧΠ 7/2026', 'Πίστωση'), 'ΕΧΠ-7');
assert.equal(formatCardRegistryNumber('custom-reference', 'Χρέωση'), 'custom-reference');
console.log('sharesService public API characterization passed.');
