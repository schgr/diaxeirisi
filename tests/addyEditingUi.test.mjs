import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { canAddItem, renderAddyRows } from '../src/ui/transactions/entryHelpers.js';
import { findSharesByNominal, formatAddyDate, isCommerceUnit } from '../src/ui/transactions/shared.js';
import { exceedsDepartmentCreditBalance } from '../src/ui/transactions/addyForm.js';

const require = createRequire(import.meta.url);
const { mapAddyDocumentItem } = require('../src/services/transactions/shared.js');

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
assert.equal(isCommerceUnit('ΕΜΠΟΡΙΟ'), true, 'Commerce matching must ignore accents and letter case.');
assert.equal(isCommerceUnit('Εμπόριο'), true, 'Commerce matching must retain accented-label compatibility.');
assert.equal(formatAddyDate('2026-07-02'), '02-07-2026');
assert.equal(exceedsDepartmentCreditBalance('1', '2'), false);
assert.equal(exceedsDepartmentCreditBalance('2.0000001', '2'), false);
assert.equal(exceedsDepartmentCreditBalance('2.001', '2'), true);
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
const modalStyles = await readFile(new URL('../src/ui/styles/modals-tables.css', import.meta.url), 'utf8');
const addyFormSource = await readFile(new URL('../src/ui/transactions/addyForm.js', import.meta.url), 'utf8');
const transactionsPageSource = await readFile(new URL('../src/ui/pages/transactionsPage.js', import.meta.url), 'utf8');
assert.doesNotMatch(addyFormSource, /window\.confirm/u);
assert.match(addyFormSource, /function confirmAddyAction\(message\)/u);
assert.match(addyFormSource, /Μερίδες με τον ίδιο Αριθμό Ονομαστικού/u);
assert.match(addyFormSource, /Υπόλοιπο Μερίδας/u);
assert.match(addyFormSource, /addCommerceCompany/u);
assert.match(addyFormSource, /data-available-quantity/u);
assert.match(addyFormSource, /invoiceNumber: controls\.invoiceNumber\.value\.trim\(\)/u);
assert.match(transactionsPageSource, /id="addy-invoice-number"/u);
assert.match(transactionsPageSource, /id="addy-invoice-date"/u);
assert.match(transactionsPageSource, /id="addy-commerce-company"/u);
assert.match(transactionsPageSource, /value="__new__">\+ Νέα επιχείρηση/u);
assert.doesNotMatch(transactionsPageSource, /id="addy-commerce-open"/u);
assert.match(transactionsPageSource, /id="addy-quantity"[\s\S]*id="addy-unit-price"[\s\S]*id="addy-commerce-modal"[^>]*hidden[\s\S]*id="addy-invoice-number"[\s\S]*id="addy-invoice-date"[\s\S]*id="addy-commerce-company"/u);
assert.doesNotMatch(transactionsPageSource, /id="addy-commerce-modal"[^>]*[\s\S]*?<input id="addy-unit-price"/u);
assert.match(transactionsPageSource, /data-confirm-addy-commerce[^>]*>Συνέχεια στην αποθήκευση/u);
assert.match(addyFormSource, /controls\.save\.addEventListener\('click',[\s\S]*await openCommerceDialog\(\)/u);
assert.doesNotMatch(addyFormSource, /controls\.unit\.addEventListener\('change',[\s\S]*openCommerceDialog\(\)/u);
assert.match(modalStyles, /\.addy-commerce-modal-body\s*\{[\s\S]*grid-template-columns:/u);
assert.match(addyStyles, /\.addy-table\s*\{\s*min-width:\s*1240px;/);
assert.match(addyStyles, /\.addy-table th:nth-child\(10\)[\s\S]*?width:\s*15%;/);
assert.match(addyStyles, /\.addy-table td:nth-child\(10\)\.row-actions[\s\S]*?flex-wrap:\s*nowrap;/);

console.log('ADDY draft editing and saved identity mapping tests passed.');
