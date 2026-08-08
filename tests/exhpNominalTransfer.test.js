const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSettingsService } = require('../src/services/settingsService');
const { createSharesService } = require('../src/services/sharesService');
const { createTransactionsService } = require('../src/services/transactionsService');
const { validateExhp, isNominalNumberTransferReason } = require('../src/transactions/exhpValidation');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-exhp-nominal-transfer-'));
  try {
    const db = await initializeDatabase(directory);
    const settings = createSettingsService(db);
    const shares = createSharesService(db);
    const transactions = createTransactionsService(db, settings);
    assert.strictEqual(
      settings.getSettings().exhpIssueReasons.find((item) => item.sortOrder === 3).name,
      'Μεταβολή Υλικών Λόγω Αλλαγής Του Αριθμού Ονομαστικού.'
    );
    const updatedSettings = settings.addExhpIssueReason({ name: 'νέα αιτιολογία ΕΧΠ - λόγω αλλαγής' });
    assert.ok(updatedSettings.exhpIssueReasons.some((item) =>
      item.name === 'Νέα Αιτιολογία ΕΧΠ - Λόγω Αλλαγής'
    ));

    shares.addShare({
      shareNumber: '10',
      nominalNumber: '1005000001',
      description: 'Δοκιμαστικό Υλικό',
      materialType: 'Υλικό',
      projectedQuantity: 10,
      accountingBalance: 10,
      chargedQuantity: 4
    });
    const source = db.prepare("SELECT * FROM shares WHERE share_number = '10'").get();
    db.prepare(`
      UPDATE shares
      SET measurement_unit = 'Τεμάχια', requires_composition = 1,
          requires_change_sheet = 1, requires_serial_number = 1,
          requires_ammunition_batch_book = 1
      WHERE id = ?
    `).run(source.id);
    shares.saveComposition(source.id, [{
      componentNominalNumber: 'COMP-1',
      componentDescription: 'Παρελκόμενο',
      measurementUnit: 'Τεμάχια',
      projectedQuantity: 1,
      notIssuedQuantity: 0,
      notes: ''
    }]);
    shares.saveChangeSheet(source.id, [{
      changeDate: '2026-01-02',
      orderReference: 'ΔΓΗ 1',
      previousValue: '',
      newValue: 'Νέο',
      changeReason: 'Δοκιμή',
      notes: '',
      componentLineNumber: 1,
      movementType: 'ΧΡΕΩΣΗ',
      quantity: 1
    }]);
    shares.saveSerialNumbers(source.id, [{ position: 1, serialNumber: 'SN-1', notes: '' }]);
    shares.saveAmmunitionBatches(source.id, [{ batchNumber: 'ΠΥΡ-1', quantity: 4, notes: '' }]);

    const departmentId = db.prepare(`
      INSERT INTO department_managers (department_name, department_head, sort_order)
      VALUES ('Τμήμα Α', 'Διαχειριστής Α', 1)
    `).run().lastInsertRowid;
    const internalDocumentId = db.prepare(`
      INSERT INTO internal_documents (
        fiscal_year, serial_number, document_date, department_manager_id,
        department_name, department_head, movement_type, notes
      ) VALUES (2026, 1, '2026-01-10', ?, 'Τμήμα Α', 'Διαχειριστής Α', 'Χορήγηση', '')
    `).run(departmentId).lastInsertRowid;
    db.prepare(`
      INSERT INTO internal_items (
        internal_document_id, share_id, share_number, nominal_number,
        description, measurement_unit, quantity, composition_snapshot
      ) VALUES (?, ?, '10', '1005000001', 'Δοκιμαστικό Υλικό', 'Τεμάχια', 4, '')
    `).run(internalDocumentId, source.id);

    const reason = 'Μεταβολή Υλικών Λόγω Αλλαγής Του Αριθμού Ονομαστικού.';
    assert.strictEqual(isNominalNumberTransferReason(reason), true);
    assert.strictEqual(
      isNominalNumberTransferReason('Μεταβολή Υλικών Λόγω Μεταβολής Του Αριθμού Ονομαστικού.'),
      false
    );
    assert.doesNotThrow(() => validateExhp({
      serviceUnit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
      issueReason: 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών Υλικών.',
      items: [{
        shareNumber: '10', nominalNumber: '1005000001', description: 'Δοκιμαστικό Υλικό',
        measurementUnit: 'Τεμάχια', transactionType: 'Πίστωση', quantity: 1
      }]
    }));
    const result = transactions.saveExhp({
      documentDate: '2026-07-22',
      serviceUnit: '108 Α/Κ ΜΜΠ/ΓΔΥ',
      issueReason: reason,
      approvalReference: 'ΔΓΗ 2/2026',
      items: [
        {
          shareNumber: '10', nominalNumber: '1005000001', description: 'Δοκιμαστικό Υλικό',
          measurementUnit: 'Τεμάχια', materialType: 'Υλικό', transactionType: 'Πίστωση',
          quantity: 10, transferGroup: 'pair-1'
        },
        {
          shareNumber: '110', sourceShareNumber: '10', nominalNumber: '1005000099',
          description: 'Δοκιμαστικό Υλικό', measurementUnit: 'Τεμάχια', materialType: 'Υλικό',
          transactionType: 'Χρέωση', quantity: 10, transferGroup: 'pair-1'
        }
      ]
    });

    assert.strictEqual(result.document.items.length, 2);
    assert.strictEqual(
      result.document.items.find((item) => item.transactionType === 'Χρέωση').nominalNumber,
      '1005000099'
    );
    const oldShare = db.prepare("SELECT * FROM shares WHERE share_number = '10'").get();
    const newShare = db.prepare("SELECT * FROM shares WHERE share_number = '110'").get();
    assert.strictEqual(oldShare.archive_status, 'Αρχειοθετημένη');
    assert.strictEqual(Number(oldShare.accounting_balance), 0);
    assert.strictEqual(Number(oldShare.charged_quantity), 0);
    assert.strictEqual(newShare.archive_status, 'Ενεργή');
    assert.strictEqual(newShare.nominal_number, '1005000099');
    assert.strictEqual(Number(newShare.accounting_balance), 10);
    assert.strictEqual(Number(newShare.charged_quantity), 4);
    assert.strictEqual(Boolean(newShare.requires_ammunition_batch_book), true);

    const movedInternal = db.prepare('SELECT * FROM internal_items WHERE id = 1').get();
    assert.strictEqual(movedInternal.share_id, newShare.id);
    assert.strictEqual(movedInternal.share_number, '110');
    assert.strictEqual(movedInternal.nominal_number, '1005000099');
    assert.strictEqual(db.prepare('SELECT share_id FROM share_composition_items').get().share_id, newShare.id);
    assert.strictEqual(db.prepare('SELECT share_id FROM share_change_sheet_entries').get().share_id, newShare.id);
    assert.strictEqual(db.prepare('SELECT share_id FROM share_serial_numbers').get().share_id, newShare.id);
    assert.strictEqual(db.prepare('SELECT share_id FROM share_ammunition_batches').get().share_id, newShare.id);

    const card = shares.getShareCard(newShare.id, 2026);
    assert.strictEqual(card.openingTransfer.balance, 0);
    assert.strictEqual(card.openingTransfer.reference, '');
    assert.strictEqual(card.transactions.length, 1);
    assert.strictEqual(card.transactions[0].imports, 10);
    assert.strictEqual(card.transactions[0].balance, 10);
    console.log('exhpNominalTransfer.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
