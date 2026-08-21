import assert from 'node:assert/strict';
import { renderAddyDocument, shouldOpenAddyDocument } from '../src/ui/transactions/addyPrint.js';

const baseDocument = {
  id: 42,
  documentDate: '2026-08-15',
  serviceName: 'Μονάδα Δοκιμής',
  financialOfficers: {
    ped: 'Λγός (ΠΒ) Πέτρος Ελεγκτής',
    manager: 'Υπλγός Μάριος Διαχειριστής'
  },
  notes: 'Γενικές πληροφορίες',
  items: [{
    transactionType: 'Χρέωση',
    column1: 'Μονάδα Δοκιμής',
    column11: '',
    column12: 'COMM-950',
    column13: 'Υλικό Εμπορίου',
    column14: 'Τεμάχια',
    column18: 'ΕΜΠΟΡΙΟ',
    column22: 2,
    column23: 0,
    column24: '',
    column25: '',
    column26: 12.5,
    composition: []
  }]
};

const commerceHtml = renderAddyDocument({
  ...baseDocument,
  transactionUnit: 'ΕΜΠΟΡΙΟ',
  invoiceNumber: 'INV-42',
  invoiceDate: '2026-08-14',
  commerceCompany: {
    id: 1,
    name: 'Δοκιμαστική Α.Ε.',
    taxNumber: '123456789',
    address: 'Λ. Δοκιμής 10'
  }
});
assert.equal(shouldOpenAddyDocument({ ...baseDocument, transactionUnit: 'ΕΜΠΟΡΙΟ' }), true);
assert.match(commerceHtml, /Αρ\. Τιμολογίου INV-42 \/ 14-08-2026/u);
assert.match(commerceHtml, /42 \/ 15-08-2026/u);
assert.match(commerceHtml, /Δοκιμαστική Α\.Ε\./u);
assert.match(commerceHtml, /ΑΦΜ: 123456789/u);
assert.match(commerceHtml, /Λ\. Δοκιμής 10/u);
assert.match(commerceHtml, /addy-commerce-information-overlay/u);
assert.ok(
  commerceHtml.indexOf('Δοκιμαστική Α.Ε.') < commerceHtml.indexOf('ΑΦΜ: 123456789')
    && commerceHtml.indexOf('ΑΦΜ: 123456789') < commerceHtml.indexOf('Λ. Δοκιμής 10'),
  'The commerce company must print as name, tax number and address on separate ordered lines.'
);
assert.match(commerceHtml, /text-align:left/u);
assert.match(commerceHtml, /font-size:clamp\(10px,calc\(0\.8vw \+ 2px\),14px\)/u);
assert.match(commerceHtml, /addy-document-description-overlay[^>]+justify-content:flex-start/u);
assert.match(commerceHtml, /addy-document-signature-name[^>]*>Πέτρος Ελεγκτής</u);
assert.match(commerceHtml, /addy-document-signature-rank[^>]*>Λγός \(ΠΒ\)</u);
assert.ok(
  commerceHtml.indexOf('Πέτρος Ελεγκτής') < commerceHtml.indexOf('Λγός (ΠΒ)'),
  'The officer name must print above the rank.'
);
assert.match(commerceHtml, /addy-description-top-line/u);
assert.match(commerceHtml, /addy-description-bottom-line/u);
assert.match(commerceHtml, /addy-field-13-border[^>]+border:2px solid #000/u);
assert.match(commerceHtml, /addy-field-15[^>]+font-size:9px/u);
assert.match(commerceHtml, /addy-field-5-right-line/u);

const nonCommerceHtml = renderAddyDocument({
  ...baseDocument,
  transactionUnit: 'Μονάδα',
  invoiceNumber: '',
  invoiceDate: '',
  commerceCompany: null
});
assert.doesNotMatch(nonCommerceHtml, /Αρ\. Τιμολογίου/u);
assert.doesNotMatch(nonCommerceHtml, /Δοκιμαστική Α\.Ε\./u);
assert.match(nonCommerceHtml, /Γενικές πληροφορίες/u);

console.log('ADDY commerce invoice fields 19/21 print tests passed.');
