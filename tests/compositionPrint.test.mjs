import assert from 'node:assert/strict';
import {
  renderCompositionDocument,
  renderCompositionDocumentFooter,
  renderChangeSheetDocument,
  renderRows
} from '../src/ui/pages/sharesPage.js';
import { renderShareNumberOptions } from '../src/ui/pages/transactionsPage.js';
import { renderAddyCompositionDocument } from '../src/ui/transactions/addyPrint.js';
import { renderFiscalYearOptions } from '../src/ui/components/forms.js';

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

const compactRows = renderRows([{
  id: 13,
  shareNumber: '13',
  nominalNumber: '1005-13',
  mainMaterialNumber: 'ΚΥ-13',
  description: 'ΔΟΚΙΜΑΣΤΙΚΟ ΥΛΙΚΟ',
  materialType: 'ΟΠΛΙΣΜΟΣ',
  accountingBalance: 4,
  chargedQuantity: 2,
  differenceQuantity: 2,
  status: 'Διαφορά',
  statusTone: 'warning'
}], true);
assert.match(compactRows, /1005-13/);
assert.match(compactRows, /ΔΟΚΙΜΑΣΤΙΚΟ ΥΛΙΚΟ/);
assert.doesNotMatch(compactRows, /ΚΥ-13|ΟΠΛΙΣΜΟΣ|status-pill/);

const shareOptions = renderShareNumberOptions([{
  shareNumber: '13',
  nominalNumber: '1005-13',
  description: 'ΔΟΚΙΜΑΣΤΙΚΟ ΥΛΙΚΟ'
}]);
assert.match(shareOptions, /value="13"/);
assert.doesNotMatch(shareOptions, /1005-13|ΔΟΚΙΜΑΣΤΙΚΟ ΥΛΙΚΟ/);

const changeSheet = renderChangeSheetDocument({
  share: { ...card.share, projectedQuantity: 1, accountingBalance: 1 },
  compositionItems: [compositionItem(0)],
  changeSheetEntries: [{
    changeDate: '2025-12-31',
    orderReference: 'ΑΠΟΓΡΑΦΗ',
    componentLineNumber: 1,
    movementType: 'ΧΡΕΩΣΗ',
    quantity: 15
  }]
});
assert.match(changeSheet, /Απογραφή 31-12-2025/);
assert.match(changeSheet, />15</);
assert.match(
  changeSheet,
  /<td><\/td>\s*<td><\/td>\s*<\/tr>/,
  'The surplus and deficit columns must remain empty.'
);

const documentChangeSheet = renderChangeSheetDocument({
  share: { ...card.share, projectedQuantity: 1, accountingBalance: 1 },
  compositionItems: [compositionItem(0)],
  changeSheetEntries: [{
    changeDate: '2026-05-31',
    orderReference: 'Χ-37',
    componentLineNumber: 1,
    movementType: 'ΧΡΕΩΣΗ',
    quantity: 2
  }, {
    changeDate: '2026-02-15',
    orderReference: 'ΕΧΠ-1',
    componentLineNumber: 1,
    movementType: 'ΠΙΣΤΩΣΗ',
    quantity: 1
  }]
});
assert.match(documentChangeSheet, /Χ-37\/31-05-2026/);
assert.match(documentChangeSheet, /ΕΧΠ-1\/15-02-2026/);
assert.match(documentChangeSheet, /<span>Χ-37\/31-05-2026<\/span>/);
assert.match(documentChangeSheet, /<span>ΕΧΠ-1\/15-02-2026<\/span>/);

const yearOptions = renderFiscalYearOptions(2025);
assert.match(yearOptions, /value="2025" selected/);
assert.match(yearOptions, /value="2026"/);

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
