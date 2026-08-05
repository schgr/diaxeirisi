const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { TEMPLATE_HEADERS, createInitialInventoryService, parseRows } = require('../src/services/initialInventoryService');
const { createCompositionImportService } = require('../src/services/compositionImportService');

async function verifyHeaderOnlyTemplate(filePath, expectedColumns, expectedSheets = 1) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  assert.equal(workbook.worksheets.length, expectedSheets);
  const sheet = workbook.worksheets[0];
  assert.equal(sheet.actualRowCount, 1);
  assert.equal(sheet.getRow(1).actualCellCount, expectedColumns);
}

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diaxeirisi-templates-'));
  const db = {};
  const initialPath = path.join(tempDir, 'initial.xlsx');
  const compositionPath = path.join(tempDir, 'composition.xlsx');

  await createInitialInventoryService(db).writeTemplate(initialPath);
  await createCompositionImportService(db).writeTemplate(compositionPath);

  await verifyHeaderOnlyTemplate(initialPath, 8);
  const initialRows = parseRows([
    TEMPLATE_HEADERS,
    [1, '10', '', 'Υλικό χωρίς αριθμό ονομαστικού', 'Τεμάχια', 1, '', 'Αναλώσιμα']
  ]);
  assert.equal(initialRows[0].nominalNumber, '');
  await verifyHeaderOnlyTemplate(compositionPath, 6, 2);
  const compositionWorkbook = new ExcelJS.Workbook();
  await compositionWorkbook.xlsx.readFile(compositionPath);
  const instructions = compositionWorkbook.getWorksheet('Οδηγίες');
  assert.ok(instructions);
  assert.match(String(instructions.getCell('B3').value), /προαιρετική/);
  assert.match(String(instructions.getCell('B6').value), /31-12/);
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('Excel templates and composition instructions are valid.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
