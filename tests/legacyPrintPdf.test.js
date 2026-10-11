const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

// Set LEGACY_PRINT_ELECTRON to an Electron 22 executable to check the exact
// Windows 7 renderer. Never opens a PDF reader or sends a physical print job.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'legacy-pdf-check-'));
const ui = pathToFileURL(path.resolve('src/ui')).href + '/';
const mainPath = path.resolve('src/main.js');
const script = `
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false, offscreen: true } });
  try {
    await win.loadFile(${JSON.stringify(path.join(directory, 'fixture.html'))});
    const source = fs.readFileSync(${JSON.stringify(mainPath)}, 'utf8');
    const block = source.slice(source.indexOf('async function printCurrentDocument('), source.indexOf('\\nasync function safeInvoke('));
    let openedPdf;
    const openedPdfs = [];
    const printCurrentDocument = vm.runInNewContext(block + '; printCurrentDocument', {
      isWindows7Legacy: true, BrowserWindow, fs, path,
      app: { getPath: () => ${JSON.stringify(directory)} },
      sanitizeExportFilename: value => value || 'Δοκιμή',
      shell: { openPath: async filename => { openedPdf = fs.readFileSync(filename); openedPdfs.push(openedPdf); return ''; } }
    });
    for (const landscape of [true, false]) {
      await win.webContents.executeJavaScript('(' + (async function(landscape) {
        const { renderAddyDocument } = await import('${ui}transactions/addyPrint.js');
        const paper = landscape
          ? renderAddyDocument({ id: 1, documentDate: '2026-10-09', items: [{ transactionType: 'Πίστωση', column1: 'ΜΟΝΑΔΑ', column12: '1005007265655', column13: 'ΔΟΚΙΜΗ ΕΚΤΥΠΩΣΗΣ ΑΔΔΥ', column22: 1 }] })
          : '<article class="weapon-registry-print print-document-area"><h1>ΜΗΤΡΩΟ ΟΠΛΙΣΜΟΥ</h1></article>';
        if (landscape) window.addyFixture = paper;
        document.body.dataset.isolatedDocumentPrint = 'true';
        document.body.dataset.addyPrintTarget = landscape ? 'addy' : 'composition';
        document.body.innerHTML = '<div class="isolated-print-root">' + paper + '</div>';
        await Promise.all([...document.images].map(image => image.decode()));
        await document.fonts.ready;
      }).toString() + ')(' + landscape + ')');
      const result = await printCurrentDocument(win.webContents, { landscape, title: 'Δοκιμή' });
      assert.equal(result.openedPdf, true);
      assert.equal(result.printed, false);
      const boxes = [...openedPdf.toString('latin1').matchAll(/\\/MediaBox\\s*\\[\\s*0\\s+0\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\]/g)];
      assert.equal(boxes.length, 1, 'The document must fit on exactly one A4 page');
      const width = Number(boxes[0][1]);
      const height = Number(boxes[0][2]);
      assert.ok(Math.abs(width - (landscape ? 842 : 595)) < 2, 'Incorrect PDF width: ' + width);
      assert.ok(Math.abs(height - (landscape ? 595 : 842)) < 2, 'Incorrect PDF height: ' + height);
    }
    await win.webContents.executeJavaScript(\`delete document.body.dataset.addyPrintTarget;
      document.body.innerHTML = '<div class="isolated-print-root">' + window.addyFixture + '<article class="weapon-registry-print print-document-area" style="page:portrait"><h1>ΜΗΤΡΩΟ ΟΠΛΙΣΜΟΥ</h1></article></div>';\`);
    await printCurrentDocument(win.webContents, { landscape: false, mixedOrientation: true, title: 'Μικτό έντυπο' });
    const mixedBoxes = openedPdfs.slice(-2).flatMap(pdf => [...pdf.toString('latin1').matchAll(/\\/MediaBox\\s*\\[\\s*0\\s+0\\s+([\\d.]+)\\s+([\\d.]+)\\s*\\]/g)]);
    assert.equal(mixedBoxes.length, 2);
    assert.ok(Number(mixedBoxes[0][1]) > Number(mixedBoxes[0][2]), 'Mixed landscape page lost orientation');
    assert.ok(Number(mixedBoxes[1][1]) < Number(mixedBoxes[1][2]), 'Mixed portrait page lost orientation');
    console.log('Electron ' + process.versions.electron + ': actual ADDY PDF is landscape A4; portrait PDF is portrait A4.');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
`;
try {
  fs.writeFileSync(path.join(directory, 'fixture.html'), `<html><head><meta charset="utf-8"><base href="${ui}"><link rel="stylesheet" href="styles.css"></head><body></body></html>`);
  fs.writeFileSync(path.join(directory, 'check.cjs'), script);
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(process.env.LEGACY_PRINT_ELECTRON || require('electron'), [path.join(directory, 'check.cjs')], {
    env: environment, encoding: 'utf8', timeout: 45000
  });
  assert.equal(result.status, 0, `${result.error || ''}\n${result.stdout}\n${result.stderr}`);
  console.log(result.stdout.trim());
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
