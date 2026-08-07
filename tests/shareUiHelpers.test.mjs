import assert from 'node:assert/strict';
import {
  compactSearchText,
  formatDate,
  formatDateWithDashes,
  formatDifference,
  formatQuantity,
  formatSignedQuantity,
  includes,
  normalize,
  pathToFileUrl
} from '../src/ui/shares/shared.js';
import {
  compareShareNumbers,
  formatDate as formatPrintDate,
  formatNumber,
  getDefaultRegistryCount
} from '../src/ui/prints/shared.js';

assert.equal(normalize('  ΆΝΩ   ΤΈΛΟΣ  '), 'ανω τελοσ');
assert.equal(normalize(null), '');
assert.equal(compactSearchText('ΑΟ-1 / 2026'), 'ΑΟ12026');

assert.equal(includes('οτιδήποτε', ''), true, 'an empty filter matches everything');
assert.equal(includes('Καλώδιο Ρεύματος', 'καλωδιο'), true);
assert.equal(includes('ΑΟ-1005/07', '1005 07'), true, 'punctuation is ignored by the compact search');
assert.equal(includes('Καλώδιο', 'λάστιχο'), false);
assert.equal(includes(null, 'κάτι'), false);

assert.equal(formatQuantity(1234.56789), '1234,568');
assert.equal(formatQuantity(0), '0');
assert.equal(formatSignedQuantity(2.5), '+2,5');
assert.equal(formatSignedQuantity(-2.5), '-2,5');
assert.equal(formatSignedQuantity(0), '0');
assert.equal(formatDifference(-4.25), '4,25');

assert.equal(formatDate(''), '');
assert.equal(formatDate('2026-03-04'), '4/3/2026');
assert.equal(formatDateWithDashes('2026-03-04'), '04-03-2026');
assert.equal(formatDateWithDashes('04/03/2026'), '04/03/2026');
assert.equal(formatDateWithDashes(''), '');

assert.equal(pathToFileUrl(''), '');
assert.equal(pathToFileUrl('C:\\temp\\photo.png'), 'file:///C:/temp/photo.png');
assert.equal(pathToFileUrl('/home/user/photo.png'), 'file:///home/user/photo.png');

assert.equal(formatPrintDate('2026-03-04'), '04/03/2026');
assert.equal(formatPrintDate('04/03/2026'), '04/03/2026');
assert.equal(formatPrintDate(''), '');
assert.equal(formatNumber(1234.56789), '1234,568');
assert.equal(formatNumber(1000), '1000', 'printed numbers never use grouping separators');

const shares = [{ shareNumber: '10' }, { shareNumber: '2' }, { shareNumber: 'ΑΟ' }];
assert.deepEqual(
  [...shares].sort(compareShareNumbers).map((share) => share.shareNumber),
  ['2', '10', 'ΑΟ']
);

assert.equal(getDefaultRegistryCount([]), 1);
assert.equal(getDefaultRegistryCount([{ shareNumber: '7' }, { shareNumber: '3' }]), 7);
assert.equal(
  getDefaultRegistryCount([{ shareNumber: 'ΑΟ' }, { shareNumber: 'ΒΟ' }]),
  2,
  'non numeric share numbers fall back to the share count'
);

console.log('shareUiHelpers.test.mjs: OK');
