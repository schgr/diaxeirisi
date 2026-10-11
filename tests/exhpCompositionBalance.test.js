const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { createTransactionsService } = require('../src/services/transactionsService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'exhp-composition-balance-'));
  try {
    const db = await initializeDatabase(directory);
    const shares = createSharesService(db);
    const transactions = createTransactionsService(db);
    shares.addShare({ shareNumber: '10', nominalNumber: 'AO-10', description: 'ΣΥΛΛΟΓΗ',
      materialType: 'Υλικό', measurementUnit: 'Τεμάχια', projectedQuantity: 0,
      accountingBalance: 0, chargedQuantity: 0 });
    const share = shares.getShareByNumber('10');
    shares.updateShareDetails(share.id, { requiresComposition: true });
    const composition = [1, 2].map((n) => ({ componentNominalNumber: `COMP-${n}`,
      componentDescription: `ΥΛΙΚΟ ${n}`, measurementUnit: 'Τεμάχια',
      projectedQuantity: 1, notIssuedQuantity: 0 }));
    shares.saveComposition(share.id, composition);
    const year = new Date().getFullYear();
    function save(type, quantities) {
      return transactions.saveExhp({ documentDate: `${year}-01-10`, serviceUnit: 'ΜΟΝΑΔΑ',
        issueReason: 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.',
        items: [{ shareNumber: '10', nominalNumber: 'AO-10', description: 'ΣΥΛΛΟΓΗ',
          measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: type, quantity: 0,
          composition: composition.map((item, i) => ({ ...item, projectedQuantity: quantities[i] })) }] });
    }
    save('Χρέωση', [7, 11]);
    save('Χρέωση', [3, 2]);
    const credit = save('Πίστωση', [4, 5]);
    function balances() {
      return transactions.getAddyReferenceData().shares.find((item) => item.id === share.id)
        .composition.map((item) => item.chargedQuantity);
    }
    assert.deepEqual(balances(), [6, 8]);
    const card = shares.getShareCard(share.id, year);
    const printedBalances = composition.map((_, i) => card.changeSheetEntries
      .filter((entry) => entry.componentLineNumber === i + 1)
      .reduce((total, entry) => total + (entry.movementType === 'ΠΙΣΤΩΣΗ' ? -1 : 1) * entry.quantity, 0));
    assert.deepEqual(balances(), printedBalances);
    transactions.deleteExhpDocument(credit.documentId);
    assert.deepEqual(balances(), [10, 13]);
    console.log('EXHP composition charge minus credit balance tests passed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
