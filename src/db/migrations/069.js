const migrations069 = [
  {
    version: 69,
    name: 'commerce_businesses_catalog',
    up: `
      CREATE TABLE commerce_businesses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TRIGGER commerce_businesses_updated_at
      AFTER UPDATE ON commerce_businesses
      FOR EACH ROW
      BEGIN
        UPDATE commerce_businesses SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;
    `
  }
];

module.exports = { migrations069 };
