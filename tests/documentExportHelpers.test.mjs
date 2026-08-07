import assert from 'node:assert/strict';
import {
  isExportablePrintLabel,
  resolveExportOrientation
} from '../src/ui/documentExport.js';

assert.equal(isExportablePrintLabel('Εκτύπωση'), true);
assert.equal(isExportablePrintLabel('  εκτυπωση της καρτέλας  '), true, 'labels are matched without accents or case');
assert.equal(isExportablePrintLabel('Εκτύπωση Προεπισκόπησης'), false);
assert.equal(isExportablePrintLabel('Εκτύπωση - Προβολή'), false);
assert.equal(isExportablePrintLabel('Αποθήκευση'), false);
assert.equal(isExportablePrintLabel(''), false);
assert.equal(isExportablePrintLabel(null), false);

function createButton({ selectors = [], dataset = {} } = {}) {
  return {
    dataset,
    matches: (selector) => selector.split(',').some((candidate) => selectors.includes(candidate.trim()))
  };
}

function createSource({ selectors = [], childSelectors = [], dataset = {}, attributeStyle = '' } = {}) {
  return {
    dataset,
    matches: (selector) => selector.split(',').some((candidate) => selectors.includes(candidate.trim())),
    querySelector: (selector) =>
      selector.split(',').some((candidate) => childSelectors.includes(candidate.trim())) ? createSource() : null,
    querySelectorAll: () => [],
    getAttribute: () => attributeStyle
  };
}

assert.equal(
  resolveExportOrientation(createButton({ dataset: { exportOrientation: 'LANDSCAPE' } }), createSource()),
  'landscape',
  'an explicit button orientation wins'
);
assert.equal(
  resolveExportOrientation(createButton(), createSource({ dataset: { exportOrientation: 'A4 portrait' } })),
  'portrait',
  'the source orientation is used when the button has none'
);
assert.equal(
  resolveExportOrientation(createButton({ selectors: ['[data-print-k2310]'] }), createSource()),
  'landscape',
  'known landscape buttons force landscape output'
);
assert.equal(
  resolveExportOrientation(createButton(), createSource({ selectors: ['.index-page'] })),
  'landscape'
);
assert.equal(
  resolveExportOrientation(createButton(), createSource({ childSelectors: ['.addy-document-page'] })),
  'landscape',
  'a nested landscape page is detected'
);
assert.equal(
  resolveExportOrientation(createButton(), createSource({ selectors: ['.official-handover-page'] })),
  'portrait'
);
assert.equal(
  resolveExportOrientation(createButton(), createSource({ dataset: { printOrientation: 'landscape' } })),
  'landscape',
  'the inline print orientation of the page is used as a fallback'
);
assert.equal(
  resolveExportOrientation(createButton(), createSource({ attributeStyle: 'page: A4 landscape' })),
  'landscape'
);
assert.equal(resolveExportOrientation(createButton(), createSource()), 'portrait');
assert.equal(resolveExportOrientation(undefined, undefined), 'portrait');

console.log('documentExportHelpers.test.mjs: OK');
