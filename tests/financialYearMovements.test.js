const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSettingsService } = require('../src/services/settingsService');
const { createTransactionsService } = require('../src/services/transactionsService');

async function run() {
  const pageSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'pages', 'financialYearTasksPage.js'), 'utf8');
  const actionsPosition = pageSource.indexOf('data-year-prints-toggle');
  const resultsPosition = pageSource.indexOf('data-year-prints-results');
  assert(actionsPosition > -1 && actionsPosition < resultsPosition);
  assert.match(pageSource, /data-year-prints-scroll-top[^>]*>Επιστροφή στην αρχή/u);
  assert.match(pageSource, /yearPrintsDetail\.querySelector\('\[data-year-prints-start\]'\)\?\.scrollIntoView/u);
  const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-financial-year-'));
  try {
    const {
      renderFinancialYearMovementTable,
      renderMovedShareCardsTable,
      sortMovedShareCards
    } = await import('../src/ui/pages/financialYearTasksPage.js');
    const db = await initializeDatabase(testDirectory);
    const transactions = createTransactionsService(db, createSettingsService(db));

    transactions.saveAddy({
      documentDate: '2026-02-03',
      transactionUnit: '104 Α/Κ ΠΜΠ/ΓΔΥ',
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
    transactions.saveAddy({
      documentDate: '2026-03-01',
      transactionUnit: '104 Α/Κ ΠΜΠ/ΓΔΥ',
      notes: '',
      items: [{
        shareNumber: '1', nominalNumber: 'TEST-1', description: 'Υλικό δοκιμής',
        quantity: 1, unitPrice: 1, measurementUnit: 'Τεμάχια',
        transactionType: 'Πίστωση', materialType: 'Κύριο Υλικό'
      }]
    });

    assert.deepStrictEqual(transactions.listFinancialYearMovementRows('addy', 2026, 'Χρέωση'), [{
      serial: 1, registryNumber: 1, shareNumber: '1', ledgerSerial: 1,
      description: 'Υλικό δοκιμής', transactionKind: 'Χ',
      date: '2026-02-03', quantity: 10, transactionUnit: '104 Α/Κ ΠΜΠ/ΓΔΥ'
    }]);
    const exhpRows = transactions.listFinancialYearMovementRows('exhp', 2026, 'Πίστωση');
    assert.strictEqual(exhpRows.length, 1);
    assert.strictEqual(exhpRows[0].registryNumber, 1);
    assert.strictEqual(exhpRows[0].ledgerSerial, 2);
    assert.strictEqual(exhpRows[0].transactionKind, 'Π');
    assert.strictEqual(Object.hasOwn(exhpRows[0], 'transactionUnit'), false);
    const addyCreditRows = transactions.listFinancialYearMovementRows('addy', 2026, 'Πίστωση');
    assert.strictEqual(addyCreditRows.length, 1);
    assert.strictEqual(addyCreditRows[0].registryNumber, 2);
    const addyHtml = renderFinancialYearMovementTable(
      transactions.listFinancialYearMovementRows('addy', 2026, 'Χρέωση'),
      'addy',
      'Χρέωση'
    );
    const exhpHtml = renderFinancialYearMovementTable(exhpRows, 'exhp', 'Πίστωση');
    assert.match(addyHtml, /ΜΟΝΑΔΑ ΔΟΣΟΛΗΨΙΑΣ/);
    assert.match(addyHtml, /ΑΡΙΘΜΟΣ ΕΥΡΕΤΗΡΙΟΥ/);
    assert.match(addyHtml, /ΠΕΡΙΓΡΑΦΗ/);
    assert.match(addyHtml, /class="financial-year-movement-table"/);
    assert.match(addyHtml, /class="financial-year-description-cell">Υλικό δοκιμής/);
    assert.match(exhpHtml, /Υλικό δοκιμής/);
    assert.match(addyHtml, /104 Α\/Κ ΠΜΠ\/ΓΔΥ/);
    assert.doesNotMatch(exhpHtml, /ΜΟΝΑΔΑ ΔΟΣΟΛΗΨΙΑΣ/);
    assert.match(exhpHtml, />Π</);
    const movedCardsHtml = renderMovedShareCardsTable([{
      share: { id: 1, shareNumber: '1', nominalNumber: 'TEST-1', description: 'Υλικό δοκιμής' },
      transactions: [{ id: 1 }],
      compositionItems: [{ id: 1 }]
    }]);
    assert.match(movedCardsHtml, /Καρτέλα και Φύλλο Μεταβολών/);
    assert.match(movedCardsHtml, /data-year-print-card="1"/);
    assert.deepStrictEqual(
      sortMovedShareCards([
        { share: { shareNumber: '145' } },
        { share: { shareNumber: '14' } },
        { share: { shareNumber: '3' } }
      ]).map((card) => card.share.shareNumber),
      ['3', '14', '145']
    );
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
