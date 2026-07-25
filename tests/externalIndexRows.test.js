const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSettingsService } = require('../src/services/settingsService');
const { createTransactionsService } = require('../src/services/transactionsService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-external-index-'));
  let db;
  try {
    db = await initializeDatabase(directory);
    const transactions = createTransactionsService(db, createSettingsService(db));
    const result = transactions.saveAddy({
      documentDate: '2026-07-19',
      transactionUnit: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ',
      justificationReference: '',
      notes: '',
      items: [
        {
          shareNumber: '9001', nominalNumber: 'TEST-001', description: 'ΥΛΙΚΟ Α',
          quantity: 1, unitPrice: 1, measurementUnit: 'Τεμάχια',
          transactionType: 'Χρέωση', materialType: 'Κύριο Υλικό',
          justificationReference: 'ΔΙΚ-1'
        },
        {
          shareNumber: '9002', nominalNumber: 'TEST-002', description: 'ΥΛΙΚΟ Β',
          quantity: 1, unitPrice: 1, measurementUnit: 'Τεμάχια',
          transactionType: 'Χρέωση', materialType: 'Κύριο Υλικό',
          justificationReference: 'ΔΙΚ-1'
        }
      ]
    });

    const rows = transactions.listExternalTransactionIndexRows(2026);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.id), [result.documentId, result.documentId]);
    assert.equal(rows.every((row) => Number.isInteger(row.itemId) && row.itemId > 0), true);
    assert.notEqual(rows[0].itemId, rows[1].itemId);
    assert.deepEqual(rows.map((row) => row.serial), [1, 1]);
    assert.deepEqual(rows.map((row) => row.nominalNumber), ['TEST-001', 'TEST-002']);

    transactions.saveAddy({
      documentDate: '2026-07-20',
      transactionUnit: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ',
      justificationReference: '',
      notes: '',
      items: [
        {
          shareNumber: '9003', nominalNumber: 'TEST-003', description: 'ΥΛΙΚΟ Γ',
          quantity: 1, unitPrice: 1, measurementUnit: 'Τεμάχια',
          transactionType: 'Χρέωση', materialType: 'Κύριο Υλικό',
          justificationReference: 'ΔΙΚ-2'
        }
      ]
    });
    const rowsWithSecondDocument = transactions.listExternalTransactionIndexRows(2026);
    assert.deepEqual(rowsWithSecondDocument.map((row) => row.serial), [1, 1, 2]);

    transactions.updateAddyIndexFields(rows[0].id, {
      field7: '7', field8: '8', field9: '9'
    });
    const updated = transactions.listExternalTransactionIndexRows(2026);
    assert.equal(updated.filter((row) => row.id === result.documentId).every((row) => row.indexField7 === '7'), true);
    console.log('External index multi-material identifiers test passed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
