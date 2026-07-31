const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');
const {
  TEMP_PREFIX,
  atomicPersist,
  cleanupOwnedTemporaryFiles,
  restoreBackup
} = require('../src/db/atomicPersistence');
const { initializeDatabase } = require('../src/db/database');
const { createShutdownCoordinator } = require('../src/appLifecycle');

const temporaryDirectory = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-atomic-'));
const ownedTemps = (directory) =>
  fs.readdirSync(directory).filter((name) => name.startsWith(TEMP_PREFIX));

async function run() {
  {
    for (const failedRename of [1, 2, 3]) {
      const directory = temporaryDirectory();
      const dbPath = path.join(directory, 'dchsi.sqlite');
      fs.writeFileSync(dbPath, 'valid-main');
      fs.writeFileSync(`${dbPath}.bak`, 'valid-backup');
      let renames = 0;
      const failingFs = {
        ...fs,
        renameSync(from, to) {
          renames += 1;
          if (renames === failedRename) throw new Error(`rename-${failedRename}`);
          return fs.renameSync(from, to);
        }
      };
      assert.throws(() => atomicPersist(dbPath, Buffer.from('valid-new'), { fs: failingFs }),
        new RegExp(`rename-${failedRename}`));
      const survivors = [dbPath, `${dbPath}.bak`]
        .filter((filePath) => fs.existsSync(filePath))
        .map((filePath) => fs.readFileSync(filePath, 'utf8'));
      assert.ok(survivors.some((value) => value.startsWith('valid-')),
        `rename stage ${failedRename} must retain a valid main or backup`);
    }
  }
  {
    const directory = temporaryDirectory();
    const dbPath = path.join(directory, 'dchsi.sqlite');
    fs.writeFileSync(dbPath, 'valid-main');
    fs.writeFileSync(`${dbPath}.bak`, 'valid-backup');
    const failingFs = { ...fs, fsyncSync() { throw new Error('simulated fsync failure'); } };
    assert.throws(() => atomicPersist(dbPath, Buffer.from('valid-new'), { fs: failingFs }), /fsync failure/);
    assert.strictEqual(fs.readFileSync(dbPath, 'utf8'), 'valid-main');
    assert.strictEqual(fs.readFileSync(`${dbPath}.bak`, 'utf8'), 'valid-backup');
  }
  {
    const directory = temporaryDirectory();
    const active = `${TEMP_PREFIX}101-aaaaaaaaaaaaaaaa`;
    const crashed = `${TEMP_PREFIX}202-bbbbbbbbbbbbbbbb`;
    const foreign = `${TEMP_PREFIX}not-owned`;
    fs.writeFileSync(path.join(directory, active), 'active');
    fs.writeFileSync(path.join(directory, crashed), 'crashed');
    fs.writeFileSync(path.join(directory, foreign), 'foreign');
    cleanupOwnedTemporaryFiles(directory, fs, {
      pid: 303,
      kill(pid) {
        if (pid === 101) return;
        throw Object.assign(new Error('missing'), { code: 'ESRCH' });
      }
    });
    assert.strictEqual(fs.existsSync(path.join(directory, active)), true);
    assert.strictEqual(fs.existsSync(path.join(directory, crashed)), false);
    assert.strictEqual(fs.existsSync(path.join(directory, foreign)), true);
  }
  {
    const directory = temporaryDirectory();
    const dbPath = path.join(directory, 'dchsi.sqlite');
    fs.writeFileSync(dbPath, 'old');
    atomicPersist(dbPath, Buffer.from('new'));
    assert.strictEqual(fs.readFileSync(dbPath, 'utf8'), 'new');
    assert.strictEqual(fs.readFileSync(`${dbPath}.bak`, 'utf8'), 'old');
    assert.deepStrictEqual(ownedTemps(directory), []);
  }
  {
    const directory = temporaryDirectory();
    const dbPath = path.join(directory, 'dchsi.sqlite');
    fs.writeFileSync(dbPath, 'valid');
    const failingFs = { ...fs, writeSync() { throw new Error('simulated write failure'); } };
    assert.throws(() => atomicPersist(dbPath, Buffer.from('new'), { fs: failingFs }), /write failure/);
    assert.strictEqual(fs.readFileSync(dbPath, 'utf8'), 'valid');
    assert.deepStrictEqual(ownedTemps(directory), []);
  }
  {
    const directory = temporaryDirectory();
    const dbPath = path.join(directory, 'dchsi.sqlite');
    fs.writeFileSync(dbPath, 'valid');
    const stalledFs = { ...fs, writeSync() { return 0; } };
    assert.throws(() => atomicPersist(dbPath, Buffer.from('new'), { fs: stalledFs }),
      (error) => error.code === 'DATABASE_WRITE_STALLED');
    assert.strictEqual(fs.readFileSync(dbPath, 'utf8'), 'valid');
    assert.deepStrictEqual(ownedTemps(directory), []);
  }
  {
    const directory = temporaryDirectory();
    const dbPath = path.join(directory, 'dchsi.sqlite');
    fs.writeFileSync(dbPath, 'valid');
    let renames = 0;
    const failingFs = {
      ...fs,
      renameSync(from, to) {
        renames += 1;
        if (renames === 2) throw new Error('simulated replacement failure');
        return fs.renameSync(from, to);
      }
    };
    assert.throws(() => atomicPersist(dbPath, Buffer.from('new'), { fs: failingFs }), /replacement failure/);
    assert.strictEqual(fs.readFileSync(dbPath, 'utf8'), 'valid');
    assert.deepStrictEqual(ownedTemps(directory), []);
  }
  {
    const root = temporaryDirectory();
    const dataDirectory = path.join(root, 'data');
    fs.mkdirSync(dataDirectory);
    const dbPath = path.join(dataDirectory, 'dchsi.sqlite');
    const SQL = await initSqlJs();
    const backupDb = new SQL.Database();
    backupDb.exec('CREATE TABLE recovery_marker (value TEXT); INSERT INTO recovery_marker VALUES ("safe");');
    const backupBytes = Buffer.from(backupDb.export());
    backupDb.close();
    fs.writeFileSync(dbPath, 'corrupt');
    fs.writeFileSync(`${dbPath}.bak`, backupBytes);
    let offered = false;
    const database = await initializeDatabase(root, {
      offerBackupRecovery: async ({ mainExists }) => {
        offered = true;
        assert.strictEqual(mainExists, true);
        return true;
      }
    });
    assert.strictEqual(offered, true);
    assert.strictEqual(database.prepare('SELECT value FROM recovery_marker').get().value, 'safe');
    const retainedBackup = new SQL.Database(fs.readFileSync(`${dbPath}.bak`));
    const markerResult = retainedBackup.exec('SELECT value FROM recovery_marker');
    assert.strictEqual(markerResult[0].values[0][0], 'safe');
    retainedBackup.close();
  }
  {
    const directory = temporaryDirectory();
    const dbPath = path.join(directory, 'dchsi.sqlite');
    fs.writeFileSync(`${dbPath}.bak`, 'backup');
    restoreBackup(dbPath, Buffer.from('backup'));
    assert.strictEqual(fs.readFileSync(dbPath, 'utf8'), 'backup');
    assert.strictEqual(fs.readFileSync(`${dbPath}.bak`, 'utf8'), 'backup');
  }
  {
    const root = temporaryDirectory();
    const database = await initializeDatabase(root);
    database.exec('CREATE TABLE baseline_round_trip (id INTEGER PRIMARY KEY, value TEXT NOT NULL)');
    database.prepare('INSERT INTO baseline_round_trip (value) VALUES (?)').run('persisted');
    database.close();

    const reopened = await initializeDatabase(root);
    assert.deepStrictEqual(
      reopened.prepare('SELECT id, value FROM baseline_round_trip').all(),
      [{ id: 1, value: 'persisted' }],
      'a committed database mutation must survive close and startup recovery'
    );
    reopened.close();
  }
  {
    const root = temporaryDirectory();
    const dataDirectory = path.join(root, 'data');
    fs.mkdirSync(dataDirectory);
    const dbPath = path.join(dataDirectory, 'dchsi.sqlite');
    const validRoot = temporaryDirectory();
    const valid = await initializeDatabase(validRoot);
    valid.exec('CREATE TABLE recovery_case (value TEXT)');
    valid.prepare('INSERT INTO recovery_case VALUES (?)').run('backup');
    valid.close();
    const validBytes = fs.readFileSync(path.join(validRoot, 'data', 'dchsi.sqlite'));

    fs.writeFileSync(`${dbPath}.bak`, validBytes);
    await assert.rejects(initializeDatabase(root, { offerBackupRecovery: async () => false }),
      (error) => error.code === 'DATABASE_RECOVERY_DECLINED');
    const recovered = await initializeDatabase(root, { offerBackupRecovery: async (details) => {
      assert.strictEqual(details.reason, 'main-missing');
      return true;
    } });
    assert.strictEqual(recovered.prepare('SELECT value FROM recovery_case').get().value, 'backup');
    recovered.close();

    fs.writeFileSync(dbPath, 'corrupt-main');
    fs.writeFileSync(`${dbPath}.bak`, 'corrupt-backup');
    await assert.rejects(initializeDatabase(root),
      (error) => error.code === 'DATABASE_BACKUP_CORRUPT');

    fs.rmSync(`${dbPath}.bak`);
    await assert.rejects(initializeDatabase(root),
      (error) => error.code === 'DATABASE_MAIN_CORRUPT');

    fs.writeFileSync(`${dbPath}.bak`, validBytes);
    await assert.rejects(initializeDatabase(root, {
      offerBackupRecovery: async () => true,
      restoreBackup() { throw new Error('injected restore failure'); }
    }), (error) => error.code === 'DATABASE_RECOVERY_FAILED');
  }
  {
    const calls = [];
    let releaseWorker;
    const workerClosed = new Promise((resolve) => { releaseWorker = resolve; });
    const app = { quit: () => calls.push('quit') };
    const coordinator = createShutdownCoordinator({
      app,
      database: { flush: () => calls.push('flush') },
      workerRunner: { close: async () => { calls.push('worker-close'); await workerClosed; } }
    });
    const event = { preventDefault: () => calls.push('prevent') };
    coordinator.beforeQuit(event);
    coordinator.beforeQuit(event);
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepStrictEqual(calls, ['prevent', 'flush', 'prevent', 'worker-close']);
    releaseWorker();
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepStrictEqual(calls, ['prevent', 'flush', 'prevent', 'worker-close', 'quit']);
    coordinator.beforeQuit({ preventDefault: () => calls.push('unexpected-prevent') });
    assert.strictEqual(calls.includes('unexpected-prevent'), false);
  }
  {
    const errors = [];
    let workerClosed = false;
    const coordinator = createShutdownCoordinator({
      app: { quit: () => assert.fail('quit must remain blocked after a failed flush') },
      database: { flush: () => { throw new Error('flush failed'); } },
      workerRunner: { close: async () => { workerClosed = true; } },
      onError: (error) => errors.push(error.message)
    });
    coordinator.beforeQuit({ preventDefault() {} });
    await new Promise((resolve) => setImmediate(resolve));
    assert.strictEqual(workerClosed, true);
    assert.deepStrictEqual(errors, ['flush failed']);
    assert.strictEqual(coordinator.isQuitAllowed(), false);
  }
  console.log('atomicPersistence.test.js: OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
