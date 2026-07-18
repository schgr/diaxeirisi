const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSettingsService } = require('../src/services/settingsService');
const { createTransactionsService } = require('../src/services/transactionsService');

async function run() {
  const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-financial-year-'));
  try {
    const { renderFinancialYearMovementTable } = await import('../src/ui/pages/financialYearTasksPage.js');
    const db = await initializeDatabase(testDirectory);
    const transactions = createTransactionsService(db, createSettingsService(db));

    transactions.saveAddy({
      documentDate: '2026-02-03',
      transactionUnit: 'ΕΜΠΟΡΙΟ',
      notes: '',
      items: [{
        shareNumber: '1', nominalNumber: 'TEST-1', description: 'Υλικό δοκιμής',
        quantity: 10, unitPrice: 1, measurementUnit: 'Τεμάχια',
        transactionType: 'Χρέωση', materialType: 'Κύριο Υλικό'
      }]
    });
    transactions.saveExhp({
      fiscalYear: 2026,
      documentDate: '2026-02-04',
      serviceUnit: 'ΔΟΚΙΜΑΣΤΙΚΗ ΜΟΝΑΔΑ',
      issueReason: 'Τακτοποίηση Διαφορών.',
      approvalReference: '', notes: '', supports: [],
      items: [{
        shareNumber: '1', nominalNumber: 'TEST-1', description: 'Υλικό δοκιμής',
        measurementUnit: 'Τεμάχια', materialType: 'Αναλώσιμα', materialCode: '',
        transactionType: 'Πίστωση', quantity: 4, supportingDocuments: ''
      }]
    });

    assert.deepStrictEqual(transactions.listFinancialYearMovementRows('addy', 2026, 'Χρέωση'), [{
      serial: 1, shareNumber: '1', ledgerSerial: 1, transactionKind: 'Χ',
      date: '2026-02-03', quantity: 10, transactionUnit: 'ΕΜΠΟΡΙΟ'
    }]);
    const exhpRows = transactions.listFinancialYearMovementRows('exhp', 2026, 'Πίστωση');
    assert.strictEqual(exhpRows.length, 1);
    assert.strictEqual(exhpRows[0].ledgerSerial, 2);
    assert.strictEqual(exhpRows[0].transactionKind, 'Π');
    assert.strictEqual(Object.hasOwn(exhpRows[0], 'transactionUnit'), false);
    const addyHtml = renderFinancialYearMovementTable(
      transactions.listFinancialYearMovementRows('addy', 2026, 'Χρέωση'),
      'addy',
      'Χρέωση'
    );
    const exhpHtml = renderFinancialYearMovementTable(exhpRows, 'exhp', 'Πίστωση');
    assert.match(addyHtml, /ΜΟΝΑΔΑ ΔΟΣΟΛΗΨΙΑΣ/);
    assert.match(addyHtml, /ΕΜΠΟΡΙΟ/);
    assert.doesNotMatch(exhpHtml, /ΜΟΝΑΔΑ ΔΟΣΟΛΗΨΙΑΣ/);
    assert.match(exhpHtml, />Π</);
    assert.deepStrictEqual(transactions.listFinancialYearMovementRows('addy', 2025, 'Χρέωση'), []);
    assert.throws(() => transactions.listFinancialYearMovementRows('invalid', 2026, 'Χρέωση'));
    assert.throws(() => transactions.listFinancialYearMovementRows('addy', 2026, 'Άλλο'));
    console.log('financialYearMovements.test.js: OK');
  } finally {
    fs.rmSync(testDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
