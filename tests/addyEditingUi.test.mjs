import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { canAddItem, renderAddyRows } from '../src/ui/transactions/entryHelpers.js';

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
assert.match(addyStyles, /\.addy-table\s*\{\s*min-width:\s*1240px;/);
assert.match(addyStyles, /\.addy-table th:nth-child\(10\)[\s\S]*?width:\s*15%;/);
assert.match(addyStyles, /\.addy-table td:nth-child\(10\)\.row-actions[\s\S]*?flex-wrap:\s*nowrap;/);

console.log('ADDY draft editing and saved identity mapping tests passed.');
