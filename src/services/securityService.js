const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { AppError } = require('../core/errorHandler');

const MIN_PASSWORD_LENGTH = 10;
const MIN_USERNAME_LENGTH = 3;
const MAX_FAILURES = 5;
const LOCK_DURATION_MS = 30_000;
const MAX_LOCKOUT_EXPONENT = 6;

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
    if (/^(.)\1+$/u.test(password)) {
      throw new AppError(
        'Ο κωδικός δεν μπορεί να αποτελείται μόνο από τον ίδιο επαναλαμβανόμενο χαρακτήρα.',
        'PASSWORD_TOO_WEAK'
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

  function normalizedRecoveryCode(value) {
    return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  function recoveryDigest(value) {
    return crypto.createHash('sha256').update(normalizedRecoveryCode(value), 'utf8').digest('hex');
  }

  function normalizedSecurityAnswer(value) {
    return String(value || '').trim().toLocaleLowerCase('el-GR').replace(/\s+/g, ' ');
  }

  function securityAnswerDigest(value, salt) {
    return crypto.scryptSync(normalizedSecurityAnswer(value), Buffer.from(salt, 'hex'), 32).toString('hex');
  }

  function validateSecurityQuestions(questions) {
    if (!Array.isArray(questions) || questions.length !== 3) {
      throw new AppError('Απαιτούνται τρεις ερωτήσεις ασφαλείας.', 'SECURITY_QUESTIONS_INVALID');
    }
    return questions.map((item) => {
      const question = String(item?.question || '').trim();
      const answer = normalizedSecurityAnswer(item?.answer);
      if (question.length < 5 || answer.length < 2) {
        throw new AppError('Συμπληρώστε και τις τρεις ερωτήσεις ασφαλείας και τις απαντήσεις τους.', 'SECURITY_QUESTIONS_INVALID');
      }
      const salt = crypto.randomBytes(16).toString('hex');
      return { question, salt, answerHash: securityAnswerDigest(answer, salt) };
    });
  }

  function verifySecurityAnswers(answers, questions) {
    if (!Array.isArray(answers) || answers.length !== questions.length) return false;
    return questions.every((question, index) => {
      const expected = Buffer.from(question.answerHash, 'hex');
      const actual = Buffer.from(securityAnswerDigest(answers[index], question.salt), 'hex');
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    });
  }

  function createRecoveryCodeValue() {
    const raw = crypto.randomBytes(12).toString('hex').toUpperCase();
    return raw.match(/.{1,4}/g).join('-');
  }

  function publicStatus(config = readConfig()) {
    const lockedUntil = Number(config?.lockedUntil || 0);
    return {
      configured: Boolean(config?.passwordHash && config?.salt),
      recoveryConfigured: Boolean(config?.recoveryHash)
        || (Array.isArray(config?.securityQuestions) && config.securityQuestions.length === 3),
      securityQuestionsConfigured: Array.isArray(config?.securityQuestions) && config.securityQuestions.length === 3,
      securityQuestions: Array.isArray(config?.securityQuestions)
        ? config.securityQuestions.map((item) => item.question)
        : [],
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

    setup(username, password, confirmation, securityQuestions) {
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
        version: 4,
        username: cleanUsername,
        salt,
        passwordHash: passwordDigest(password, salt),
        failedAttempts: 0,
        lockedUntil: 0,
        createdAt: new Date(now()).toISOString(),
        updatedAt: new Date(now()).toISOString(),
        securityQuestions: validateSecurityQuestions(securityQuestions)
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
      const usernameValid = normalizedUsername(username) === expectedUsername;
      const passwordValid = verifyPassword(String(password || ''), config);
      const credentialsValid = usernameValid && passwordValid;
      if (!credentialsValid) {
        const failedAttempts = Number(config.failedAttempts || 0) + 1;
        config.failedAttempts = failedAttempts;
        config.lockedUntil = 0;
        if (failedAttempts >= MAX_FAILURES) {
          const lockoutCount = Number(config.lockoutCount || 0);
          const lockDurationMs = LOCK_DURATION_MS * Math.pow(2, Math.min(lockoutCount, MAX_LOCKOUT_EXPONENT));
          config.lockedUntil = now() + lockDurationMs;
          config.lockoutCount = lockoutCount + 1;
          config.failedAttempts = 0;
        }
        writeConfig(config);
        throw new AppError('Λανθασμένο όνομα χρήστη ή κωδικός εισόδου.', 'AUTH_INVALID_CREDENTIALS', {
          remainingAttempts: Math.max(0, MAX_FAILURES - failedAttempts),
          lockedUntil: config.lockedUntil || 0
        });
      }
      config.failedAttempts = 0;
      config.lockedUntil = 0;
      config.lockoutCount = 0;
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
      config.lockoutCount = 0;
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
      config.lockoutCount = 0;
      config.updatedAt = new Date(now()).toISOString();
      writeConfig(config);
      return publicStatus(config);
    },

    createRecoveryCode() {
      const config = readConfig();
      if (!config || !unlocked) {
        throw new AppError('Απαιτείται σύνδεση.', 'AUTH_REQUIRED');
      }
      const recoveryCode = createRecoveryCodeValue();
      config.recoveryHash = recoveryDigest(recoveryCode);
      config.recoveryCreatedAt = new Date(now()).toISOString();
      config.updatedAt = new Date(now()).toISOString();
      writeConfig(config);
      return { recoveryCode, status: publicStatus(config) };
    },

    changeSecurityQuestions(currentPassword, questions) {
      const config = readConfig();
      if (!config || !unlocked) {
        throw new AppError('Απαιτείται σύνδεση.', 'AUTH_REQUIRED');
      }
      if (!verifyPassword(String(currentPassword || ''), config)) {
        throw new AppError('Ο τρέχων κωδικός δεν είναι σωστός.', 'AUTH_INVALID_PASSWORD');
      }
      config.version = 4;
      config.securityQuestions = validateSecurityQuestions(questions);
      delete config.recoveryHash;
      delete config.recoveryCreatedAt;
      config.updatedAt = new Date(now()).toISOString();
      writeConfig(config);
      return publicStatus(config);
    },

    answerSecurityQuestions(answers) {
      const config = readConfig();
      if (!Array.isArray(config?.securityQuestions) || config.securityQuestions.length !== 3) {
        throw new AppError('Δεν έχουν οριστεί ερωτήσεις ασφαλείας.', 'SECURITY_QUESTIONS_NOT_CONFIGURED');
      }
      if (!verifySecurityAnswers(answers, config.securityQuestions)) {
        throw new AppError('Μία ή περισσότερες απαντήσεις δεν είναι σωστές.', 'SECURITY_ANSWERS_INVALID');
      }
      const recoveryCode = createRecoveryCodeValue();
      config.recoveryHash = recoveryDigest(recoveryCode);
      config.recoveryCreatedAt = new Date(now()).toISOString();
      config.updatedAt = new Date(now()).toISOString();
      writeConfig(config);
      return { recoveryCode };
    },

    recover(recoveryCode, username, newPassword, confirmation) {
      const config = readConfig();
      if (!config?.recoveryHash) {
        throw new AppError('Δεν έχει δημιουργηθεί κωδικός ανάκτησης.', 'RECOVERY_NOT_CONFIGURED');
      }
      const suppliedHash = recoveryDigest(recoveryCode);
      const expected = Buffer.from(config.recoveryHash, 'hex');
      const actual = Buffer.from(suppliedHash, 'hex');
      if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
        throw new AppError('Ο κωδικός ανάκτησης δεν είναι σωστός.', 'RECOVERY_CODE_INVALID');
      }
      const cleanUsername = validateUsername(username);
      validatePassword(newPassword);
      if (newPassword !== confirmation) {
        throw new AppError('Οι δύο νέοι κωδικοί δεν είναι ίδιοι.', 'PASSWORD_CONFIRMATION_MISMATCH');
      }
      const salt = crypto.randomBytes(16).toString('hex');
      config.version = 3;
      config.username = cleanUsername;
      config.salt = salt;
      config.passwordHash = passwordDigest(newPassword, salt);
      config.failedAttempts = 0;
      config.lockedUntil = 0;
      config.lockoutCount = 0;
      delete config.recoveryHash;
      delete config.recoveryCreatedAt;
      config.updatedAt = new Date(now()).toISOString();
      writeConfig(config);
      unlocked = true;
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
