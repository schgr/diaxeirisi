import assert from 'node:assert/strict';
import {
  renderExhpDocument,
  renderExhpFrontSignatureTitles,
  renderFaithfulExhpRows,
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
assert.match(html, /exhp-field-18-signature/u);
assert.match(html, /exhp-field-23-signature/u);
assert.match(html, /<strong>Διοικητής Δημήτριος<\/strong>\s*<em>Σχης \(ΠΖ\)<\/em>/u);
assert.match(html, /<div class="exhp-page-number">Σελίδα 1 από 1<\/div>/u);
assert.equal((renderExhpFrontSignatureTitles().match(/exhp-signature-title-mask/gu) || []).length, 5);
assert.match(renderExhpFrontSignatureTitles(), /\(18\) ΤΟ ΛΟΓΙΣΤΗΡΙΟ/u);
const supportGrid = renderExhpSupportingDocuments(['1', '2', '3', '4', '5', '6']);
assert.match(supportGrid, /exhp-supporting-documents-grid/u);
assert.equal((supportGrid.match(/<span>/gu) || []).length, 9);

const nineSupportHtml = renderExhpDocument({
  ...baseDocument,
  supports: Array.from({ length: 10 }, (_unused, index) => ({
    completed: true,
    documentCode: `Δ${index + 1}`,
    documentReference: `ΕΓΓΡΑΦΟ ${index + 1}`
  }))
});
assert.match(nineSupportHtml, /Δ9 ΕΓΓΡΑΦΟ 9/u);
assert.doesNotMatch(nineSupportHtml, /Δ10 ΕΓΓΡΑΦΟ 10/u);

const officialSupportHtml = renderExhpDocument({
  ...baseDocument,
  officialSupportDocuments: [{ documentType: 'useless_material_a' }],
  otherSupportDocument: 'ΤΕ 34-254 ΤΜ 99\nΠΡΩΤΟΚΟΛΛΑ ΖΥΓΙΣΗΣ'
});
assert.match(officialSupportHtml, /Πρωτόκολλο Πρωτοβάθμιας Επιτροπής/u);
assert.match(officialSupportHtml, /ΤΕ 34-254 ΤΜ 99/u);
assert.match(officialSupportHtml, /ΠΡΩΤΟΚΟΛΛΑ ΖΥΓΙΣΗΣ/u);
assert.match(renderExhpFrontSignatureTitles(), /top:73\.25%;/u);
assert.match(renderExhpFrontSignatureTitles(), /left:47\.4%;top:74\.05%;width:10\.5%;height:2\.7%;/u);
assert.match(html, /left:1\.2%;top:76\.1%;width:10\.8%;height:2\.7%;/u);
assert.match(html, /left:46\.6%;top:76\.1%;width:11\.5%;height:2\.7%;/u);
assert.match(html, /left:75\.4%;top:89%;width:20\.5%;height:4\.3%;/u);
assert.match(html, /exhp-registry-overlay[^>]+left:82\.6%;top:14\.2%/u);
assert.match(html, /exhp-date-overlay[^>]+left:81%;top:17%/u);
assert.match(renderExhpFrontSignatureTitles(), /left:49\.2%;top:73\.25%;width:9\.2%;/u);
assert.match(renderExhpFrontSignatureTitles(), /left:78\.9%;top:73\.25%;width:8\.2%;/u);
assert.match(renderExhpFrontSignatureTitles(), /exhp-credit-field-16-clear-mask[^>]+left:87%;top:75\.35%;width:10\.9%;height:2\.85%;/u);

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

const materialPositionRows = renderFaithfulExhpRows([
  {
    exhpSerial: 1,
    shareNumber: '25',
    ledgerSerial: 7,
    nominalNumber: 'AO-25',
    description: 'ΚΑΝΟΝΙΚΗ ΚΙΝΗΣΗ',
    measurementUnit: 'Τεμ',
    quantity: 3
  },
  {
    exhpSerial: 2,
    shareNumber: '30',
    ledgerSerial: 'Φ.Μ.',
    nominalNumber: 'AO-30',
    description: 'ΣΥΝΘΕΣΗ ΧΩΡΙΣ ΚΙΝΗΣΗ',
    measurementUnit: 'Τεμ',
    quantity: 0
  }
], false);
assert.match(materialPositionRows, />25\/7<\/div>/u);
assert.match(materialPositionRows, />30\/Φ\.Μ\.<\/div>/u);
assert.equal((materialPositionRows.match(/exhp-material-position-overlay/gu) || []).length, 2);
assert.match(
  materialPositionRows,
  /left:36\.85%;top:41%;width:2\.45%;height:2\.45%;"><\/div>/u
);

const hundredItemHtml = renderExhpDocument({
  ...baseDocument,
  items: Array.from({ length: 100 }, (_unused, index) => ({
    transactionType: 'Χρέωση',
    nominalNumber: `C-${index + 1}`,
    description: `ΧΡΕΩΣΗ ${index + 1}`,
    quantity: 1
  }))
});
assert.equal((hundredItemHtml.match(/exhp-faithful-front-side/gu) || []).length, 8);
assert.match(hundredItemHtml, /<div class="exhp-page-number">Σελίδα 8 από 8<\/div>/u);

console.log('EXHP preview overlays, pagination and field 23 signature test passed.');
