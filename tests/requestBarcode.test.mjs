import assert from 'node:assert/strict';
import {
  buildRequestBarcodeValue,
  renderCode128Svg,
  renderRequestItemBarcode
} from '../src/ui/barcode/code128.js';

assert.equal(
  buildRequestBarcodeValue({ nominalNumber: '9000358005', quantity: 1 }),
  '9000358005&#9;1'
);
assert.equal(
  buildRequestBarcodeValue({ nominalNumber: '', partNumber: 'ABC-123', quantity: 4 }),
  'ABC-123&#9;4'
);
assert.equal(buildRequestBarcodeValue({ nominalNumber: '', quantity: 2 }), '');

const known = renderCode128Svg('AB');
assert.match(known, /^<svg class="request-line-barcode"/);
assert.match(known, /viewBox="0 0 73 30"/);
assert.match(known, /<rect x="8" y="0" width="2" height="30"\/>/);
assert.doesNotMatch(known, />AB</);
assert.equal(renderCode128Svg('ΕΛΛΗΝΙΚΑ'), '');

const manual = renderRequestItemBarcode({
  nominalNumber: '9000358002',
  quantity: 3
});
assert.match(manual, /aria-label="Barcode"/);
assert.ok(manual.includes('<rect '));

console.log('Request Code 128 barcode tests passed.');
