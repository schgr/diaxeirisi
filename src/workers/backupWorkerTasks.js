const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const initSqlJs = require('sql.js');

const DATABASE_RELATIVE_PATH = path.join('data', 'dchsi.sqlite');
const MANIFEST_FILE = 'backup-manifest.json';
const MANIFEST_HASH_FILE = 'backup-manifest.sha256';
const FORMAT = 'diaxeirisi-backup';
const VERSION = 3;
const LEGACY_VERSION = 2;
const BACKUP_KINDS = new Set(['automatic', 'manual', 'pre-restore', 'test']);
const CRITICAL_TABLES = [
  'schema_migrations',
  'service_settings',
  'shares',
  'share_transactions',
  'inventory_sessions',
  'inventory_items'
];

function taskError(message, code) {
  return Object.assign(new Error(message), { code });
}

function safeRelative(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  if (
    !normalized
    || normalized.includes('\0')
    || normalized.startsWith('/')
    || /^[a-z]:/i.test(normalized)
    || normalized.split('/').includes('..')
    || path.posix.normalize(normalized) !== normalized
  ) {
    throw taskError('Το αντίγραφο περιέχει μη ασφαλή διαδρομή αρχείου.', 'BACKUP_PATH_UNSAFE');
  }
  return normalized;
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  await new Promise((resolve, reject) => {
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return hash.digest('hex');
}

async function listFiles(root, relative = '') {
  if (!fs.existsSync(root)) return [];
  const currentPath = path.join(root, relative);
  const currentStats = await fs.promises.lstat(currentPath);
  if (!currentStats.isDirectory() || currentStats.isSymbolicLink()) {
    throw taskError('Το αντίγραφο περιέχει μη ασφαλή δομή αρχείων.', 'BACKUP_PATH_UNSAFE');
  }
  const result = [];
  const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isSymbolicLink()) {
      throw taskError('Το αντίγραφο περιέχει μη ασφαλή σύνδεση αρχείου.', 'BACKUP_PATH_UNSAFE');
    }
    if (entry.isDirectory()) result.push(...await listFiles(root, child));
    else if (entry.isFile()) result.push(child);
  }
  return result;
}

async function syncFile(filePath) {
  const handle = await fs.promises.open(filePath, 'r+');
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(directoryPath) {
  let handle;
  try {
    handle = await fs.promises.open(directoryPath, 'r');
    await handle.sync();
  } catch (error) {
    if (process.platform !== 'win32' && !['EINVAL', 'EISDIR', 'EPERM'].includes(error.code)) throw error;
  } finally {
    if (handle) await handle.close();
  }
}

async function scanBackupFiles(root, relative = '') {
  const current = path.join(root, relative);
  const currentStats = await fs.promises.lstat(current);
  if (currentStats.isSymbolicLink() || (!relative && !currentStats.isDirectory())) {
    throw taskError('Το αντίγραφο περιέχει μη ασφαλή δομή αρχείων.', 'BACKUP_PATH_UNSAFE');
  }
  const files = [];
  const entries = await fs.promises.readdir(current, { withFileTypes: true });
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    const childPath = path.join(root, child);
    const stats = await fs.promises.lstat(childPath);
    if (entry.isSymbolicLink() || stats.isSymbolicLink()) {
      throw taskError('Το αντίγραφο περιέχει μη ασφαλή σύνδεση αρχείου.', 'BACKUP_PATH_UNSAFE');
    }
    if (stats.isDirectory()) files.push(...await scanBackupFiles(root, child));
    else if (stats.isFile()) files.push(child.replace(/\\/g, '/'));
    else throw taskError('Το αντίγραφο περιέχει μη υποστηριζόμενο αρχείο.', 'BACKUP_PATH_UNSAFE');
  }
  return files;
}

