import assert from 'node:assert/strict';
import {
  exceedsInternalDepartmentBalance,
  getInternalRedistributionShortfalls,
  renderK2310Pages
} from '../src/ui/pages/chargesPage.js';
import { buildDepartmentImbalanceMessage, exceedsAddyDepartmentBalance } from '../src/ui/transactions/addyForm.js';

assert.equal(exceedsAddyDepartmentBalance(0, 0), false);
assert.equal(exceedsAddyDepartmentBalance(2, 2), false);
assert.equal(exceedsAddyDepartmentBalance(2.001, 2), true);
assert.equal(buildDepartmentImbalanceMessage('Χρέωση', -2), 'Η παραπάνω πράξη θα δημιουργήσει έλλειμμα 2. Να συνεχίσω;');
assert.equal(buildDepartmentImbalanceMessage('Πίστωση', -2), 'Η παραπάνω πράξη θα δημιουργήσει πλεόνασμα 2. Να συνεχίσω;');
assert.equal(exceedsInternalDepartmentBalance(2, 5, 3), false);
assert.equal(exceedsInternalDepartmentBalance(2.001, 5, 3), true);
assert.deepEqual(getInternalRedistributionShortfalls([
  { redistributionGroup: 'a', movementType: 'Επιστροφή', quantity: 10 },
  { redistributionGroup: 'a', movementType: 'Χορήγηση', quantity: 4 },
  { redistributionGroup: 'b', movementType: 'Επιστροφή', quantity: 3 },
  { redistributionGroup: 'b', movementType: 'Χορήγηση', quantity: 3 }
]), [{ redistributionGroup: 'a', unallocatedQuantity: 6 }]);
assert.deepEqual(getInternalRedistributionShortfalls([
  { redistributionGroup: 'zero', movementType: 'Επιστροφή', quantity: 5 }
]), [{ redistributionGroup: 'zero', unallocatedQuantity: 5 }]);
assert.deepEqual(getInternalRedistributionShortfalls([
  { redistributionGroup: 'surplus', movementType: 'Επιστροφή', quantity: 5 },
  { redistributionGroup: 'surplus', movementType: 'Χορήγηση', quantity: 7 }
]), [{ redistributionGroup: 'surplus', unallocatedQuantity: -2 }]);

const department = {
  departmentName: '1ο Τμήμα',
  departmentHead: 'Λγός (ΠΒ) Αζίζογλου Πρόδρομος'
};
const balances = [{
  shareNumber: '12',
  nominalNumber: '123456',
  description: 'Υλικό δοκιμής',
  measurementUnit: 'Τεμάχιο',
  projectedQuantity: 20,
  issuedQuantity: 10,
  returnedQuantity: 3,
  finalQuantity: 7,
  materialSerialNumbers: ['SN-001', 'SN-002', 'SN-003'],
  ammunitionBatchNumbers: ['ΠΥΡ-001', 'ΠΥΡ-002'],
  composition: []
}];

const html = renderK2310Pages(
  'Μονάδα Δοκιμής',
  department,
  balances
);

assert.match(html, /<td>7<\/td>(?:<td><\/td>){10}<\/tr>/u);
assert.doesNotMatch(html, /<td>10<\/td>/u);
assert.doesNotMatch(html, /<td>20<\/td>/u);
assert.doesNotMatch(html, /Αζίζογλου Πρόδρομος/u);
assert.match(
  html,
  /class="k2310-serial-numbers-row"><td><\/td><td><\/td><td><\/td><td class="k2310-description-cell">SN-001, SN-002, SN-003<\/td>/u
);

const zeroCompositionHtml = renderK2310Pages(
  'Μονάδα Δοκιμής',
  department,
  [{ ...balances[0], composition: [{
    componentNominalNumber: 'ZERO-1',
    componentDescription: 'Μη χορηγηθέν υλικό',
    measurementUnit: 'Τεμάχια',
    finalQuantity: 0
  }] }]
);
assert.match(
  zeroCompositionHtml,
  /class="k2310-composition-row"[^]*?<td>0<\/td>/u,
  'A zero composition quantity must be printed as 0 instead of an empty cell.'
);
assert.match(
  html,
  /class="k2310-ammunition-batches-row"><td><\/td><td><\/td><td><\/td><td class="k2310-description-cell">ΠΥΡ-001, ΠΥΡ-002<\/td>/u
);

const departmentSignatureHtml = renderK2310Pages(
  'Μονάδα Δοκιμής', department, balances, { signatureMode: 'department' }
);
assert.match(departmentSignatureHtml, /colspan="17" class="k2310-signatures"/u);
assert.match(departmentSignatureHtml, /k2310-horizontal-signatures/u);
assert.doesNotMatch(departmentSignatureHtml, /k2310-vertical-signature/u);
assert.match(departmentSignatureHtml, /Αζίζογλου Πρόδρομος/u);
assert.match(departmentSignatureHtml, /Λγός \(ΠΒ\)/u);

const allSignaturesHtml = renderK2310Pages(
  'Μονάδα Δοκιμής',
  department,
  balances,
  { signatureMode: 'all', financialManager: 'Ανθλγός (ΠΒ) Διαχειριστής Δήμος' }
);
assert.match(allSignaturesHtml, /k2310-horizontal-signatures/u);
assert.match(allSignaturesHtml, /k2310-signature-mode-all/u);
assert.doesNotMatch(allSignaturesHtml, /Ο ΔΙΑΧΕΙΡΙΣΤΗΣ/u);
assert.doesNotMatch(allSignaturesHtml, /Ο ΜΕΡΙΚΟΣ ΔΙΑΧΕΙΡΙΣΤΗΣ/u);
assert.match(allSignaturesHtml, /<strong>Διαχειριστής Δήμος<\/strong><span>Ανθλγός \(ΠΒ\)<\/span>/u);
assert.match(allSignaturesHtml, /Αζίζογλου Πρόδρομος/u);

console.log('K2310 net issue quantity and department signature test passed.');
