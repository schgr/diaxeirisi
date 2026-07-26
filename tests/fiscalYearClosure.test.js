const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { createTransactionsService } = require('../src/services/transactionsService');
const { createYearEndService } = require('../src/services/yearEndService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-year-close-'));
  try {
    const db = await initializeDatabase(directory);
    const fiscalYear = new Date().getFullYear();
    const shares = createSharesService(db);
    const transactions = createTransactionsService(db);
    const yearEnd = createYearEndService(db);

    shares.addShare(makeShare('1', 'AO-1', 10));
    shares.addShare(makeShare('2', 'AO-2', 0));
    const [active, archived] = shares.listShares();
    shares.updateShareDetails(active.id, { requiresComposition: true });
    shares.saveComposition(active.id, [{
      componentNominalNumber: 'COMP-1',
      componentDescription: 'ΕΞΑΡΤΗΜΑ',
      projectedQuantity: 2,
      notIssuedQuantity: 0
    }]);
    db.prepare(`
      UPDATE shares
      SET archive_status = 'Αρχειοθετημένη', archived_at = ?, archive_reason = 'ΔΟΚΙΜΗ'
      WHERE id = ?
    `).run(`${fiscalYear}-06-01`, archived.id);

    transactions.saveAddy({
      documentDate: `${fiscalYear}-05-31`,
      transactionUnit: 'ΜΟΝΑΔΑ',
      items: [{
        shareNumber: '1',
        nominalNumber: 'AO-1',
        description: 'ΥΛΙΚΟ 1',
        quantity: 2,
        transactionType: 'Χρέωση',
        measurementUnit: 'Τεμάχια',
        materialType: 'Υλικό'
      }]
    });

    const result = yearEnd.closeFiscalYear(fiscalYear);
    assert.strictEqual(result.nextFiscalYear, fiscalYear + 1);
    assert.strictEqual(yearEnd.getStatus().activeFiscalYear, fiscalYear + 1);
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM addy_documents').get().count, 0);
    assert.strictEqual(
      db.prepare('SELECT archive_status FROM shares WHERE id = ?').get(archived.id).archive_status,
      'Διαγραμμένη στο κλείσιμο'
    );

    const opening = db.prepare(`
      SELECT transaction_date, quantity, notes
      FROM share_transactions WHERE share_id = ?
    `).get(active.id);
    assert.strictEqual(opening.transaction_date, `${fiscalYear}-12-31`);
    assert.strictEqual(Number(opening.quantity), 12);
    assert.strictEqual(opening.notes, 'INITIAL_ANNUAL_INVENTORY');

    const closedCard = shares.getShareCard(active.id, fiscalYear);
    assert.strictEqual(closedCard.transactions.length, 1);
    assert.strictEqual(closedCard.transactions[0].registryNumber, 'Χ-1');
    assert.strictEqual(closedCard.compositionItems.length, 1);
    const nextCard = shares.getShareCard(active.id, fiscalYear + 1);
    assert.strictEqual(nextCard.openingTransfer.balance, 12);
    assert.strictEqual(nextCard.transactions.length, 0);
    assert.strictEqual(transactions.listExternalTransactionIndexRows(fiscalYear).length, 1);
    assert.throws(
      () => transactions.saveAddy({
        documentDate: `${fiscalYear}-07-01`,
        transactionUnit: 'ΜΟΝΑΔΑ',
        items: [{
          shareNumber: '1', nominalNumber: 'AO-1', description: 'ΥΛΙΚΟ 1',
          quantity: 1, transactionType: 'Χρέωση', measurementUnit: 'Τεμάχια', materialType: 'Υλικό'
        }]
      }),
      /έχει κλείσει/
    );
    assert.throws(() => yearEnd.closeFiscalYear(fiscalYear), /έχει ήδη κλείσει/);
    console.log('fiscalYearClosure.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function makeShare(shareNumber, nominalNumber, accountingBalance) {
  return {
    shareNumber,
    nominalNumber,
    description: `ΥΛΙΚΟ ${shareNumber}`,
    materialType: 'Υλικό',
    projectedQuantity: 0,
    accountingBalance,
    chargedQuantity: 0
  };
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
