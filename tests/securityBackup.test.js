const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const ExcelJS = require('exceljs');
const { createSecurityService } = require('../src/services/securityService');
const {
  createBackupService,
  applyPendingRestore,
  EXPECTED_SCHEMA_VERSION,
  SQL_JS_DIRECTORY
} = require('../src/services/backupService');
const { createHeavyTaskRunner } = require('../src/workers/heavyTaskRunner');
const { MANIFEST_HASH_FILE } = require('../src/workers/backupWorkerTasks');

function expectCode(operation, code) {
  assert.throws(operation, (error) => error && error.code === code);
}

async function sqliteFixture(marker) {
  const SQL = await initSqlJs({ locateFile: (file) => path.join(SQL_JS_DIRECTORY, file) });
  const database = new SQL.Database();
  database.exec(`
    CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY, name TEXT);
    INSERT INTO schema_migrations VALUES (${EXPECTED_SCHEMA_VERSION}, 'current');
    CREATE TABLE service_settings(id INTEGER PRIMARY KEY, marker TEXT);
    INSERT INTO service_settings VALUES (1, '${marker}');
    CREATE TABLE shares(id INTEGER PRIMARY KEY);
    CREATE TABLE share_transactions(id INTEGER PRIMARY KEY);
    CREATE TABLE inventory_sessions(id INTEGER PRIMARY KEY);
    CREATE TABLE inventory_items(id INTEGER PRIMARY KEY);
  `);
  const bytes = Buffer.from(database.export());
  database.close();
  return bytes;
}

function writeManifest(backupPath, manifest) {
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
  fs.writeFileSync(path.join(backupPath, 'backup-manifest.json'), bytes);
  fs.writeFileSync(path.join(backupPath, MANIFEST_HASH_FILE),
    `${crypto.createHash('sha256').update(bytes).digest('hex')}\n`);
}

function runSecurityTests(root) {
  let currentTime = Date.now();
  const security = createSecurityService(path.join(root, 'security'), () => currentTime);
  assert.deepStrictEqual(security.status().configured, false);
  expectCode(() => security.setup('ab', '123456', '123456'), 'USERNAME_INVALID');
  expectCode(() => security.setup('admin', '123', '123'), 'PASSWORD_TOO_SHORT');
  const setup = security.setup('διαχειριστής', 'ασφαλής-κωδικός', 'ασφαλής-κωδικός');
  assert.strictEqual(security.isUnlocked(), true);
  assert.match(setup.recoveryCode, /^[A-F0-9]{4}(?:-[A-F0-9]{4}){5}$/);
  assert.strictEqual(security.status().recoveryConfigured, true);

  security.lock();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    expectCode(() => security.login('διαχειριστής', 'λάθος'), 'AUTH_INVALID_CREDENTIALS');
  }
  expectCode(() => security.login('διαχειριστής', 'ασφαλής-κωδικός'), 'AUTH_RATE_LIMITED');
  // Clear the lockout by clearing failed attempts
  const config = JSON.parse(fs.readFileSync(path.join(root, 'security', 'security.json'), 'utf8'));
  config.failedAttempts = 0;
  config.lockedUntil = 0;
  config.lockoutCount = 0;
  fs.writeFileSync(path.join(root, 'security', 'security.json'), JSON.stringify(config, null, 2));
  security.login('διαχειριστής', 'ασφαλής-κωδικός');
  security.changeCredentials('ασφαλής-κωδικός', 'υπεύθυνος', 'νέος-κωδικός', 'νέος-κωδικός');
  const recovery = security.createRecoveryCode();
  assert.match(recovery.recoveryCode, /^[A-F0-9]{4}(?:-[A-F0-9]{4}){5}$/);
  assert.strictEqual(security.status().recoveryConfigured, true);
  security.lock();
  expectCode(() => security.login('διαχειριστής', 'νέος-κωδικός'), 'AUTH_INVALID_CREDENTIALS');
  expectCode(
    () => security.recover('WRONG-CODE', 'ανακτημένος', 'κωδικός-ανάκτησης', 'κωδικός-ανάκτησης'),
    'RECOVERY_CODE_INVALID'
  );
  security.recover(recovery.recoveryCode, 'ανακτημένος', 'κωδικός-ανάκτησης', 'κωδικός-ανάκτησης');
  assert.strictEqual(security.status().recoveryConfigured, false);
  security.lock();
  expectCode(() => security.login('υπεύθυνος', 'νέος-κωδικός'), 'AUTH_INVALID_CREDENTIALS');
  security.login('ανακτημένος', 'κωδικός-ανάκτησης');

  const stored = fs.readFileSync(path.join(root, 'security', 'security.json'), 'utf8');
  assert.ok(!stored.includes('κωδικός-ανάκτησης'));
  assert.ok(!stored.includes(recovery.recoveryCode));
  assert.ok(stored.includes('ανακτημένος'));

  const legacyPath = path.join(root, 'legacy-security');
  const legacyWriter = createSecurityService(legacyPath, () => currentTime);
  legacyWriter.setup('admin', 'παλιός-κωδικός', 'παλιός-κωδικός');
  legacyWriter.lock();
  const legacyConfigPath = path.join(legacyPath, 'security.json');
  const legacyConfig = JSON.parse(fs.readFileSync(legacyConfigPath, 'utf8'));
  delete legacyConfig.username;
  legacyConfig.version = 1;
  fs.writeFileSync(legacyConfigPath, JSON.stringify(legacyConfig), 'utf8');
  const legacyReader = createSecurityService(legacyPath, () => currentTime);
  assert.strictEqual(legacyReader.status().username, 'admin');
  legacyReader.login('admin', 'παλιός-κωδικός');
}

