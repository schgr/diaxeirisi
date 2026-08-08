const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
const initSqlJs = require('sql.js');
const { migrations, validateMigrations } = require('../src/db/migrations');

const root = path.resolve(__dirname, '..');
const baselineSource = execFileSync(
  'git',
  ['show', 'c771eced787a37bbfbf340f6c7fb7f34116e840d:src/db/migrations.js'],
  { cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
);
const baselineModule = { exports: {} };
vm.runInNewContext(baselineSource, { module: baselineModule, exports: baselineModule.exports });
const baseline = baselineModule.exports.migrations;

function snapshot(items) {
  return Array.from(items, ({ version, name, up }) => ({
    version,
    name,
    sqlHash: crypto.createHash('sha256').update(up).digest('hex')
  }));
}

function applyMigrations(db, items) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  const applied = new Set(
    db.exec('SELECT version FROM schema_migrations')[0]?.values.map(([version]) => version) || []
  );
  let executed = 0;
  for (const migration of items) {
    if (applied.has(migration.version)) continue;
    let existingForeignKeyViolations = new Set();
    if (migration.foreignKeysOff) {
      db.exec('PRAGMA foreign_keys = OFF');
      existingForeignKeyViolations = new Set(
        queryRows(db, 'PRAGMA foreign_key_check').map(foreignKeyViolationKey)
      );
    }
    db.exec('BEGIN');
    try {
      db.exec(migration.up);
      const statement = db.prepare(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
      );
      statement.run([migration.version, migration.name]);
      statement.free();
      if (migration.foreignKeysOff) {
        const newViolations = queryRows(db, 'PRAGMA foreign_key_check').filter(
          (row) => !existingForeignKeyViolations.has(foreignKeyViolationKey(row))
        );
        assert.deepStrictEqual(newViolations, []);
      }
      db.exec('COMMIT');
      executed += 1;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    } finally {
      if (migration.foreignKeysOff) db.exec('PRAGMA foreign_keys = ON');
    }
  }
  return executed;
}

function queryRows(db, sql) {
  const result = db.exec(sql)[0];
  if (!result) return [];
  return result.values.map((values) =>
    Object.fromEntries(result.columns.map((column, index) => [column, values[index]]))
  );
}

function foreignKeyViolationKey(row) {
  return [row.table, row.rowid, row.parent, row.fkid].join('\u0000');
}

function schemaSnapshot(db) {
  const master = queryRows(
    db,
    `SELECT type, name, tbl_name, sql
       FROM sqlite_master
      WHERE name NOT LIKE 'sqlite_%'
      ORDER BY type, name`
  );
  const tables = master.filter(({ type }) => type === 'table').map(({ name }) => name);
  return {
    master,
    tables: tables.map((table) => ({
      table,
      columns: queryRows(db, `PRAGMA table_info(${JSON.stringify(table)})`),
      foreignKeys: queryRows(db, `PRAGMA foreign_key_list(${JSON.stringify(table)})`),
      indexes: queryRows(db, `PRAGMA index_list(${JSON.stringify(table)})`)
    }))
  };
}

