import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  renderExhpDocument,
  renderExhpReferenceRows,
  renderExhpSupportingDocuments,
  shouldShowCommanderInExhpField23
} from '../src/ui/transactions/exhpPrint.js';

const documentData = {
  items: [
    { transactionType: 'Χρέωση', nominalNumber: 'Χ-1', description: 'ΧΡΕΩΣΗ', measurementUnit: 'Τεμ.', quantity: 1 },
    { transactionType: 'Πίστωση', nominalNumber: 'Π-1', description: 'ΠΙΣΤΩΣΗ', measurementUnit: 'Τεμ.', quantity: 2 }
  ],
  unit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
  registryNumber: '17',
  date: '2026-07-14',
  managementType: 'ΓΕΝΙΚΗ',
  reason: 'Αιτιολογία δοκιμής',
  reasonCode: 'z',
  reasonTexts: {},
  financialOfficers: {
    manager: 'Λγός (ΠΒ) Αλεξανδρής Ιωάννης',
    ped: 'Τχης (ΠΒ) Προϊστάμενος Πέτρος',
    commander: 'Σχης (ΠΖ) Διοικητής Δημήτριος'
  }
};

const html = renderExhpDocument(documentData);
assert.match(html, /exhp-reference-management/u);
assert.match(html, /left:10\.4%;top:11\.7%;width:37\.6%;height:2\.2%/u);
assert.match(html, /left:37\.45%;top:69\.5%;width:18%;height:8\.5%/u);
assert.match(html, /exhp-field-19-signature/u);
assert.doesNotMatch(html, /left:12\.4%;top:68\.5%/u, 'Field 17 must not contain the PED signature.');
assert.match(html, /left:2\.9%;top:72\.4%;width:9\.4%;height:4\.9%/u);
assert.match(html, /left:2\.9%;top:79\.1%;width:45\.8%;height:8\.95%/u);
assert.match(html, /Χ-1/u);
assert.match(html, /Π-1/u);

const supportGrid = renderExhpSupportingDocuments(['1', '2', '3', '4', '5', '6', '7', '8', '9']);
assert.equal((supportGrid.match(/<span>/gu) || []).length, 9);
assert.match(supportGrid, /exhp-supporting-documents-gap/u);
assert.match(supportGrid, />9<\/span>/u);

const styles = fs.readFileSync(new URL('../src/ui/styles/official-prints.css', import.meta.url), 'utf8');
assert.match(styles, /\.exhp-reference-management\s*\{[\s\S]*justify-items:\s*center;[\s\S]*text-align:\s*center;/u);
assert.match(styles, /\.exhp-reference-signature \.exhp-officer-signature\s*\{[\s\S]*min-height:\s*0;/u);
assert.match(styles, /\.exhp-reference-support-field \.exhp-supporting-documents-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,[\s\S]*grid-template-rows:\s*repeat\(5,[\s\S]*grid-auto-flow:\s*column/u);
assert.match(styles, /\.exhp-reference-support-field \.exhp-supporting-documents-grid\s*\{[\s\S]*border:\s*0\s*!important;[\s\S]*background:\s*transparent;/u);
assert.match(styles, /@media print\s*\{[\s\S]*\.exhp-reference-signature-field-16 \.exhp-officer-signature strong\s*\{[\s\S]*12px/u);
assert.match(styles, /@media screen\s*\{[\s\S]*\.exhp-field-19-signature \.exhp-officer-signature strong[\s\S]*11px/u);
assert.match(styles, /\.exhp-reference-signature\.exhp-field-19-signature\s*\{[\s\S]*align-content:\s*end;[\s\S]*padding-bottom:\s*1px/u);
assert.match(styles, /@media print\s*\{[\s\S]*\.exhp-faithful-page \.exhp-reference-signature,[\s\S]*visibility:\s*visible\s*!important/u);

const rows = renderExhpReferenceRows([
  { exhpSerial: 1, transactionYearSerial: 17, nominalNumber: 'ΑΟ-1', description: 'ΥΛΙΚΟ', measurementUnit: 'Τεμ.', quantity: 3 }
], 'charge');
assert.match(rows, /left:32\.49%[^>]*>17<\/div>/u);

const collectionDocument = {
  ...documentData,
  reason: 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.',
  reasonCode: '',
  items: documentData.items.map((item) => ({ ...item, quantity: 0, ledgerSerial: 'Φ.Μ.' }))
};
const collectionHtml = renderExhpDocument(collectionDocument);
assert.match(collectionHtml, /left:32\.49%[^>]*>Φ\.Μ<\/div>/u);
assert.match(collectionHtml, /left:78\.29%[^>]*>Φ\.Μ<\/div>/u);
assert.doesNotMatch(renderExhpDocument({
  ...collectionDocument,
  items: collectionDocument.items.map((item) => ({ ...item, quantity: 1 }))
}), />Φ\.Μ<\/div>/u);
assert.doesNotMatch(renderExhpDocument({
  ...collectionDocument, reason: documentData.reason, reasonCode: 'z'
}), />Φ\.Μ<\/div>/u);

assert.equal(shouldShowCommanderInExhpField23('', 'z'), true);
assert.equal(shouldShowCommanderInExhpField23('', 'a'), false);

console.log('EXHP print layout test passed.');
