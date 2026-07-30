const fs = require('fs');
const path = require('path');
const { AppError } = require('../core/errorHandler');
const { migrations } = require('../db/migrations');

const BACKUP_PREFIX = 'Diaxeirisi-Backup-';
const MANIFEST_FILE = 'backup-manifest.json';
const DEFAULT_RETENTION = 15;
const EXPECTED_SCHEMA_VERSION = Math.max(...migrations.map((migration) => migration.version));
const SQL_JS_DIRECTORY = path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist');

function isInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function readManifest(backupPath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(backupPath, MANIFEST_FILE), 'utf8'));
    if (manifest.format !== 'diaxeirisi-backup' || manifest.version !== 2) return null;
    return { path: backupPath, ...manifest };
  } catch (_error) {
    return null;
  }
}

function createBackupService(userDataPath, options = {}) {
  const runner = options.runner;
  const exportSnapshot = options.exportSnapshot;
  if (!runner || typeof runner.run !== 'function' || typeof exportSnapshot !== 'function') {
    throw new TypeError('Backup service requires a worker runner and database snapshot provider.');
  }
  const automaticRoot = path.join(userDataPath, 'backups');
  const retention = options.retention || DEFAULT_RETENTION;
  const active = new Set();

  function list() {
    if (!fs.existsSync(automaticRoot)) return [];
    return fs.readdirSync(automaticRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(BACKUP_PREFIX))
      .map((entry) => readManifest(path.join(automaticRoot, entry.name)))
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  async function enforceRetention() {
    for (const backup of list().slice(retention)) {
      await fs.promises.rm(backup.path, { recursive: true, force: true });
    }
  }

  async function create(destinationRoot, kind, runOptions = {}) {
    const taskId = runOptions.taskId || `backup-${kind}-${Date.now()}`;
    active.add(taskId);
    try {
      return await runner.run('backup-create', {
        userDataPath,
        destinationRoot,
        photosPath: path.join(userDataPath, 'photos'),
        databaseSnapshot: exportSnapshot(),
        kind,
        sqlJsDirectory: SQL_JS_DIRECTORY,
        expectedSchemaVersion: EXPECTED_SCHEMA_VERSION
      }, { ...runOptions, id: taskId });
    } finally {
      active.delete(taskId);
    }
  }

  return {
    list,

    async createAutomatic(force = false, runOptions = {}) {
      const latest = list()[0];
      if (!force && latest && Date.now() - new Date(latest.createdAt).getTime() < 24 * 60 * 60 * 1000) {
        return { ...latest, skipped: true };
      }
      const backup = await create(automaticRoot, 'automatic', runOptions);
      await enforceRetention();
      return backup;
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
      const taskId = runOptions.taskId || `backup-restore-${Date.now()}`;
      active.add(taskId);
      try {
        return await runner.run('backup-prepare-restore', {
          backupPath,
          userDataPath,
          sqlJsDirectory: SQL_JS_DIRECTORY,
          expectedSchemaVersion: EXPECTED_SCHEMA_VERSION
        }, { ...runOptions, id: taskId });
      } finally {
        active.delete(taskId);
      }
    },

    cancel(taskId) {
      return active.has(String(taskId)) && runner.cancel(String(taskId));
    }
  };
}

async function applyPendingRestore(userDataPath, runner, options = {}) {
  return runner.run('backup-apply-restore', {
    userDataPath,
    sqlJsDirectory: SQL_JS_DIRECTORY,
    expectedSchemaVersion: EXPECTED_SCHEMA_VERSION,
    ...options
  }, { id: options.taskId || `backup-apply-${Date.now()}`, timeoutMs: options.timeoutMs || 10 * 60 * 1000 });
}

module.exports = {
  createBackupService,
  applyPendingRestore,
  EXPECTED_SCHEMA_VERSION,
  SQL_JS_DIRECTORY
};
