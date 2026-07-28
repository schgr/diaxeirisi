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
      orientation: 'landscape',
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
    assert.strictEqual(sheet.pageSetup.orientation, 'landscape');

    const continuousExcelPath = path.join(directory, 'Κ2310.xlsx');
    await writeExcelExport(continuousExcelPath, {
      title: 'Κ2310',
      orientation: 'landscape',
      singleWorksheet: true,
      tables: [
        { name: 'Σελίδα 1', rows: [['Α'], ['1']] },
        { name: 'Σελίδα 2', rows: [['Β'], ['2']] }
      ]
    });
    const continuousWorkbook = new ExcelJS.Workbook();
    await continuousWorkbook.xlsx.readFile(continuousExcelPath);
    assert.strictEqual(continuousWorkbook.worksheets.length, 1);
    assert.strictEqual(continuousWorkbook.worksheets[0].getCell('A1').value, 'Α');
    assert.strictEqual(continuousWorkbook.worksheets[0].getCell('A3').value, 'Β');

    const wordPath = path.join(directory, 'Κατάσταση.doc');
    writeWordExport(wordPath, {
      title: 'Κατάσταση Πλεονασμάτων',
      orientation: 'portrait',
      html: '<table><tr><th>Μερίδα</th></tr><tr><td>12</td></tr></table>'
    });
    const word = fs.readFileSync(wordPath, 'utf8');
    assert.match(word, /Κατάσταση Πλεονασμάτων/);
    assert.match(word, /<table>/);
    assert.match(word, /size: 595\.3pt 841\.9pt/);
    assert.match(word, /mso-page-orientation: portrait/);

    const landscapeWordPath = path.join(directory, 'Κατάσταση landscape.doc');
    writeWordExport(landscapeWordPath, {
      title: 'Οριζόντια Κατάσταση',
      orientation: 'landscape',
      html: '<table><tr><td>1</td></tr></table>'
    });
    const landscapeWord = fs.readFileSync(landscapeWordPath, 'utf8');
    assert.match(landscapeWord, /size: 841\.9pt 595\.3pt/);
    assert.match(landscapeWord, /mso-page-orientation: landscape/);

    const { isExportablePrintLabel } = await import('../src/ui/documentExport.js');
    assert.strictEqual(isExportablePrintLabel('Εκτύπωση'), true);
    assert.strictEqual(isExportablePrintLabel('Εκτύπωση Κατάστασης'), true);
    assert.strictEqual(isExportablePrintLabel('Πίσω στις Εκτυπώσεις'), false);
    assert.strictEqual(isExportablePrintLabel('Συγκεντρωτικές Εκτυπώσεις'), false);

    const { renderBalanceDifferenceControls } = await import('../src/ui/pages/printsPage.js');
    const controls = renderBalanceDifferenceControls(
      { balanceDifferenceFilter: 'all' },
      [{ status: 'Έλλειμμα' }, { status: 'Πλεόνασμα' }]
    );
    assert.strictEqual((controls.match(/id="print-current-document"/g) || []).length, 1);
    assert.doesNotMatch(controls, /data-print-balance-differences/);
    console.log('documentExport.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
