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
