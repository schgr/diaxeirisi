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
    const zeroQuantityShare = shares.addShare({
      shareNumber: '14', nominalNumber: 'MAIN-14', description: 'Κύριο υλικό χωρίς υπάρχουσα σύνθεση',
      materialType: 'Αναλώσιμα', projectedQuantity: 5, accountingBalance: 5, chargedQuantity: 0
    }).find((item) => item.shareNumber === '14');
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
    sheet.addRow(['13', 'COMP-1', 'Εξάρτημα εναλλακτικής περιγραφής', 'Τεμάχια', 3, 20]);
    sheet.addRow(['13', '', 'Εξάρτημα χωρίς αριθμό ονομαστικού', 'Τεμάχια', 2, 5]);
    sheet.addRow(['14', 'COMP-0', 'Εξάρτημα με μηδενική απογραφή', 'Τεμάχια', 1, 0]);
    await workbook.xlsx.writeFile(input);

    const inventoryDate = `${new Date().getFullYear() - 1}-12-31`;
    const result = await importer.importWorkbook(input, inventoryDate);
    assert.strictEqual(result.updatedShares, 2);
    assert.strictEqual(result.importedRows, 4);
    const card = shares.getShareCard(share.id, new Date().getFullYear());
    assert.strictEqual(card.share.requiresComposition, true);
    assert.strictEqual(card.compositionItems[0].projectedQuantity, 150);
    assert.strictEqual(card.compositionItems[0].quantityPerMaterial, 15);
    assert.strictEqual(card.compositionItems[0].measurementUnit, 'Τεμάχια');
    assert.strictEqual(card.compositionItems[0].notIssuedQuantity, 50);
    assert.strictEqual(card.compositionItems[1].componentNominalNumber, 'COMP-1');
    assert.strictEqual(card.compositionItems[1].componentDescription, 'Εξάρτημα εναλλακτικής περιγραφής');
    assert.strictEqual(card.compositionItems[2].componentNominalNumber, '');
    assert.strictEqual(card.changeSheetEntries.length, 3);
    assert.strictEqual(card.changeSheetEntries[0].changeDate, `${new Date().getFullYear() - 1}-12-31`);
    assert.strictEqual(card.changeSheetEntries[0].orderReference, 'Απογραφή');
    assert.strictEqual(card.changeSheetEntries[0].movementType, 'ΧΡΕΩΣΗ');
    assert.strictEqual(card.changeSheetEntries[0].quantity, 100);
    const zeroQuantityCard = shares.getShareCard(zeroQuantityShare.id, new Date().getFullYear());
    assert.strictEqual(zeroQuantityCard.changeSheetEntries.length, 1);
    assert.strictEqual(zeroQuantityCard.changeSheetEntries[0].changeDate, inventoryDate);
    assert.strictEqual(zeroQuantityCard.changeSheetEntries[0].orderReference, 'Απογραφή');
    assert.strictEqual(zeroQuantityCard.changeSheetEntries[0].quantity, 0);

    const preflightShareA = shares.addShare({
      shareNumber: 'PRE-A', nominalNumber: 'PRE-A-MAIN', description: 'Μερίδα preflight A',
      materialType: 'Αναλώσιμα', projectedQuantity: 1, accountingBalance: 1, chargedQuantity: 0
    }).find((item) => item.shareNumber === 'PRE-A');
    const preflightShareB = shares.addShare({
      shareNumber: 'PRE-B', nominalNumber: 'PRE-B-MAIN', description: 'Μερίδα preflight B',
      materialType: 'Αναλώσιμα', projectedQuantity: 1, accountingBalance: 1, chargedQuantity: 0
    }).find((item) => item.shareNumber === 'PRE-B');
    assert.throws(
      () => importer.importMatrix([
        COMPOSITION_HEADERS,
        ['PRE-A', 'PRE-A-COMP', 'Έγκυρο εξάρτημα', 'Τεμάχια', 1, 1],
        ['UNKNOWN-SHARE', 'UNKNOWN-COMP', 'Ανύπαρκτη μερίδα', 'Τεμάχια', 1, 1]
      ], inventoryDate),
      (error) => error && error.code === 'VALIDATION_ERROR'
    );
    [preflightShareA, preflightShareB].forEach((candidate) => {
      const card = shares.getShareCard(candidate.id, new Date().getFullYear());
      assert.strictEqual(card.share.requiresComposition, false);
      assert.strictEqual(card.compositionItems.length, 0);
      assert.strictEqual(card.changeSheetEntries.length, 0);
    });

    const rollbackShares = ['ROLLBACK-1', 'ROLLBACK-2', 'ROLLBACK-3'].map((shareNumber) =>
      shares.addShare({
        shareNumber,
        nominalNumber: `${shareNumber}-MAIN`,
        description: `Μερίδα ${shareNumber}`,
        materialType: 'Αναλώσιμα', projectedQuantity: 1, accountingBalance: 1, chargedQuantity: 0
      }).find((item) => item.shareNumber === shareNumber)
    );
    db.exec(`
      CREATE TRIGGER fail_composition_import_change_sheet
      BEFORE INSERT ON share_change_sheet_entries
      WHEN NEW.share_id = ${rollbackShares[2].id}
      BEGIN
        SELECT RAISE(ABORT, 'FORCED_COMPOSITION_IMPORT_FAILURE');
      END
    `);
    assert.throws(
      () => importer.importMatrix([
        COMPOSITION_HEADERS,
        ['ROLLBACK-1', 'ROLLBACK-1-COMP', 'Εξάρτημα 1', 'Τεμάχια', 1, 1],
        ['ROLLBACK-2', 'ROLLBACK-2-COMP', 'Εξάρτημα 2', 'Τεμάχια', 1, 1],
        ['ROLLBACK-3', 'ROLLBACK-3-COMP', 'Εξάρτημα 3', 'Τεμάχια', 1, 1]
      ], inventoryDate),
      /FORCED_COMPOSITION_IMPORT_FAILURE/
    );
    rollbackShares.forEach((candidate) => {
      const card = shares.getShareCard(candidate.id, new Date().getFullYear());
      assert.strictEqual(card.share.requiresComposition, false);
      assert.strictEqual(card.compositionItems.length, 0);
      assert.strictEqual(card.changeSheetEntries.length, 0);
    });

    const output = path.join(root, 'composition-template.xlsx');
    await importer.writeTemplate(output);
    const exported = new ExcelJS.Workbook();
    await exported.xlsx.readFile(output);
    assert.deepStrictEqual(exported.worksheets[0].getRow(1).values.slice(1), COMPOSITION_HEADERS);
    assert.strictEqual(exported.worksheets[0].actualRowCount, 1);
    assert.strictEqual(exported.worksheets.length, 2);
    assert.strictEqual(exported.worksheets[1].name, 'Οδηγίες');
    console.log('compositionImport.test.js: OK');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