async function inspectDatabase(databaseBytes, sqlJsDirectory, pragma, expectedSchemaVersion) {
  const SQL = await initSqlJs({ locateFile: (file) => path.join(sqlJsDirectory, file) });
  let database;
  try {
    const bytes = databaseBytes instanceof Uint8Array
      ? databaseBytes
      : new Uint8Array(databaseBytes);
    database = new SQL.Database(bytes);
    const check = database.exec(`PRAGMA ${pragma}`);
    const details = check.flatMap((set) => set.values.flat()).map(String);
    if (details.length !== 1 || details[0] !== 'ok') {
      throw taskError(`Ο έλεγχος ${pragma} απέτυχε: ${details.join(', ')}`, 'BACKUP_DATABASE_INVALID');
    }
    const tables = database.exec("SELECT name FROM sqlite_master WHERE type='table'");
    const names = new Set((tables[0]?.values || []).map((row) => String(row[0])));
    const missing = CRITICAL_TABLES.filter((name) => !names.has(name));
    if (missing.length) {
      throw taskError(`Λείπουν κρίσιμοι πίνακες: ${missing.join(', ')}`, 'BACKUP_SCHEMA_INVALID');
    }
    const schema = database.exec('SELECT MAX(version) FROM schema_migrations');
    const schemaVersion = Number(schema[0]?.values[0]?.[0] || 0);
    if (!schemaVersion || (expectedSchemaVersion && schemaVersion > expectedSchemaVersion)) {
      throw taskError('Η έκδοση schema του αντιγράφου δεν υποστηρίζεται.', 'BACKUP_SCHEMA_UNSUPPORTED');
    }
    return { schemaVersion, check: pragma };
  } catch (error) {
    if (error.code) throw error;
    throw taskError('Η βάση δεδομένων του αντιγράφου είναι κατεστραμμένη.', 'BACKUP_DATABASE_INVALID');
  } finally {
    if (database) database.close();
  }
}

async function availableSpace(targetPath, override) {
  if (Number.isFinite(override)) return Number(override);
  let existing = path.resolve(targetPath);
  while (!fs.existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    existing = parent;
  }
  if (fs.promises.statfs) {
    const stats = await fs.promises.statfs(existing);
    return Number(stats.bavail) * Number(stats.bsize);
  }
  if (process.platform === 'win32') {
    const drive = path.parse(existing).root.slice(0, 1);
    return new Promise((resolve, reject) => {
      const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32',
        'WindowsPowerShell', 'v1.0', 'powershell.exe');
      execFile(executable, ['-NoProfile', '-NonInteractive', '-Command',
        `(Get-PSDrive -Name '${drive}').Free`], { timeout: 8000 }, (error, stdout) => {
        if (error) reject(taskError('Δεν ήταν δυνατός ο έλεγχος ελεύθερου χώρου.', 'BACKUP_SPACE_CHECK_FAILED'));
        else resolve(Number(String(stdout).trim()));
      });
    });
  }
  throw taskError('Δεν ήταν δυνατός ο έλεγχος ελεύθερου χώρου.', 'BACKUP_SPACE_CHECK_FAILED');
}

async function requireSpace(targetPath, bytes, override) {
  let free;
  try {
    free = await availableSpace(targetPath, override);
  } catch (error) {
    if (error && error.code === 'BACKUP_SPACE_CHECK_FAILED') {
      // Ο έλεγχος χώρου απέτυχε να ολοκληρωθεί (π.χ. PowerShell timeout σε Windows 7) -
      // δεν σημαίνει ότι δεν υπάρχει χώρος. Προχωράμε χωρίς να μπλοκάρουμε το backup.
      return;
    }
    throw error;
  }
  if (!Number.isFinite(free) || free < bytes) {
    throw taskError('Δεν υπάρχει αρκετός ελεύθερος χώρος για την ασφαλή εργασία.', 'BACKUP_INSUFFICIENT_SPACE');
  }
}

function uniquePath(root, prefix) {
  let candidate = path.join(root, `${prefix}${new Date().toISOString().replace(/[:.]/g, '-')}`);
  let suffix = 1;
  while (fs.existsSync(candidate)) candidate = `${candidate}-${suffix++}`;
  return candidate;
}

