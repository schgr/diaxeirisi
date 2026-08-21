const migrations068 = [
  {
    version: 68,
    name: 'commerce_companies_and_addy_invoice_fields',
    up: `
      CREATE TABLE commerce_companies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        tax_number TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE addy_documents
      ADD COLUMN invoice_number TEXT;

      ALTER TABLE addy_documents
      ADD COLUMN invoice_date TEXT;

      ALTER TABLE addy_documents
      ADD COLUMN commerce_company_id INTEGER;
    `
  }
];

module.exports = { migrations068 };
