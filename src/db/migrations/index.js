const { migrations001To010 } = require('./001-010');
const { migrations011To020 } = require('./011-020');
const { migrations021To030 } = require('./021-030');
const { migrations031To040 } = require('./031-040');
const { migrations041To050 } = require('./041-050');
const { migrations051To061 } = require('./051-061');
const { migrations062 } = require('./062');
const { migrations063 } = require('./063');
const { migrations064 } = require('./064');
const { migrations065 } = require('./065');
const { migrations066 } = require('./066');
const { migrations067 } = require('./067');

function validateMigrations(items) {
  let previousVersion = 0;
  const versions = new Set();
  for (const migration of items) {
    if (!Number.isInteger(migration.version) || versions.has(migration.version)) {
      throw new Error(`Duplicate or invalid migration version: ${migration.version}`);
    }
    if (migration.version <= previousVersion) {
      throw new Error(`Migration versions are out of order: ${previousVersion}, ${migration.version}`);
    }
    versions.add(migration.version);
    previousVersion = migration.version;
  }
  return items;
}

const migrations = validateMigrations([
  ...migrations001To010,
  ...migrations011To020,
  ...migrations021To030,
  ...migrations031To040,
  ...migrations041To050,
  ...migrations051To061,
  ...migrations062,
  ...migrations063,
  ...migrations064,
  ...migrations065,
  ...migrations066,
  ...migrations067
]);

module.exports = {
  migrations,
  validateMigrations
};