async function readManifest(backupPath) {
  let manifestBytes;
  try {
    const rootStats = await fs.promises.lstat(backupPath);
    if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
      throw taskError('Μη ασφαλής φάκελος αντιγράφου.', 'BACKUP_PATH_UNSAFE');
    }
    manifestBytes = await fs.promises.readFile(path.join(backupPath, MANIFEST_FILE));
  } catch (error) {
    if (error.code && String(error.code).startsWith('BACKUP_')) throw error;
    throw taskError('Το manifest του αντιγράφου λείπει ή είναι κατεστραμμένο.', 'BACKUP_MANIFEST_INVALID');
  }

  const manifestHashPath = path.join(backupPath, MANIFEST_HASH_FILE);
  if (fs.existsSync(manifestHashPath)) {
    const expectedHash = String(await fs.promises.readFile(manifestHashPath, 'utf8')).trim();
    const actualHash = crypto.createHash('sha256').update(manifestBytes).digest('hex');
    if (!/^[a-f0-9]{64}$/i.test(expectedHash) || expectedHash !== actualHash) {
      throw taskError('Το manifest του αντιγράφου έχει τροποποιηθεί.', 'BACKUP_MANIFEST_TAMPERED');
    }
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (_error) {
    throw taskError('Το manifest του αντιγράφου λείπει ή είναι κατεστραμμένο.', 'BACKUP_MANIFEST_INVALID');
  }
  if (
    manifest.format !== FORMAT
    || ![LEGACY_VERSION, VERSION].includes(manifest.version)
    || !manifest.database
    || !Array.isArray(manifest.files)
  ) {
    throw taskError('Η μορφή του αντιγράφου δεν υποστηρίζεται.', 'BACKUP_FORMAT_UNSUPPORTED');
  }
  if (manifest.version === VERSION) {
    if (!fs.existsSync(manifestHashPath)) {
      throw taskError('Λείπει η επαλήθευση του manifest.', 'BACKUP_MANIFEST_TAMPERED');
    }
    if (
      typeof manifest.appVersion !== 'string'
      || !manifest.appVersion.trim()
      || !Number.isInteger(manifest.schemaVersion)
      || manifest.schemaVersion < 1
      || !BACKUP_KINDS.has(manifest.kind)
      || typeof manifest.createdAt !== 'string'
      || !Number.isFinite(Date.parse(manifest.createdAt))
    ) {
      throw taskError('Το manifest του αντιγράφου δεν είναι έγκυρο.', 'BACKUP_MANIFEST_INVALID');
    }
  }
  return manifest;
}

async function validateBackup(backupPath, options = {}, progress = () => {}) {
  const manifest = await readManifest(backupPath);
  const declared = [manifest.database, ...manifest.files];
  const declaredPaths = new Set();
  for (const item of declared) {
    if (
      !item
      || typeof item.path !== 'string'
      || !Number.isSafeInteger(item.size)
      || item.size < 0
      || typeof item.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/i.test(item.sha256)
    ) {
      throw taskError('Το manifest περιέχει μη έγκυρη εγγραφή αρχείου.', 'BACKUP_MANIFEST_INVALID');
    }
    const relative = safeRelative(item.path);
    if (declaredPaths.has(relative)) {
      throw taskError('Το manifest περιέχει διπλή εγγραφή αρχείου.', 'BACKUP_MANIFEST_INVALID');
    }
    declaredPaths.add(relative);
  }
  if (safeRelative(manifest.database.path) !== DATABASE_RELATIVE_PATH.replace(/\\/g, '/')) {
    throw taskError('Η διαδρομή της βάσης στο manifest δεν είναι έγκυρη.', 'BACKUP_MANIFEST_INVALID');
  }

  const actualFiles = new Set(await scanBackupFiles(backupPath));
  const expectedFiles = new Set([MANIFEST_FILE, ...declaredPaths]);
  if (manifest.version === VERSION) expectedFiles.add(MANIFEST_HASH_FILE);

  let checked = 0;
  for (const item of declared) {
    const relative = safeRelative(item.path);
    const filePath = path.resolve(backupPath, relative);
    if (!filePath.startsWith(`${path.resolve(backupPath)}${path.sep}`) || !fs.existsSync(filePath)) {
      throw taskError('Λείπει αρχείο του αντιγράφου.', 'BACKUP_FILE_MISSING');
    }
    const stats = await fs.promises.lstat(filePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw taskError('Το αντίγραφο περιέχει μη ασφαλές αρχείο.', 'BACKUP_PATH_UNSAFE');
    }
    if (stats.size !== item.size || await hashFile(filePath) !== item.sha256) {
      throw taskError('Απέτυχε η επαλήθευση ακεραιότητας αρχείου.', 'BACKUP_CHECKSUM_MISMATCH');
    }
    checked += 1;
    progress(checked, declared.length + 1, 'Επαλήθευση checksums…');
  }
  if (
    actualFiles.size !== expectedFiles.size
    || [...actualFiles].some((relative) => !expectedFiles.has(relative))
  ) {
    throw taskError('Το αντίγραφο περιέχει μη δηλωμένα αρχεία.', 'BACKUP_CONTENTS_INVALID');
  }
  const bytes = await fs.promises.readFile(path.join(backupPath, DATABASE_RELATIVE_PATH));
  const inspection = await inspectDatabase(bytes, options.sqlJsDirectory, options.pragma || 'integrity_check',
    options.expectedSchemaVersion);
  if (inspection.schemaVersion !== manifest.schemaVersion) {
    throw taskError('Η έκδοση schema δεν συμφωνεί με το manifest.', 'BACKUP_SCHEMA_MISMATCH');
  }
  progress(declared.length + 1, declared.length + 1, 'Η επαλήθευση ολοκληρώθηκε.');
  return manifest;
}

