const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const initSqlJs = require('sql.js');
const { TEMP_PREFIX, atomicPersist, restoreBackup } = require('../src/db/atomicPersistence');
const { initializeDatabase } = require('../src/db/database');

const temporaryDirectory = () => fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-atomic-'));
const ownedTemps = (directory) =>
  fs.readdirSync(directory).filter((name) => name.startsWith(TEMP_PREFIX));

async function run() {
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
  console.log('atomicPersistence.test.js: OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
