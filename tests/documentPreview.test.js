const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

// Exercise Chromium's real zoom/layout, including print media and resizing.
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'document-preview-'));
const ui = pathToFileURL(path.resolve('src/ui')).href + '/';
const script = `
const { app, BrowserWindow } = require('electron');
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1366, height: 768, useContentSize: true, webPreferences: { backgroundThrottling: false, offscreen: true } });
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error') console.error(event.message);
  });
  try {
    await win.loadFile(${JSON.stringify(path.join(directory, 'fixture.html'))});
    await win.webContents.executeJavaScript(\`(async () => {
      const { initializeDocumentPreviews } = await import('${ui}prints/printPreview.js');
      const { renderMaterialRegistryPages } = await import('${ui}prints/shareRegistryPrint.js');
      const { renderMovementDifferencesIndex, renderBalanceDifferenceTable } = await import('${ui}prints/administrationPrint.js');
      window.documents = [
        renderMaterialRegistryPages([], { serviceInfo: { serviceName: 'ΜΟΝΑΔΑ' } }, { displayCount: 56 }),
        renderMovementDifferencesIndex({ serviceInfo: { serviceName: 'ΜΟΝΑΔΑ' } }, []),
        renderBalanceDifferenceTable(Array.from({ length: 36 }, (_, i) => ({ sourceType: 'Σύνθεση', shareNumber: i + 1, description: 'ΥΛΙΚΟ', parentDescription: 'ΠΕΡΙΓΡΑΦΗ', existingQuantity: 4, chargedQuantity: 1, differenceQuantity: 3, status: 'Έλλειμμα' })))
      ];
      initializeDocumentPreviews();
      window.showDocument = (index) => {
        document.body.innerHTML = '<div class="modal-backdrop"><div class="request-document-modal index-document-preview-modal"><header class="material-card-header"><h2>Προεπισκόπηση</h2><button>Εκτύπωση</button></header><div class="index-document-preview-content">' + window.documents[index] + '</div></div></div>';
      };
    })()\`);
    const settle = () => win.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 100))');
    for (const [width, height] of [[1366, 768], [1024, 600], [1920, 1080]]) {
      win.setContentSize(width, height);
      for (let index = 0; index < 3; index++) {
        await win.webContents.executeJavaScript('showDocument(' + index + ')');
        await settle();
        const result = await win.webContents.executeJavaScript(\`(() => {
          const viewport = document.querySelector('.document-preview-viewport');
          const pages = [...viewport.querySelectorAll('[data-preview-paper]')];
          if (!pages.length) return { html: viewport.outerHTML.slice(0, 500) };
          const first = pages[0].getBoundingClientRect();
          const bounds = viewport.getBoundingClientRect();
          const table = pages[0].querySelector('table').getBoundingClientRect();
          const footer = pages[0].querySelector('.registry-footer, .balance-differences-page-number, .index-page-number');
          return { fits: first.width <= viewport.clientWidth && first.height <= viewport.clientHeight && first.top >= bounds.top && first.bottom <= bounds.bottom,
            tableInside: table.bottom <= first.bottom && table.right <= first.right,
            footerClear: !footer || table.bottom <= footer.getBoundingClientRect().top,
            modalFits: viewport.parentElement.getBoundingClientRect().bottom <= innerHeight,
            count: document.querySelectorAll('.document-preview-tools').length,
            separate: pages.length < 2 || pages[1].getBoundingClientRect().top >= first.bottom };
        })()\`);
        if (!result.fits || !result.tableInside || !result.footerClear || !result.modalFits || result.count !== 1 || !result.separate) throw Error(JSON.stringify({ width, height, index, result }));
        if (width === 1366 && index === 2 && process.env.PREVIEW_SCREENSHOT) {
          require('node:fs').writeFileSync(process.env.PREVIEW_SCREENSHOT, (await win.webContents.capturePage()).toPNG());
        }
      }
    }
    win.setContentSize(1024, 600);
    await win.webContents.executeJavaScript('showDocument(1)');
    await settle();
    for (const mode of ['width', 'actual']) {
      await win.webContents.executeJavaScript("(() => { const select = document.querySelector('.document-preview-tools select'); select.value = '" + mode + "'; select.dispatchEvent(new Event('change')); })()");
      await settle();
      const zoom = await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('[data-preview-paper]')).zoom");
      if (mode === 'width' && !(Number(zoom) > 0.5 && Number(zoom) < 1)) throw Error('Fit width mode failed');
      if (mode === 'actual' && Number(zoom) !== 1) throw Error('100% mode failed');
    }
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
    const printZoom = await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('[data-preview-paper]')).zoom");
    if (Number(printZoom) !== 1) throw Error('Preview zoom leaked into print');
    console.log('Document preview Chromium checks passed at three resolutions, including zoom and print.');
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
`;
try {
  fs.writeFileSync(path.join(directory, 'fixture.html'), `<html><head><meta charset="utf-8"><link rel="stylesheet" href="${ui}styles.css"></head><body></body></html>`);
  fs.writeFileSync(path.join(directory, 'check.cjs'), script);
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [path.join(directory, 'check.cjs')], { env: environment, encoding: 'utf8', timeout: 45000 });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  console.log(result.stdout.trim());
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