async function previousHashes(root) {
  if (!fs.existsSync(root)) return new Map();
  const entries = (await fs.promises.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('Diaxeirisi-Backup-'))
    .sort((a, b) => b.name.localeCompare(a.name));
  for (const entry of entries) {
    const backupPath = path.join(root, entry.name);
    try {
      const manifest = await readManifest(backupPath);
      const result = new Map();
      for (const item of manifest.files) {
        const candidate = path.join(backupPath, safeRelative(item.path));
        const stats = await fs.promises.lstat(candidate);
        if (stats.isFile() && !stats.isSymbolicLink() && await hashFile(candidate) === item.sha256) {
          result.set(item.sha256, candidate);
        }
      }
      return result;
    } catch (_error) {}
  }
  return new Map();
}

async function createBackup(payload, progress, checkCanceled, registerCleanup = () => {}) {
  const root = path.resolve(payload.destinationRoot);
  await fs.promises.mkdir(root, { recursive: true });
  const rootStats = await fs.promises.lstat(root);
  if (!rootStats.isDirectory() || rootStats.isSymbolicLink()) {
    throw taskError('Μη ασφαλής προορισμός αντιγράφου.', 'BACKUP_PATH_UNSAFE');
  }
  const photos = await listFiles(payload.photosPath);
  const databaseSnapshot = payload.databaseSnapshot instanceof Uint8Array
    ? payload.databaseSnapshot
    : new Uint8Array(payload.databaseSnapshot);
  let required = databaseSnapshot.byteLength;
  for (const relative of photos) required += (await fs.promises.stat(path.join(payload.photosPath, relative))).size;
  await requireSpace(root, required + 1024 * 1024, payload.availableBytes);
  const finalPath = uniquePath(root, 'Diaxeirisi-Backup-');
  const temporary = path.join(root, `.dchsi-backup-tmp-${crypto.randomUUID()}`);
  let published = false;
  registerCleanup(temporary);
  try {
    await fs.promises.mkdir(path.join(temporary, 'data'), { recursive: true });
    const databasePath = path.join(temporary, DATABASE_RELATIVE_PATH);
    await fs.promises.writeFile(databasePath, databaseSnapshot);
    await syncFile(databasePath);
    if (payload.failAt === 'afterDatabaseWrite') {
      throw taskError('Injected backup failure.', 'BACKUP_INJECTED_FAILURE');
    }
    const inspection = await inspectDatabase(databaseSnapshot, payload.sqlJsDirectory,
      'integrity_check', payload.expectedSchemaVersion);
    const files = [];
    const dedup = await previousHashes(root);
    for (let index = 0; index < photos.length; index += 1) {
      checkCanceled();
      const relative = photos[index];
      const source = path.join(payload.photosPath, relative);
      const destinationRelative = path.join('photos', relative).replace(/\\/g, '/');
      const destination = path.join(temporary, destinationRelative);
      await fs.promises.mkdir(path.dirname(destination), { recursive: true });
      const sha256 = await hashFile(source);
      const prior = dedup.get(sha256);
      try {
        if (!prior || !fs.existsSync(prior)) throw new Error('copy');
        await fs.promises.link(prior, destination);
      } catch (_error) {
        await fs.promises.copyFile(source, destination);
      }
      await syncFile(destination);
      const size = (await fs.promises.stat(destination)).size;
      files.push({ path: destinationRelative, size, sha256 });
      progress(index + 1, Math.max(photos.length, 1), 'Αντιγραφή και επαλήθευση φωτογραφιών…');
    }
    if (payload.failAt === 'afterFilesCopy') {
      throw taskError('Injected backup failure.', 'BACKUP_INJECTED_FAILURE');
    }
    const databaseStats = await fs.promises.stat(databasePath);
    const manifest = {
      format: FORMAT,
      version: VERSION,
      appVersion: String(payload.appVersion || 'unknown'),
      createdAt: new Date().toISOString(),
      kind: payload.kind,
      schemaVersion: inspection.schemaVersion,
      includesPhotos: photos.length > 0,
      database: {
        path: DATABASE_RELATIVE_PATH.replace(/\\/g, '/'),
        size: databaseStats.size,
        sha256: await hashFile(databasePath),
        check: 'integrity_check'
      },
      files
    };
    const manifestPath = path.join(temporary, MANIFEST_FILE);
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    await fs.promises.writeFile(manifestPath, manifestBytes);
    await syncFile(manifestPath);
    const manifestHash = crypto.createHash('sha256').update(manifestBytes).digest('hex');
    const manifestHashPath = path.join(temporary, MANIFEST_HASH_FILE);
    await fs.promises.writeFile(manifestHashPath, `${manifestHash}\n`, 'utf8');
    await syncFile(manifestHashPath);
    if (payload.failAt === 'afterManifestWrite') {
      throw taskError('Injected backup failure.', 'BACKUP_INJECTED_FAILURE');
    }
    await validateBackup(temporary, { ...payload, pragma: 'integrity_check' }, progress);
    await syncDirectory(temporary);
    await fs.promises.rename(temporary, finalPath);
    published = true;
    await syncDirectory(root);
    if (payload.failAt === 'afterPublish') {
      throw taskError('Injected backup failure.', 'BACKUP_INJECTED_FAILURE');
    }
    await validateBackup(finalPath, { ...payload, pragma: 'integrity_check' }, progress);
    return { path: finalPath, ...manifest };
  } catch (error) {
    await fs.promises.rm(temporary, { recursive: true, force: true }).catch(() => {});
    if (published) await fs.promises.rm(finalPath, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function copyDirectory(source, destination, progress, checkCanceled) {
  const files = await listFiles(source);
  for (let index = 0; index < files.length; index += 1) {
    checkCanceled();
    const relative = files[index];
    const target = path.join(destination, relative);
    await fs.promises.mkdir(path.dirname(target), { recursive: true });
    await fs.promises.copyFile(path.join(source, relative), target);
    progress(index + 1, Math.max(files.length, 1), 'Αντιγραφή επαναφοράς…');
  }
}

async function prepareRestore(payload, progress, checkCanceled, registerCleanup = () => {}) {
  const manifest = await validateBackup(payload.backupPath, { ...payload, pragma: 'integrity_check' }, progress);
  const userData = path.resolve(payload.userDataPath);
  const staging = path.join(userData, `.dchsi-restore-tmp-${crypto.randomUUID()}`);
  registerCleanup(staging);
  const pending = path.join(userData, 'pending-restore');
  await requireSpace(userData, manifest.database.size + manifest.files.reduce((sum, item) => sum + item.size, 0)
    + 1024 * 1024, payload.availableBytes);
  try {
    await copyDirectory(payload.backupPath, staging, progress, checkCanceled);
    await validateBackup(staging, { ...payload, pragma: 'integrity_check' }, progress);
    await fs.promises.rm(pending, { recursive: true, force: true });
    await fs.promises.rename(staging, pending);
    await fs.promises.writeFile(path.join(userData, 'pending-restore.json'), JSON.stringify({
      path: pending, requestedAt: new Date().toISOString(), manifest
    }, null, 2), 'utf8');
    return { prepared: true, createdAt: manifest.createdAt };
  } catch (error) {
    await fs.promises.rm(staging, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function replaceFile(source, destination) {
  const next = `${destination}.restore-next-${crypto.randomUUID()}`;
  try {
    await fs.promises.mkdir(path.dirname(destination), { recursive: true });
    await fs.promises.copyFile(source, next);
    await syncFile(next);
    await fs.promises.rm(destination, { force: true });
    await fs.promises.rename(next, destination);
    await syncDirectory(path.dirname(destination));
  } finally {
    await fs.promises.rm(next, { force: true }).catch(() => {});
  }
}

async function applyRestore(payload, progress, checkCanceled, registerCleanup = () => {}) {
  const userData = path.resolve(payload.userDataPath);
  const request = path.join(userData, 'pending-restore.json');
  if (!fs.existsSync(request)) return { applied: false };
  const pending = path.join(userData, 'pending-restore');
  const database = path.join(userData, DATABASE_RELATIVE_PATH);
  const photos = path.join(userData, 'photos');
  const rollback = path.join(userData, '.dchsi-restore-rollback');
  const nextPhotos = path.join(userData, `.dchsi-restore-photos-${crypto.randomUUID()}`);
  registerCleanup(nextPhotos);
  if (fs.existsSync(rollback)) {
    const oldDatabase = path.join(rollback, DATABASE_RELATIVE_PATH);
    if (fs.existsSync(oldDatabase)) await replaceFile(oldDatabase, database);
    await fs.promises.rm(photos, { recursive: true, force: true });
    if (fs.existsSync(path.join(rollback, 'photos'))) {
      await fs.promises.rename(path.join(rollback, 'photos'), photos);
    }
    await fs.promises.rm(rollback, { recursive: true, force: true });
  }
  await validateBackup(pending, { ...payload, pragma: 'integrity_check' }, progress);
  try {
    await fs.promises.mkdir(rollback, { recursive: true });
    if (fs.existsSync(database)) {
      await fs.promises.mkdir(path.join(rollback, 'data'), { recursive: true });
      await fs.promises.copyFile(database, path.join(rollback, DATABASE_RELATIVE_PATH));
    }
    if (fs.existsSync(photos)) await copyDirectory(photos, path.join(rollback, 'photos'), progress, checkCanceled);
    const snapshot = fs.existsSync(database) ? await fs.promises.readFile(database) : null;
    if (snapshot) {
      await createBackup({ ...payload, databaseSnapshot: snapshot, photosPath: photos,
        destinationRoot: path.join(userData, 'backups'), kind: 'pre-restore' },
      progress, checkCanceled, registerCleanup);
    }
    const restoredPhotos = path.join(pending, 'photos');
    if (fs.existsSync(restoredPhotos)) await copyDirectory(restoredPhotos, nextPhotos, progress, checkCanceled);
    checkCanceled();
    await replaceFile(path.join(pending, DATABASE_RELATIVE_PATH), database);
    if (payload.failAt === 'afterDatabaseReplace') throw taskError('Injected restore failure.', 'RESTORE_INJECTED_FAILURE');
    await fs.promises.rm(photos, { recursive: true, force: true });
    if (fs.existsSync(nextPhotos)) await fs.promises.rename(nextPhotos, photos);
    if (payload.failAt === 'afterPhotosReplace') {
      throw taskError('Injected restore failure.', 'RESTORE_INJECTED_FAILURE');
    }
    await fs.promises.rm(pending, { recursive: true, force: true });
    await fs.promises.rm(request, { force: true });
    await fs.promises.rm(rollback, { recursive: true, force: true });
    return { applied: true };
  } catch (error) {
    try {
      const oldDatabase = path.join(rollback, DATABASE_RELATIVE_PATH);
      if (fs.existsSync(oldDatabase)) await replaceFile(oldDatabase, database);
      await fs.promises.rm(photos, { recursive: true, force: true });
      if (fs.existsSync(path.join(rollback, 'photos'))) {
        await fs.promises.rename(path.join(rollback, 'photos'), photos);
      }
    } finally {
      await fs.promises.rm(nextPhotos, { recursive: true, force: true }).catch(() => {});
      await fs.promises.rm(rollback, { recursive: true, force: true }).catch(() => {});
    }
    throw error;
  }
}

async function executeBackupTask(task, payload, progress, checkCanceled, registerCleanup) {
  if (task === 'backup-create') return createBackup(payload, progress, checkCanceled, registerCleanup);
  if (task === 'backup-validate') return validateBackup(payload.backupPath, payload, progress);
  if (task === 'backup-prepare-restore') {
    return prepareRestore(payload, progress, checkCanceled, registerCleanup);
  }
  if (task === 'backup-apply-restore') return applyRestore(payload, progress, checkCanceled, registerCleanup);
  return undefined;
}

module.exports = {
  executeBackupTask,
  validateBackup,
  CRITICAL_TABLES,
  MANIFEST_FILE,
  MANIFEST_HASH_FILE,
  DATABASE_RELATIVE_PATH
};
