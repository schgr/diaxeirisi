const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSecurityService } = require('../src/services/securityService');
const { createBackupService, applyPendingRestore } = require('../src/services/backupService');

function expectCode(operation, code) {
  assert.throws(operation, (error) => error && error.code === code);
}

function sqliteFixture(marker) {
  return Buffer.concat([Buffer.from('SQLite format 3\u0000'), Buffer.from(marker)]);
}

function runSecurityTests(root) {
  let currentTime = Date.now();
  const security = createSecurityService(path.join(root, 'security'), () => currentTime);

  assert.deepStrictEqual(security.status().configured, false);
  expectCode(() => security.setup('123', '123'), 'PASSWORD_TOO_SHORT');
  security.setup('ασφαλής-κωδικός', 'ασφαλής-κωδικός');
  assert.strictEqual(security.isUnlocked(), true);

  security.lock();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    expectCode(() => security.login('λάθος'), 'AUTH_INVALID_PASSWORD');
  }
  expectCode(() => security.login('ασφαλής-κωδικός'), 'AUTH_RATE_LIMITED');
  currentTime += 31_000;
  security.login('ασφαλής-κωδικός');
  security.changePassword('ασφαλής-κωδικός', 'νέος-κωδικός', 'νέος-κωδικός');
  security.lock();
  expectCode(() => security.login('ασφαλής-κωδικός'), 'AUTH_INVALID_PASSWORD');
  security.login('νέος-κωδικός');

  const stored = fs.readFileSync(path.join(root, 'security', 'security.json'), 'utf8');
  assert.ok(!stored.includes('νέος-κωδικός'));
}

function runBackupTests(root) {
  const userData = path.join(root, 'userdata');
  const databasePath = path.join(userData, 'data', 'dchsi.sqlite');
  const photoPath = path.join(userData, 'photos', 'material.png');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.mkdirSync(path.dirname(photoPath), { recursive: true });
  const originalDatabase = sqliteFixture('original-data');
  fs.writeFileSync(databasePath, originalDatabase);
  fs.writeFileSync(photoPath, 'original-photo');

  const backupService = createBackupService(userData, { retention: 2 });
  const automatic = backupService.createAutomatic(true);
  assert.ok(fs.existsSync(path.join(automatic.path, 'data', 'dchsi.sqlite')));
  assert.ok(fs.existsSync(path.join(automatic.path, 'photos', 'material.png')));
  assert.strictEqual(backupService.list().length, 1);

  const manualRoot = path.join(root, 'manual');
  const manual = backupService.createManual(manualRoot);
  assert.ok(manual.path.startsWith(manualRoot));
  expectCode(() => backupService.createManual(path.join(userData, 'photos')), 'BACKUP_DESTINATION_UNSAFE');
  backupService.prepareRestore(manual.path);

  fs.writeFileSync(databasePath, sqliteFixture('changed-data'));
  fs.writeFileSync(photoPath, 'changed-photo');
  assert.strictEqual(applyPendingRestore(userData), true);
  assert.deepStrictEqual(fs.readFileSync(databasePath), originalDatabase);
  assert.strictEqual(fs.readFileSync(photoPath, 'utf8'), 'original-photo');
  assert.strictEqual(applyPendingRestore(userData), false);
}

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-security-backup-'));
try {
  runSecurityTests(root);
  runBackupTests(root);
  console.log('Security and backup tests passed.');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
