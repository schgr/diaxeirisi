import assert from 'node:assert/strict';
import fs from 'node:fs';
import { renderSharesByCategoryPages } from '../src/ui/pages/printsPage.js';

const shares = [
  {
    shareNumber: '5',
    nominalNumber: 'N-5',
    description: 'Υλικό 5',
    materialType: 'Κατηγορία Α',
    measurementUnit: 'Τεμάχια',
    accountingBalance: 10
  },
  {
    shareNumber: '8',
    nominalNumber: 'N-8',
    description: 'Υλικό 8',
    materialType: 'Κατηγορία Β',
    measurementUnit: 'Τεμάχια',
    accountingBalance: 20
  },
  {
    shareNumber: '9',
    nominalNumber: 'N-9',
    description: 'Υλικό 9',
    materialType: 'Κατηγορία Γ',
    measurementUnit: 'Τεμάχια',
    accountingBalance: 30
  }
];

const html = renderSharesByCategoryPages(
  shares,
  { serviceInfo: { serviceName: 'Μονάδα Δοκιμής' } },
  ['Κατηγορία Α', 'Κατηγορία Β']
);

assert.match(html, /Υλικό 5/u);
assert.match(html, /Υλικό 8/u);
assert.doesNotMatch(html, /Υλικό 9/u);
assert.match(html, /Κατηγορία Α/u);
assert.match(html, /Κατηγορία Β/u);

const printsPageSource = fs.readFileSync(
  new URL('../src/ui/pages/printsPage.js', import.meta.url),
  'utf8'
);
assert.match(printsPageSource, /id="preview-category-shares"/u);
assert.match(printsPageSource, /category-share-preview-modal/u);
assert.doesNotMatch(
  printsPageSource.match(/function bindCategoryShareControls[\s\S]*?\n\}\n/u)?.[0] || '',
  /preview\.innerHTML/u
);

console.log('Multiple-category share print filtering test passed.');
