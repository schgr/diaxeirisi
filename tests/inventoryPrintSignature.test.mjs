import assert from 'node:assert/strict';
import fs from 'node:fs';
import { splitOfficerSignature, formatOfficerRank } from '../src/ui/officerSignature.js';

const source = fs.readFileSync(new URL('../src/ui/prints/inventoryPrint.js', import.meta.url), 'utf8');

assert.match(
  source,
  /import \{ formatOfficerName, formatOfficerRank, splitOfficerSignature \} from '\.\.\/officerSignature\.js';/u
);
assert.match(source, /const officer = splitOfficerSignature\(value\);/u);

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