(async () => {
  assert.deepStrictEqual(
    snapshot(migrations.slice(0, baseline.length)),
    snapshot(baseline),
    'Published migration SQL hashes changed.'
  );
  assert.strictEqual(migrations.length, 66);
  assert.strictEqual(migrations[62].name, 'training_ammunition_batch_book');
  assert.strictEqual(migrations[63].name, 'weapon_registry_entries');
  assert.strictEqual(migrations[64].name, 'weapon_registry_nine_fields');
  assert.strictEqual(migrations[65].name, 'addy_documents_without_autoincrement');
  assert.throws(
    () => validateMigrations([migrations[0], migrations[0]]),
    /Duplicate or invalid migration version/
  );
  assert.throws(
    () => validateMigrations([migrations[1], migrations[0]]),
    /out of order/
  );

  const SQL = await initSqlJs({
    locateFile: (file) => path.join(root, 'node_modules', 'sql.js', 'dist', file)
  });
  const baselineDb = new SQL.Database();
  const currentDb = new SQL.Database();
  assert.strictEqual(applyMigrations(baselineDb, baseline), 61);
  assert.strictEqual(applyMigrations(currentDb, migrations), 66);
  const addyTableSql = queryRows(
    currentDb,
    "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'addy_documents'"
  )[0].sql;
  assert.match(addyTableSql, /id INTEGER PRIMARY KEY/u);
  assert.doesNotMatch(addyTableSql, /AUTOINCREMENT/iu);

  const addyUpgradeDb = new SQL.Database();
  applyMigrations(addyUpgradeDb, migrations.filter(({ version }) => version <= 65));
  addyUpgradeDb.exec(`
    PRAGMA foreign_keys = ON;
    INSERT INTO shares (id, share_number, description, material_type)
    VALUES (1, '1', 'TEST MATERIAL', 'TEST');
    INSERT INTO addy_documents (id, document_date, transaction_unit)
    VALUES (42, '2025-12-31', 'TEST UNIT');
    INSERT INTO addy_items (
      addy_document_id, share_id, share_number, nominal_number,
      material_type, transaction_type, quantity
    ) VALUES (42, 1, '1', 'N-1', 'TEST', 'ΧΡΕΩΣΗ', 1);
    PRAGMA foreign_keys = OFF;
    INSERT INTO addy_items (
      addy_document_id, share_id, share_number, nominal_number,
      material_type, transaction_type, quantity
    ) VALUES (999, 1, '1', 'N-2', 'TEST', 'ΧΡΕΩΣΗ', 1);
    PRAGMA foreign_keys = ON;
  `);
  const violationsBeforeAddyMigration = queryRows(addyUpgradeDb, 'PRAGMA foreign_key_check');
  assert.strictEqual(violationsBeforeAddyMigration.length, 1);
  assert.strictEqual(applyMigrations(addyUpgradeDb, migrations), 1);
  assert.strictEqual(queryRows(addyUpgradeDb, 'SELECT id FROM addy_documents')[0].id, 42);
  assert.strictEqual(queryRows(addyUpgradeDb, 'SELECT addy_document_id FROM addy_items')[0].addy_document_id, 42);
  assert.deepStrictEqual(
    queryRows(addyUpgradeDb, 'PRAGMA foreign_key_check'),
    violationsBeforeAddyMigration,
    'Migration 66 must preserve existing violations without creating new ones.'
  );
  addyUpgradeDb.close();

  currentDb.exec(`
    INSERT INTO addy_documents (document_date, transaction_unit) VALUES ('2026-01-01', 'A');
    INSERT INTO addy_documents (document_date, transaction_unit) VALUES ('2026-01-02', 'B');
  `);
  const latestAddyId = queryRows(currentDb, 'SELECT MAX(id) AS id FROM addy_documents')[0].id;
  currentDb.exec(`DELETE FROM addy_documents WHERE id = ${latestAddyId}`);
  currentDb.exec("INSERT INTO addy_documents (document_date, transaction_unit) VALUES ('2026-01-03', 'C')");
  assert.strictEqual(
    queryRows(currentDb, 'SELECT MAX(id) AS id FROM addy_documents')[0].id,
    latestAddyId,
    'Deleting the greatest ADDY id must make that id available to the next insert.'
  );
  const currentIndexes = queryRows(
    currentDb,
    `SELECT name FROM sqlite_master
      WHERE type = 'index'
        AND name IN ('idx_shares_print_order', 'idx_share_transactions_moved_year')
      ORDER BY name`
  );
  assert.deepStrictEqual(currentIndexes.map(({ name }) => name), [
    'idx_share_transactions_moved_year',
    'idx_shares_print_order'
  ]);
  assert.strictEqual(applyMigrations(currentDb, migrations), 0, 'Second startup reran migrations.');

  for (const version of [10, 30, 50]) {
    const upgradeDb = new SQL.Database();
    applyMigrations(upgradeDb, baseline.filter((migration) => migration.version <= version));
    assert.strictEqual(applyMigrations(upgradeDb, migrations), 66 - version);
    assert.deepStrictEqual(schemaSnapshot(upgradeDb), schemaSnapshot(currentDb));
    upgradeDb.close();
  }

  baselineDb.close();
  currentDb.close();
  console.log('migrationModules.test.js: OK (61 immutable SQL hashes + migrations 62-66, fresh/upgrade/idempotent parity)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
