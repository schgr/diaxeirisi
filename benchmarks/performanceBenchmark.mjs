import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { createHeavyTaskRunner } = require('../src/workers/heavyTaskRunner');
const { createBackupService } = require('../src/services/backupService');
const { filterAndRankShares, renderRows } = await import('../src/ui/pages/sharesPage.js');
const { renderSharePrintDocument } = await import('../src/ui/shares/sharePrint.js');

const SHARE_COUNT = 1500;
const CURRENT_YEAR = 2026;
const MOVED_SHARE_COUNT = 750;
const ITERATIONS = Number(process.env.DCHSI_BENCH_ITERATIONS || 3);
const LIMITS_MS = Object.freeze({
  startup: 3000,
  shareRegistry: 750,
  search: 250,
  openShare: 250,
  saveTransaction: 1000,
  previewAll: 5000,
  previewMoved: 3000,
  backup: 10000,
  excelExport: 10000,
  excelImport: 10000,
  mainStall: 1500,
  rendererStall: 250,
  workerStall: 250
});
const RSS_LIMIT_MB = 700;

const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = outputArgument ? path.resolve(outputArgument.slice('--output='.length)) : null;
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-benchmark-'));
const userDataPath = path.join(temporaryRoot, 'user-data');
const exportPath = path.join(temporaryRoot, 'shares.xlsx');
const backupRoot = path.join(temporaryRoot, 'backup-destination');
fs.mkdirSync(userDataPath, { recursive: true });
fs.mkdirSync(backupRoot, { recursive: true });

const samples = new Map();
const stalls = new Map();

async function measure(name, operation) {
  const started = performance.now();
  let maximumStall = 0;
  let previousTick = started;
  const timer = setInterval(() => {
    const now = performance.now();
    maximumStall = Math.max(maximumStall, now - previousTick - 10);
    previousTick = now;
  }, 10);
  try {
    const result = await operation();
    await new Promise((resolve) => setImmediate(resolve));
    const elapsed = performance.now() - started;
    if (!samples.has(name)) samples.set(name, []);
    samples.get(name).push(elapsed);
    if (!stalls.has(name)) stalls.set(name, []);
    stalls.get(name).push(maximumStall);
    return result;
  } finally {
    clearInterval(timer);
  }
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))];
}

function summarize(values) {
  return {
    medianMs: Number(percentile(values, 0.5).toFixed(2)),
    p95Ms: Number(percentile(values, 0.95).toFixed(2)),
    minMs: Number(Math.min(...values).toFixed(2)),
    maxMs: Number(Math.max(...values).toFixed(2))
  };
}

