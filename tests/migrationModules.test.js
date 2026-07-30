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
    db.exec('BEGIN');
    try {
      db.exec(migration.up);
      const statement = db.prepare(
        'INSERT INTO schema_migrations (version, name) VALUES (?, ?)'
      );
      statement.run([migration.version, migration.name]);
      statement.free();
      db.exec('COMMIT');
      executed += 1;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
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
  assert.deepStrictEqual(snapshot(migrations), snapshot(baseline), 'Migration SQL hashes changed.');
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
  assert.strictEqual(applyMigrations(currentDb, migrations), 61);
  assert.deepStrictEqual(schemaSnapshot(currentDb), schemaSnapshot(baselineDb));
  assert.strictEqual(applyMigrations(currentDb, migrations), 0, 'Second startup reran migrations.');

  for (const version of [10, 30, 50]) {
    const upgradeDb = new SQL.Database();
    applyMigrations(upgradeDb, baseline.filter((migration) => migration.version <= version));
    assert.strictEqual(applyMigrations(upgradeDb, migrations), 61 - version);
    assert.deepStrictEqual(schemaSnapshot(upgradeDb), schemaSnapshot(baselineDb));
    upgradeDb.close();
  }

  baselineDb.close();
  currentDb.close();
  console.log('migrationModules.test.js: OK (61 SQL hashes, fresh/upgrade/idempotent schema parity)');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
