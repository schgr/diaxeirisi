const migrations066 = [
  {
    version: 66,
    name: 'addy_documents_without_autoincrement',
    foreignKeysOff: true,
    up: `
      CREATE TABLE addy_documents_new (
        id INTEGER PRIMARY KEY,
        document_date TEXT NOT NULL,
        transaction_unit TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        justification_reference TEXT NOT NULL DEFAULT '',
        index_field_7 TEXT NOT NULL DEFAULT '',
        index_field_8 TEXT NOT NULL DEFAULT '',
        index_field_9 TEXT NOT NULL DEFAULT ''
      );

      INSERT INTO addy_documents_new
      SELECT * FROM addy_documents;

      DROP TABLE addy_documents;

      ALTER TABLE addy_documents_new
      RENAME TO addy_documents;
    `
  }
];

module.exports = { migrations066 };
