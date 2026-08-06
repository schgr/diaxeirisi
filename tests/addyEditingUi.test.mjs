import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
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
assert.match(rows, /data-edit-addy-item="0"/u);
assert.match(rows, /data-remove-addy-item="0"/u);
assert.ok(
  rows.indexOf('data-edit-addy-item') < rows.indexOf('data-remove-addy-item'),
  'Edit must appear before delete in the draft material actions.'
);

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

console.log('ADDY draft editing and saved identity mapping tests passed.');
