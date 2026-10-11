import assert from 'node:assert/strict';
import fs from 'node:fs';
import { splitOfficerSignature, formatOfficerRank } from '../src/ui/officerSignature.js';
import { renderInventoryStatement } from '../src/ui/prints/inventoryPrint.js';

const source = fs.readFileSync(new URL('../src/ui/prints/inventoryPrint.js', import.meta.url), 'utf8');

assert.match(
  source,
  /import \{ formatOfficerName, formatOfficerRank, splitOfficerSignature \} from '\.\.\/officerSignature\.js';/u
);
assert.match(source, /const officer = splitOfficerSignature\(value\);/u);
assert.match(source, /const INVENTORY_ROWS_PER_PAGE = 28;/u);
assert.match(source, /const INVENTORY_ROW_HEIGHT = 1\.7;/u);
assert.match(source, /INVENTORY_FIRST_ROW_TOP \+ rowIndex \* INVENTORY_ROW_HEIGHT/u);

const inventoryHtml = renderInventoryStatement(
  { serviceInfo: {}, financialOfficers: {} },
  {
    items: Array.from({ length: 29 }, (_unused, index) => ({
      shareNumber: String(index + 1), nominalNumber: `ΟΝ-${index + 1}`,
      description: 'ΥΛΙΚΟ', measurementUnit: 'Τεμ', finalCount: 1,
      accountingBalance: 1, difference: 0, settlementReference: ''
    }))
  }
);
const [firstInventoryPage] = inventoryHtml.split('</article>');
assert.equal((firstInventoryPage.match(/inventory-row-overlay/gu) || []).length, 28 * 10);

// Test separator trimming
const signature1 = splitOfficerSignature('ΟΝΟΜΑ ΕΠΩΝΥΜΟ - Υπλγός');
assert.strictEqual(signature1.name, 'Ονομα Επωνυμο', 'Name should not have trailing separator');
assert.strictEqual(signature1.rank, 'Υπλγός', 'Rank should be extracted correctly');

// Test formatOfficerRank normalizes all words outside parentheses
assert.strictEqual(formatOfficerRank('Υπευθυνη ΥΛΙΚΟΥ'), 'Υπευθυνη Υλικου',
  'All words should be normalized');

// Test formatOfficerRank preserves content in parentheses (regression check)
assert.strictEqual(formatOfficerRank('Ανθστής (ΕΜΘ)'), 'Ανθστής (ΕΜΘ)',
  'Content in parentheses should be preserved');

console.log('Inventory print officer-signature import test passed.');
