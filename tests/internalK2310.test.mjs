import assert from 'node:assert/strict';
import { renderK2310Pages } from '../src/ui/pages/chargesPage.js';

const html = renderK2310Pages(
  'Μονάδα Δοκιμής',
  {
    departmentName: '1ο Τμήμα',
    departmentHead: 'Λγός (ΠΒ) Αζίζογλου Πρόδρομος'
  },
  [{
    shareNumber: '12',
    nominalNumber: '123456',
    description: 'Υλικό δοκιμής',
    measurementUnit: 'Τεμάχιο',
    projectedQuantity: 20,
    issuedQuantity: 10,
    returnedQuantity: 3,
    finalQuantity: 7,
    composition: []
  }]
);

assert.match(html, /<td>7<\/td>(?:<td><\/td>){9}<td>7<\/td>/u);
assert.doesNotMatch(html, /<td>10<\/td>/u);
assert.match(html, /Αζίζογλου Πρόδρομος/u);
assert.match(html, /Λγός \(ΠΒ\)/u);

console.log('K2310 net issue quantity and department signature test passed.');
