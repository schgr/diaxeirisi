const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const {
  COMPOSITION_HEADERS,
  createCompositionImportService
} = require('../src/services/compositionImportService');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-composition-import-'));
  try {
    const db = await initializeDatabase(root);
    const shares = createSharesService(db);
    const importer = createCompositionImportService(db);
    let [share] = shares.addShare({
      shareNumber: '13', nominalNumber: 'MAIN-13', description: 'Κύριο υλικό',
      materialType: 'Αναλώσιμα', projectedQuantity: 10, accountingBalance: 10, chargedQuantity: 0
    });
    db.prepare(`
      INSERT INTO share_transactions (
        share_id, transaction_date, transaction_unit, transaction_type,
        document_reference, quantity, notes
      ) VALUES (?, ?, 'ΑΡΧΙΚΗ ΑΠΟΓΡΑΦΗ', 'Χρέωση', 'TEST', 10, 'TEST_OPENING')
    `).run(share.id, `${new Date().getFullYear()}-01-01`);

    const input = path.join(root, 'compositions.xlsx');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Συνθέσεις');
    sheet.addRow(COMPOSITION_HEADERS);
    sheet.addRow(['13', 'COMP-1', 'Εξάρτημα', 'Τεμάχια', 15, 100]);
    await workbook.xlsx.writeFile(input);

    const result = await importer.importWorkbook(input);
    assert.strictEqual(result.updatedShares, 1);
    assert.strictEqual(result.importedRows, 1);
    const card = shares.getShareCard(share.id, new Date().getFullYear());
    assert.strictEqual(card.share.requiresComposition, true);
    assert.strictEqual(card.compositionItems[0].projectedQuantity, 150);
    assert.strictEqual(card.compositionItems[0].quantityPerMaterial, 15);
    assert.strictEqual(card.compositionItems[0].measurementUnit, 'Τεμάχια');
    assert.strictEqual(card.compositionItems[0].notIssuedQuantity, 50);
    assert.strictEqual(card.changeSheetEntries.length, 1);
    assert.strictEqual(card.changeSheetEntries[0].changeDate, `${new Date().getFullYear() - 1}-12-31`);
    assert.strictEqual(card.changeSheetEntries[0].orderReference, 'ΑΠΟΓΡΑΦΗ');
    assert.strictEqual(card.changeSheetEntries[0].movementType, 'ΧΡΕΩΣΗ');
    assert.strictEqual(card.changeSheetEntries[0].quantity, 100);

    const output = path.join(root, 'composition-template.xlsx');
    await importer.writeTemplate(output);
    const exported = new ExcelJS.Workbook();
    await exported.xlsx.readFile(output);
    assert.deepStrictEqual(exported.worksheets[0].getRow(1).values.slice(1), COMPOSITION_HEADERS);
    assert.strictEqual(exported.worksheets[0].actualRowCount, 1);
    console.log('compositionImport.test.js: OK');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
