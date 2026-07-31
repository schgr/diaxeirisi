const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { AppError } = require('../core/errorHandler');
const { migrations } = require('../db/migrations');
const packageMetadata = require('../../package.json');

const BACKUP_PREFIX = 'Diaxeirisi-Backup-';
const MANIFEST_FILE = 'backup-manifest.json';
const DEFAULT_RETENTION = 15;
const EXPECTED_SCHEMA_VERSION = Math.max(...migrations.map((migration) => migration.version));
const SQL_JS_DIRECTORY = path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist');

function resolveThroughExistingAncestor(target) {
  const absolute = path.resolve(target);
  let existing = absolute;
  while (!fs.existsSync(existing)) {
    const next = path.dirname(existing);
    if (next === existing) throw new Error('No existing path ancestor.');
    existing = next;
  }
  const resolvedExisting = fs.realpathSync.native(existing);
  return path.resolve(resolvedExisting, path.relative(existing, absolute));
}

function isInside(candidate, parent) {
  let resolvedCandidate;
  let resolvedParent;
  try {
    resolvedCandidate = resolveThroughExistingAncestor(candidate);
    resolvedParent = resolveThroughExistingAncestor(parent);
  } catch (_error) {
    return true;
  }
  const relative = path.relative(resolvedParent, resolvedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readManifest(backupPath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(backupPath, MANIFEST_FILE), 'utf8'));
    if (manifest.format !== 'diaxeirisi-backup' || ![2, 3].includes(manifest.version)) return null;
    if (manifest.version === 3) {
      const manifestBytes = fs.readFileSync(path.join(backupPath, MANIFEST_FILE));
      const expected = fs.readFileSync(path.join(backupPath, 'backup-manifest.sha256'), 'utf8').trim();
      const actual = crypto.createHash('sha256').update(manifestBytes).digest('hex');
      if (expected !== actual) return null;
    }
    return { path: backupPath, ...manifest };
  } catch (_error) {
    return null;
  }
}

function createMutex() {
  let tail = Promise.resolve();
  return async function withLock(operation) {
    let release;
    const previous = tail;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };
}

function sanitizedBackupError(error) {
  if (error instanceof AppError) return error;
  const code = error && error.code ? error.code : 'BACKUP_OPERATION_FAILED';
  return new AppError('Η εργασία αντιγράφου ασφαλείας δεν ολοκληρώθηκε με ασφάλεια.', code);
}

