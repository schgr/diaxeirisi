const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { createTransactionsService } = require('../src/services/transactionsService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-document-changes-'));
  try {
    const db = await initializeDatabase(directory);
    const shares = createSharesService(db);
    const transactions = createTransactionsService(db);
    shares.addShare({
      shareNumber: '10', nominalNumber: 'AO-10', description: 'ΚΥΡΙΟ ΥΛΙΚΟ',
      materialType: 'Υλικό', projectedQuantity: 0, accountingBalance: 10, chargedQuantity: 0
    });
    const share = shares.listShares()[0];
    shares.updateShareDetails(share.id, { requiresComposition: true });
    shares.saveComposition(share.id, [{
      componentNominalNumber: 'COMP-1', componentDescription: 'ΕΞΑΡΤΗΜΑ',
      measurementUnit: 'Τεμάχια', projectedQuantity: 2, notIssuedQuantity: 0
    }]);

    transactions.saveAddy({
      documentDate: '2026-05-31', transactionUnit: 'ΜΟΝΑΔΑ',
      items: [{
        shareNumber: '10', nominalNumber: 'AO-10', description: 'ΚΥΡΙΟ ΥΛΙΚΟ',
        quantity: 3, transactionType: 'Χρέωση', measurementUnit: 'Τεμάχια', materialType: 'Υλικό'
      }]
    });
    transactions.saveExhp({
      documentDate: '2026-02-15', serviceUnit: 'ΜΟΝΑΔΑ', issueReason: 'Τακτοποίηση Διαφορών',
      items: [{
        shareNumber: '10', nominalNumber: 'AO-10', description: 'ΚΥΡΙΟ ΥΛΙΚΟ',
        quantity: 1, transactionType: 'Πίστωση', measurementUnit: 'Τεμάχια', materialType: 'Υλικό'
      }]
    });

    const entries = shares.getShareCard(share.id, 2026).changeSheetEntries;
    const addy = entries.find((entry) => entry.orderReference === 'Χ-1');
    const exhp = entries.find((entry) => entry.orderReference === 'ΕΧΠ-1');
    assert.ok(addy);
    assert.strictEqual(addy.changeDate, '2026-05-31');
    assert.strictEqual(addy.movementType, 'ΧΡΕΩΣΗ');
    assert.strictEqual(addy.quantity, 6);
    assert.ok(exhp);
    assert.strictEqual(exhp.changeDate, '2026-02-15');
    assert.strictEqual(exhp.movementType, 'ΠΙΣΤΩΣΗ');
    assert.strictEqual(exhp.quantity, 2);
    console.log('documentChangeSheet.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
