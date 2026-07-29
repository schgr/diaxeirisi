import assert from 'node:assert/strict';
import { renderK2310Pages } from '../src/ui/pages/chargesPage.js';

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
