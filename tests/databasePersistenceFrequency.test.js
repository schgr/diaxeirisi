const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');
const { createPersistentDatabase } = require('../src/db/database');

async function createMeasuredDatabase() {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  let exports = 0;
  const db = createPersistentDatabase(raw, 'unused.sqlite', {
    persistDatabase() {
      exports += 1;
    }
  });
  return { db, raw, exportCount: () => exports };
}

async function run() {
  {
    const { db, exportCount } = await createMeasuredDatabase();
    db.exec('SELECT 1');
    db.prepare('SELECT 2 AS value').get();
    db.pragma('foreign_keys');
    db.pragma('foreign_keys = ON');
    assert.equal(exportCount(), 0, 'read-only work must not export');
  }

  {
    const { db, exportCount } = await createMeasuredDatabase();
    db.transaction(() => {
      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)');
      db.prepare('INSERT INTO items (value) VALUES (?)').run('one');
      db.prepare('INSERT INTO items (value) VALUES (?)').run('two');
      db.prepare('UPDATE items SET value = ? WHERE id = ?').run('updated', 1);
    })();
    assert.equal(exportCount(), 1, 'a complex domain transaction must export exactly once');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM items').get().count, 2);
  }

  {
    const { db, exportCount } = await createMeasuredDatabase();
    db.exec('CREATE TABLE committed (value TEXT)');
    const before = exportCount();
    db.transaction(() => {
      db.prepare('INSERT INTO committed VALUES (?)').run('yes');
    })();
    assert.equal(exportCount(), before + 1, 'outer commit must export once');
  }

  {
    const { db, exportCount } = await createMeasuredDatabase();
    db.exec('CREATE TABLE rolled_back (value TEXT)');
    const before = exportCount();
    assert.throws(() => db.transaction(() => {
      db.prepare('INSERT INTO rolled_back VALUES (?)').run('no');
      throw new Error('rollback');
    })(), /rollback/);
    assert.equal(exportCount(), before, 'rollback must not export');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM rolled_back').get().count, 0);
  }

  {
    const { db, exportCount } = await createMeasuredDatabase();
    db.exec('CREATE TABLE nested (value TEXT)');
    const before = exportCount();
    db.transaction(() => {
      db.prepare('INSERT INTO nested VALUES (?)').run('outer');
      db.transaction(() => {
        db.prepare('INSERT INTO nested VALUES (?)').run('inner');
      })();
    })();
    assert.equal(exportCount(), before + 1, 'nested transactions must share one outer export');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM nested').get().count, 2);
  }

  {
    const { db, exportCount } = await createMeasuredDatabase();
    db.exec('CREATE TABLE nested_rollback (value TEXT)');
    const before = exportCount();
    db.transaction(() => {
      db.prepare('INSERT INTO nested_rollback VALUES (?)').run('outer');
      assert.throws(() => db.transaction(() => {
        db.prepare('INSERT INTO nested_rollback VALUES (?)').run('inner');
        throw new Error('nested rollback');
      })(), /nested rollback/);
    })();
    assert.equal(exportCount(), before + 1);
    assert.deepEqual(
      db.prepare('SELECT value FROM nested_rollback ORDER BY rowid').all(),
      [{ value: 'outer' }],
      'a caught nested rollback must not leak its failed state'
    );
  }

  {
    const SQL = await initSqlJs();
    const raw = new SQL.Database();
    let attempts = 0;
    let allowPersist = false;
    const db = createPersistentDatabase(raw, 'unused.sqlite', {
      persistDatabase() {
        attempts += 1;
        if (!allowPersist) throw new Error('temporary storage failure');
      }
    });
    assert.throws(() => db.exec('CREATE TABLE pending (value TEXT)'), /storage failure/);
    assert.equal(db.isDirty(), true, 'failed persistence must retain pending dirty state');
    allowPersist = true;
    db.close();
    assert.equal(attempts, 2, 'safe close must retry and flush pending dirty state');
  }

  console.log('databasePersistenceFrequency.test.js: OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
