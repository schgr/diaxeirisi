const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-ammunition-batches-'));
  try {
    const db = await initializeDatabase(directory);
    const shares = createSharesService(db);
    shares.addShare(makeShare('10', 'ΠΥΡΟΜΑΧΙΚΑ Α'));
    shares.addShare(makeShare('20', 'ΠΥΡΟΜΑΧΙΚΑ Β'));

    const first = shares.listShares().find((share) => share.shareNumber === '10');
    const second = shares.listShares().find((share) => share.shareNumber === '20');
    shares.updateShareDetails(first.id, { requiresAmmunitionBatchBook: true });

    let registry = shares.listAmmunitionBatchRegistry();
    assert.deepStrictEqual(registry.map((item) => item.share.shareNumber), ['10']);
    assert.strictEqual(registry[0].share.requiresAmmunitionBatchBook, true);

    shares.saveAmmunitionBatches(first.id, [
      { batchNumber: 'ΠΥΡ-001', quantity: 120, notes: 'Πρώτη μερίδα' },
      { batchNumber: 'ΠΥΡ-002', quantity: 80, notes: '' }
    ]);
    registry = shares.listAmmunitionBatchRegistry();
    assert.deepStrictEqual(registry[0].entries.map((entry) => entry.batchNumber), ['ΠΥΡ-001', 'ΠΥΡ-002']);
    assert.deepStrictEqual(registry[0].entries.map((entry) => entry.quantity), [120, 80]);

    assert.throws(
      () => shares.saveAmmunitionBatches(first.id, [{ batchNumber: '', quantity: 1 }]),
      /Μερίδα Πυρκού/
    );
    assert.throws(
      () => shares.saveAmmunitionBatches(second.id, [{ batchNumber: 'Χ', quantity: 1 }]),
      /δεν έχει ενεργοποιημένο/
    );

    console.log('ammunitionBatchBook.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function makeShare(shareNumber, description) {
  return {
    shareNumber,
    nominalNumber: `AO-${shareNumber}`,
    description,
    materialType: 'Πυρομαχικά',
    projectedQuantity: 0,
    accountingBalance: 0,
    chargedQuantity: 0
  };
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
