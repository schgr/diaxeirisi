import assert from 'node:assert/strict';
import {
  renderExhpDocument,
  renderExhpSupportingDocuments
} from '../src/ui/transactions/exhpPrint.js';

const html = renderExhpDocument({
  items: [],
  reasonTexts: {},
  financialOfficers: {
    manager: 'Manager',
    ped: 'Accounting'
  }
});

assert.match(html, /left:1\.8%;top:76\.1%;width:10\.8%;height:2\.7%;/u);
assert.match(html, /left:79\.5%;top:76\.1%;width:8%;height:2\.7%;/u);
assert.match(html, /exhp-field-18-signature exhp-top-line-signature" style="left:47\.2%;top:75\.35%;/u);

const documentsHtml = renderExhpSupportingDocuments([
  'Document 1', 'Document 2', 'Document 3', 'Document 4',
  'Document 5', 'Document 6', 'Document 7'
]);
assert.equal((documentsHtml.match(/exhp-supporting-document-/gu) || []).length, 6);
assert.match(documentsHtml, /exhp-supporting-document-1" style="left:50\.8%;top:81%;/u);
assert.match(documentsHtml, /exhp-supporting-document-3" style="left:50\.8%;top:84\.3%;/u);
assert.match(documentsHtml, /exhp-supporting-document-4" style="left:73\.8%;top:81%;/u);
assert.match(documentsHtml, /Document 6 · Document 7/u);

const delimitedDocumentsHtml = renderExhpSupportingDocuments([
  'Document 1; Document 2\nDocument 3 · Document 4|Document 5•Document 6'
]);
assert.equal((delimitedDocumentsHtml.match(/exhp-supporting-document-/gu) || []).length, 6);
assert.match(delimitedDocumentsHtml, /exhp-supporting-document-6/u);

console.log('EXHP supporting-document grid and signature alignment test passed.');
