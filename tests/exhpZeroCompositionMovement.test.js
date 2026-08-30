const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSettingsService } = require('../src/services/settingsService');
const { createSharesService } = require('../src/services/sharesService');
const { createTransactionsService } = require('../src/services/transactionsService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-exhp-zero-composition-'));
  try {
    const db = await initializeDatabase(directory);
    const settings = createSettingsService(db);
    const shares = createSharesService(db);
    const transactions = createTransactionsService(db, settings);
    shares.addShare({
      shareNumber: '10',
      nominalNumber: 'AO-10',
      description: 'ΜΕΡΙΔΑ ΜΕ ΣΥΝΘΕΣΗ',
      materialType: 'Υλικό',
      measurementUnit: 'Τεμάχια',
      projectedQuantity: 10,
      accountingBalance: 10,
      chargedQuantity: 0
    });
    const share = shares.getShareByNumber('10');
    shares.updateShareDetails(share.id, { requiresComposition: true });
    shares.saveComposition(share.id, [{
      componentNominalNumber: 'COMP-1',
      componentDescription: 'ΕΠΙΜΕΡΟΥΣ ΥΛΙΚΟ',
      measurementUnit: 'Τεμάχια',
      projectedQuantity: 1,
      notIssuedQuantity: 0
    }]);

    const result = transactions.saveExhp({
      documentDate: '2026-08-26',
      serviceUnit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
      issueReason: 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.',
      items: [
        {
          shareNumber: '10', nominalNumber: 'AO-10', description: 'ΜΕΡΙΔΑ ΜΕ ΣΥΝΘΕΣΗ',
          measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Πίστωση',
          quantity: 0,
          composition: [{
            componentNominalNumber: 'COMP-1', componentDescription: 'ΕΠΙΜΕΡΟΥΣ ΥΛΙΚΟ',
            measurementUnit: 'Τεμάχια', projectedQuantity: 2, notIssuedQuantity: 0
          }]
        },
        {
          shareNumber: '10', nominalNumber: 'AO-10', description: 'ΜΕΡΙΔΑ ΜΕ ΣΥΝΘΕΣΗ',
          measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Χρέωση',
          quantity: 0,
          composition: [{
            componentNominalNumber: 'COMP-1', componentDescription: 'ΕΠΙΜΕΡΟΥΣ ΥΛΙΚΟ',
            measurementUnit: 'Τεμάχια', projectedQuantity: 3, notIssuedQuantity: 0
          }]
        }
      ]
    });

    assert.deepStrictEqual(result.document.items.map((item) => item.ledgerSerial), ['Φ.Μ.', 'Φ.Μ.']);
    const reopened = transactions.getExhpDocument(result.documentId);
    assert.deepStrictEqual(reopened.items.map((item) => item.quantity), [0, 0]);
    assert.deepStrictEqual(reopened.items.map((item) => item.ledgerSerial), ['Φ.Μ.', 'Φ.Μ.']);
    assert.strictEqual(shares.getShareByNumber('10').accountingBalance, 10);
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM share_transactions').get().count, 0);
    const card = shares.getShareCard(share.id, 2026);
    assert.deepStrictEqual(
      card.changeSheetEntries
        .map((entry) => [entry.movementType, entry.quantity])
        .sort((left, right) => left[0].localeCompare(right[0], 'el')),
      [['ΠΙΣΤΩΣΗ', 2], ['ΧΡΕΩΣΗ', 3]]
        .sort((left, right) => left[0].localeCompare(right[0], 'el'))
    );
    assert.ok(card.changeSheetEntries.every((entry) => /^ΕΧΠ-\d+$/u.test(entry.orderReference)));

    shares.addShare({
      shareNumber: '30', nominalNumber: 'COMP-30', description: 'ΥΛΙΚΟ ΣΥΝΘΕΣΗΣ',
      materialType: 'Υλικό', measurementUnit: 'Τεμάχια', projectedQuantity: 0,
      accountingBalance: 0, chargedQuantity: 0
    });
    const collectionCredit = transactions.saveExhp({
      documentDate: '2026-08-26', serviceUnit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
      issueReason: 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.',
      items: [{
        shareNumber: '10', nominalNumber: 'AO-10', description: 'ΜΕΡΙΔΑ ΜΕ ΣΥΝΘΕΣΗ',
        measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Πίστωση', quantity: 0,
        composition: [{
          componentNominalNumber: 'COMP-1', componentDescription: 'ΕΠΙΜΕΡΟΥΣ ΥΛΙΚΟ',
          measurementUnit: 'Τεμάχια', projectedQuantity: 2, notIssuedQuantity: 0
        }]
      }, {
        shareNumber: '30', nominalNumber: 'COMP-30', description: 'ΥΛΙΚΟ ΣΥΝΘΕΣΗΣ',
        measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Χρέωση', quantity: 2
      }]
    });
    assert.deepStrictEqual(
      collectionCredit.document.items.map((item) => item.transactionType),
      ['Πίστωση', 'Χρέωση']
    );
    assert.strictEqual(shares.getShareByNumber('30').accountingBalance, 2);
    const parentCreditEntries = shares.getShareCard(share.id, 2026).changeSheetEntries
      .filter((entry) => entry.orderReference === `ΕΧΠ-${collectionCredit.document.registryNumber}`);
    assert.deepStrictEqual(parentCreditEntries.map((entry) => entry.movementType), ['ΠΙΣΤΩΣΗ']);

    transactions.saveExhp({
      documentDate: '2026-08-27',
      serviceUnit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
      issueReason: 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.',
      items: [{
        shareNumber: '11', nominalNumber: 'AO-11', description: 'ΝΕΑ ΣΥΝΘΕΣΗ',
        measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Χρέωση',
        quantity: 1,
        createComposition: [{
          componentNominalNumber: 'COMP-2', componentDescription: 'ΝΕΟ ΕΠΙΜΕΡΟΥΣ ΥΛΙΚΟ',
          measurementUnit: 'Τεμάχια', projectedQuantity: 4, notIssuedQuantity: 0
        }],
        composition: [{
          componentNominalNumber: 'COMP-2', componentDescription: 'ΝΕΟ ΕΠΙΜΕΡΟΥΣ ΥΛΙΚΟ',
          measurementUnit: 'Τεμάχια', projectedQuantity: 4, notIssuedQuantity: 0
        }]
      }]
    });
    const createdShare = shares.getShareByNumber('11');
    assert.strictEqual(createdShare.requiresComposition, true);
    const createdCard = shares.getShareCard(createdShare.id, 2026);
    assert.strictEqual(createdCard.compositionItems.length, 1);
    assert.deepStrictEqual(
      createdCard.changeSheetEntries.map((entry) => [entry.movementType, entry.quantity]),
      [['ΧΡΕΩΣΗ', 4]]
    );

    transactions.saveExhp({
      documentDate: '2026-08-28', serviceUnit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
      issueReason: 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.',
      items: [{
        shareNumber: '12', nominalNumber: 'AO-12', description: 'ΝΕΑ ΜΗΔΕΝΙΚΗ ΣΥΝΘΕΣΗ',
        measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Πίστωση', quantity: 0,
        createComposition: [{
          componentNominalNumber: 'COMP-3', componentDescription: 'ΥΛΙΚΟ ΠΙΣΤΩΣΗΣ',
          measurementUnit: 'Τεμάχια', projectedQuantity: 1, notIssuedQuantity: 0
        }],
        composition: [{
          componentNominalNumber: 'COMP-3', componentDescription: 'ΥΛΙΚΟ ΠΙΣΤΩΣΗΣ',
          measurementUnit: 'Τεμάχια', projectedQuantity: 5, notIssuedQuantity: 0
        }]
      }]
    });
    const zeroCreditShare = shares.getShareByNumber('12');
    assert.strictEqual(zeroCreditShare.accountingBalance, 0);
    assert.deepStrictEqual(
      shares.getShareCard(zeroCreditShare.id, 2026).changeSheetEntries
        .map((entry) => [entry.movementType, entry.quantity]),
      [['ΠΙΣΤΩΣΗ', 5]]
    );

    transactions.saveExhp({
      documentDate: '2026-08-29', serviceUnit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
      issueReason: 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών Υλικών.',
      items: [{
        shareNumber: '40', nominalNumber: 'AO-40', description: 'ΝΕΑ ΜΕΡΙΔΑ ΓΕΝΙΚΗΣ ΑΙΤΙΟΛΟΓΙΑΣ',
        measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Χρέωση', quantity: 7
      }]
    });
    const generalReasonShare = shares.getShareByNumber('40');
    assert.strictEqual(generalReasonShare.accountingBalance, 7);
    assert.strictEqual(generalReasonShare.nominalNumber, 'AO-40');
    assert.strictEqual(generalReasonShare.description, 'ΝΕΑ ΜΕΡΙΔΑ ΓΕΝΙΚΗΣ ΑΙΤΙΟΛΟΓΙΑΣ');

    const addyResult = transactions.saveAddy({
      documentDate: '2026-08-02', transactionUnit: 'ΜΟΝΑΔΑ',
      items: [{
        shareNumber: '20', nominalNumber: 'AO-20', description: 'ΝΕΑ ΣΥΝΘΕΣΗ ΑΔΔΥ',
        measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Χρέωση', quantity: 1,
        createComposition: [{
          componentNominalNumber: 'COMP-A', componentDescription: 'ΥΛΙΚΟ ΑΔΔΥ',
          measurementUnit: 'Τεμάχια', projectedQuantity: 3, notIssuedQuantity: 0
        }],
        composition: [{
          componentNominalNumber: 'COMP-A', componentDescription: 'ΥΛΙΚΟ ΑΔΔΥ',
          measurementUnit: 'Τεμάχια', projectedQuantity: 3, notIssuedQuantity: 0
        }]
      }]
    });
    const addyShare = shares.getShareByNumber('20');
    assert.strictEqual(addyShare.requiresComposition, true);
    const addyEntry = shares.getShareCard(addyShare.id, 2026).changeSheetEntries[0];
    assert.strictEqual(addyEntry.orderReference, `Χ-${addyResult.documentId}`);
    assert.strictEqual(addyEntry.changeDate, '2026-08-02');
    assert.strictEqual(addyEntry.movementType, 'ΧΡΕΩΣΗ');
    assert.strictEqual(addyEntry.quantity, 3);

    assert.throws(() => transactions.saveExhp({
      documentDate: '2026-08-26',
      serviceUnit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
      issueReason: 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών Υλικών.',
      items: [{
        shareNumber: '10', nominalNumber: 'AO-10', description: 'ΜΕΡΙΔΑ ΜΕ ΣΥΝΘΕΣΗ',
        measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Χρέωση',
        quantity: 0
      }]
    }), /θετικός αριθμός/u);
    console.log('exhpZeroCompositionMovement.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
