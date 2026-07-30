const migrations001To010 = [
  {
    version: 1,
    name: 'initial_settings_schema',
    up: `
      CREATE TABLE service_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        service_name TEXT NOT NULL DEFAULT '',
        commander TEXT NOT NULL DEFAULT '',
        ped TEXT NOT NULL DEFAULT '',
        manager TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO service_settings (id) VALUES (1);

      CREATE TABLE department_managers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        department_name TEXT NOT NULL,
        department_head TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE ranks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE measurement_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TRIGGER department_managers_updated_at
      AFTER UPDATE ON department_managers
      FOR EACH ROW
      BEGIN
        UPDATE department_managers SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

      CREATE TRIGGER ranks_updated_at
      AFTER UPDATE ON ranks
      FOR EACH ROW
      BEGIN
        UPDATE ranks SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

      CREATE TRIGGER measurement_units_updated_at
      AFTER UPDATE ON measurement_units
      FOR EACH ROW
      BEGIN
        UPDATE measurement_units SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;
    `
  },
  {
    version: 2,
    name: 'shares_schema',
    up: `
      CREATE TABLE shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_number TEXT NOT NULL,
        nominal_number TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL,
        material_type TEXT NOT NULL,
        accounting_balance REAL NOT NULL DEFAULT 0,
        charged_quantity REAL NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_shares_share_number ON shares (share_number);
      CREATE INDEX idx_shares_nominal_number ON shares (nominal_number);
      CREATE INDEX idx_shares_material_type ON shares (material_type);

      CREATE TRIGGER shares_updated_at
      AFTER UPDATE ON shares
      FOR EACH ROW
      BEGIN
        UPDATE shares SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

    `
  },
  {
    version: 3,
    name: 'transaction_units_and_material_categories',
    up: `
      CREATE TABLE transaction_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE material_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TRIGGER transaction_units_updated_at
      AFTER UPDATE ON transaction_units
      FOR EACH ROW
      BEGIN
        UPDATE transaction_units SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

      CREATE TRIGGER material_categories_updated_at
      AFTER UPDATE ON material_categories
      FOR EACH ROW
      BEGIN
        UPDATE material_categories SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

      INSERT INTO transaction_units (name, sort_order)
      VALUES ('ΕΜΠΟΡΙΟ', 1);

      INSERT INTO material_categories (name, sort_order)
      VALUES ('Αναλώσιμα', 1);
    `
  },
  {
    version: 4,
    name: 'share_card_transactions_and_assignments',
    up: `
      CREATE TABLE share_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL,
        transaction_date TEXT NOT NULL,
        transaction_unit TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        document_reference TEXT NOT NULL DEFAULT '',
        quantity REAL NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_share_transactions_share_year
      ON share_transactions (share_id, transaction_date);

      CREATE TABLE share_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL,
        holder_name TEXT NOT NULL,
        department TEXT NOT NULL DEFAULT '',
        quantity REAL NOT NULL DEFAULT 0,
        assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        notes TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_share_assignments_share_id
      ON share_assignments (share_id);

    `
  },
  {
    version: 5,
    name: 'addy_documents',
    up: `
      CREATE TABLE addy_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_date TEXT NOT NULL,
        transaction_unit TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE addy_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        addy_document_id INTEGER NOT NULL,
        share_id INTEGER NOT NULL,
        share_number TEXT NOT NULL,
        nominal_number TEXT NOT NULL,
        material_type TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (addy_document_id) REFERENCES addy_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_addy_items_document_id ON addy_items (addy_document_id);
      CREATE INDEX idx_addy_items_share_id ON addy_items (share_id);
    `
  },
  {
    version: 6,
    name: 'normalize_numeric_share_numbers',
    up: `
      UPDATE shares
      SET share_number = CAST(CAST(share_number AS INTEGER) AS TEXT)
      WHERE share_number GLOB '[0-9]*'
        AND CAST(share_number AS INTEGER) > 0;

      UPDATE addy_items
      SET share_number = CAST(CAST(share_number AS INTEGER) AS TEXT)
      WHERE share_number GLOB '[0-9]*'
        AND CAST(share_number AS INTEGER) > 0;
    `
  },
  {
    version: 7,
    name: 'supply_requests',
    up: `
      CREATE TABLE supply_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        serial_number INTEGER NOT NULL,
        request_date TEXT NOT NULL,
        requesting_unit TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Οφειλούμενη',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (year, serial_number)
      );

      CREATE TABLE supply_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        supply_request_id INTEGER NOT NULL,
        nominal_number TEXT NOT NULL,
        description TEXT NOT NULL,
        quantity REAL NOT NULL,
        measurement_unit TEXT NOT NULL,
        justification_code TEXT NOT NULL,
        priority_code TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (supply_request_id) REFERENCES supply_requests(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_supply_requests_year ON supply_requests (year);
      CREATE INDEX idx_supply_request_items_request_id ON supply_request_items (supply_request_id);
    `
  },
  {
    version: 8,
    name: 'addy_items_measurement_unit',
    up: `
      ALTER TABLE addy_items
      ADD COLUMN measurement_unit TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 9,
    name: 'addy_items_description_and_price',
    up: `
      ALTER TABLE addy_items
      ADD COLUMN description TEXT NOT NULL DEFAULT '';

      ALTER TABLE addy_items
      ADD COLUMN unit_price REAL;
    `
  },
  {
    version: 10,
    name: 'share_price_and_photo',
    up: `
      ALTER TABLE shares
      ADD COLUMN unit_price REAL;

      ALTER TABLE shares
      ADD COLUMN photo_path TEXT NOT NULL DEFAULT '';
    `
  }
];

module.exports = { migrations001To010 };
