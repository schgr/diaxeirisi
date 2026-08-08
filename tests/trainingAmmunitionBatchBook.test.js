const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');

async function run() {
  const administrationSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'pages', 'administrationPage.js'), 'utf8');
  const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'ui', 'pages', 'settingsPage.js'), 'utf8');
  assert.match(administrationSource, /Βιβλίο Μερίδων Πυρομαχικών Εκπαιδεύσεως/u);
  assert.match(administrationSource, /data-preview-training-ammunition-batches/u);
  assert.match(administrationSource, /data-print-training-ammunition-preview/u);
  assert.match(administrationSource, /ammunition-batch-preview-backdrop/u);
  assert.match(settingsSource, /requiresTrainingAmmunitionBatchBook/u);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-training-ammunition-'));
  try {
    const db = await initializeDatabase(directory);
    const shares = createSharesService(db);
    shares.addShare({
      shareNumber: '30', nominalNumber: 'AO-30', description: 'ΠΥΡΟΜΑΧΙΚΑ ΕΚΠΑΙΔΕΥΣΕΩΣ',
      materialType: 'Πυρομαχικά', projectedQuantity: 0, accountingBalance: 100, chargedQuantity: 0
    });
    const share = shares.listShares()[0];
    assert.strictEqual(share.requiresTrainingAmmunitionBatchBook, false);
    shares.updateShareDetails(share.id, { requiresTrainingAmmunitionBatchBook: true });
    let registry = shares.listTrainingAmmunitionBatchRegistry();
    assert.deepStrictEqual(registry.map((item) => item.share.shareNumber), ['30']);
    shares.saveTrainingAmmunitionBatches(share.id, [
      { batchNumber: 'ΕΚΠ-001', quantity: 100, department: '', notes: 'Δοκιμή' }
    ]);
    registry = shares.listTrainingAmmunitionBatchRegistry();
    assert.deepStrictEqual(registry[0].entries, [{
      position: 1, batchNumber: 'ΕΚΠ-001', quantity: 100, department: '', notes: 'Δοκιμή'
    }]);
    assert.throws(
      () => shares.saveTrainingAmmunitionBatches(share.id, [{ batchNumber: '', quantity: 1 }]),
      /Μερίδα Πυρκού/
    );
    console.log('trainingAmmunitionBatchBook.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
