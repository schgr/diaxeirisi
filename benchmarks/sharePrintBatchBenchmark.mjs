import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { renderSharePrintDocument } = await import('../src/ui/shares/sharePrint.js');

const COUNTS = [1500, 5000, 10000];
const TOTAL_BUDGETS_MS = new Map([[1500, 2000], [5000, 6000], [10000, 12000]]);
const YEAR = 2026;
const CHUNK_SIZE = 400;
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-share-print-benchmark-'));
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = outputArgument ? path.resolve(outputArgument.slice('--output='.length)) : null;

function measuredService(db) {
  let queries = 0;
  const measuredDb = {
    ...db,
    prepare(sql) {
      queries += 1;
      return db.prepare(sql);
    }
  };
  return {
    service: createSharesService(measuredDb),
    reset: () => { queries = 0; },
    queryCount: () => queries
  };
}

function measure(operation) {
  const started = performance.now();
  const value = operation();
  return { value, elapsedMs: Number((performance.now() - started).toFixed(2)) };
}

try {
  const db = await initializeDatabase(temporaryRoot);
  db.transaction(() => {
    const insertShare = db.prepare(`
      INSERT INTO shares (share_number, nominal_number, description, material_type)
      VALUES (?, ?, ?, 'Υλικό')
    `);
    const insertMovement = db.prepare(`
      INSERT INTO share_transactions
        (share_id, transaction_date, transaction_unit, transaction_type,
         document_reference, quantity, notes)
      VALUES (?, ?, 'Μονάδα', 'Χρέωση', ?, 1, '')
    `);
    for (let index = 1; index <= COUNTS[COUNTS.length - 1]; index += 1) {
      insertShare.run(String(index), `N-${index}`, `Υλικό ${index}`);
      insertMovement.run(index, `${YEAR}-01-02`, `ΑΔΔΥ ${index} /${YEAR}`);
    }
  })();

  const measured = measuredService(db);
  const results = [];
  for (const count of COUNTS) {
    measured.reset();
    const batch = measure(() => measured.service.getShareCardsBatch({
      mode: 'all',
      year: YEAR,
      fromShareNumber: 1,
      toShareNumber: count
    }));
    const render = measure(() =>
      batch.value.map((card) => renderSharePrintDocument(card, { fiscalYear: YEAR })).join('')
    );
    const maximumQueries = 2 + (7 * Math.ceil(count / CHUNK_SIZE));
    assert.equal(batch.value.length, count);
    assert.ok(measured.queryCount() <= maximumQueries);
    assert.ok(render.value.includes('ΑΠΟ ΜΕΤΑΦΟΡΑ'));
    assert.ok(
      batch.elapsedMs + render.elapsedMs <= TOTAL_BUDGETS_MS.get(count),
      `${count}-share preview exceeded its performance budget`
    );
    results.push({
      shares: count,
      batchMs: batch.elapsedMs,
      renderMs: render.elapsedMs,
      totalMs: Number((batch.elapsedMs + render.elapsedMs).toFixed(2)),
      queries: measured.queryCount(),
      maximumQueries,
      totalBudgetMs: TOTAL_BUDGETS_MS.get(count),
      htmlBytes: Buffer.byteLength(render.value)
    });
  }
  const report = {
    deterministic: true,
    chunkSize: CHUNK_SIZE,
    results
  };
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  db.close();
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
