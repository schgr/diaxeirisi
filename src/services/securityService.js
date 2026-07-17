const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { AppError } = require('../core/errorHandler');

const MIN_PASSWORD_LENGTH = 6;
const MIN_USERNAME_LENGTH = 3;
const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 30_000;

function createSecurityService(userDataPath, now = () => Date.now()) {
  const configPath = path.join(userDataPath, 'security.json');
  let unlocked = false;

  function readConfig() {
    if (!fs.existsSync(configPath)) return null;
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (_error) {
      throw new AppError('Το αρχείο ασφαλείας είναι κατεστραμμένο.', 'SECURITY_CONFIG_INVALID');
    }
  }

  function writeConfig(config) {
    fs.mkdirSync(userDataPath, { recursive: true });
    const temporaryPath = `${configPath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(config, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, configPath);
  }

  function validatePassword(password) {
    if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
      throw new AppError(
        `Ο κωδικός πρέπει να έχει τουλάχιστον ${MIN_PASSWORD_LENGTH} χαρακτήρες.`,
        'PASSWORD_TOO_SHORT'
      );
    }
  }

  function validateUsername(username) {
    const value = String(username || '').trim();
    if (value.length < MIN_USERNAME_LENGTH || value.length > 50) {
      throw new AppError('Το όνομα χρήστη πρέπει να έχει από 3 έως 50 χαρακτήρες.', 'USERNAME_INVALID');
    }
    return value;
  }

  function normalizedUsername(username) {
    return String(username || '').trim().toLocaleLowerCase('el-GR');
  }

  function passwordDigest(password, salt) {
    return crypto.scryptSync(password, Buffer.from(salt, 'hex'), 64).toString('hex');
  }

  function verifyPassword(password, config) {
    const expected = Buffer.from(config.passwordHash, 'hex');
    const actual = Buffer.from(passwordDigest(password, config.salt), 'hex');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  function publicStatus(config = readConfig()) {
    const lockedUntil = Number(config?.lockedUntil || 0);
    return {
      configured: Boolean(config?.passwordHash && config?.salt),
      username: config?.passwordHash ? String(config.username || 'admin') : '',
      unlocked,
      failedAttempts: Number(config?.failedAttempts || 0),
      lockedUntil: lockedUntil > now() ? lockedUntil : 0
    };
  }

  return {
    status() {
      return publicStatus();
    },

    isUnlocked() {
      return unlocked;
    },

    setup(username, password, confirmation) {
      if (readConfig()) {
        throw new AppError('Η προστασία εισόδου έχει ήδη ρυθμιστεί.', 'SECURITY_ALREADY_CONFIGURED');
      }
      const cleanUsername = validateUsername(username);
      validatePassword(password);
      if (password !== confirmation) {
        throw new AppError('Οι δύο κωδικοί δεν είναι ίδιοι.', 'PASSWORD_CONFIRMATION_MISMATCH');
      }
      const salt = crypto.randomBytes(16).toString('hex');
      writeConfig({
        version: 2,
        username: cleanUsername,
        salt,
        passwordHash: passwordDigest(password, salt),
        failedAttempts: 0,
        lockedUntil: 0,
        createdAt: new Date(now()).toISOString(),
        updatedAt: new Date(now()).toISOString()
      });
      unlocked = true;
      return publicStatus();
    },

    login(username, password) {
      const config = readConfig();
      if (!config) {
        throw new AppError('Πρέπει πρώτα να οριστεί κωδικός εισόδου.', 'SECURITY_NOT_CONFIGURED');
      }
      if (Number(config.lockedUntil || 0) > now()) {
        throw new AppError('Πολλές αποτυχημένες προσπάθειες. Δοκιμάστε ξανά σε λίγο.', 'AUTH_RATE_LIMITED', {
          lockedUntil: config.lockedUntil
        });
      }
      const expectedUsername = normalizedUsername(config.username || 'admin');
      const credentialsValid = normalizedUsername(username) === expectedUsername
        && verifyPassword(String(password || ''), config);
      if (!credentialsValid) {
        const failedAttempts = Number(config.failedAttempts || 0) + 1;
        config.failedAttempts = failedAttempts;
        config.lockedUntil = failedAttempts >= MAX_FAILURES ? now() + LOCK_DURATION_MS : 0;
        if (config.lockedUntil) config.failedAttempts = 0;
        writeConfig(config);
        throw new AppError('Λανθασμένο όνομα χρήστη ή κωδικός εισόδου.', 'AUTH_INVALID_CREDENTIALS', {
          remainingAttempts: Math.max(0, MAX_FAILURES - failedAttempts),
          lockedUntil: config.lockedUntil || 0
        });
      }
      config.failedAttempts = 0;
      config.lockedUntil = 0;
      if (!config.username) {
        config.version = 2;
        config.username = 'admin';
      }
      writeConfig(config);
      unlocked = true;
      return publicStatus(config);
    },

    changePassword(currentPassword, newPassword, confirmation) {
      const config = readConfig();
      if (!config || !unlocked) {
        throw new AppError('Απαιτείται σύνδεση.', 'AUTH_REQUIRED');
      }
      if (!verifyPassword(String(currentPassword || ''), config)) {
        throw new AppError('Ο τρέχων κωδικός δεν είναι σωστός.', 'AUTH_INVALID_PASSWORD');
      }
      validatePassword(newPassword);
      if (newPassword !== confirmation) {
        throw new AppError('Οι δύο νέοι κωδικοί δεν είναι ίδιοι.', 'PASSWORD_CONFIRMATION_MISMATCH');
      }
      const salt = crypto.randomBytes(16).toString('hex');
      config.salt = salt;
      config.passwordHash = passwordDigest(newPassword, salt);
      config.failedAttempts = 0;
      config.lockedUntil = 0;
      config.updatedAt = new Date(now()).toISOString();
      writeConfig(config);
      return publicStatus(config);
    },

    changeCredentials(currentPassword, username, newPassword, confirmation) {
      const config = readConfig();
      if (!config || !unlocked) {
        throw new AppError('Απαιτείται σύνδεση.', 'AUTH_REQUIRED');
      }
      if (!verifyPassword(String(currentPassword || ''), config)) {
        throw new AppError('Ο τρέχων κωδικός δεν είναι σωστός.', 'AUTH_INVALID_PASSWORD');
      }
      const cleanUsername = validateUsername(username);
      validatePassword(newPassword);
      if (newPassword !== confirmation) {
        throw new AppError('Οι δύο νέοι κωδικοί δεν είναι ίδιοι.', 'PASSWORD_CONFIRMATION_MISMATCH');
      }
      const salt = crypto.randomBytes(16).toString('hex');
      config.version = 2;
      config.username = cleanUsername;
      config.salt = salt;
      config.passwordHash = passwordDigest(newPassword, salt);
      config.failedAttempts = 0;
      config.lockedUntil = 0;
      config.updatedAt = new Date(now()).toISOString();
      writeConfig(config);
      return publicStatus(config);
    },

    lock() {
      unlocked = false;
      return publicStatus();
    }
  };
}

module.exports = {
  createSecurityService,
  MIN_PASSWORD_LENGTH,
  MIN_USERNAME_LENGTH
};
