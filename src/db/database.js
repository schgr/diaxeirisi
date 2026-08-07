const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { migrations } = require('./migrations');
const { seedDefaults } = require('./seed');
const { createLogger } = require('../utils/logger');
const { atomicPersist, cleanupOwnedTemporaryFiles, restoreBackup } = require('./atomicPersistence');
const { createPersistenceCoordinator } = require('./persistenceCoordinator');

const logger = createLogger('database');

async function initializeDatabase(userDataPath, options = {}) {
  const dataDirectory = path.join(userDataPath, 'data');
  fs.mkdirSync(dataDirectory, { recursive: true });

  const dbPath = path.join(dataDirectory, 'dchsi.sqlite');
  const backupPath = `${dbPath}.bak`;
  const SQL = await initSqlJs({
    locateFile: (file) => path.join(__dirname, '..', '..', 'node_modules', 'sql.js', 'dist', file)
  });
  cleanupOwnedTemporaryFiles(dataDirectory);
  const mainExists = fs.existsSync(dbPath);
  const backupExists = fs.existsSync(backupPath);
  let fileBuffer = readValidDatabase(SQL, dbPath);
  if (!fileBuffer && backupExists) {
    const backupBuffer = readValidDatabase(SQL, backupPath);
    if (backupBuffer) {
      const recover = options.offerBackupRecovery || (async () => false);
      if (!await recover({ dbPath, backupPath, mainExists, reason: mainExists ? 'main-corrupt' : 'main-missing' })) {
        throw databaseError('Database recovery was not accepted.', 'DATABASE_RECOVERY_DECLINED');
      }
      try {
        (options.restoreBackup || restoreBackup)(dbPath, backupBuffer);
      } catch (error) {
        throw databaseError('Database recovery failed.', 'DATABASE_RECOVERY_FAILED', error);
      }
      fileBuffer = readValidDatabase(SQL, dbPath);
      if (!fileBuffer) throw databaseError('Recovered database validation failed.', 'DATABASE_RECOVERY_FAILED');
      logger.info(`Recovered SQLite database from ${backupPath}`);
    } else {
      throw databaseError('The database backup is corrupt.', 'DATABASE_BACKUP_CORRUPT');
    }
  }
  if (!fileBuffer && mainExists) {
    throw databaseError('The main database is corrupt and no valid backup is available.', 'DATABASE_MAIN_CORRUPT');
  }
  const db = createPersistentDatabase(new SQL.Database(fileBuffer), dbPath);
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  runMigrations(db);
  seedDefaults(db);
  logger.info(`SQLite ready at ${dbPath}`);
  return db;
}

function databaseError(message, code, cause) {
  return Object.assign(new Error(message), { code, cause });
}

function readValidDatabase(SQL, filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    const contents = fs.readFileSync(filePath);
    const candidate = new SQL.Database(contents);
    try {
      const result = candidate.exec('PRAGMA integrity_check');
      return result[0]?.values[0]?.[0] === 'ok' ? contents : null;
    } finally {
      candidate.close();
    }
  } catch (error) {
    logger.warn(`Unable to read a valid database from ${filePath}.`, {
      code: error && error.code,
      message: error && error.message
    });
    return null;
  }
}

