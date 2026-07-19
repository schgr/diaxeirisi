import assert from 'node:assert/strict';

const {
  renderChargeCreditOrdersIndex,
  renderExternalTransactionsIndex,
  renderIndexAnnualSignatures
} = await import('../src/ui/pages/printsPage.js');

const settings = { serviceInfo: { serviceName: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ' } };
const externalRows = Array.from({ length: 23 }, (_unused, index) => ({
  serial: index + 1,
  date: '2026-01-01',
  unit: 'ΜΟΝΑΔΑ',
  documentType: 'Π',
  nominalNumber: `ΑΟ-${index + 1}`,
  notes: ''
}));
const ordersRows = Array.from({ length: 28 }, (_unused, index) => ({
  serial: index + 1,
  date: '2026-01-01',
  reason: `ΑΙΤΙΟΛΟΓΙΑ ${index + 1}`
}));

const externalHtml = renderExternalTransactionsIndex(settings, externalRows);
assert.match(externalHtml, /Σελίδα 1 από Σελίδα 2/);
assert.match(externalHtml, /Σελίδα 2 από Σελίδα 2/);
assert.equal((externalHtml.match(/official-index-page print-document-area/g) || []).length, 2);

const ordersHtml = renderChargeCreditOrdersIndex(settings, ordersRows);
assert.match(ordersHtml, /Σελίδα 1 από Σελίδα 2/);
assert.match(ordersHtml, /Σελίδα 2 από Σελίδα 2/);

const signaturesHtml = renderIndexAnnualSignatures({
  commander: 'ΑΝΘΛΓΟΣ ΙΩΑΝΝΗΣ ΔΟΚΙΜΗ',
  ped: 'ΛΓΟΣ ΠΕΤΡΟΣ ΕΛΕΓΧΟΣ',
  manager: 'ΥΠΛΓΟΣ ΝΙΚΟΣ ΔΙΑΧΕΙΡΙΣΤΗΣ'
});
assert.match(signaturesHtml, /Θεωρήθηκε[\s\S]*<span>Ο<\/span>[\s\S]*<span>ΔΚΤΗΣ<\/span>/);
assert.match(signaturesHtml, /<span>Ο<\/span>[\s\S]*<span>Π\.Ε\.Δ<\/span>/);
assert.match(signaturesHtml, /<span>Ο<\/span>[\s\S]*<span>ΔΧΣΤΗΣ<\/span>/);
assert.match(signaturesHtml, /Ιωαννης Δοκιμη[\s\S]*Ανθλγος/);

console.log('Index pagination and annual signatures test passed.');
