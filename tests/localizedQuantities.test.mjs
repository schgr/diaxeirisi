import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  displayToMachine,
  machineToDisplay,
  sanitizeTypedQuantity
} from '../src/ui/localizedQuantities.js';

assert.equal(sanitizeTypedQuantity('1000'), '1000');
assert.equal(sanitizeTypedQuantity('1.000'), '1000');
assert.equal(sanitizeTypedQuantity('99,25'), '99,25');
assert.equal(sanitizeTypedQuantity('99.25'), '9925');
assert.equal(sanitizeTypedQuantity('12,3,4'), '12,34');
assert.equal(machineToDisplay('99.25'), '99,25');
assert.equal(displayToMachine('99,25'), '99.25');

const chargesPage = fs.readFileSync(
  new URL('../src/ui/pages/chargesPage.js', import.meta.url),
  'utf8'
);
assert.doesNotMatch(chargesPage, /internal-share-list/);

console.log('localized quantity tests passed');
