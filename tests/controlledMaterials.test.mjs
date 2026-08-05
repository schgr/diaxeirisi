import assert from 'node:assert/strict';
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

console.log('controlledMaterials.test.mjs: OK');
