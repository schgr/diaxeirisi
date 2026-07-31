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
    db.prepare(`
      INSERT INTO share_composition_items
        (share_id, line_number, component_nominal_number, component_description,
         measurement_unit, quantity, not_issued_quantity, notes)
      VALUES (1, 1, 'C-1', 'Συστατικό', 'ΤΕΜ', 2, 0, '')
    `).run();
    db.prepare(`
      INSERT INTO share_change_sheet_entries
        (share_id, change_date, order_reference, previous_value, new_value,
         change_reason, notes, component_line_number, movement_type, quantity)
      VALUES (1, '2025-03-01', 'ΔΟΚ-1', '', '', 'Δοκιμή', '', 1, 'ΧΡΕΩΣΗ', 2)
    `).run();
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

  const orderedPlan = db.prepare(`
    EXPLAIN QUERY PLAN
    SELECT id
    FROM shares
    WHERE archive_status = 'Ενεργή'
    ORDER BY CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
             CAST(share_number AS INTEGER), share_number COLLATE NOCASE, id
  `).all().map((row) => row.detail).join('\n');
  assert.match(orderedPlan, /idx_shares_print_order/);
  assert.doesNotMatch(orderedPlan, /TEMP B-TREE/);

  const movedPlan = db.prepare(`
    EXPLAIN QUERY PLAN
    SELECT id
    FROM shares
    WHERE archive_status = 'Ενεργή'
      AND id IN (
        SELECT share_id
        FROM share_transactions
        WHERE transaction_date >= '2025-01-01'
          AND transaction_date <= '2025-12-31'
          AND notes <> 'INITIAL_ANNUAL_INVENTORY'
      )
  `).all().map((row) => row.detail).join('\n');
  assert.match(movedPlan, /idx_share_transactions_moved_year/);
  assert.doesNotMatch(movedPlan, /SCAN share_transactions/);

  queryCount = 0;
  const all = service.getShareCardsBatch({ mode: 'all', year: 2025 });
  assert.equal(all.length, 1500, 'all mode must support at least 1,500 shares');
  assert.ok(queryCount <= 35, `batch loading used ${queryCount} SQL queries instead of chunk-bounded queries`);
  assert.ok(queryCount < all.length / 10, 'query count must remain independent of individual share count');

  const single = service.getShareCardsBatch({ mode: 'single', shareId: 1, year: 2025 });
  assert.equal(single.length, 1);
  assert.equal(single[0].transactions.length, 1);
  assert.equal(single[0].openingTransfer.balance, 7);
  assert.equal(single[0].openingTransfer.inventoryDate, '2024-12-31');
  assert.equal(single[0].transactions[0].balance, 10);
  assert.deepEqual(single[0], service.getShareCard(1, 2025), 'batch and legacy card data must remain identical');

  const empty = service.getShareCardsBatch({
    mode: 'all',
    year: 2025,
    fromShareNumber: 2000,
    toShareNumber: 3000
  });
  assert.deepEqual(empty, []);

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
