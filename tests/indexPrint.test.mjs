import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderFiscalYearControls, renderIndexPages } from '../src/ui/prints/indexPrint.js';

const {
  renderChargeCreditOrdersIndex,
  renderExternalTransactionsIndex,
  renderIndexAnnualSignatures,
  selectFirstMaterialPerAddy
} = await import('../src/ui/pages/printsPage.js');

const settings = { serviceInfo: { serviceName: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ' } };
const indexStyles = await readFile(new URL('../src/ui/styles/print-indexes.css', import.meta.url), 'utf8');
assert.match(indexStyles, /\.index-document-preview-content > \.official-index-page[\s\S]*flex:\s*0 0 auto;[\s\S]*aspect-ratio:\s*297 \/ 210;/u);
assert.match(indexStyles, /\.official-index-overlay[\s\S]*font-size:\s*clamp\(7px, 0\.62vw, 9px\)/u);
assert.match(indexStyles, /\.orders-official-index-page > img,[\s\S]*transform:\s*translateY\(-12px\)/u);
const movementControls = renderFiscalYearControls({ fiscalYear: 2026 });
assert.match(movementControls, />Προβολή<\/button>/u);
assert.doesNotMatch(movementControls, />Εκτύπωση<\/button>/u);
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
assert.match(externalHtml, /01-01-2026/u);
assert.equal((externalHtml.match(/official-index-page external-official-index-page print-document-area/g) || []).length, 2);

const ordersHtml = renderChargeCreditOrdersIndex(settings, ordersRows);
assert.match(ordersHtml, /Σελίδα 1 από Σελίδα 2/);
assert.match(ordersHtml, /Σελίδα 2 από Σελίδα 2/);
assert.match(ordersHtml, /official-index-page orders-official-index-page print-document-area/u);
assert.match(ordersHtml, /official-index-cell official-index-left-cell[^>]*>ΑΙΤΙΟΛΟΓΙΑ 1</u);

const defaultPageHtml = renderIndexPages({
  unit: 'UNIT',
  code: 'CODE',
  title: 'TITLE',
  columns: ['COLUMN'],
  numbers: ['1'],
  rows: Array.from({ length: 35 }, (_unused, index) => [`ROW ${index + 1}`])
});
assert.equal(
  (defaultPageHtml.match(/index-page print-document-area/g) || []).length,
  2,
  'The default index pagination must remain available to every index renderer.'
);

const signaturesHtml = renderIndexAnnualSignatures({
  commander: 'ΑΝΘΛΓΟΣ ΙΩΑΝΝΗΣ ΔΟΚΙΜΗ',
  ped: 'ΛΓΟΣ ΠΕΤΡΟΣ ΕΛΕΓΧΟΣ',
  manager: 'ΥΠΛΓΟΣ ΝΙΚΟΣ ΔΙΑΧΕΙΡΙΣΤΗΣ'
});
assert.match(signaturesHtml, /ΘΕΩΡΗΘΗΚΕ[\s\S]*<span>Ο<\/span>[\s\S]*<span>ΔΚΤΗΣ<\/span>/);
assert.match(signaturesHtml, /<span>Ο<\/span>[\s\S]*<span>Π\.Ε\.Δ<\/span>/);
assert.match(signaturesHtml, /<span>Ο<\/span>[\s\S]*<span>ΔΧΣΤΗΣ<\/span>/);
assert.match(signaturesHtml, /Ιωαννης Δοκιμη[\s\S]*Ανθλγος/);
assert.match(signaturesHtml, /ΘΕΩΡΗΘΗΚΕ/);

const oneMaterialRows = selectFirstMaterialPerAddy([
  { id: 10, itemId: 1, serial: 1 },
  { id: 10, itemId: 2, serial: 2 },
  { id: 11, itemId: 3, serial: 3 }
]);
assert.deepEqual(oneMaterialRows.map((row) => [row.id, row.itemId, row.serial]), [
  [10, 1, 1],
  [11, 3, 2]
]);

console.log('Index pagination and annual signatures test passed.');
