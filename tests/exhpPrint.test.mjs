import assert from 'node:assert/strict';
import {
  renderExhpDocument,
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

console.log('EXHP preview overlays, pagination and field 23 signature test passed.');
