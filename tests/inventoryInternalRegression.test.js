'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeDatabase } = require('../src/db/database');
const { createInternalService } = require('../src/services/internalService');
const { createSettingsService } = require('../src/services/settingsService');
const { createSharesService } = require('../src/services/sharesService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-internal-overage-'));
  try {
    const db = await initializeDatabase(directory);
    const settings = createSettingsService(db);
    const shares = createSharesService(db);
    settings.addDepartmentManager({ departmentName: 'Τμήμα Α', departmentHead: 'Διαχειριστής Α' });
    shares.addShare({
      shareNumber: '1',
      nominalNumber: '1000000000000',
      description: 'Δοκιμαστικό υλικό',
      materialType: 'Υλικό',
      projectedQuantity: 0,
      accountingBalance: 5,
      chargedQuantity: 0
    });
    const internal = createInternalService(db);
    const reference = internal.getReferenceData();
    internal.saveMovement({
      documentDate: '2026-08-01',
      departmentManagerId: reference.departmentManagers[0].id,
      shareId: reference.shares[0].id,
      movementType: 'Χορήγηση',
      quantity: 8,
      notes: '',
      composition: []
    });
    assert.equal(shares.listShares()[0].chargedQuantity, 8);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }

  const inventoryPage = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ui', 'pages', 'inventoryPage.js'),
    'utf8'
  );
  const chargesPage = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ui', 'pages', 'chargesPage.js'),
    'utf8'
  );
  const styles = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ui', 'styles', 'share-print-ui.css'),
    'utf8'
  );
  const addyPrint = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ui', 'transactions', 'addyPrint.js'),
    'utf8'
  );
  const newInventory = inventoryPage.match(/<h3>Νέα Απογραφή<\/h3>([\s\S]*?)<\/section>/u)?.[1] || '';
  assert.doesNotMatch(newInventory, /Επιτροπή Καταμέτρησης/u);
  assert.match(newInventory, /inventory-period-start[\s\S]*inventory-period-end[\s\S]*inventory-reason[\s\S]*inventory-session-notes[\s\S]*inventory-create/u);
  assert.match(styles, /\.inventory-session-grid\s*\{[\s\S]*grid-template-columns:/u);
  assert.match(styles, /\.inventory-count-grid\s*\{[\s\S]*grid-template-columns:/u);
  assert.match(chargesPage, /<h2>Κινήσεις Μερικών Διαχειρίσεων<\/h2>/u);
  assert.match(addyPrint, /isolated-print-root addy-isolated-print-root/u);
  assert.match(addyPrint, /printRoot\.innerHTML = source\.outerHTML/u);
  assert.match(
    styles,
    /\.composition-document-page \.material-form-page-number\s*\{[\s\S]*right:\s*15mm;[\s\S]*bottom:\s*8mm;[\s\S]*text-align:\s*right;/u
  );
  console.log('Inventory and internal-movement regression tests passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
