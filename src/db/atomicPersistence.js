const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMP_PREFIX = '.dchsi.sqlite.tmp-';
const temporaryPath = (directory) =>
  path.join(directory, `${TEMP_PREFIX}${process.pid}-${crypto.randomBytes(8).toString('hex')}`);

function temporaryOwner(name) {
  const match = String(name).match(/^\.dchsi\.sqlite\.tmp-(\d+)-[a-f0-9]+$/i);
  return match ? Number(match[1]) : null;
}

function isProcessAlive(pid, processApi = process) {
  if (pid === processApi.pid) return true;
  try {
    processApi.kill(pid, 0);
    return true;
  } catch (error) {
    return error && error.code === 'EPERM';
  }
}

function syncDirectory(directory, io) {
  let handle;
  try {
    handle = io.openSync(directory, 'r');
    io.fsyncSync(handle);
  } catch (error) {
    if (process.platform !== 'win32') throw error;
  } finally {
    if (handle !== undefined) io.closeSync(handle);
  }
}

function writeAndSync(filePath, contents, io) {
  const handle = io.openSync(filePath, 'wx', 0o600);
  try {
    let offset = 0;
    while (offset < contents.length) {
      const written = io.writeSync(handle, contents, offset, contents.length - offset);
      if (!Number.isInteger(written) || written <= 0) {
        throw Object.assign(new Error('Atomic database write made no progress.'), {
          code: 'DATABASE_WRITE_STALLED'
        });
      }
      offset += written;
    }
    io.fsyncSync(handle);
  } finally {
    io.closeSync(handle);
  }
}

function safeUnlink(filePath, io) {
  try { io.unlinkSync(filePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}

function cleanupOwnedTemporaryFiles(directory, io = fs, processApi = process) {
  for (const entry of io.readdirSync(directory, { withFileTypes: true })) {
    const owner = entry.isFile() ? temporaryOwner(entry.name) : null;
    if (owner !== null && !isProcessAlive(owner, processApi)) {
      safeUnlink(path.join(directory, entry.name), io);
    }
  }
}

function atomicPersist(dbPath, contents, options = {}) {
  const io = options.fs || fs;
  const directory = path.dirname(dbPath);
  const backupPath = `${dbPath}.bak`;
  const stagedPath = temporaryPath(directory);
  const previousBackupPath = temporaryPath(directory);
  let movedPreviousBackup = false;
  let movedMain = false;
  try {
    writeAndSync(stagedPath, Buffer.from(contents), io);
    syncDirectory(directory, io);
    if (io.existsSync(backupPath)) {
      io.renameSync(backupPath, previousBackupPath);
      movedPreviousBackup = true;
      syncDirectory(directory, io);
    }
    if (io.existsSync(dbPath)) {
      try {
        io.renameSync(dbPath, backupPath);
        movedMain = true;
        syncDirectory(directory, io);
      } catch (error) {
        if (movedPreviousBackup && !io.existsSync(backupPath)) {
          io.renameSync(previousBackupPath, backupPath);
          movedPreviousBackup = false;
          syncDirectory(directory, io);
        }
        throw error;
      }
    }
    try {
      io.renameSync(stagedPath, dbPath);
      syncDirectory(directory, io);
    } catch (replaceError) {
      if (movedMain && !io.existsSync(dbPath)) {
        io.renameSync(backupPath, dbPath);
        movedMain = false;
        syncDirectory(directory, io);
      }
      if (movedPreviousBackup && !io.existsSync(backupPath)) {
        io.renameSync(previousBackupPath, backupPath);
        movedPreviousBackup = false;
        syncDirectory(directory, io);
      }
      throw replaceError;
    }
    if (movedPreviousBackup) {
      safeUnlink(previousBackupPath, io);
      syncDirectory(directory, io);
    }
  } catch (error) {
    try {
      if (movedPreviousBackup && !io.existsSync(backupPath)) io.renameSync(previousBackupPath, backupPath);
    } catch (restoreError) {
      error.suppressed = [...(error.suppressed || []), restoreError];
    }
    try {
      safeUnlink(stagedPath, io);
    } catch (cleanupError) {
      error.suppressed = [...(error.suppressed || []), cleanupError];
    }
    throw error;
  }
}

function restoreBackup(dbPath, backupContents, options = {}) {
  const io = options.fs || fs;
  const directory = path.dirname(dbPath);
  const stagedPath = temporaryPath(directory);
  const displacedPath = temporaryPath(directory);
  let displacedMain = false;
  try {
    writeAndSync(stagedPath, Buffer.from(backupContents), io);
    syncDirectory(directory, io);
    if (io.existsSync(dbPath)) {
      io.renameSync(dbPath, displacedPath);
      displacedMain = true;
    }
    try {
      io.renameSync(stagedPath, dbPath);
      syncDirectory(directory, io);
    } catch (error) {
      if (displacedMain && !io.existsSync(dbPath)) io.renameSync(displacedPath, dbPath);
      throw error;
    }
    if (displacedMain) safeUnlink(displacedPath, io);
  } catch (error) {
    try {
      safeUnlink(stagedPath, io);
    } catch (cleanupError) {
      error.suppressed = [...(error.suppressed || []), cleanupError];
    }
    throw error;
  }
}

module.exports = {
  TEMP_PREFIX,
  atomicPersist,
  cleanupOwnedTemporaryFiles,
  restoreBackup,
  temporaryOwner,
  isProcessAlive
};
