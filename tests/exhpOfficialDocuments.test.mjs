import assert from 'node:assert/strict';
import {
  renderClothingDisposalStatement,
  renderOfficialAmmoConsumptionCertificate,
  renderOfficialUselessDifferencesProtocol,
  renderOfficialUselessProtocol
} from '../src/exhpDocuments.mjs';

const settings = {
  serviceInfo: { serviceName: '999 ΤΑΓΜΑ ΔΟΚΙΜΩΝ' },
  financialOfficers: {
    commander: 'Σχης (ΠΖ) ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ',
    manager: 'Λγός (ΦΠΒ) ΑΛΕΞΑΝΔΡΗΣ ΙΩΑΝΝΗΣ',
    ped: 'Τχης ΝΙΚΟΛΑΟΥ ΜΑΡΙΑ'
  }
};
const exhp = { indexNumber: 42 };

function fieldValue(markup, fieldName) {
  const match = new RegExp(`data-field="${fieldName}">([^<]*)</span>`, 'u').exec(markup);
  return match ? match[1] : null;
}

const uselessProtocol = renderOfficialUselessProtocol(settings, exhp, {
  location: 'Λάρισα',
  day: '9',
  month: 'Μαΐου',
  year: '26',
  hdmNumber: 'Φ.100/1',
  president: 'Τχης ΝΙΚΟΛΑΟΥ ΜΑΡΙΑ',
  memberA: 'Υπλγός ΔΗΜΗΤΡΙΟΥ ΠΕΤΡΟΣ',
  periodFrom: '2026-01-01',
  periodTo: '2026-06-30',
  items: [
    {
      nominalNumber: 'ΑΟ-1005',
      description: 'Καλώδιο <ρεύματος>',
      measurementUnit: 'ΤΕΜ',
      quantity: 4,
      acquisitionDate: '2025-11-02',
      notes: 'Καλή διάθεση'
    }
  ]
});

assert.match(uselessProtocol, /ΠΡΩΤΟΚΟΛΛΟ<br \/><span>ΔΙΑΘΕΣΕΩΣ ΑΝΑΛΩΣΙΜΟΥ ΥΛΙΚΟΥ<\/span>/u);
assert.equal(fieldValue(uselessProtocol, 'serviceUnit'), '999 ΤΑΓΜΑ ΔΟΚΙΜΩΝ');
assert.equal(fieldValue(uselessProtocol, 'indexNumber'), '42');
assert.equal(fieldValue(uselessProtocol, 'year'), '2026', 'two digit years are expanded');
assert.equal(fieldValue(uselessProtocol, 'periodFrom'), '01/01/2026');
assert.equal(fieldValue(uselessProtocol, 'periodTo'), '30/06/2026');
assert.equal(fieldValue(uselessProtocol, 'items.0.nomenclatureNumber'), 'ΑΟ-1005');
assert.equal(fieldValue(uselessProtocol, 'items.0.unit'), 'ΤΕΜ', 'measurementUnit is used when unit is missing');
assert.equal(fieldValue(uselessProtocol, 'items.0.acquisitionDate'), '02/11/2025');
assert.equal(fieldValue(uselessProtocol, 'items.0.remarks'), 'Καλή διάθεση');
assert.equal(
  fieldValue(uselessProtocol, 'items.0.description'),
  'Καλώδιο &lt;ρεύματος&gt;',
  'material descriptions are escaped'
);
assert.equal(fieldValue(uselessProtocol, 'memberB'), '');
assert.match(uselessProtocol, /<strong>Παπαδοπουλος Γεωργιος<\/strong><em>Σχης \(ΠΖ\)<\/em>/u);
assert.match(uselessProtocol, /<strong>Αλεξανδρης Ιωαννης<\/strong><em>Λγός \(ΦΠΒ\)<\/em>/u);

const emptyProtocol = renderOfficialUselessProtocol(undefined, undefined);
assert.equal((emptyProtocol.match(/<tbody>[\s\S]*?<\/tbody>/u)[0].match(/<tr>/gu) || []).length, 1,
  'an empty document still renders a single blank material row');
assert.equal(fieldValue(emptyProtocol, 'serviceUnit'), '');
assert.equal(fieldValue(emptyProtocol, 'indexNumber'), '');
assert.equal(fieldValue(emptyProtocol, 'year'), '');

