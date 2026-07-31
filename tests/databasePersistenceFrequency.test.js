const assert = require('node:assert/strict');
const initSqlJs = require('sql.js');
const { createPersistentDatabase } = require('../src/db/database');

async function createMeasuredDatabase(options = {}) {
  const SQL = await initSqlJs();
  const raw = new SQL.Database();
  let exports = 0;
  let persisted;
  const db = createPersistentDatabase(raw, 'unused.sqlite', {
    persistenceDelayMs: options.persistenceDelayMs,
    persistenceMaxDelayMs: options.persistenceMaxDelayMs,
    scheduler: options.scheduler,
    persistDatabase(_path, bytes) {
      exports += 1;
      persisted = Buffer.from(bytes);
      if (options.failPersist && options.failPersist()) throw new Error('temporary storage failure');
    }
  });
  return { db, raw, exportCount: () => exports, persisted: () => persisted };
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
    const { db, exportCount } = await createMeasuredDatabase({ persistenceDelayMs: 0 });
    const result = db.transaction(() => {
      db.exec('CREATE TABLE immediate_transaction (value TEXT)');
      db.prepare('INSERT INTO immediate_transaction VALUES (?)').run('safe');
      return 'committed';
    })();
    assert.equal(result, 'committed');
    assert.equal(exportCount(), 1, 'even immediate mode must never export inside an active transaction');
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
    db.exec('CREATE TABLE pending (value TEXT)');
    assert.throws(() => db.forceDurability(), /storage failure/);
    assert.equal(db.isDirty(), true, 'failed persistence must retain pending dirty state');
    allowPersist = true;
    db.close();
    assert.equal(attempts, 2, 'safe close must retry and flush pending dirty state');
  }

  {
    const { db, exportCount } = await createMeasuredDatabase();
    db.exec('CREATE TABLE burst (value INTEGER)');
    for (let value = 0; value < 500; value += 1) {
      db.prepare('INSERT INTO burst VALUES (?)').run(value);
    }
    assert.equal(exportCount(), 0, 'a burst must remain coalesced before its scheduled flush');
    assert.equal(db.forceDurability(), true);
    assert.equal(exportCount(), 1, 'hundreds of writes must require one export');
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM burst').get().count, 500);
  }

  {
    const timers = [];
    const scheduler = {
      setTimeout(callback, delay) {
        const timer = { callback, delay, canceled: false, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimeout(timer) { timer.canceled = true; }
    };
    const { db, exportCount } = await createMeasuredDatabase({
      persistenceDelayMs: 100,
      persistenceMaxDelayMs: 500,
      scheduler
    });
    db.exec('CREATE TABLE deadline (value TEXT)');
    for (let index = 0; index < 20; index += 1) {
      db.prepare('INSERT INTO deadline VALUES (?)').run(String(index));
    }
    assert.equal(exportCount(), 0);
    const maximum = timers.find((timer) => timer.delay === 500 && !timer.canceled);
    assert.ok(maximum, 'the first mutation must establish a maximum durability deadline');
    maximum.callback();
    assert.equal(exportCount(), 1, 'the maximum delay must flush a continuing write burst');
  }

  {
    const timers = [];
    const scheduler = {
      setTimeout(callback, delay) {
        const timer = { callback, delay, canceled: false, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimeout(timer) { timer.canceled = true; }
    };
    const { db, persisted } = await createMeasuredDatabase({ scheduler });
    db.exec('CREATE TABLE crash_window (value TEXT)');
    db.prepare('INSERT INTO crash_window VALUES (?)').run('pending');
    assert.equal(persisted(), undefined, 'a crash before scheduled flush can lose only the bounded pending window');
    const scheduled = timers.filter((timer) => timer.delay === 250 && !timer.canceled).pop();
    assert.ok(scheduled, 'dirty state must schedule a persistence flush');
    scheduled.callback();
    const SQL = await initSqlJs();
    const recovered = new SQL.Database(persisted());
    assert.equal(recovered.exec('SELECT value FROM crash_window')[0].values[0][0], 'pending');
    recovered.close();
  }

  {
    const timers = [];
    const errors = [];
    let shouldFail = true;
    const scheduler = {
      setTimeout(callback, delay) {
        const timer = { callback, delay, canceled: false, unref() {} };
        timers.push(timer);
        return timer;
      },
      clearTimeout(timer) { timer.canceled = true; }
    };
    const SQL = await initSqlJs();
    const db = createPersistentDatabase(new SQL.Database(), 'unused.sqlite', {
      scheduler,
      onPersistenceError(error) { errors.push(error); },
      persistDatabase() {
        if (shouldFail) throw new Error('scheduled failure');
      }
    });
    db.exec('CREATE TABLE scheduled_retry (value TEXT)');
    timers.filter((timer) => timer.delay === 250 && !timer.canceled).pop().callback();
    assert.equal(db.isDirty(), true, 'a failed scheduled flush must retain dirty state');
    assert.equal(errors.length, 1);
    shouldFail = false;
    timers.filter((timer) => timer.delay === 250 && !timer.canceled).pop().callback();
    assert.equal(db.isDirty(), false, 'a later scheduled retry must clear dirty state');
  }

  {
    const { db } = await createMeasuredDatabase();
    db.exec('CREATE TABLE transaction_results (value TEXT)');
    const result = db.transaction(() => {
      db.prepare('INSERT INTO transaction_results VALUES (?)').run('committed');
      return { saved: true };
    })();
    assert.deepEqual(result, { saved: true });
    assert.throws(() => db.transaction(async () => {
      db.prepare('INSERT INTO transaction_results VALUES (?)').run('rolled-back');
    })(), (error) => error.code === 'DATABASE_ASYNC_TRANSACTION');
    assert.deepEqual(
      db.prepare('SELECT value FROM transaction_results ORDER BY rowid').all(),
      [{ value: 'committed' }]
    );
  }

  console.log('databasePersistenceFrequency.test.js: OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
