const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createClothingService } = require('../src/services/clothingService');

async function run() {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-clothing-'));
  try {
    const db = await initializeDatabase(tempDirectory);
    const service = createClothingService(db);
    db.prepare(`
      INSERT INTO exhp_documents (
        fiscal_year, registry_number, document_date, service_unit, issue_reason
      ) VALUES (?, ?, ?, ?, ?)
    `).run(2026, 1, '2026-06-18', 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ', 'Δοκιμή ιματισμού');
    const exhpId = Number(
      db.prepare('SELECT id FROM exhp_documents WHERE fiscal_year = ? AND registry_number = ?')
        .get(2026, 1).id
    );

    const jacket = service.addClothingItem({
      name: 'ΤΖΑΚΕΤ ΠΑΡΑΛΛΑΓΗΣ',
      short_name: 'ΤΖΑΚΕΤ',
      category: 'ιματισμός',
      sort_order: 1
    });
    const boots = service.addClothingItem({
      name: 'ΑΡΒΥΛΑ',
      short_name: 'ΑΡΒΥΛΑ',
      category: 'υπόδηση',
      sort_order: 2
    });

    assert.deepStrictEqual(
      service.getClothingItems().map((item) => item.name),
      ['ΤΖΑΚΕΤ ΠΑΡΑΛΛΑΓΗΣ', 'ΑΡΒΥΛΑ']
    );

    const created = service.saveDistribution(exhpId, 'initial', {
      subunit: '1ος Λόχος',
      soldierRank: 'ΣΤΡ',
      soldierName: 'ΔΟΚΙΜΑΣΤΙΚΟΣ ΟΠΛΙΤΗΣ',
      soldierSgSmSk: 'Μ',
      esso: '2026 Α',
      signature: true,
      items: [
        { clothingItemId: jacket.id, quantity: 2 },
        { clothingItemId: boots.id, quantity: 1 }
      ]
    }).distribution;

    assert.strictEqual(created.items.length, 2);
    assert.strictEqual(created.signature, true);

    const updated = service.saveDistribution(exhpId, 'replacement', {
      id: created.id,
      subunit: '1ος Λόχος',
      soldierRank: 'ΣΤΡ',
      soldierName: 'ΔΟΚΙΜΑΣΤΙΚΟΣ ΟΠΛΙΤΗΣ',
      items: [{ clothingItemId: jacket.id, quantity: 1 }]
    }).distribution;

    assert.strictEqual(updated.distributionType, 'replacement');
    assert.strictEqual(updated.items.length, 1);
    assert.strictEqual(updated.items[0].quantity, 1);
    assert.strictEqual(service.getDistributionsForExhp(exhpId).length, 1);

    const now = new Date();
    const summary = service.getSummary(now.getMonth() + 1, now.getFullYear());
    assert.strictEqual(summary.length, 1);
    assert.strictEqual(summary[0].subunit, '1ος Λόχος');
    assert.strictEqual(summary[0].distributionType, 'replacement');
    assert.strictEqual(summary[0].totalQuantity, 1);

    service.deleteDistribution(updated.id);
    assert.strictEqual(
      db.prepare('SELECT COUNT(*) AS count FROM clothing_distributions').get().count,
      0
    );

    console.log('Clothing service integration test passed.');
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
