const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const initSqlJs = require('sql.js');
const { createSecurityService } = require('../src/services/securityService');
const {
  createBackupService,
  applyPendingRestore,
  EXPECTED_SCHEMA_VERSION,
  SQL_JS_DIRECTORY
} = require('../src/services/backupService');
const { createHeavyTaskRunner } = require('../src/workers/heavyTaskRunner');

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

function runSecurityTests(root) {
  let currentTime = Date.now();
  const security = createSecurityService(path.join(root, 'security'), () => currentTime);
  const securityQuestions = [
    { question: 'Ποια είναι η πρώτη μονάδα σας;', answer: 'Αλφα' },
    { question: 'Ποιο είναι το αγαπημένο σας χρώμα;', answer: 'Μπλε' },
    { question: 'Ποια είναι η πόλη γέννησής σας;', answer: 'Αθήνα' }
  ];

  assert.deepStrictEqual(security.status().configured, false);
  expectCode(() => security.setup('ab', '123456', '123456'), 'USERNAME_INVALID');
  expectCode(() => security.setup('admin', '123', '123'), 'PASSWORD_TOO_SHORT');
  security.setup('διαχειριστής', 'ασφαλής-κωδικός', 'ασφαλής-κωδικός', securityQuestions);
  assert.strictEqual(security.isUnlocked(), true);
  assert.strictEqual(security.status().securityQuestionsConfigured, true);

  security.lock();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    expectCode(() => security.login('διαχειριστής', 'λάθος'), 'AUTH_INVALID_CREDENTIALS');
  }
  expectCode(() => security.login('διαχειριστής', 'ασφαλής-κωδικός'), 'AUTH_RATE_LIMITED');
  currentTime += 31_000;
  security.login('διαχειριστής', 'ασφαλής-κωδικός');
  security.changeCredentials('ασφαλής-κωδικός', 'υπεύθυνος', 'νέος-κωδικός', 'νέος-κωδικός');
  const recovery = security.answerSecurityQuestions(['αλφα', ' ΜΠΛΕ ', 'αθήνα']);
  assert.match(recovery.recoveryCode, /^[A-F0-9]{4}(?:-[A-F0-9]{4}){5}$/);
  const secondRecovery = security.answerSecurityQuestions(['αλφα', 'μπλε', 'αθήνα']);
  assert.notStrictEqual(secondRecovery.recoveryCode, recovery.recoveryCode);
  recovery.recoveryCode = secondRecovery.recoveryCode;
  assert.strictEqual(security.status().recoveryConfigured, true);
  security.lock();
  expectCode(() => security.login('διαχειριστής', 'νέος-κωδικός'), 'AUTH_INVALID_CREDENTIALS');
  expectCode(
    () => security.recover('WRONG-CODE', 'ανακτημένος', 'κωδικός-ανάκτησης', 'κωδικός-ανάκτησης'),
    'RECOVERY_CODE_INVALID'
  );
  security.recover(recovery.recoveryCode, 'ανακτημένος', 'κωδικός-ανάκτησης', 'κωδικός-ανάκτησης');
  assert.strictEqual(security.status().recoveryConfigured, true);
  security.lock();
  expectCode(() => security.login('υπεύθυνος', 'νέος-κωδικός'), 'AUTH_INVALID_CREDENTIALS');
  security.login('ανακτημένος', 'κωδικός-ανάκτησης');

  const stored = fs.readFileSync(path.join(root, 'security', 'security.json'), 'utf8');
  assert.ok(!stored.includes('κωδικός-ανάκτησης'));
  assert.ok(!stored.includes(recovery.recoveryCode));
  assert.ok(stored.includes('ανακτημένος'));

  const legacyPath = path.join(root, 'legacy-security');
  const legacyWriter = createSecurityService(legacyPath, () => currentTime);
  legacyWriter.setup('admin', 'παλιός-κωδικός', 'παλιός-κωδικός', securityQuestions);
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
  const backupService = createBackupService(userData, {
    retention: 2,
    runner,
    exportSnapshot: () => snapshot
  });
  const automatic = await backupService.createAutomatic(true);
  assert.ok(fs.existsSync(path.join(automatic.path, 'data', 'dchsi.sqlite')));
  assert.ok(fs.existsSync(path.join(automatic.path, 'photos', 'material.png')));
  assert.strictEqual(backupService.list().length, 1);

  const manualRoot = path.join(root, 'manual');
  const manual = await backupService.createManual(manualRoot);
  assert.ok(manual.path.startsWith(manualRoot));
  await assert.rejects(backupService.createManual(path.join(userData, 'photos')),
    (error) => error && error.code === 'BACKUP_DESTINATION_UNSAFE');
  await backupService.prepareRestore(manual.path);

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
  fs.writeFileSync(corruptManifestPath, JSON.stringify(corruptManifest));
  await assert.rejects(backupService.prepareRestore(corruptDatabase),
    (error) => error && error.code === 'BACKUP_DATABASE_INVALID');

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
