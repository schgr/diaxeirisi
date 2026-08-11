import assert from 'node:assert/strict';
import {
  renderExhpDocument,
  renderExhpFrontFooterLabels
} from '../src/ui/transactions/exhpPrint.js';

const labelsHtml = renderExhpFrontFooterLabels();
assert.equal((labelsHtml.match(/exhp-front-footer-label/gu) || []).length, 5);
assert.equal((labelsHtml.match(/\(15\) Ο ΔΙΑΧΕΙΡ\./gu) || []).length, 2);
assert.equal((labelsHtml.match(/\(16\) Ο ΒΟΗΘΟΣ ΓΕΝ ΔΙΑΧ/gu) || []).length, 2);
assert.equal((labelsHtml.match(/\(18\) ΤΟ ΛΟΓΙΣΤΗΡΙΟ/gu) || []).length, 1);
assert.equal((labelsHtml.match(/top:73\.25%/gu) || []).length, 5);

const documentHtml = renderExhpDocument({
  items: [],
  reasonTexts: {},
  financialOfficers: { manager: 'Manager', ped: 'Accounting' }
});
assert.match(documentHtml, /left:1\.8%;top:76\.1%;width:10\.8%;height:2\.7%;/u);
assert.match(documentHtml, /left:79\.5%;top:76\.1%;width:8%;height:2\.7%;/u);

console.log('EXHP footer labels are top-aligned without moving manager signatures.');
