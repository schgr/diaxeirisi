const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const ExcelJS = require('exceljs');
const {
  sanitizeExportFilename,
  writeExcelExport,
  writeWordExport
} = require('../src/services/documentExportService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-document-export-'));
  try {
    const title = 'Μητρώο / Πλεονάσματα: Ελλείμματα';
    assert.strictEqual(
      sanitizeExportFilename(title),
      'Μητρώο Πλεονάσματα Ελλείμματα'
    );

    const excelPath = path.join(directory, 'Κατάσταση.xlsx');
    await writeExcelExport(excelPath, {
      title: 'Κατάσταση',
      tables: [{
        name: 'Πλεονάσματα - Ελλείμματα',
        rows: [
          ['Μερίδα', 'Περιγραφή', 'Διαφορά'],
          ['12', 'ΥΛΙΚΟ ΔΟΚΙΜΗΣ', 1]
        ]
      }]
    });
    assert.ok(fs.statSync(excelPath).size > 0);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(excelPath);
    const sheet = workbook.worksheets[0];
    assert.strictEqual(sheet.getCell('A1').value, 'Μερίδα');
    assert.strictEqual(sheet.getCell('C2').value, 1);

    const wordPath = path.join(directory, 'Κατάσταση.doc');
    writeWordExport(wordPath, {
      title: 'Κατάσταση Πλεονασμάτων',
      html: '<table><tr><th>Μερίδα</th></tr><tr><td>12</td></tr></table>'
    });
    const word = fs.readFileSync(wordPath, 'utf8');
    assert.match(word, /Κατάσταση Πλεονασμάτων/);
    assert.match(word, /<table>/);
    console.log('documentExport.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