async function runBackupTests(root) {
  const SQL = await initSqlJs({ locateFile: (file) => path.join(SQL_JS_DIRECTORY, file) });
  const userData = path.join(root, 'userdata');
  const databasePath = path.join(userData, 'data', 'dchsi.sqlite');
  const photoPath = path.join(userData, 'photos', 'material.png');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.mkdirSync(path.dirname(photoPath), { recursive: true });
  const originalDatabase = await sqliteFixture('original-data');
  fs.writeFileSync(databasePath, originalDatabase);
  fs.writeFileSync(photoPath, 'original-photo');

  const runner = createHeavyTaskRunner();
  let snapshot = originalDatabase;
  let flushes = 0;
  const backupService = createBackupService(userData, {
    retention: 2,
    runner,
    flush: () => { flushes += 1; },
    exportSnapshot: () => snapshot
  });
  const automatic = await backupService.createAutomatic(true);
  assert.strictEqual(flushes, 1, 'backup must flush pending database writes before snapshot export');
  assert.ok(fs.existsSync(path.join(automatic.path, 'data', 'dchsi.sqlite')));
  assert.ok(fs.existsSync(path.join(automatic.path, 'photos', 'material.png')));
  assert.strictEqual(backupService.list().length, 1);
  const automaticManifest = JSON.parse(fs.readFileSync(
    path.join(automatic.path, 'backup-manifest.json'), 'utf8'
  ));
  assert.strictEqual(automaticManifest.version, 3);
  assert.strictEqual(automaticManifest.appVersion, require('../package.json').version);
  assert.match(automaticManifest.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.strictEqual(automaticManifest.kind, 'automatic');
  assert.ok(fs.existsSync(path.join(automatic.path, MANIFEST_HASH_FILE)));

  const manualRoot = path.join(root, 'manual');
  const workbookPath = path.join(root, 'concurrent-import.xlsx');
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Data').addRow(['backup', 'excel']);
  await workbook.xlsx.writeFile(workbookPath);
  const [manual, matrix] = await Promise.all([
    backupService.createManual(manualRoot),
    runner.run('read-excel-matrix', { filePath: workbookPath })
  ]);
  assert.deepStrictEqual(matrix, [['backup', 'excel']]);
  assert.ok(manual.path.startsWith(manualRoot));
  await assert.rejects(backupService.createManual(path.join(userData, 'photos')),
    (error) => error && error.code === 'BACKUP_DESTINATION_UNSAFE');
  await backupService.prepareRestore(manual.path);
  assert.ok(flushes >= 3, 'restore preparation must flush pending database writes');

  snapshot = await sqliteFixture('changed-data');
  fs.writeFileSync(databasePath, snapshot);
  fs.writeFileSync(photoPath, 'changed-photo');
  assert.strictEqual((await applyPendingRestore(userData, runner)).applied, true);
  assert.deepStrictEqual(fs.readFileSync(databasePath), originalDatabase);
  assert.strictEqual(fs.readFileSync(photoPath, 'utf8'), 'original-photo');
  assert.strictEqual((await applyPendingRestore(userData, runner)).applied, false);

  const invalidChecksum = path.join(root, 'invalid-checksum');
  fs.cpSync(manual.path, invalidChecksum, { recursive: true });
  fs.writeFileSync(path.join(invalidChecksum, 'photos', 'material.png'), 'tampered');
  await assert.rejects(backupService.prepareRestore(invalidChecksum),
    (error) => error && error.code === 'BACKUP_CHECKSUM_MISMATCH');

  const missingPhoto = path.join(root, 'missing-photo');
  fs.cpSync(manual.path, missingPhoto, { recursive: true });
  fs.rmSync(path.join(missingPhoto, 'photos', 'material.png'));
  await assert.rejects(backupService.prepareRestore(missingPhoto),
    (error) => error && error.code === 'BACKUP_FILE_MISSING');

  const corruptDatabase = path.join(root, 'corrupt-database');
  fs.cpSync(manual.path, corruptDatabase, { recursive: true });
  const corruptPath = path.join(corruptDatabase, 'data', 'dchsi.sqlite');
  fs.writeFileSync(corruptPath, Buffer.from('not sqlite'));
  const corruptManifestPath = path.join(corruptDatabase, 'backup-manifest.json');
  const corruptManifest = JSON.parse(fs.readFileSync(corruptManifestPath, 'utf8'));
  corruptManifest.database.size = fs.statSync(corruptPath).size;
  corruptManifest.database.sha256 = crypto.createHash('sha256').update(fs.readFileSync(corruptPath)).digest('hex');
  writeManifest(corruptDatabase, corruptManifest);
  await assert.rejects(backupService.prepareRestore(corruptDatabase),
    (error) => error && error.code === 'BACKUP_DATABASE_INVALID');

  const tamperedManifest = path.join(root, 'tampered-manifest');
  fs.cpSync(manual.path, tamperedManifest, { recursive: true });
  const tamperedManifestPath = path.join(tamperedManifest, 'backup-manifest.json');
  const tampered = JSON.parse(fs.readFileSync(tamperedManifestPath, 'utf8'));
  tampered.kind = 'automatic';
  fs.writeFileSync(tamperedManifestPath, JSON.stringify(tampered, null, 2));
  await assert.rejects(backupService.prepareRestore(tamperedManifest),
    (error) => error && error.code === 'BACKUP_MANIFEST_TAMPERED');

  const missingManifestHash = path.join(root, 'missing-manifest-hash');
  fs.cpSync(manual.path, missingManifestHash, { recursive: true });
  fs.rmSync(path.join(missingManifestHash, MANIFEST_HASH_FILE));
  await assert.rejects(backupService.prepareRestore(missingManifestHash),
    (error) => error && error.code === 'BACKUP_MANIFEST_TAMPERED');

  const unsafeManifest = path.join(root, 'unsafe-manifest');
  fs.cpSync(manual.path, unsafeManifest, { recursive: true });
  const unsafe = JSON.parse(fs.readFileSync(path.join(unsafeManifest, 'backup-manifest.json'), 'utf8'));
  unsafe.files[0].path = '../outside.png';
  writeManifest(unsafeManifest, unsafe);
  await assert.rejects(backupService.prepareRestore(unsafeManifest),
    (error) => error && error.code === 'BACKUP_PATH_UNSAFE');

  const coordinatedTamper = path.join(root, 'coordinated-manifest-tamper');
  fs.cpSync(manual.path, coordinatedTamper, { recursive: true });
  const coordinated = JSON.parse(fs.readFileSync(
    path.join(coordinatedTamper, 'backup-manifest.json'), 'utf8'
  ));
  coordinated.kind = 'unsupported-kind';
  writeManifest(coordinatedTamper, coordinated);
  await assert.rejects(backupService.prepareRestore(coordinatedTamper),
    (error) => error && error.code === 'BACKUP_MANIFEST_INVALID');

  const sourceManifest = JSON.parse(fs.readFileSync(path.join(manual.path, 'backup-manifest.json'), 'utf8'));
  for (const [index, item] of [sourceManifest.database, ...sourceManifest.files].entries()) {
    const corrupted = path.join(root, `corrupted-file-${index}`);
    fs.cpSync(manual.path, corrupted, { recursive: true });
    fs.appendFileSync(path.join(corrupted, item.path), 'corruption');
    await assert.rejects(backupService.prepareRestore(corrupted),
      (error) => error && error.code === 'BACKUP_CHECKSUM_MISMATCH');
  }

  const newerSchema = path.join(root, 'newer-schema');
  fs.cpSync(manual.path, newerSchema, { recursive: true });
  const newerDatabasePath = path.join(newerSchema, 'data', 'dchsi.sqlite');
  const newerDatabase = new SQL.Database(fs.readFileSync(newerDatabasePath));
  newerDatabase.exec(`INSERT INTO schema_migrations VALUES (${EXPECTED_SCHEMA_VERSION + 1}, 'future');`);
  const newerBytes = Buffer.from(newerDatabase.export());
  newerDatabase.close();
  fs.writeFileSync(newerDatabasePath, newerBytes);
  const newerManifest = JSON.parse(fs.readFileSync(path.join(newerSchema, 'backup-manifest.json'), 'utf8'));
  newerManifest.schemaVersion = EXPECTED_SCHEMA_VERSION + 1;
  newerManifest.database.size = newerBytes.length;
  newerManifest.database.sha256 = crypto.createHash('sha256').update(newerBytes).digest('hex');
  writeManifest(newerSchema, newerManifest);
  await assert.rejects(backupService.prepareRestore(newerSchema),
    (error) => error && error.code === 'BACKUP_SCHEMA_UNSUPPORTED');

  const symlinkBackup = path.join(root, 'symlink-backup');
  fs.cpSync(manual.path, symlinkBackup, { recursive: true });
  const outsideDirectory = path.join(root, 'outside-junction');
  fs.mkdirSync(outsideDirectory);
  fs.writeFileSync(path.join(outsideDirectory, 'secret.txt'), 'secret');
  fs.symlinkSync(outsideDirectory, path.join(symlinkBackup, 'unsafe-link'), 'junction');
  await assert.rejects(backupService.prepareRestore(symlinkBackup),
    (error) => error && error.code === 'BACKUP_PATH_UNSAFE');

  for (const failAt of ['afterDatabaseWrite', 'afterFilesCopy', 'afterManifestWrite', 'afterPublish']) {
    const interruptedRoot = path.join(root, `interrupted-${failAt}`);
    await assert.rejects(runner.run('backup-create', {
      destinationRoot: interruptedRoot,
      photosPath: path.join(userData, 'photos'),
      databaseSnapshot: originalDatabase,
      appVersion: 'test',
      kind: 'test',
      sqlJsDirectory: SQL_JS_DIRECTORY,
      expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
      failAt
    }), (error) => error && error.code === 'BACKUP_INJECTED_FAILURE');
    const remnants = fs.existsSync(interruptedRoot) ? fs.readdirSync(interruptedRoot) : [];
    assert.deepStrictEqual(remnants, [], `interrupted backup must leave no remnants at ${failAt}`);
  }

  const concurrentRoot = path.join(root, 'concurrent-userdata');
  fs.mkdirSync(path.join(concurrentRoot, 'data'), { recursive: true });
  fs.mkdirSync(path.join(concurrentRoot, 'photos'), { recursive: true });
  fs.writeFileSync(path.join(concurrentRoot, 'data', 'dchsi.sqlite'), originalDatabase);
  let concurrentFlushes = 0;
  const concurrentService = createBackupService(concurrentRoot, {
    retention: 2,
    runner,
    flush: async () => {
      concurrentFlushes += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
    },
    exportSnapshot: () => Buffer.from(originalDatabase)
  });
  const concurrentResults = await Promise.all([
    concurrentService.createAutomatic(false),
    concurrentService.createAutomatic(false),
    concurrentService.createAutomatic(false)
  ]);
  assert.strictEqual(concurrentFlushes, 1, 'daily eligibility must be rechecked after acquiring the mutex');
  assert.strictEqual(concurrentResults.filter((result) => result.skipped).length, 2);

  await Promise.all([
    concurrentService.createAutomatic(true),
    concurrentService.createAutomatic(true),
    concurrentService.createAutomatic(true)
  ]);
  assert.strictEqual(concurrentService.list().length, 2, 'retention must run inside the critical queue');

  const corruptRetention = path.join(
    concurrentRoot,
    'backups',
    `Diaxeirisi-Backup-corrupt-${Date.now()}`
  );
  fs.cpSync(concurrentService.list()[0].path, corruptRetention, { recursive: true });
  const corruptRetentionPhoto = path.join(corruptRetention, 'data', 'dchsi.sqlite');
  fs.appendFileSync(corruptRetentionPhoto, 'corrupt');
  await Promise.all([
    concurrentService.createAutomatic(true),
    concurrentService.createAutomatic(true)
  ]);
  assert.strictEqual(fs.existsSync(corruptRetention), true,
    'retention must ignore corrupt or incomplete backup directories');
  assert.strictEqual(concurrentService.list().filter((backup) => backup.path !== corruptRetention).length, 2);

  await assert.rejects(runner.run('backup-create', {
    destinationRoot: path.join(root, 'no-space'),
    photosPath: path.join(userData, 'photos'),
    databaseSnapshot: originalDatabase,
    kind: 'test',
    sqlJsDirectory: SQL_JS_DIRECTORY,
    expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
    availableBytes: 1
  }), (error) => error && error.code === 'BACKUP_INSUFFICIENT_SPACE');

  await backupService.prepareRestore(manual.path);
  const beforeFailedRestore = await sqliteFixture('before-failure');
  fs.writeFileSync(databasePath, beforeFailedRestore);
  fs.writeFileSync(photoPath, 'before-failure-photo');
  await assert.rejects(applyPendingRestore(userData, runner, { failAt: 'afterDatabaseReplace' }),
    (error) => error && error.code === 'RESTORE_INJECTED_FAILURE');
  assert.deepStrictEqual(fs.readFileSync(databasePath), beforeFailedRestore);
  assert.strictEqual(fs.readFileSync(photoPath, 'utf8'), 'before-failure-photo');

  await backupService.prepareRestore(manual.path);
  const beforePhotoFailure = await sqliteFixture('before-photo-failure');
  fs.writeFileSync(databasePath, beforePhotoFailure);
  fs.writeFileSync(photoPath, 'before-photo-failure-photo');
  await assert.rejects(applyPendingRestore(userData, runner, { failAt: 'afterPhotosReplace' }),
    (error) => error && error.code === 'RESTORE_INJECTED_FAILURE');
  assert.deepStrictEqual(fs.readFileSync(databasePath), beforePhotoFailure);
  assert.strictEqual(fs.readFileSync(photoPath, 'utf8'), 'before-photo-failure-photo');
  await runner.close();
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-security-backup-'));
(async () => {
  try {
    runSecurityTests(root);
    await runBackupTests(root);
    console.log('Security and verified backup/restore tests passed.');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