function createPersistentDatabase(sqlDatabase, dbPath, options = {}) {
  let transactionDepth = 0;
  const persistDatabase = options.persistDatabase || atomicPersist;
  const persistence = createPersistenceCoordinator({
    debounceMs: options.persistenceDelayMs,
    maxDelayMs: options.persistenceMaxDelayMs,
    scheduler: options.scheduler,
    onError: options.onPersistenceError || ((error) => logger.error('Scheduled database persistence failed.', error)),
    persist: () => persistDatabase(dbPath, Buffer.from(sqlDatabase.export()))
  });

  function flush() {
    if (transactionDepth > 0) return false;
    return persistence.flush();
  }

  function markDirty() {
    persistence.markDirty(transactionDepth === 0);
  }

  return {
    exec(sql) {
      sqlDatabase.exec(sql);
      if (isMutatingSql(sql)) markDirty();
    },

    pragma(statement) {
      sqlDatabase.exec(`PRAGMA ${statement}`);
      if (isMutatingPragma(statement)) markDirty();
    },

    prepare(sql) {
      return {
        all(...params) {
          const statement = sqlDatabase.prepare(sql);
          try {
            statement.bind(flattenParams(params));
            const rows = [];
            while (statement.step()) {
              rows.push(statement.getAsObject());
            }
            return rows;
          } finally {
            statement.free();
          }
        },

        get(...params) {
          const statement = sqlDatabase.prepare(sql);
          try {
            statement.bind(flattenParams(params));
            return statement.step() ? statement.getAsObject() : undefined;
          } finally {
            statement.free();
          }
        },

        run(...params) {
          const statement = sqlDatabase.prepare(sql);
          try {
            statement.run(flattenParams(params));
            if (isMutatingSql(sql)) markDirty();
            return {
              lastInsertRowid: sqlDatabase.exec('SELECT last_insert_rowid() AS id')[0].values[0][0]
            };
          } finally {
            statement.free();
          }
        }
      };
    },

    transaction(operation) {
      return () => {
        const isOuterTransaction = transactionDepth === 0;
        const dirtyBeforeTransaction = persistence.isDirty();
        const savepoint = `dchsi_nested_${transactionDepth}`;
        transactionDepth += 1;
        if (isOuterTransaction) {
          sqlDatabase.exec('BEGIN TRANSACTION');
        } else {
          sqlDatabase.exec(`SAVEPOINT ${savepoint}`);
        }
        let committed = false;
        let result;
        try {
          result = operation();
          if (result && typeof result.then === 'function') {
            Promise.resolve(result).catch((error) => {
              logger.warn('Rejected asynchronous database transaction callback.', {
                message: error && error.message
              });
            });
            throw Object.assign(new TypeError('Database transaction callbacks must be synchronous.'), {
              code: 'DATABASE_ASYNC_TRANSACTION'
            });
          }
          if (isOuterTransaction) {
            sqlDatabase.exec('COMMIT');
          } else {
            sqlDatabase.exec(`RELEASE SAVEPOINT ${savepoint}`);
          }
          committed = true;
        } catch (error) {
          if (!committed) {
            try {
              if (isOuterTransaction) {
                sqlDatabase.exec('ROLLBACK');
              } else {
                sqlDatabase.exec(`ROLLBACK TO SAVEPOINT ${savepoint}`);
                sqlDatabase.exec(`RELEASE SAVEPOINT ${savepoint}`);
              }
            } catch (rollbackError) {
              // sql.js can auto-close a failed transaction after certain DDL errors.
              logger.warn('Database rollback did not complete.', {
                message: rollbackError && rollbackError.message
              });
            }
            persistence.restoreDirty(dirtyBeforeTransaction);
          }
          throw error;
        } finally {
          transactionDepth -= 1;
        }
        if (isOuterTransaction) {
          flush();
        }
        return result;
      };
    },

    flush,

    close() {
      flush();
      persistence.close();
      sqlDatabase.close();
    },

    isDirty() {
      return persistence.isDirty();
    },

    exportSnapshot() {
      flush();
      return Buffer.from(sqlDatabase.export());
    },

    forceDurability: flush,

    persistenceError() {
      return persistence.lastError();
    }
  };
}

function firstSqlKeyword(sql) {
  return String(sql || '')
    .replace(/^\s*(?:(?:--[^\r\n]*(?:\r?\n|$))|(?:\/\*[\s\S]*?\*\/)\s*)*/g, '')
    .match(/^([A-Za-z]+)/)?.[1]?.toUpperCase() || '';
}

function isMutatingSql(sql) {
  const keyword = firstSqlKeyword(sql);
  if (keyword === 'PRAGMA') {
    return isMutatingPragma(String(sql).replace(/^[\s\S]*?\bPRAGMA\b/i, ''));
  }
  if (keyword === 'WITH') {
    return /\b(INSERT|UPDATE|DELETE|REPLACE)\b/i.test(String(sql));
  }
  return !['', 'SELECT', 'EXPLAIN', 'VALUES'].includes(keyword);
}

function isMutatingPragma(statement) {
  const value = String(statement || '').trim();
  if (!value) return false;
  if (/^(foreign_keys|query_only|busy_timeout)\s*=/i.test(value)) return false;
  return /=/.test(value);
}

function flattenParams(params) {
  return params.length === 1 && Array.isArray(params[0]) ? params[0] : params;
}

function runMigrations(db) {
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((row) => row.version)
  );

  for (const migration of migrations) {
    if (applied.has(migration.version)) {
      continue;
    }

    const transaction = db.transaction(() => {
      db.exec(migration.up);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name
      );
    });

    transaction();
    logger.info(`Applied migration ${migration.version}: ${migration.name}`);
  }
}

module.exports = {
  initializeDatabase,
  createPersistentDatabase,
  readValidDatabase,
  isMutatingSql,
  isMutatingPragma
};
