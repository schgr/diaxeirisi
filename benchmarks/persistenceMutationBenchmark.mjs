import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const initSqlJs = require('sql.js');
const { atomicPersist } = require('../src/db/atomicPersistence');
const { createPersistentDatabase } = require('../src/db/database');

const COUNTS = [1, 100, 1000];
const DATABASE_PAYLOAD_BYTES = 2 * 1024 * 1024;
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = outputArgument ? path.resolve(outputArgument.slice('--output='.length)) : null;
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-persistence-benchmark-'));

async function measure(mode, mutationCount) {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  const dbPath = path.join(temporaryRoot, `${mode}-${mutationCount}.sqlite`);
  let exports = 0;
  let bytesWritten = 0;
  const db = createPersistentDatabase(raw, dbPath, {
    persistenceDelayMs: mode === 'immediate' ? 0 : 250,
    persistenceMaxDelayMs: 2000,
    persistDatabase(filePath, bytes) {
      exports += 1;
      bytesWritten += bytes.length;
      atomicPersist(filePath, bytes);
    }
  });
  db.transaction(() => {
    db.exec('CREATE TABLE benchmark_mutations (id INTEGER PRIMARY KEY, value INTEGER)');
    db.exec('CREATE TABLE benchmark_payload (contents BLOB)');
    db.prepare('INSERT INTO benchmark_payload VALUES (?)').run(new Uint8Array(DATABASE_PAYLOAD_BYTES));
  })();
  exports = 0;
  bytesWritten = 0;

  const started = performance.now();
  for (let index = 0; index < mutationCount; index += 1) {
    db.prepare('INSERT INTO benchmark_mutations (value) VALUES (?)').run(index);
  }
  db.forceDurability();
  const elapsedMs = performance.now() - started;
  const rows = db.prepare('SELECT COUNT(*) AS count FROM benchmark_mutations').get().count;
  db.close();
  return {
    mutations: mutationCount,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    exports,
    bytesWritten,
    rows
  };
}

try {
  const report = {
    databasePayloadBytes: DATABASE_PAYLOAD_BYTES,
    immediate: [],
    writeBehind: []
  };
  for (const count of COUNTS) {
    report.immediate.push(await measure('immediate', count));
    report.writeBehind.push(await measure('writeBehind', count));
  }
  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
