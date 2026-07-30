const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const { migrations } = require('./migrations');
const { seedDefaults } = require('./seed');
const { createLogger } = require('../utils/logger');
const { atomicPersist, cleanupOwnedTemporaryFiles, restoreBackup } = require('./atomicPersistence');

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
  let fileBuffer = readValidDatabase(SQL, dbPath);
  if (!fileBuffer && fs.existsSync(backupPath)) {
    const backupBuffer = readValidDatabase(SQL, backupPath);
    if (backupBuffer) {
      const recover = options.offerBackupRecovery || (async () => false);
      if (await recover({ dbPath, backupPath, mainExists: fs.existsSync(dbPath) })) {
        restoreBackup(dbPath, backupBuffer);
        fileBuffer = backupBuffer;
        logger.info(`Recovered SQLite database from ${backupPath}`);
      }
    }
  }
  if (!fileBuffer && fs.existsSync(dbPath)) {
    throw new Error('The main database is corrupt and no recovery was accepted.');
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
  } catch (_error) {
    return null;
  }
}

function createPersistentDatabase(sqlDatabase, dbPath, options = {}) {
  let transactionDepth = 0;
  let dirty = false;
  const persistDatabase = options.persistDatabase || atomicPersist;

  function flush() {
    if (!dirty || transactionDepth > 0) return false;
    persistDatabase(dbPath, Buffer.from(sqlDatabase.export()));
    dirty = false;
    return true;
  }

  function markDirty() {
    dirty = true;
    if (transactionDepth === 0) flush();
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
        const dirtyBeforeTransaction = dirty;
        const savepoint = `dchsi_nested_${transactionDepth}`;
        transactionDepth += 1;
        if (isOuterTransaction) {
          sqlDatabase.exec('BEGIN TRANSACTION');
        } else {
          sqlDatabase.exec(`SAVEPOINT ${savepoint}`);
        }
        let committed = false;
        try {
          operation();
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
            } catch (_rollbackError) {
              // sql.js can auto-close a failed transaction after certain DDL errors.
            }
            dirty = dirtyBeforeTransaction;
          }
          throw error;
        } finally {
          transactionDepth -= 1;
        }
        if (isOuterTransaction) {
          flush();
        }
      };
    },

    flush,

    close() {
      flush();
      sqlDatabase.close();
    },

    isDirty() {
      return dirty;
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
