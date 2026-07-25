const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { createAdministrationService } = require('../src/services/administrationService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-management-report-'));
  try {
    const db = await initializeDatabase(directory);
    const shares = createSharesService(db);
    addShare(shares, '1', 'AO-DUP', 0, 0);
    addShare(shares, '2', 'AO-DUP', 5, 3);
    addShare(shares, '3', 'AO-3', 2, 4);
    addShare(shares, '4', 'AO-4', 0, 0);
    const [first, second] = shares.listShares();
    shares.updateShareDetails(first.id, { requiresComposition: true });
    shares.saveComposition(first.id, [{ componentDescription: 'ΕΞΑΡΤΗΜΑ', projectedQuantity: 1, notIssuedQuantity: 0 }]);
    shares.updateShareDetails(second.id, { requiresComposition: true });
    db.prepare(`
      INSERT INTO share_transactions (
        share_id, transaction_date, transaction_unit, transaction_type,
        document_reference, quantity, notes
      ) VALUES (?, '2026-04-01', 'ΜΟΝΑΔΑ', 'Χρέωση', 'ΔΟΚΙΜΗ', 1, 'TEST')
    `).run(first.id);

    const report = createAdministrationService(db).getManagementReport(2026);
    assert.strictEqual(report.totalShares, 4);
    assert.strictEqual(report.zeroBalanceShares, 2);
    assert.strictEqual(report.sharesWithBalance, 2);
    assert.strictEqual(report.movedShares, 1);
    assert.strictEqual(report.deficitShares, 1);
    assert.strictEqual(report.surplusShares, 1);
    assert.strictEqual(report.compositionShares, 2);
    assert.strictEqual(report.missingCompositionShares, 1);
    assert.strictEqual(report.duplicateNominalShares, 2);
    assert.strictEqual(report.duplicateNominalGroups.length, 1);
    console.log('managementReport.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function addShare(shares, shareNumber, nominalNumber, accountingBalance, chargedQuantity) {
  shares.addShare({
    shareNumber, nominalNumber, description: `ΥΛΙΚΟ ${shareNumber}`, materialType: 'Υλικό',
    projectedQuantity: 0, accountingBalance, chargedQuantity
  });
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
