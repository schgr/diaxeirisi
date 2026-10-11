import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  filterBalanceDifferences,
  renderBalanceDifferenceActionList
} from '../src/ui/prints/administrationPrint.js';

const rows = [
  { shareId: 1, shareNumber: '2', description: 'ΥΛΙΚΟ Α', measurementUnit: 'Τεμ', differenceQuantity: 3, status: 'Έλλειμμα', sourceType: 'Μερίδα' },
  { shareId: 2, shareNumber: '3', description: 'ΥΛΙΚΟ Β', measurementUnit: 'Τεμ', differenceQuantity: 2, status: 'Πλεόνασμα', sourceType: 'Μερίδα', requiresComposition: true },
  { shareId: 3, shareNumber: '4', description: 'ΣΥΝΘΕΣΗ', measurementUnit: 'Τεμ', differenceQuantity: 1, status: 'Έλλειμμα', sourceType: 'Σύνθεση' }
];

assert.equal(filterBalanceDifferences(rows, 'all').length, 3);
assert.deepEqual(filterBalanceDifferences(rows, 'deficit').map((row) => row.shareNumber), ['2', '4']);
assert.deepEqual(filterBalanceDifferences(rows, 'surplus').map((row) => row.shareNumber), ['3']);

const list = renderBalanceDifferenceActionList(rows, [{ id: 4, departmentName: '1ο ΤΜΗΜΑ' }]);
assert.match(list, /Χρέωση/u);
assert.match(list, /Πίστωση/u);
assert.equal((list.match(/data-settle-balance-difference/gu) || []).length, 2);
assert.match(list, /Κατανομή/u);
assert.match(list, /Κατανομή σύνθεσης/u);
assert.doesNotMatch(list, /data-share-id="2"[\s\S]*?disabled/u);

const previewStyles = fs.readFileSync(new URL('../src/ui/styles/document-preview.css', import.meta.url), 'utf8');
assert.match(previewStyles, /\.financial-year-print-sheet,\s*\.balance-differences-page,/u);
const layoutStyles = fs.readFileSync(new URL('../src/ui/styles/base-layout.css', import.meta.url), 'utf8');
const sharePrintStyles = fs.readFileSync(new URL('../src/ui/styles/share-print-ui.css', import.meta.url), 'utf8');
assert.match(layoutStyles, /\.content:has\(\[data-balance-difference-action-panel\]:not\(\[hidden\]\)\)\s*\{\s*overflow-y:\s*auto;/u);
assert.match(sharePrintStyles, /\.balance-difference-action-list \.table-wrap\s*\{[^}]*max-height:[^;]+;\s*overflow:\s*auto;/u);

console.log('Balance differences preview filtering, settlement list, and landscape layout test passed.');
