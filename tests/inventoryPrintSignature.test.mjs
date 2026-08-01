import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/prints/inventoryPrint.js', import.meta.url), 'utf8');

assert.match(
  source,
  /import \{ formatOfficerName, formatOfficerRank, splitOfficerSignature \} from '\.\.\/officerSignature\.js';/u
);
assert.match(source, /const officer = splitOfficerSignature\(value\);/u);

console.log('Inventory print officer-signature import test passed.');
