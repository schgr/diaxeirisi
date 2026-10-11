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
const indexSource = await readFile(new URL('../src/ui/prints/indexPrint.js', import.meta.url), 'utf8');
assert.doesNotMatch(indexSource, /external-transaction-index-template\.xlsx/u);
assert.match(indexStyles, /\.index-document-preview-content > \.official-index-page[\s\S]*flex:\s*0 0 auto;[\s\S]*aspect-ratio:\s*297 \/ 210;/u);
assert.match(indexStyles, /\.official-index-overlay[\s\S]*font-size:\s*clamp\(7px, 0\.62vw, 9px\)/u);
assert.match(indexStyles, /\.orders-official-index-page > img,[\s\S]*transform:\s*translateY\(-12px\)/u);
assert.match(indexStyles, /\.orders-official-index-page \.official-index-cell \{[\s\S]*font-size:\s*clamp\(11px, calc\(0\.8vw \+ 2px\), 13px\)/u);
assert.match(indexStyles, /\.external-official-index-page \.official-index-cell \{[\s\S]*font-family:\s*Arial, sans-serif;[\s\S]*font-size:\s*12px/u);
assert.match(indexStyles, /\.external-official-index-page \.external-index-notes-cell \{[\s\S]*font-family:\s*Arial, sans-serif;[\s\S]*font-size:\s*12px/u);
assert.match(indexStyles, /@page external-transaction-index\s*\{[^}]*size:\s*A4 landscape/u);
assert.match(indexStyles, /\.isolated-print-root > \.external-excel-index-page\s*\{[^}]*page:\s*external-transaction-index/u);
assert.match(indexStyles, /\.isolated-print-root > \.external-excel-index-page\s*\{[^}]*position:\s*relative;[^}]*min-height:\s*0/u);
assert.match(indexStyles, /\.external-excel-index-page \.official-index-annual-signatures/u);
assert.match(indexSource, /\.external-excel-index-page:last-child/u);
assert.match(indexStyles, /\.external-excel-index-page \.external-index-cell-text \{[^}]*white-space:\s*nowrap/u);
assert.match(indexStyles, /\.official-index-annual-signatures \{[\s\S]*font-size:\s*clamp\(9px, calc\(0\.8vw \+ 1px\), 13px\)/u);
const movementControls = renderFiscalYearControls({ fiscalYear: 2026 });
assert.match(movementControls, />Προβολή<\/button>/u);
assert.doesNotMatch(movementControls, />Εκτύπωση<\/button>/u);
const externalRows = Array.from({ length: 31 }, (_unused, index) => ({
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
const firstPageOnlyHtml = renderExternalTransactionsIndex(settings, externalRows.slice(0, 22));
assert.equal((firstPageOnlyHtml.match(/external-excel-index-page print-document-area/g) || []).length, 1);
assert.match(externalHtml, /Σελίδα 1 από Σελίδα 2/);
assert.match(externalHtml, /Σελίδα 2 από Σελίδα 2/);
assert.match(externalHtml, /01-01-2026/u);
assert.equal((externalHtml.match(/external-excel-index-page print-document-area/g) || []).length, 2);
assert.equal((externalHtml.match(/<tbody>/g) || []).length, 2);
assert.equal((externalHtml.match(/<tr>/g) || []).length, 50, 'Preceding pages have 24 data rows; the final page has 22, plus two header rows per page.');
for (const count of [0, 1, 22, 23, 24, 25, 46, 47, 48, 70, 71]) {
  const entries = Array.from({ length: count }, (_, index) => ({ serial: index + 1, nominalNumber: `ITEM-${index + 1}` }));
  const html = renderExternalTransactionsIndex(settings, entries);
  const bodies = [...html.matchAll(/<tbody>([\s\S]*?)<\/tbody>/g)];
  bodies.forEach((body, index) => {
    assert.equal((body[1].match(/<tr>/g) || []).length, index === bodies.length - 1 ? 22 : 24);
  });
  assert.deepEqual([...html.matchAll(/>ITEM-(\d+)</g)].map((match) => Number(match[1])), entries.map((entry) => entry.serial));
  if (count > 0) assert.match(bodies.at(-1)[1], /ITEM-/u, 'The final page must contain an entry.');
}
assert.match(indexStyles, /\.external-excel-index-page tbody tr \{ height: 6mm; \}/u);
assert.match(indexStyles, /\.external-excel-index-page \{[^}]*width: 297mm;[^}]*height: 209mm;/u);
assert.match(externalHtml, /Σελίδα 1 από Σελίδα 2[\s\S]*Σελίδα 2 από Σελίδα 2/u);
assert.match(externalHtml, /ΑΟ-25/u);
assert.match(externalHtml, /ΑΟ-26/u);
assert.match(externalHtml, /ΕΥΡΕΤΗΡΙΟ[\s\S]*ΔΙΚΑΙΟΛΟΓΗΤΙΚΩΝ ΕΞΩΤΕΡΙΚΩΝ ΔΟΣΟΛΗΨΙΩΝ/u);

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
