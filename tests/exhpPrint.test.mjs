import assert from 'node:assert/strict';
import {
  renderExhpDocument,
  renderExhpFrontSignatureTitles,
  renderExhpSupportingDocuments,
  shouldShowCommanderInExhpField23
} from '../src/ui/transactions/exhpPrint.js';

const baseDocument = {
  items: [],
  unit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
  registryNumber: '1',
  date: '2026-07-14',
  managementType: 'ΓΕΝΙΚΗ',
  reason: 'Διαγραφή αναλώσιμου υλικού και ειδών σταθερών χορηγήσεων',
  reasonCode: 'z',
  reasonTexts: {},
  financialOfficers: {
    manager: 'Λγός (ΠΒ) Αλεξανδρής Ιωάννης',
    ped: 'Τχης (ΠΒ) Προϊστάμενος Πέτρος',
    commander: 'Σχης (ΠΖ) Διοικητής Δημήτριος'
  }
};

const html = renderExhpDocument(baseDocument);
assert.match(html, /exhp-unit-overlay/u);
assert.equal((html.match(/exhp-field-15-signature/gu) || []).length, 2);
assert.match(html, /exhp-field-23-signature/u);
assert.match(html, /<strong>Διοικητής Δημήτριος<\/strong>\s*<em>Σχης \(ΠΖ\)<\/em>/u);
assert.match(html, /<div class="exhp-page-number">Σελίδα 1 από 1<\/div>/u);
assert.equal((renderExhpFrontSignatureTitles().match(/exhp-signature-title-mask/gu) || []).length, 5);
assert.match(renderExhpFrontSignatureTitles(), /\(18\) ΤΟ ΛΟΓΙΣΤΗΡΙΟ/u);
const supportGrid = renderExhpSupportingDocuments(['1', '2', '3', '4', '5', '6']);
assert.match(supportGrid, /exhp-supporting-documents-grid/u);
assert.equal((supportGrid.match(/<span>/gu) || []).length, 6);

const sixSupportHtml = renderExhpDocument({
  ...baseDocument,
  supports: Array.from({ length: 7 }, (_unused, index) => ({
    completed: true,
    documentCode: `Δ${index + 1}`,
    documentReference: `ΕΓΓΡΑΦΟ ${index + 1}`
  }))
});
assert.match(sixSupportHtml, /Δ6 ΕΓΓΡΑΦΟ 6/u);
assert.doesNotMatch(sixSupportHtml, /Δ7 ΕΓΓΡΑΦΟ 7/u);

assert.equal(shouldShowCommanderInExhpField23('', 'z'), true);
for (const code of ['a', 'd', 'th', 'i', 'ib']) {
  assert.equal(shouldShowCommanderInExhpField23('', code), false);
}

const excludedHtml = renderExhpDocument({
  ...baseDocument,
  reason: 'Μετασχηματισμός υλικών (κατασκευή - μετασκευή)',
  reasonCode: 'd'
});
assert.doesNotMatch(excludedHtml, /exhp-field-23-signature/u);

const separateSerialHtml = renderExhpDocument({
  ...baseDocument,
  items: [
    { transactionType: 'Χρέωση', nominalNumber: 'C-1', description: 'ΧΡΕΩΣΗ 1', quantity: 1 },
    { transactionType: 'Πίστωση', nominalNumber: 'P-1', description: 'ΠΙΣΤΩΣΗ 1', quantity: 1 },
    { transactionType: 'Χρέωση', nominalNumber: 'C-2', description: 'ΧΡΕΩΣΗ 2', quantity: 1 }
  ]
});
assert.match(separateSerialHtml, /C-1/u);
assert.match(separateSerialHtml, /P-1/u);
assert.equal((separateSerialHtml.match(/>1<\/div>/gu) || []).length >= 2, true);

console.log('EXHP preview overlays, pagination and field 23 signature test passed.');