function seedSyntheticDataset(db) {
  const photosPath = path.join(userDataPath, 'photos');
  fs.mkdirSync(photosPath, { recursive: true });
  const insertShare = db.prepare(`
    INSERT INTO shares (
      share_number, nominal_number, description, material_type, material_code,
      main_material_number, measurement_unit, projected_quantity, accounting_balance,
      charged_quantity, unit_price, photo_path, requires_composition,
      requires_serial_number, requires_weapon_registry, requires_ammunition_batch_book,
      requires_change_sheet, archive_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Ενεργή')
  `);
  const insertTransaction = db.prepare(`
    INSERT INTO share_transactions (
      share_id, transaction_date, transaction_unit, transaction_type,
      document_reference, quantity, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertComposition = db.prepare(`
    INSERT INTO share_composition_items (
      share_id, line_number, component_nominal_number, component_description,
      measurement_unit, quantity, not_issued_quantity, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertSerial = db.prepare(`
    INSERT INTO share_serial_numbers (share_id, position, serial_number, notes)
    VALUES (?, ?, ?, ?)
  `);
  const insertBatch = db.prepare(`
    INSERT INTO share_ammunition_batches (
      share_id, position, batch_number, quantity, department, notes
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  db.transaction(() => {
    for (let index = 1; index <= SHARE_COUNT; index += 1) {
      const hasPhoto = index % 5 === 0;
      const photoPath = hasPhoto ? path.join(photosPath, `share-${index}.jpg`) : '';
      if (hasPhoto) fs.writeFileSync(photoPath, Buffer.alloc(1024, index % 251));
      insertShare.run(
        String(index),
        `NSN-${String(index).padStart(6, '0')}`,
        `Συνθετικό υλικό ${String(index).padStart(4, '0')}`,
        `Κατηγορία ${(index % 12) + 1}`,
        `CODE-${index}`,
        index % 9 === 0 ? `MAIN-${index}` : '',
        index % 2 === 0 ? 'ΤΕΜ' : 'ΚΙΛ',
        100 + (index % 50),
        50 + (index % 30),
        10 + (index % 20),
        1 + (index % 100) / 10,
        photoPath,
        index % 10 === 0 ? 1 : 0,
        index % 15 === 0 ? 1 : 0,
        index % 30 === 0 ? 1 : 0,
        index % 25 === 0 ? 1 : 0,
        index % 10 === 0 ? 1 : 0
      );
      if (index <= MOVED_SHARE_COUNT) {
        for (const year of [2024, 2025, 2026]) {
          insertTransaction.run(
            index, `${year}-01-01`, 'Συνθετική Μονάδα', 'Χρέωση',
            `ΑΠΟΓΡΑΦΗ ${year}`, 40 + (index % 10), 'INITIAL_ANNUAL_INVENTORY'
          );
          insertTransaction.run(
            index, `${year}-03-15`, 'Συνθετική Μονάδα', 'Χρέωση',
            `ΑΔΔΥ ${year}-${index}`, 5, ''
          );
          insertTransaction.run(
            index, `${year}-09-20`, 'Συνθετική Μονάδα', 'Πίστωση',
            `ΕΧΠ ${year}-${index}`, 2, ''
          );
        }
      }
      if (index % 10 === 0) {
        for (let line = 1; line <= 4; line += 1) {
          insertComposition.run(
            index, line, `COMP-${index}-${line}`, `Συνθετικό εξάρτημα ${line}`,
            'ΤΕΜ', line / 2, 0, ''
          );
        }
      }
      if (index % 15 === 0) {
        for (let position = 1; position <= 3; position += 1) {
          insertSerial.run(index, position, `SN-${index}-${position}`, '');
        }
      }
      if (index % 25 === 0) {
        insertBatch.run(index, 1, `BATCH-${index}`, 10 + (index % 20), 'Συνθετικό Τμήμα', '');
      }
    }
    db.prepare(`
      INSERT INTO inventory_sessions (
        fiscal_year, serial_number, inventory_date, title, status
      ) VALUES (?, ?, ?, ?, ?)
    `).run(2023, 1, '2023-12-31', 'Συνθετική απογραφή benchmark', 'Ολοκληρωμένη');
    const cards = Array.from({ length: SHARE_COUNT }, (_, offset) => ({
      share: { id: offset + 1, shareNumber: String(offset + 1) },
      year: 2023,
      transactions: []
    }));
    db.prepare(`
      INSERT INTO fiscal_year_closures (
        fiscal_year, next_fiscal_year, inventory_session_id, archive_snapshot
      ) VALUES (?, ?, ?, ?)
    `).run(2023, 2024, 1, JSON.stringify({ cards, movedCards: [] }));
  })();
}

function queryPlans(db) {
  const statements = {
    registry: `SELECT * FROM shares WHERE archive_status = 'Ενεργή'
      ORDER BY CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
      CAST(share_number AS INTEGER), share_number COLLATE NOCASE, id`,
    moved: `SELECT DISTINCT share_id FROM share_transactions
      WHERE transaction_date >= '2026-01-01' AND transaction_date <= '2026-12-31'
      AND notes <> 'INITIAL_ANNUAL_INVENTORY' ORDER BY share_id`,
    card: `SELECT * FROM share_transactions WHERE share_id = 375
      AND transaction_date >= '2026-01-01' AND transaction_date <= '2026-12-31'
      AND notes <> 'INITIAL_ANNUAL_INVENTORY' ORDER BY transaction_date, id`
  };
  return Object.fromEntries(Object.entries(statements).map(([name, sql]) => [
    name,
    db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all().map((row) => row.detail)
  ]));
}

let db;
let runner;
try {
  db = await measure('startupFresh', () => initializeDatabase(userDataPath));
  seedSyntheticDataset(db);
  db.flush();
  const snapshotBytes = db.exportSnapshot().length;
  const service = createSharesService(db);
  runner = createHeavyTaskRunner({ defaultTimeout: 30000 });

  let shares;
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    shares = await measure('shareRegistry', async () => {
      const rows = service.listShares();
      assert.strictEqual(rows.length, SHARE_COUNT);
      renderRows(rows);
      return rows;
    });
    await measure('search', async () => {
      const matches = filterAndRankShares(shares, { description: 'υλικό 1499' });
      assert.strictEqual(matches[0].shareNumber, '1499');
    });
    await measure('openShare', async () => {
      const card = service.getShareCard(750, CURRENT_YEAR);
      assert.strictEqual(card.transactions.length, 2);
    });
    await measure('previewAll', async () => {
      const cards = service.getShareCardsBatch({ mode: 'all', year: CURRENT_YEAR });
      assert.strictEqual(cards.length, SHARE_COUNT);
      const html = cards.map((card) => renderSharePrintDocument(card, { fiscalYear: CURRENT_YEAR })).join('');
      assert.ok(html.includes('ΑΠΟ ΜΕΤΑΦΟΡΑ'));
    });
    await measure('previewMoved', async () => {
      const cards = service.getShareCardsBatch({ mode: 'moved', year: CURRENT_YEAR });
      assert.strictEqual(cards.length, MOVED_SHARE_COUNT);
      cards.map((card) => renderSharePrintDocument(card, { fiscalYear: CURRENT_YEAR })).join('');
    });
  }

  await measure('saveTransaction', async () => {
    db.transaction(() => {
      db.prepare(`
        INSERT INTO share_transactions (
          share_id, transaction_date, transaction_unit, transaction_type,
          document_reference, quantity, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(1, '2026-11-01', 'Συνθετική Μονάδα', 'Χρέωση', 'BENCHMARK-1', 1, '');
      db.prepare('UPDATE shares SET accounting_balance = accounting_balance + 1 WHERE id = ?').run(1);
    })();
  });

  const excelRows = [['Μερίδα', 'Ονομαστικό', 'Περιγραφή', 'Υπόλοιπο']]
    .concat(shares.map((share) => [
      share.shareNumber, share.nominalNumber, share.description, share.accountingBalance
    ]));
  await measure('excelExport', () => runner.run('export-document', {
    filePath: exportPath,
    format: 'excel',
    document: {
      title: 'Synthetic benchmark',
      tables: [{ name: 'Shares', rows: excelRows }]
    }
  }));
  await measure('excelImport', async () => {
    const matrix = await runner.run('read-excel-matrix', { filePath: exportPath });
    assert.strictEqual(matrix.length, SHARE_COUNT + 1);
  });
  const backupService = createBackupService(userDataPath, {
    runner,
    exportSnapshot: () => db.exportSnapshot()
  });
  await measure('backup', async () => {
    const result = await backupService.createManual(backupRoot, { timeoutMs: 30000 });
    assert.ok(fs.existsSync(result.path));
  });

  db.close();
  db = null;
  await measure('startupExisting', async () => {
    const reopened = await initializeDatabase(userDataPath);
    assert.strictEqual(createSharesService(reopened).listShares().length, SHARE_COUNT);
    reopened.close();
  });

  const metrics = Object.fromEntries([...samples].map(([name, values]) => [name, summarize(values)]));
  const stallMetrics = Object.fromEntries([...stalls].map(([name, values]) => [name, summarize(values)]));
  const maximumMainStall = Math.max(
    ...['startupFresh', 'startupExisting', 'openShare', 'saveTransaction']
      .map((name) => stallMetrics[name]?.maxMs || 0)
  );
  const maximumRendererStall = Math.max(
    ...['shareRegistry', 'search', 'previewAll', 'previewMoved']
      .map((name) => stallMetrics[name]?.maxMs || 0)
  );
  const maximumWorkerStall = Math.max(
    ...['backup', 'excelExport', 'excelImport'].map((name) => stallMetrics[name]?.maxMs || 0)
  );
  const rssMb = Number((process.memoryUsage().rss / 1024 / 1024).toFixed(2));
  const report = {
    dataset: {
      deterministic: true,
      shares: SHARE_COUNT,
      movedShares: MOVED_SHARE_COUNT,
      transactions: MOVED_SHARE_COUNT * 3 * 3 + 1,
      fiscalYears: [2023, 2024, 2025, 2026],
      photos: SHARE_COUNT / 5,
      compositions: SHARE_COUNT / 10,
      serialRegistries: SHARE_COUNT / 15,
      ammunitionRegistries: SHARE_COUNT / 25,
      databaseBytes: snapshotBytes
    },
    iterations: ITERATIONS,
    limits: { ...LIMITS_MS, rssMb: RSS_LIMIT_MB },
    metrics,
    stalls: {
      byOperation: stallMetrics,
      maximumMainMs: Number(maximumMainStall.toFixed(2)),
      maximumRendererMs: Number(maximumRendererStall.toFixed(2)),
      maximumWorkerMs: Number(maximumWorkerStall.toFixed(2))
    },
    rssMb,
    queryPlans: {}
  };
  const planDatabase = await initializeDatabase(userDataPath);
  try {
    report.queryPlans = queryPlans(planDatabase);
  } finally {
    planDatabase.close();
  }

  for (const [name, limit] of Object.entries(LIMITS_MS)) {
    if (name === 'mainStall') assert.ok(report.stalls.maximumMainMs <= limit, `Main stall exceeded ${limit} ms.`);
    else if (name === 'rendererStall') {
      assert.ok(report.stalls.maximumRendererMs <= limit, `Renderer stall exceeded ${limit} ms.`);
    }
    else if (name === 'workerStall') assert.ok(report.stalls.maximumWorkerMs <= limit, `Worker stall exceeded ${limit} ms.`);
    else if (name === 'startup') {
      assert.ok(metrics.startupExisting.maxMs <= limit, `Startup exceeded ${limit} ms.`);
    } else {
      assert.ok(metrics[name]?.maxMs <= limit, `${name} exceeded ${limit} ms.`);
    }
  }
  assert.ok(rssMb <= RSS_LIMIT_MB, `RSS ${rssMb} MB exceeds constrained x86 budget ${RSS_LIMIT_MB} MB.`);
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (db) db.close();
  if (runner) await runner.close();
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
