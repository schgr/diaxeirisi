import assert from 'node:assert/strict';
import {
  collectRows,
  compareShareNumbers,
  displaySupportStatus,
  findShareByNominal,
  findShareByNumber,
  formatDate,
  formatQuantity,
  greekMonthNumber,
  isCommerceUnit,
  isSameIssueReason,
  normalize,
  normalizeIssueReason,
  officialDateParts,
  readOptionalNumber,
  readRowField,
  readSupportField,
  setReadonlyRowField
} from '../src/ui/transactions/shared.js';

function createInput(attribute, value) {
  return { attribute, value };
}

function matchesSelector(input, selector) {
  const attribute = `[${input.attribute}]`;
  return selector === attribute || attribute.startsWith(`${selector.slice(0, -1)}=`);
}

function createElement(inputs) {
  return {
    inputs,
    querySelector(selector) {
      return this.inputs.find((input) => matchesSelector(input, selector)) || null;
    },
    querySelectorAll(selector) {
      return this.inputs.filter((input) => matchesSelector(input, selector));
    }
  };
}

function createRoot(rows) {
  return {
    querySelectorAll(selector) {
      return selector === 'tr[data-row]' ? rows : [];
    }
  };
}

const filledRow = createElement([createInput('data-row-field="quantity"', ' 5 ')]);
const emptyRow = createElement([createInput('data-row-field="quantity"', '   ')]);
assert.deepEqual(collectRows(createRoot([filledRow, emptyRow]), 'tr[data-row]'), [filledRow]);
assert.deepEqual(collectRows(createRoot([]), 'tr[data-row]'), []);

assert.equal(readRowField(filledRow, 'quantity'), '5');
assert.equal(readRowField(filledRow, 'missing'), '');

const supportRoot = createElement([createInput('data-support-field="president"', '  Λγός Παπαδόπουλος  ')]);
assert.equal(readSupportField(supportRoot, 'support', 'president'), 'Λγός Παπαδόπουλος');
assert.equal(readSupportField(supportRoot, 'support', 'absent'), '');

const readonlyRow = createElement([createInput('data-row-field="unitPrice"', '')]);
setReadonlyRowField(readonlyRow, 'unitPrice', '12,5');
assert.deepEqual(
  { value: readonlyRow.inputs[0].value, readOnly: readonlyRow.inputs[0].readOnly },
  { value: '12,5', readOnly: true }
);
setReadonlyRowField(readonlyRow, 'missing', '1');

assert.equal(readOptionalNumber('12,5'), 12.5);
assert.equal(readOptionalNumber(' 8 '), 8);
assert.equal(readOptionalNumber(''), null);
assert.equal(readOptionalNumber(null), null);

assert.deepEqual(officialDateParts('2026-05-09'), {
  day: '09',
  month: '05',
  monthName: 'Μαΐου',
  year: '2026'
});
assert.deepEqual(officialDateParts(''), { day: '', month: '', monthName: '', year: '' });

assert.equal(greekMonthNumber('Μαΐου'), '05');
assert.equal(greekMonthNumber('ΙΑΝΟΥΑΡΙΟΥ'), '01');
assert.equal(greekMonthNumber('7'), '07');
assert.equal(greekMonthNumber('13'), '');
assert.equal(greekMonthNumber('άγνωστος'), '');

const shares = [
  { shareNumber: '10', nominalNumber: 'ΑΟ-1' },
  { shareNumber: '2', nominalNumber: 'ΑΟ-2' }
];
assert.equal(findShareByNumber(shares, ' 2 ')?.nominalNumber, 'ΑΟ-2');
assert.equal(findShareByNumber(shares, '99'), undefined);
assert.equal(findShareByNominal(shares, 'αο-1')?.shareNumber, '10');
assert.equal(findShareByNominal(shares, 'ΑΟ-9'), undefined);

assert.deepEqual(
  [{ shareNumber: '10' }, { shareNumber: 'ΑΟ' }, { shareNumber: '2' }, { shareNumber: '' }]
    .sort(compareShareNumbers)
    .map((share) => share.shareNumber),
  ['2', '10', '', 'ΑΟ'],
  'numeric share numbers sort first and in numeric order'
);
assert.equal(compareShareNumbers({ shareNumber: '3' }, { shareNumber: '3' }), 0);

assert.equal(formatDate('2026-03-04'), '04/03/2026');
assert.equal(formatDate('χωρίς ημερομηνία'), 'χωρίς ημερομηνία');
assert.equal(formatDate(''), '');

assert.equal(normalize('  ΜΕΡΊΔΑ  '), 'μερίδα');
assert.equal(normalizeIssueReason('Φθορά (χρήσης), κλπ.'), 'φθορα χρησης κλπ');
assert.equal(isSameIssueReason('Φθορά – χρήση', 'φθορα - χρηση'), true);
assert.equal(isSameIssueReason('Φθορά', 'Απώλεια'), false);

assert.equal(isCommerceUnit('Εμπόριο'), true);
assert.equal(isCommerceUnit('ΜΟΝΑΔΑ'), false);

assert.equal(displaySupportStatus('Πλήρης για ΕΥΣ'), 'Πλήρης');
assert.equal(displaySupportStatus('Ελλιπής'), 'Ελλιπής');

assert.equal(formatQuantity(1234.56789), '1234,568');
assert.equal(formatQuantity(0), '0');

console.log('transactionUiShared.test.mjs: OK');
