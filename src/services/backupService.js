const fs = require('fs');
const path = require('path');
const { AppError } = require('../core/errorHandler');

const DATABASE_RELATIVE_PATH = path.join('data', 'dchsi.sqlite');
const MANIFEST_FILE = 'backup-manifest.json';
const BACKUP_PREFIX = 'Diaxeirisi-Backup-';
const DEFAULT_RETENTION = 15;

function timestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function validateDatabaseFile(databasePath) {
  if (!fs.existsSync(databasePath)) {
    throw new AppError('Το αντίγραφο δεν περιέχει βάση δεδομένων.', 'BACKUP_DATABASE_MISSING');
  }
  const header = Buffer.alloc(16);
  const descriptor = fs.openSync(databasePath, 'r');
  try {
    fs.readSync(descriptor, header, 0, header.length, 0);
  } finally {
    fs.closeSync(descriptor);
  }
  if (header.toString('utf8') !== 'SQLite format 3\u0000') {
    throw new AppError('Το αρχείο βάσης του αντιγράφου δεν είναι έγκυρο.', 'BACKUP_DATABASE_INVALID');
  }
}

function ensureUniqueDirectory(root, baseName) {
  let candidate = path.join(root, baseName);
  let suffix = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(root, `${baseName}-${suffix}`);
    suffix += 1;
  }
  return candidate;
}

function isInside(candidate, parent) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function copyBackupContents(userDataPath, destination, kind) {
  const databasePath = path.join(userDataPath, DATABASE_RELATIVE_PATH);
  validateDatabaseFile(databasePath);
  fs.mkdirSync(path.join(destination, 'data'), { recursive: true });
  fs.copyFileSync(databasePath, path.join(destination, DATABASE_RELATIVE_PATH));
  const photosPath = path.join(userDataPath, 'photos');
  if (fs.existsSync(photosPath)) {
    fs.cpSync(photosPath, path.join(destination, 'photos'), { recursive: true });
  }
  const manifest = {
    format: 'diaxeirisi-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    kind,
    includesPhotos: fs.existsSync(photosPath)
  };
  fs.writeFileSync(path.join(destination, MANIFEST_FILE), JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

function validateBackupDirectory(backupPath) {
  const manifestPath = path.join(backupPath, MANIFEST_FILE);
  if (!fs.existsSync(manifestPath)) {
    throw new AppError('Ο επιλεγμένος φάκελος δεν είναι αντίγραφο της εφαρμογής.', 'BACKUP_MANIFEST_MISSING');
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (_error) {
    throw new AppError('Το αρχείο περιγραφής του αντιγράφου είναι κατεστραμμένο.', 'BACKUP_MANIFEST_INVALID');
  }
  if (manifest.format !== 'diaxeirisi-backup' || manifest.version !== 1) {
    throw new AppError('Η μορφή του αντιγράφου δεν υποστηρίζεται.', 'BACKUP_FORMAT_UNSUPPORTED');
  }
  validateDatabaseFile(path.join(backupPath, DATABASE_RELATIVE_PATH));
  return manifest;
}

function createBackupService(userDataPath, options = {}) {
  const automaticRoot = path.join(userDataPath, 'backups');
  const retention = options.retention || DEFAULT_RETENTION;

  function createInRoot(root, kind) {
    fs.mkdirSync(root, { recursive: true });
    const backupPath = ensureUniqueDirectory(root, `${BACKUP_PREFIX}${timestamp()}`);
    fs.mkdirSync(backupPath, { recursive: true });
    try {
      const manifest = copyBackupContents(userDataPath, backupPath, kind);
      return { path: backupPath, ...manifest };
    } catch (error) {
      fs.rmSync(backupPath, { recursive: true, force: true });
      throw error;
    }
  }

  function listAutomaticBackups() {
    if (!fs.existsSync(automaticRoot)) return [];
    return fs.readdirSync(automaticRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(BACKUP_PREFIX))
      .map((entry) => {
        const backupPath = path.join(automaticRoot, entry.name);
        try {
          const manifest = validateBackupDirectory(backupPath);
          return { path: backupPath, ...manifest };
        } catch (_error) {
          return null;
        }
      })
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  function enforceRetention() {
    for (const backup of listAutomaticBackups().slice(retention)) {
      fs.rmSync(backup.path, { recursive: true, force: true });
    }
  }

  return {
    list: listAutomaticBackups,

    createAutomatic(force = false) {
      const latest = listAutomaticBackups()[0];
      if (!force && latest && Date.now() - new Date(latest.createdAt).getTime() < 24 * 60 * 60 * 1000) {
        return { ...latest, skipped: true };
      }
      const backup = createInRoot(automaticRoot, 'automatic');
      enforceRetention();
      return backup;
    },

    createManual(destinationRoot) {
      if (isInside(destinationRoot, userDataPath)) {
        throw new AppError(
          'Επιλέξτε φάκελο έξω από τον φάκελο δεδομένων της εφαρμογής.',
          'BACKUP_DESTINATION_UNSAFE'
        );
      }
      return createInRoot(destinationRoot, 'manual');
    },

    prepareRestore(backupPath) {
      const manifest = validateBackupDirectory(backupPath);
      const pendingRoot = path.join(userDataPath, 'pending-restore');
      fs.rmSync(pendingRoot, { recursive: true, force: true });
      fs.cpSync(backupPath, pendingRoot, { recursive: true });
      fs.writeFileSync(path.join(userDataPath, 'pending-restore.json'), JSON.stringify({
        path: pendingRoot,
        requestedAt: new Date().toISOString(),
        manifest
      }, null, 2), 'utf8');
      return { prepared: true, createdAt: manifest.createdAt };
    }
  };
}

function applyPendingRestore(userDataPath) {
  const requestPath = path.join(userDataPath, 'pending-restore.json');
  if (!fs.existsSync(requestPath)) return false;
  const pendingRoot = path.join(userDataPath, 'pending-restore');
  validateBackupDirectory(pendingRoot);

  const databasePath = path.join(userDataPath, DATABASE_RELATIVE_PATH);
  if (fs.existsSync(databasePath)) {
    const safetyRoot = path.join(userDataPath, 'backups');
    const safetyPath = ensureUniqueDirectory(safetyRoot, `Pre-Restore-${timestamp()}`);
    fs.mkdirSync(safetyPath, { recursive: true });
    copyBackupContents(userDataPath, safetyPath, 'pre-restore');
  }

  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.copyFileSync(path.join(pendingRoot, DATABASE_RELATIVE_PATH), databasePath);
  const currentPhotos = path.join(userDataPath, 'photos');
  const restoredPhotos = path.join(pendingRoot, 'photos');
  fs.rmSync(currentPhotos, { recursive: true, force: true });
  if (fs.existsSync(restoredPhotos)) {
    fs.cpSync(restoredPhotos, currentPhotos, { recursive: true });
  }
  fs.rmSync(pendingRoot, { recursive: true, force: true });
  fs.rmSync(requestPath, { force: true });
  return true;
}

module.exports = {
  createBackupService,
  applyPendingRestore,
  validateBackupDirectory
};