const certificate = renderOfficialAmmoConsumptionCertificate(settings, { registryNumber: 7 }, {
  officerName: 'ΓΕΩΡΓΙΟΥ ΝΙΚΟΛΑΟΣ',
  officerRank: 'Υπλγός',
  date: '2026-04-05',
  dayOfWeek: 'Δευτέρα',
  copiesCount: 3,
  items: [
    { itemType: 'consumed', description: 'Φυσίγγια 5.56mm', quantity: 120 },
    { itemType: 'empty', description: 'Κάλυκες 5.56mm', quantity: 118 }
  ]
});

assert.match(certificate, /ΠΙΣΤΟΠΟΙΗΤΙΚΟ<br \/><span>ΚΑΤΑΝΑΛΩΣΕΩΣ ΠΥΡΟΜΑΧΙΚΩΝ<\/span>/u);
assert.equal(fieldValue(certificate, 'indexNumber'), '7', 'the registry number is used when no index number exists');
assert.equal(fieldValue(certificate, 'officerRankName'), 'Υπλγός - ΓΕΩΡΓΙΟΥ ΝΙΚΟΛΑΟΣ');
assert.equal(fieldValue(certificate, 'unit'), '999 ΤΑΓΜΑ ΔΟΚΙΜΩΝ', 'the service name is the default unit');
assert.equal(fieldValue(certificate, 'date'), '05/04/2026');
assert.equal(fieldValue(certificate, 'consumedItems.0.quantity'), '120');
assert.equal(fieldValue(certificate, 'emptyItems.0.description'), 'Κάλυκες 5.56mm');
assert.equal(fieldValue(certificate, 'consumedItems.4.description'), '', 'both item lists are padded to five rows');
assert.equal(fieldValue(certificate, 'emptyItems.4.description'), '');
assert.match(certificate, /<strong>Νικολαου Μαρια<\/strong><em>Τχης<\/em>/u);
assert.match(certificate, /ΑΞΚΟΣ ΒΟΛΗΣ Ή ΕΚΠΤΗΣ<\/span><strong>Γεωργιου Νικολαος[^<]*<\/strong><em>Υπλγός<\/em>/u);

const differences = renderOfficialUselessDifferencesProtocol(settings, exhp, {
  president: 'Τχης ΝΙΚΟΛΑΟΥ ΜΑΡΙΑ',
  items: [
    { nomenclatureNumber: 'ΑΟ-1', description: 'Υλικό', unit: 'ΤΕΜ', qtyPrimary: 5, qtySecondary: 4, diffMinus: 1 },
    { nomenclatureNumber: 'ΑΟ-2', description: 'Άλλο', unit: 'ΚΙΒ', qtyPrimary: 2, qtySecondary: 3, diffPlus: 1 }
  ]
});
assert.match(differences, /ΔΙΑΦΟΡΩΝ ΔΕΥΤΕΡΟΒΑΘΜΙΑΣ ΕΠΙΤΡΟΠΗΣ/u);
assert.equal((differences.match(/<tbody>[\s\S]*?<\/tbody>/u)[0].match(/<tr>/gu) || []).length, 2);
assert.match(differences, /<td>1<\/td>[\s\S]*ΑΟ-1/u, 'rows are numbered from one');
assert.doesNotMatch(
  renderOfficialUselessDifferencesProtocol(settings, exhp).match(/<tbody>[\s\S]*?<\/tbody>/u)[0],
  /<tr>/u,
  'the differences protocol renders no blank rows'
);

const statement = renderClothingDisposalStatement(settings, exhp, {
  items: [{ nominalNumber: 'ΑΟ-9', description: 'Χιτώνιο', measurementUnit: 'ΤΕΜ', quantity: 2, quantityWords: 'δύο' }]
}, 'Α', 'Είδη <ιματισμού>');
assert.match(statement, /ΚΑΤΑΣΤΑΣΗ «Α»/u);
assert.match(statement, /Είδη &lt;ιματισμού&gt; \(Υπόδειγμα\)/u, 'the statement title is escaped');
assert.match(statement, /ΑΟ-9/u, 'nominalNumber is used when no nomenclature number exists');
assert.match(statement, /δύο/u);

console.log('exhpOfficialDocuments.test.mjs: OK');
