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
  composition: []
}];

const html = renderK2310Pages(
  'Μονάδα Δοκιμής',
  department,
  balances
);

assert.match(html, /<td>7<\/td>(?:<td><\/td>){10}<\/tr>/u);
assert.doesNotMatch(html, /<td>10<\/td>/u);
assert.doesNotMatch(html, /Αζίζογλου Πρόδρομος/u);

const departmentSignatureHtml = renderK2310Pages(
  'Μονάδα Δοκιμής', department, balances, { signatureMode: 'department' }
);
assert.match(departmentSignatureHtml, /<td class="k2310-signature-grid-cell k2310-vertical-signature">/u);
assert.doesNotMatch(departmentSignatureHtml, /colspan="5" class="k2310-signature-grid-cell/u);
assert.match(departmentSignatureHtml, /Αζίζογλου Πρόδρομος/u);
assert.match(departmentSignatureHtml, /Λγός \(ΠΒ\)/u);

const allSignaturesHtml = renderK2310Pages(
  'Μονάδα Δοκιμής',
  department,
  balances,
  { signatureMode: 'all', financialManager: 'Ανθλγός (ΠΒ) Διαχειριστής Δήμος' }
);
assert.match(allSignaturesHtml, /k2310-signatures k2310-manager-signature/u);
assert.match(allSignaturesHtml, /<strong>Διαχειριστής Δήμος<\/strong><span>Ανθλγός \(ΠΒ\)<\/span>/u);
assert.match(allSignaturesHtml, /Αζίζογλου Πρόδρομος/u);

console.log('K2310 net issue quantity and department signature test passed.');
