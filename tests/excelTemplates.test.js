const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ExcelJS = require('exceljs');
const { createInitialInventoryService } = require('../src/services/initialInventoryService');
const { createCompositionImportService } = require('../src/services/compositionImportService');

async function verifyHeaderOnlyTemplate(filePath, expectedColumns) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  assert.equal(workbook.worksheets.length, 1);
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
  await verifyHeaderOnlyTemplate(compositionPath, 6);
  fs.rmSync(tempDir, { recursive: true, force: true });
  console.log('Excel templates contain headers only.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
