const { AppError } = require('../core/errorHandler');

const defaultRanks = ['ΛΓΟΣ', 'ΥΠΛΓΟΣ', 'ΑΝΘΛΓΟΣ', 'ΑΛΧΙΑΣ'];
const defaultMeasurementUnits = ['Τεμάχια', 'Κιλά', 'Λίτρα'];
const ALLOWED_NAMED_LIST_TABLES = new Set([
  'ranks',
  'measurement_units',
  'transaction_units',
  'material_categories',
  'request_issuing_units',
  'exhp_issue_reasons'
]);

function seedDefaults(db) {
  seedNamedList(db, 'ranks', defaultRanks);
  seedNamedList(db, 'measurement_units', defaultMeasurementUnits);
}

function seedNamedList(db, tableName, values) {
  if (!ALLOWED_NAMED_LIST_TABLES.has(tableName)) {
    throw new AppError(`Μη έγκυρος πίνακας ονομαστικής λίστας: ${tableName}`, 'VALIDATION_ERROR');
  }

  const count = db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
  if (count > 0) {
    return;
  }

  const insert = db.prepare(`INSERT INTO ${tableName} (name, sort_order) VALUES (?, ?)`);
  const transaction = db.transaction(() => {
    values.forEach((value, index) => insert.run(value, index + 1));
  });
  transaction();
}

module.exports = {
  seedDefaults
};
