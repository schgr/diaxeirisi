import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { canAddItem, renderAddyRows } from '../src/ui/transactions/entryHelpers.js';
import { validateSupportDocumentCreditBalances } from '../src/ui/transactions/exhpFormModuleBridge.js';
import { validateSharedMaterialPayload } from '../src/ui/transactions/exhpOfficialDocuments.js';
import { findSharesByNominal } from '../src/ui/transactions/shared.js';

const require = createRequire(import.meta.url);
const { mapAddyDocumentItem } = require('../src/services/transactions/shared.js');
const { validateAddy } = require('../src/transactions/addyValidation.js');

const rows = renderAddyRows([{
  shareNumber: '152',
  nominalNumber: '1315231129037',
  description: 'ΓΕΜΙΣΜΑΤΑ ΑΥΤΟΚΑΤΑΣΕΞΕΩΣ',
  quantity: 1,
  unitPrice: '',
  measurementUnit: 'Τεμάχια',
  transactionType: 'Χρέωση',
  transactionUnit: '104 Α/Κ ΜΜΠ/ΔΥ',
  materialType: 'Υλικό'
}]);
assert.doesNotMatch(rows, /data-edit-addy-item/u);
assert.doesNotMatch(rows, /data-remove-addy-item/u);

const valueControl = (value) => ({ value });
const controls = {
  unit: valueControl('104 Α/Κ ΜΜΠ/ΔΥ'),
  shareNumber: { value: '152', dataset: {} },
  nominalNumber: valueControl('1315231129037'),
  description: valueControl('ΓΕΜΙΣΜΑΤΑ ΑΥΤΟΚΑΤΑΣΕΞΕΩΣ'),
  quantity: valueControl('1'),
  unitPrice: valueControl(''),
  measurementUnit: valueControl('Τεμάχια'),
  transactionType: valueControl('Χρέωση'),
  materialType: valueControl('Υλικό')
};
assert.equal(
  canAddItem(controls, { items: Array.from({ length: 10 }), addyEditingIndex: 4 }),
  true,
  'Editing an existing row must remain possible when the draft already has ten rows.'
);

const validAddyItem = {
  shareNumber: '152',
  nominalNumber: 'N-152',
  description: 'Υλικό δοκιμής',
  quantity: 1,
  transactionType: 'Χρέωση',
  measurementUnit: 'Τεμάχια',
  materialType: 'Υλικό'
};
assert.throws(
  () => validateAddy({
    transactionUnit: '104 Α/Κ ΜΜΠ/ΔΥ',
    items: [validAddyItem, { ...validAddyItem, shareNumber: '153', transactionType: 'Πίστωση' }]
  }),
  /δεν μπορούν να συνυπάρχουν υλικά Χρέωσης και Πίστωσης/u
);

const supportData = {
  aitiologiaCode: 'z',
  materials: [{ shareNumber: '152', quantity: 6 }]
};
const supportReferenceData = { shares: [{ shareNumber: '152', accountingBalance: 5 }] };
assert.equal(
  validateSupportDocumentCreditBalances(supportData, supportReferenceData).valid,
  false,
  'An EXHP support document must reject a credit above the share balance.'
);
supportData.materials[0].quantity = 5;
assert.equal(validateSupportDocumentCreditBalances(supportData, supportReferenceData).valid, true);

const toastMessages = [];
const officialPayload = {
  items: [{ shareNumber: '152', quantity: 6, _availableQuantity: '5' }]
};
assert.equal(
  validateSharedMaterialPayload(officialPayload, (message) => toastMessages.push(message)),
  false
);
assert.match(toastMessages[0], /υπερβαίνει το διαθέσιμο υπόλοιπο/u);

const duplicateNominalShares = findSharesByNominal([
  { shareNumber: '10', nominalNumber: 'N-100' },
  { shareNumber: '11', nominalNumber: 'N-100' },
  { shareNumber: '12', nominalNumber: 'N-200' }
], 'n-100');
assert.deepEqual(duplicateNominalShares.map((share) => share.shareNumber), ['10', '11']);

const mapped = mapAddyDocumentItem({
  item: {
    shareNumber: '152',
    nominalNumber: '1315231129037',
    description: 'ΓΕΜΙΣΜΑΤΑ ΑΥΤΟΚΑΤΑΣΕΞΕΩΣ',
    transactionType: 'Πίστωση',
    measurementUnit: 'Τεμάχια',
    quantity: 1,
    unitPrice: null
  },
  share: {
    share_number: '152',
    description: 'ΓΕΜΙΣΜΑΤΑ ΑΥΤΟΚΑΤΑΣΕΞΕΩΣ'
  },
  ledgerSerial: '1',
  transactionUnit: '104 Α/Κ ΜΜΠ/ΔΥ',
  serviceName: 'Μονάδα'
});
assert.deepEqual(
  [mapped.shareNumber, mapped.nominalNumber, mapped.description],
  ['152', '1315231129037', 'ΓΕΜΙΣΜΑΤΑ ΑΥΤΟΚΑΤΑΣΕΞΕΩΣ']
);

const addyStyles = await readFile(new URL('../src/ui/styles/transactions-settings.css', import.meta.url), 'utf8');
const addyFormSource = await readFile(new URL('../src/ui/transactions/addyForm.js', import.meta.url), 'utf8');
assert.doesNotMatch(addyFormSource, /window\.confirm/u);
assert.match(addyFormSource, /function confirmAddyAction\(message\)/u);
assert.match(addyFormSource, /Μερίδες με τον ίδιο Αριθμό Ονομαστικού/u);
assert.match(addyFormSource, /Υπόλοιπο Μερίδας/u);
assert.match(addyStyles, /\.addy-table\s*\{\s*min-width:\s*1240px;/);
assert.match(addyStyles, /\.addy-table th:nth-child\(10\)[\s\S]*?width:\s*15%;/);
assert.match(addyStyles, /\.addy-table td:nth-child\(10\)\.row-actions[\s\S]*?flex-wrap:\s*nowrap;/);

console.log('ADDY draft editing and saved identity mapping tests passed.');