function createBackupService(userDataPath, options = {}) {
  const runner = options.runner;
  const exportSnapshot = options.exportSnapshot;
  const flush = options.flush || (() => {});
  if (!runner || typeof runner.run !== 'function' || typeof exportSnapshot !== 'function') {
    throw new TypeError('Backup service requires a worker runner and database snapshot provider.');
  }
  const automaticRoot = path.join(userDataPath, 'backups');
  const retention = options.retention || DEFAULT_RETENTION;
  const transferableSnapshots = options.transferableSnapshots === true;
  const active = new Set();
  const queued = new Set();
  const cancelled = new Set();
  const withCriticalOperation = createMutex();

  function list() {
    if (!fs.existsSync(automaticRoot)) return [];
    return fs.readdirSync(automaticRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(BACKUP_PREFIX))
      .map((entry) => readManifest(path.join(automaticRoot, entry.name)))
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function enforceRetention() {
    const verified = [];
    for (const backup of list()) {
      try {
        await runner.run('backup-validate', {
          backupPath: backup.path,
          sqlJsDirectory: SQL_JS_DIRECTORY,
          expectedSchemaVersion: EXPECTED_SCHEMA_VERSION
        }, { id: crypto.randomUUID(), resource: 'backup' });
        verified.push(backup);
      } catch (_error) {
        // Incomplete or corrupt backups are never retention candidates.
      }
    }
    for (const backup of verified.slice(retention)) {
      await fs.promises.rm(backup.path, { recursive: true, force: true });
    }
  }

  async function createUnlocked(destinationRoot, kind, runOptions = {}) {
    const taskId = runOptions.taskId || crypto.randomUUID();
    if (cancelled.delete(taskId)) throw new AppError('Η εργασία ακυρώθηκε.', 'WORKER_CANCELED');
    active.add(taskId);
    try {
      await Promise.resolve(flush());
      const databaseSnapshot = exportSnapshot();
      const transferList = transferableSnapshots
        && databaseSnapshot
        && databaseSnapshot.byteOffset === 0
        && databaseSnapshot.byteLength === databaseSnapshot.buffer.byteLength
        ? [databaseSnapshot.buffer]
        : [];
      return await runner.run('backup-create', {
        userDataPath,
        destinationRoot,
        photosPath: path.join(userDataPath, 'photos'),
        databaseSnapshot,
        appVersion: packageMetadata.version,
        kind,
        sqlJsDirectory: SQL_JS_DIRECTORY,
        expectedSchemaVersion: EXPECTED_SCHEMA_VERSION
      }, { ...runOptions, id: taskId, resource: 'backup', transferList });
    } catch (error) {
      throw sanitizedBackupError(error);
    } finally {
      active.delete(taskId);
    }
  }

  async function create(destinationRoot, kind, runOptions = {}) {
    const taskId = runOptions.taskId || crypto.randomUUID();
    queued.add(taskId);
    return withCriticalOperation(() => {
      queued.delete(taskId);
      return createUnlocked(destinationRoot, kind, { ...runOptions, taskId });
    });
  }

  return {
    list,

    async createAutomatic(force = false, runOptions = {}) {
      const taskId = runOptions.taskId || crypto.randomUUID();
      queued.add(taskId);
      return withCriticalOperation(async () => {
        queued.delete(taskId);
        if (cancelled.delete(taskId)) throw new AppError('Η εργασία ακυρώθηκε.', 'WORKER_CANCELED');
        const latest = list()[0];
        if (!force && latest && Date.now() - new Date(latest.createdAt).getTime() < 24 * 60 * 60 * 1000) {
          return { ...latest, skipped: true };
        }
        const backup = await createUnlocked(automaticRoot, 'automatic', { ...runOptions, taskId });
        await enforceRetention();
        return backup;
      });
    },

    async createManual(destinationRoot, runOptions = {}) {
      if (isInside(destinationRoot, userDataPath)) {
        throw new AppError(
          'Επιλέξτε φάκελο έξω από τον φάκελο δεδομένων της εφαρμογής.',
          'BACKUP_DESTINATION_UNSAFE'
        );
      }
      return create(destinationRoot, 'manual', runOptions);
    },

    async prepareRestore(backupPath, runOptions = {}) {
      const taskId = runOptions.taskId || crypto.randomUUID();
      queued.add(taskId);
      return withCriticalOperation(async () => {
        queued.delete(taskId);
        if (cancelled.delete(taskId)) throw new AppError('Η εργασία ακυρώθηκε.', 'WORKER_CANCELED');
        active.add(taskId);
        try {
          await Promise.resolve(flush());
          return await runner.run('backup-prepare-restore', {
            backupPath,
            userDataPath,
            appVersion: packageMetadata.version,
            sqlJsDirectory: SQL_JS_DIRECTORY,
            expectedSchemaVersion: EXPECTED_SCHEMA_VERSION
          }, { ...runOptions, id: taskId, resource: 'backup' });
        } catch (error) {
          throw sanitizedBackupError(error);
        } finally {
          active.delete(taskId);
        }
      });
    },

    cancel(taskId) {
      const id = String(taskId);
      if (active.has(id)) return runner.cancel(id);
      if (!queued.has(id)) return false;
      cancelled.add(id);
      return true;
    }
  };
}

async function applyPendingRestore(userDataPath, runner, options = {}) {
  return runner.run('backup-apply-restore', {
    userDataPath,
    appVersion: packageMetadata.version,
    sqlJsDirectory: SQL_JS_DIRECTORY,
    expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
    ...options
  }, {
    id: options.taskId || crypto.randomUUID(),
    timeoutMs: options.timeoutMs || 10 * 60 * 1000,
    resource: 'backup'
  });
}

module.exports = {
  createBackupService,
  applyPendingRestore,
  EXPECTED_SCHEMA_VERSION,
  SQL_JS_DIRECTORY
};
