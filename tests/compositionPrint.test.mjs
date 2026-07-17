import assert from 'node:assert/strict';
import {
  renderCompositionDocument,
  renderCompositionDocumentFooter
} from '../src/ui/pages/sharesPage.js';
import { renderAddyCompositionDocument } from '../src/ui/transactions/addyPrint.js';

const card = {
  share: {
    shareNumber: '13',
    nominalNumber: '1005-13',
    description: 'ΔΟΚΙΜΑΣΤΙΚΟ ΥΛΙΚΟ'
  },
  compositionItems: []
};
const settings = { serviceInfo: { serviceName: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ' } };

const emptyDocument = renderCompositionDocument(card, settings);
assert.equal(countPages(emptyDocument), 1, 'An empty composition must print on one page.');
assert.match(emptyDocument, /13\.\s*<\/b> ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ/);
assert.match(emptyDocument, /14\.\s*<\/b> ΠΑΡΑΛΑΜΒΑΝΟΥΣΑ ΜΟΝΑΔΑ/);
assert.match(emptyDocument, /Αριθμ\. Ημερ\. Ευρετ\. Δικ\. Εξωτ\. Δοσ\./);
assert.match(emptyDocument, /20\.\.\.\./);

const sixteenRows = Array.from({ length: 16 }, (_unused, index) => compositionItem(index));
assert.equal(
  countPages(renderCompositionDocument({ ...card, compositionItems: sixteenRows }, settings)),
  1,
  'A composition that fits must not create a second page.'
);
assert.equal(
  countPages(renderCompositionDocument({ ...card, compositionItems: [...sixteenRows, compositionItem(16)] }, settings)),
  2,
  'A composition larger than one sheet must paginate.'
);

const footer = renderCompositionDocumentFooter();
const addyDocument = renderAddyCompositionDocument(
  {
    id: 1,
    documentDate: '2026-07-17',
    transactionUnit: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ'
  },
  [{
    column12: '1005-13',
    column13: 'ΔΟΚΙΜΑΣΤΙΚΟ ΥΛΙΚΟ',
    column24: '13',
    composition: [compositionItem(0)]
  }]
);
assert.ok(addyDocument.includes(footer), 'The ADDY composition must use the complete official footer.');
assert.match(addyDocument, /class="composition-column-numbers"/);

console.log('compositionPrint.test.mjs: OK');

function countPages(html) {
  return (html.match(/class="composition-document-page print-document-area/g) || []).length;
}

function compositionItem(index) {
  return {
    componentNominalNumber: `1005-${index + 1}`,
    componentDescription: `ΥΛΙΚΟ ${index + 1}`,
    measurementUnit: 'ΤΕΜ',
    projectedQuantity: 1,
    notIssuedQuantity: 0
  };
}
