const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'form-layout-'));
const ui = pathToFileURL(path.resolve('src/ui')).href + '/';
assert.match(fs.readFileSync('src/ui/pages/chargesPage.js', 'utf8'), /class="request-document-preview" data-k2310-pages/);
const script = `
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 1366, height: 900, useContentSize: true, webPreferences: { backgroundThrottling: false, offscreen: true } });
  win.webContents.on('console-message', event => { if (event.level === 'error') console.error(event.message); });
  try {
    await win.loadFile(${JSON.stringify(path.join(directory, 'fixture.html'))});
    await win.webContents.executeJavaScript(\`(async () => {
      const { renderK2310Pages } = await import('${ui}pages/chargesPage.js');
      const { renderOfficialHandoverProtocol } = await import('${ui}handoverProtocol.js');
      const { renderWeaponRegistry, bindControlledMaterialEvents } = await import('${ui}administration/controlledMaterials.js');
      const { renderAddyCompositionDocument } = await import('${ui}transactions/addyPrint.js');
      const { renderSharePrintDocument } = await import('${ui}shares/sharePrint.js');
      const { renderChargeCreditOrdersIndex } = await import('${ui}prints/indexPrint.js');
      const { renderSharesTableHeader, renderRows } = await import('${ui}shares/shareList.js');
      const { initializeDocumentPreviews } = await import('${ui}prints/printPreview.js');
      const financialOfficers = { ped: 'Τχης (ΠΒ) Αντωνιάδης Ευάγγελος', manager: 'Λγός (ΦΠΒ) Αλεξανδρής Ιωάννης' };
      window.fixtures = {};
      document.body.innerHTML = '<table class="shares-table"><thead>' + renderSharesTableHeader(false) + '</thead><tbody>' + renderRows([{ id: 1, shareNumber: '1', nominalNumber: '1005007265655', mainMaterialNumber: '1161' }]) + '</tbody></table>';
      if (![...document.querySelectorAll('th:nth-child(-n+3), td:nth-child(-n+3)')].every(e => getComputedStyle(e).textAlign === 'center')) throw Error('Share numbers must align like quantity columns');
      if (document.querySelector('th:nth-child(3) br')) throw Error('Share headers must wrap naturally');
      fixtures.orders = renderChargeCreditOrdersIndex({ serviceInfo: { serviceName: '108 Α/Κ ΜΜΠ/ΔΥ' } }, []);
      fixtures.k2310 = renderK2310Pages('108 Α/Κ ΜΜΠ/ΔΥ', { departmentName: 'Α ΠΥΡΧΙΑ', departmentHead: 'Λγος (ΠΒ) Αζίζογλου Πρόδρομος' }, Array.from({ length: 17 }, (_, i) => ({ shareNumber: i + 1, nominalNumber: '1005007265655', description: 'ΔΟΚΙΜΗ ΥΛΙΚΟΥ', measurementUnit: 'Τεμάχια', finalQuantity: 4 })), { financialManager: financialOfficers.manager, signatureMode: 'all' });
      fixtures.handover = renderOfficialHandoverProtocol({ serviceInfo: { serviceName: '108 Α/Κ ΜΜΠ/ΔΥ' }, financialOfficers }, { startDate: '2026-10-11', incomingOfficer: 'Παραλαμβάνων', protocolData: {} });
      fixtures.composition = renderAddyCompositionDocument({ financialOfficers }, [{ composition: Array.from({ length: 9 }, (_, i) => ({ componentNominalNumber: '8452123696' + i, componentDescription: 'ΚΛΕΙΔΙ ' + i, measurementUnit: 'Τεμάχια', projectedQuantity: 1, notIssuedQuantity: 0 })) }]);
      fixtures.share = renderSharePrintDocument({ share: { nominalNumber: '1005007265655', shareNumber: '1', description: 'ΑΥΤΟΜΑΤΟ ΠΙΣΤΟΛ. 0.45', measurementUnit: 'Τεμάχια' }, transactions: [] });
      document.body.innerHTML = renderWeaponRegistry([{ share: { id: 1, mainMaterialNumber: '2192', description: 'ΤΥΦΕΚΙΟ', accountingBalance: 16 }, entries: Array.from({ length: 16 }, (_, i) => ({ registryNumber: String(i + 1), fromDate: '2026-10-11' })) }]);
      bindControlledMaterialEvents(document.body, () => {}, {});
      document.querySelector('[data-preview-selected-weapon]').click();
      fixtures.weapon = document.querySelector('.weapon-registry-document-preview').innerHTML;
      initializeDocumentPreviews();
      window.showFixture = (name) => {
        delete document.body.dataset.isolatedDocumentPrint;
        document.body.innerHTML = '<div class="modal-backdrop"><div class="request-document-modal k2310-document-modal"><header class="material-card-header"><h2>Προεπισκόπηση</h2></header><div class="request-document-preview weapon-registry-document-preview" ' + (name === 'k2310' ? 'data-k2310-pages' : '') + '>' + fixtures[name] + '</div></div></div>';
      };
    })().catch(error => { console.error(error.stack); throw error; })\`);
    const settle = () => win.webContents.executeJavaScript('new Promise(resolve => setTimeout(resolve, 100))');
    for (const name of ['k2310', 'handover', 'weapon', 'composition', 'share', 'orders']) {
      await win.webContents.executeJavaScript('showFixture(' + JSON.stringify(name) + ')');
      await settle();
      const result = await win.webContents.executeJavaScript(\`(() => {
        const pages = [...document.querySelectorAll('[data-preview-paper]')];
        const first = pages[0];
        const rect = element => element.getBoundingClientRect();
        const inside = (page, element) => rect(element).bottom <= rect(page).bottom + 1;
        return {
          pageCount: pages.length,
          toolbars: document.querySelectorAll('.document-preview-tools').length,
          scale: Number(first.style.getPropertyValue('--preview-scale')),
          handover: pages.map(p => ({ heading: p.querySelector('h2')?.textContent, fits: [...p.children].every(c => inside(p, c)) })),
          footerGrid: first.querySelector('.k2310-signatures')?.colSpan,
          footerCells: first.querySelector('tfoot tr')?.cells.length,
          signaturesAtBottom: !first.querySelector('.k2310-horizontal-signatures') || Math.abs(rect(first.querySelector('.k2310-signatures')).bottom - rect(first.querySelector('.k2310-horizontal-signatures')).bottom) / Number(first.style.getPropertyValue('--preview-scale')) < 5,
          dateBreak: !!first.querySelector('.k2310-date-row td:nth-child(7) br'),
          unitLeft: first.querySelector('.official-index-unit')?.style.left,
          weaponRows: pages.map(p => p.querySelectorAll('tbody tr').length),
          weaponDate: first.querySelector('tbody tr:nth-child(2) td:nth-child(3)')?.textContent,
          weaponFits: !first.querySelector('footer') || inside(first, first.querySelector('footer')),
          weaponRowHeight: first.querySelector('tbody tr') ? rect(first.querySelector('tbody tr')).height / Number(first.style.getPropertyValue('--preview-scale')) : null,
          shareSizes: [...first.querySelectorAll('.share-primary-data-overlay')].map(e => getComputedStyle(e).fontSize),
          shareBaseSize: first.querySelector('.official-share-overlay:not(.share-primary-data-overlay)') ? parseFloat(getComputedStyle(first.querySelector('.official-share-overlay:not(.share-primary-data-overlay)')).fontSize) : null,
          compositionGap: first.querySelector('.composition-footer-field-13 .composition-footer-signatures') ? (rect(first.querySelector('.composition-footer-field-13 .composition-footer-signatures')).top - rect(first.querySelector('.composition-footer-field-13')).top) / Number(first.style.getPropertyValue('--preview-scale')) : null
        };
      })()\`);
      assert.equal(result.toolbars, 1, name + ': missing preview controls');
      assert.ok(result.scale > 0 && result.scale < 1, name + ': page must scale to viewport');
      if (name === 'k2310') {
        assert.equal(result.footerGrid, 6);
        assert.equal(result.footerCells, 12);
        assert.equal(result.dateBreak, true);
        assert.equal(result.signaturesAtBottom, true);
      }
      if (name === 'handover') {
        assert.equal(result.pageCount, 3);
        assert.equal(result.handover[1].heading, '2. ΔΙΑΦΟΡΕΣ');
        assert.equal(result.handover[2].heading, '5. ΠΑΡΑΤΗΡΗΣΕΙΣ ΠΑΡΑΔΙΔΟΝΤΟΣ');
        assert.ok(result.handover.every(p => p.fits), JSON.stringify(result.handover));
      }
      if (name === 'weapon') {
        assert.deepEqual(result.weaponRows, [30, 30]);
        assert.equal(result.weaponDate, '11/10/2026');
        assert.equal(result.weaponFits, true);
        assert.ok(Math.abs(result.weaponRowHeight - 7.5 * 96 / 25.4) < 0.1);
      }
      if (name === 'share') assert.ok(result.shareSizes.length === 4 && result.shareSizes.every(size => Math.abs(parseFloat(size) - result.shareBaseSize - 1) < 0.01));
      if (name === 'composition') assert.ok(Math.abs(result.compositionGap - 37.8) < 1);
      if (name === 'orders') assert.equal(result.unitLeft, '13.4%');
      if (process.env.FORM_LAYOUT_SCREENSHOTS) {
        fs.writeFileSync(require('node:path').join(process.env.FORM_LAYOUT_SCREENSHOTS, name + '.png'), (await win.webContents.capturePage()).toPNG());
      }
      await win.webContents.executeJavaScript(\`document.body.dataset.isolatedDocumentPrint = 'true'; document.body.innerHTML = '<div class="isolated-print-root">' + fixtures[\${JSON.stringify(name)}] + '</div>';\`);
      await win.webContents.executeJavaScript('Promise.all([...document.images].map(i => i.decode()))');
      win.webContents.debugger.attach('1.3');
      await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: 'print' });
      if (name === 'share') assert.deepEqual(await win.webContents.executeJavaScript("[...document.querySelectorAll('.share-primary-data-overlay')].map(e => getComputedStyle(e).fontSize)"), ['13px', '13px', '12px', '13px']);
      const pdf = await win.webContents.printToPDF({ landscape: name === 'k2310', printBackground: true, preferCSSPageSize: true, pageSize: 'A4', margins: { top: 0, bottom: 0, left: 0, right: 0 } });
      const count = [...pdf.toString('latin1').matchAll(/\\/Type\\s*\\/Page\\b/g)].length;
      assert.equal(count, name === 'handover' ? 3 : name === 'weapon' ? 2 : 1, name + ': unexpected printed page count');
      win.webContents.debugger.detach();
      console.log(name + ': preview and PDF layout passed (' + count + ' pages)');
    }
    app.exit(0);
  } catch (error) { console.error(error); app.exit(1); }
});
`;
try {
  fs.writeFileSync(path.join(directory, 'fixture.html'), `<html><head><meta charset="utf-8"><base href="${ui}"><link rel="stylesheet" href="styles.css"></head><body></body></html>`);
  fs.writeFileSync(path.join(directory, 'check.cjs'), script);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(require('electron'), [path.join(directory, 'check.cjs')], { env, encoding: 'utf8', timeout: 45000 });
  assert.equal(result.status, 0, String(result.error || '') + result.stdout + result.stderr);
  console.log(result.stdout.trim());
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
