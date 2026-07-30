const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-share-batch-'));
  const db = await initializeDatabase(root);
  db.transaction(() => {
    const insertShare = db.prepare(`
      INSERT INTO shares (share_number, nominal_number, description, material_type)
      VALUES (?, ?, ?, ?)
    `);
    for (let index = 1; index <= 1500; index += 1) {
      insertShare.run(String(index), `N-${index}`, `Υλικό ${index}`, 'Υλικό');
    }
    db.prepare(`
      INSERT INTO share_transactions
        (share_id, transaction_date, transaction_unit, transaction_type, document_reference, quantity, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(1, '2024-12-31', 'Μονάδα', 'Χρέωση', 'Απογραφή 31-12-2024', 7, 'INITIAL_ANNUAL_INVENTORY');
    db.prepare(`
      INSERT INTO share_transactions
        (share_id, transaction_date, transaction_unit, transaction_type, document_reference, quantity, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(1, '2025-02-01', 'Μονάδα', 'Χρέωση', 'ΑΔΔΥ 10 /2025', 3, '');
  })();

  let queryCount = 0;
  const measuredDb = {
    ...db,
    prepare(sql) {
      queryCount += 1;
      return db.prepare(sql);
    }
  };
  const service = createSharesService(measuredDb);

  queryCount = 0;
  const all = service.getShareCardsBatch({ mode: 'all', year: 2025 });
  assert.equal(all.length, 1500, 'all mode must support at least 1,500 shares');
  assert.ok(queryCount <= 5, `batch loading used ${queryCount} SQL queries instead of a fixed small count`);

  const single = service.getShareCardsBatch({ mode: 'single', shareId: 1, year: 2025 });
  assert.equal(single.length, 1);
  assert.equal(single[0].transactions.length, 1);
  assert.equal(single[0].openingTransfer.balance, 7);
  assert.equal(single[0].openingTransfer.inventoryDate, '2024-12-31');
  assert.equal(single[0].transactions[0].balance, 10);

  const moved = service.getShareCardsBatch({ mode: 'moved', year: 2025 });
  assert.deepEqual(moved.map((card) => card.share.id), [1]);

  const ranged = service.getShareCardsBatch({
    mode: 'all',
    year: 2025,
    fromShareNumber: 100,
    toShareNumber: 120
  });
  assert.equal(ranged.length, 21);

  const archiveCard = { ...single[0], year: 2023 };
  db.transaction(() => {
    const session = db.prepare(`
      INSERT INTO inventory_sessions (fiscal_year, serial_number, inventory_date, title)
      VALUES (2023, 1, '2023-12-31', 'Archive')
    `).run();
    db.prepare(`
      INSERT INTO fiscal_year_closures
        (fiscal_year, next_fiscal_year, inventory_session_id, archive_snapshot)
      VALUES (?, ?, ?, ?)
    `).run(2023, 2024, session.lastInsertRowid, JSON.stringify({
      cards: [archiveCard],
      movedCards: [archiveCard]
    }));
  })();
  const archived = service.getShareCardsBatch({ mode: 'moved', year: 2023 });
  assert.equal(archived.length, 1);
  assert.equal(archived[0].year, 2023);

  console.log('shareCardBatch.test.js: OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
