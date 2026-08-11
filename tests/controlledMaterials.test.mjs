import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  CONTROLLED_MATERIAL_CATEGORIES,
  buildCategoryPageGroups,
  buildContinuousPageGroups,
  categoryForCode,
  controlledMaterialRows
} from '../src/ui/administration/controlledMaterials.js';

assert.equal(CONTROLLED_MATERIAL_CATEGORIES.length, 12);
assert.equal(categoryForCode('01161')?.label, 'Οπλισμός');
assert.equal(categoryForCode('50000')?.id, 12);
assert.equal(categoryForCode('47000'), null);

const rows = controlledMaterialRows([
  { share: { shareNumber: '1', mainMaterialNumber: '01161', projectedQuantity: 5, accountingBalance: 3 } },
  { share: { shareNumber: '2', mainMaterialNumber: '50000', projectedQuantity: 2, accountingBalance: 7 } },
  { share: { shareNumber: '3', mainMaterialNumber: '', projectedQuantity: 1, accountingBalance: 1 } }
]);

assert.equal(rows.length, 2);
assert.equal(rows[0].deficit, 2);
assert.equal(rows[0].surplus, 0);
assert.equal(rows[1].deficit, 0);
assert.equal(rows[1].surplus, 5);

const printGroups = [
  { category: CONTROLLED_MATERIAL_CATEGORIES[0], rows: Array.from({ length: 12 }, (_, index) => index) },
  { category: CONTROLLED_MATERIAL_CATEGORIES[1], rows: Array.from({ length: 10 }, (_, index) => index) }
];
const continuousPages = buildContinuousPageGroups(printGroups);
assert.equal(continuousPages.length, 2);
assert.equal(continuousPages[0].sections.length, 2, 'continuous mode must allow the next category on the same page');
assert.equal(continuousPages[0].sections[1].rows.length, 6);
assert.equal(continuousPages[1].sections[0].rows.length, 4);
const categoryPages = buildCategoryPageGroups(printGroups);
assert.equal(categoryPages.length, 2, 'per-category mode must start each category on a new page');
assert.equal(categoryPages[0].sections[0].rows.length, 12);
assert.equal(categoryPages[1].sections[0].rows.length, 10);

const controlledSource = fs.readFileSync(new URL('../src/ui/administration/controlledMaterials.js', import.meta.url), 'utf8');
const administrationSource = fs.readFileSync(new URL('../src/ui/pages/administrationPage.js', import.meta.url), 'utf8');
const printStyles = fs.readFileSync(new URL('../src/ui/styles/share-print-ui.css', import.meta.url), 'utf8');
const registryStyles = fs.readFileSync(new URL('../src/ui/styles/registries-legacy.css', import.meta.url), 'utf8');
const annualStyles = fs.readFileSync(new URL('../src/ui/styles/transactions-settings.css', import.meta.url), 'utf8');
assert.match(controlledSource, /print\.currentDocument\(\{ landscape: false \}\)/u);
assert.match(administrationSource, /print\.currentDocument\(\{ landscape: false \}\)/u);
assert.match(printStyles, /\.controlled-material-print\.print-document-area\s*\{[\s\S]*page:\s*portrait;[\s\S]*width:\s*210mm;[\s\S]*height:\s*297mm;/u);
assert.match(registryStyles, /\.serial-registry-print-root \.serial-registry-print-page\s*\{[\s\S]*page:\s*portrait;[\s\S]*width:\s*210mm;[\s\S]*height:\s*297mm;/u);
assert.match(printStyles, /nth-child\(4\)\s*\{\s*width:\s*38%/u);
assert.match(registryStyles, /nth-child\(4\)\s*\{\s*width:\s*34%/u);
assert.match(annualStyles, /\[data-annual-document-pages\]\s*\{[\s\S]*flex-direction:\s*column;[\s\S]*gap:\s*18px;/u);

console.log('controlledMaterials.test.mjs: OK');
