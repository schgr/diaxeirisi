const migrations = [
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
  },
  {
    version: 11,
    name: 'request_justification_codes',
    up: `
      CREATE TABLE request_justification_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        auto_delete_owed INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TRIGGER request_justification_codes_updated_at
      AFTER UPDATE ON request_justification_codes
      FOR EACH ROW
      BEGIN
        UPDATE request_justification_codes SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;

      INSERT INTO request_justification_codes (code, description, auto_delete_owed, sort_order)
      VALUES
        ('01', 'Αναπλήρωση Αποθέματος, Συμπλήρωση Προβλεπομένων ΠΟΥ', 1, 1),
        ('02', 'Δημιουργία αποθέματος', 0, 2),
        ('03', 'Αρχική χορήγηση', 0, 3),
        ('04', 'Ανάγκες Μονάδων', 1, 4),
        ('05', 'Αντικατάσταση φθαρμένων', 1, 5),
        ('06', 'Δημιουργία Κλίμακας', 0, 6),
        ('07', 'Ακινησία Κυρίου Υλικού', 0, 7),
        ('08', 'Ανασύσταση Κυρίου Υλικού', 1, 8),
        ('09', 'ΟΧΙ Οφειλόμενα', 1, 9),
        ('10', 'Αξιοποίηση Κυρίου Υλικού', 1, 10),
        ('11', 'Διασκευή Υλικού', 1, 11),
        ('12', 'Κατασκευές', 1, 12),
        ('13', 'Συγκρότηση Συλλογής', 0, 13),
        ('14', 'Διάλυση Συλλογής', 1, 14),
        ('15', 'Συμπλήρωση Συλλογής', 1, 15),
        ('16', 'Συγκρότηση Μονάδας', 0, 16),
        ('17', 'Αλλαγή Σύνθεσης Μονάδας', 1, 17),
        ('18', 'Συμπλήρωση Προβλεπομένων', 0, 18),
        ('20', 'Χορηγήσεις ΕΣΣΟ', 1, 19),
        ('21', 'Συμπλήρωση Υλικών ΕΣΣΟ', 1, 20),
        ('22', 'Ανάγκες Επιστράτευσης', 0, 21),
        ('23', 'Συμπλήρωση Επιστράτευσης', 1, 22),
        ('24', 'Συντήρηση Επιστράτευσης', 1, 23),
        ('25', 'Χορήγηση ΔΙΧΑΜΕ/Υ', 0, 24),
        ('26', 'Χορήγηση για Άσκηση', 1, 25),
        ('27', 'Χορήγηση με Εντολή', 1, 26),
        ('28', 'Καλυπτική Δοσοληψία', 1, 27),
        ('30', 'Αναλώσιμα', 1, 28),
        ('71', 'Ακινησία Κυρίου Α/Α Υλικού (ΧΩΚ, ΡΑΝΤΑΡ)', 1, 29),
        ('72', 'Ακινησία Πυροβόλου, Σ/Α, Α-Τ, Α/Φ, Ε/Π, Αρμάτων', 1, 30),
        ('73', 'Ακινησία Φορ. - Ομ. Οπλισμού, Ειδ. Οχ. Μηχ.', 1, 31),
        ('80', 'Πλευρικός Εσωτερικός Εφοδιασμός', 0, 32),
        ('85', 'Προώθηση για Επισκευή', 0, 33),
        ('86', 'Πρόγραμμα Ανακατασκευών', 0, 34);
    `
  },
  {
    version: 12,
    name: 'request_units_and_measurement_codes',
    up: `
      ALTER TABLE measurement_units
      ADD COLUMN code TEXT NOT NULL DEFAULT '';

      UPDATE measurement_units SET code = 'EA' WHERE name = 'Τεμάχια';
      UPDATE measurement_units SET code = 'kg' WHERE name = 'Κιλά';
      UPDATE measurement_units SET code = 'lit' WHERE name = 'Λίτρα';

      INSERT OR IGNORE INTO measurement_units (name, code, sort_order)
      VALUES
        ('Τεμάχια', 'EA', 1),
        ('Ζεύγη', 'PR', 2),
        ('Μέτρα', 'm', 3),
        ('Συλλογή', 'SET', 4),
        ('m3', 'm3', 5),
        ('Βολίδες', 'RDS', 6),
        ('Σετ', 'SET', 7),
        ('Κιλά', 'kg', 8),
        ('Μίλια', 'mile', 9),
        ('Φιαλίδιο', 'vial', 10),
        ('Δίσκιο', 'disc', 11),
        ('Φύλλα', 'sheet', 12),
        ('Πόδια', 'ft', 13),
        ('Λίβρες', 'lb', 14),
        ('Κάλυμμες', 'cover', 15),
        ('Φύσιγγες', 'ctg', 16),
        ('Σωληνάριο', 'tube', 17),
        ('Ρολλά', 'roll', 18),
        ('Βιβλία', 'book', 19),
        ('KM', 'km', 20);

      UPDATE measurement_units SET code = 'PR', sort_order = 2 WHERE name = 'Ζεύγη';
      UPDATE measurement_units SET code = 'm', sort_order = 3 WHERE name = 'Μέτρα';
      UPDATE measurement_units SET code = 'SET', sort_order = 4 WHERE name = 'Συλλογή';
      UPDATE measurement_units SET code = 'm3', sort_order = 5 WHERE name = 'm3';
      UPDATE measurement_units SET code = 'RDS', sort_order = 6 WHERE name = 'Βολίδες';
      UPDATE measurement_units SET code = 'SET', sort_order = 7 WHERE name = 'Σετ';
      UPDATE measurement_units SET code = 'kg', sort_order = 8 WHERE name = 'Κιλά';
      UPDATE measurement_units SET code = 'mile', sort_order = 9 WHERE name = 'Μίλια';
      UPDATE measurement_units SET code = 'vial', sort_order = 10 WHERE name = 'Φιαλίδιο';
      UPDATE measurement_units SET code = 'disc', sort_order = 11 WHERE name = 'Δίσκιο';
      UPDATE measurement_units SET code = 'sheet', sort_order = 12 WHERE name = 'Φύλλα';
      UPDATE measurement_units SET code = 'ft', sort_order = 13 WHERE name = 'Πόδια';
      UPDATE measurement_units SET code = 'lb', sort_order = 14 WHERE name = 'Λίβρες';
      UPDATE measurement_units SET code = 'cover', sort_order = 15 WHERE name = 'Κάλυμμες';
      UPDATE measurement_units SET code = 'ctg', sort_order = 16 WHERE name = 'Φύσιγγες';
      UPDATE measurement_units SET code = 'tube', sort_order = 17 WHERE name = 'Σωληνάριο';
      UPDATE measurement_units SET code = 'roll', sort_order = 18 WHERE name = 'Ρολλά';
      UPDATE measurement_units SET code = 'book', sort_order = 19 WHERE name = 'Βιβλία';
      UPDATE measurement_units SET code = 'km', sort_order = 20 WHERE name = 'KM';

      CREATE TABLE request_issuing_units (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TRIGGER request_issuing_units_updated_at
      AFTER UPDATE ON request_issuing_units
      FOR EACH ROW
      BEGIN
        UPDATE request_issuing_units SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
      END;
    `
  },
  {
    version: 13,
    name: 'supply_request_issuing_unit',
    up: `
      ALTER TABLE supply_requests
      ADD COLUMN issuing_unit TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 14,
    name: 'service_request_and_share_extra_fields',
    up: `
      ALTER TABLE service_settings
      ADD COLUMN service_location TEXT NOT NULL DEFAULT '';

      ALTER TABLE supply_requests
      ADD COLUMN protocol_number TEXT NOT NULL DEFAULT '';

      ALTER TABLE shares
      ADD COLUMN material_code TEXT NOT NULL DEFAULT '';

      ALTER TABLE shares
      ADD COLUMN projected_quantity REAL NOT NULL DEFAULT 0;

      DELETE FROM material_categories
      WHERE name = 'Υλικά Ιματισμού'
        AND EXISTS (
          SELECT 1 FROM material_categories existing
          WHERE existing.name = 'Αναλώσιμα'
        );

      UPDATE material_categories
      SET name = 'Αναλώσιμα'
      WHERE name = 'Υλικά Ιματισμού';

      INSERT OR IGNORE INTO material_categories (name, sort_order)
      VALUES ('Αναλώσιμα', 1);
    `
  },
  {
    version: 15,
    name: 'request_renewal_tracking',
    up: `
      ALTER TABLE supply_requests
      ADD COLUMN renewal_postponed_until TEXT NOT NULL DEFAULT '';

      ALTER TABLE supply_requests
      ADD COLUMN renewed_from_request_id INTEGER;
    `
  },
  {
    version: 16,
    name: 'default_commerce_transaction_unit',
    up: `
      INSERT OR IGNORE INTO transaction_units (name, sort_order)
      SELECT 'ΕΜΠΟΡΙΟ', 1
      WHERE NOT EXISTS (SELECT 1 FROM transaction_units);
    `
  },
  {
    version: 17,
    name: 'addy_document_justification_reference',
    up: `
      ALTER TABLE addy_documents
      ADD COLUMN justification_reference TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 18,
    name: 'exhp_issue_reasons',
    up: `
      CREATE TABLE exhp_issue_reasons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO exhp_issue_reasons (name, sort_order) VALUES
        ('Λογιστική Τακτοποίηση Άχρηστου Υλικού.', 1),
        ('Λογιστική Τακτοποίηση Διαφορών Ομοειδών Υλικών.', 2),
        ('Μεταγραφή Υλικών Λόγω Μεταβολής του Αριθμού Ονομαστικού.', 3),
        ('Μετασχηματισμός Υλικών (κατασκευή - μετασκευή).', 4),
        ('Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.', 5),
        ('Διαγραφή Ειδών Ιματισμού - Υποδήσεως και Λοιπών Ατομικών Ειδών - Χρέωση Επιστρεφομένων.', 6),
        ('Διαγραφή Αναλώσιμου Υλικού και Ειδών Σταθερών Χορηγιών.', 7),
        ('Υποστήριξη Συμπληρωματικών Εγγραφών.', 8),
        ('Τακτοποίηση Διαφορών.', 9),
        ('Διαγραφή Ανταλλακτικών Εμπορίου που δεν Υποστηρίζονται από το Σύστημα ΔΜ.', 10),
        ('Διαγραφή Πυρομαχικών Εκπαιδεύσεως.', 11),
        ('Κάθε Άλλη Περίπτωση Λογιστικής Τακτοποίησης Υλικού που Διατάσσεται με Διαταγή Προϊσταμένης Αρχής.', 12);
    `
  },
  {
    version: 19,
    name: 'general_management_ledger_and_exhp',
    up: `
      ALTER TABLE shares
      ADD COLUMN measurement_unit TEXT NOT NULL DEFAULT '';

      UPDATE shares
      SET measurement_unit = COALESCE((
        SELECT measurement_unit
        FROM addy_items
        WHERE addy_items.share_id = shares.id
          AND measurement_unit <> ''
        ORDER BY addy_items.id DESC
        LIMIT 1
      ), '');

      UPDATE shares
      SET charged_quantity = COALESCE((
        SELECT SUM(quantity)
        FROM share_assignments
        WHERE share_assignments.share_id = shares.id
          AND department <> ''
          AND quantity > 0
      ), 0);

      DELETE FROM share_assignments
      WHERE department = '';

      CREATE TABLE exhp_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fiscal_year INTEGER NOT NULL,
        registry_number INTEGER NOT NULL,
        document_date TEXT NOT NULL,
        service_unit TEXT NOT NULL,
        issue_reason TEXT NOT NULL,
        approval_reference TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Οριστική',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (fiscal_year, registry_number)
      );

      CREATE TABLE exhp_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exhp_document_id INTEGER NOT NULL,
        share_id INTEGER NOT NULL,
        share_number TEXT NOT NULL,
        nominal_number TEXT NOT NULL,
        description TEXT NOT NULL,
        measurement_unit TEXT NOT NULL,
        material_type TEXT NOT NULL DEFAULT '',
        material_code TEXT NOT NULL DEFAULT '',
        transaction_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        supporting_documents TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exhp_document_id) REFERENCES exhp_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE RESTRICT
      );

      CREATE INDEX idx_exhp_documents_year
      ON exhp_documents (fiscal_year, registry_number);

      CREATE INDEX idx_exhp_items_document
      ON exhp_items (exhp_document_id);
    `
  },
  {
    version: 20,
    name: 'internal_partial_management_movements',
    up: `
      CREATE TABLE internal_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fiscal_year INTEGER NOT NULL,
        serial_number INTEGER NOT NULL,
        document_date TEXT NOT NULL,
        department_manager_id INTEGER NOT NULL,
        department_name TEXT NOT NULL,
        department_head TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_manager_id) REFERENCES department_managers(id) ON DELETE RESTRICT,
        UNIQUE (fiscal_year, serial_number)
      );

      CREATE TABLE internal_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        internal_document_id INTEGER NOT NULL,
        share_id INTEGER NOT NULL,
        share_number TEXT NOT NULL,
        nominal_number TEXT NOT NULL,
        description TEXT NOT NULL,
        measurement_unit TEXT NOT NULL,
        quantity REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (internal_document_id) REFERENCES internal_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE RESTRICT
      );

      CREATE INDEX idx_internal_documents_year
      ON internal_documents (fiscal_year, serial_number);

      CREATE INDEX idx_internal_items_share
      ON internal_items (share_id);

      UPDATE shares
      SET charged_quantity = COALESCE((
        SELECT SUM(quantity)
        FROM share_assignments
        WHERE share_assignments.share_id = shares.id
          AND department <> ''
          AND quantity > 0
      ), 0)
      WHERE NOT EXISTS (
        SELECT 1 FROM internal_items WHERE internal_items.share_id = shares.id
      );

      DELETE FROM share_assignments
      WHERE department = '';
    `
  },
  {
    version: 21,
    name: 'general_management_inventory',
    up: `
      CREATE TABLE inventory_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fiscal_year INTEGER NOT NULL,
        serial_number INTEGER NOT NULL,
        inventory_date TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Σε εξέλιξη',
        notes TEXT NOT NULL DEFAULT '',
        completed_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (fiscal_year, serial_number)
      );

      CREATE TABLE inventory_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_session_id INTEGER NOT NULL,
        share_id INTEGER NOT NULL,
        share_number TEXT NOT NULL,
        nominal_number TEXT NOT NULL,
        description TEXT NOT NULL,
        measurement_unit TEXT NOT NULL,
        accounting_balance REAL NOT NULL,
        partial_management_quantity REAL NOT NULL,
        expected_warehouse_quantity REAL NOT NULL,
        first_count REAL NOT NULL,
        second_count REAL,
        final_count REAL NOT NULL,
        difference REAL NOT NULL,
        difference_status TEXT NOT NULL,
        settlement_status TEXT NOT NULL DEFAULT 'Εκκρεμεί',
        settlement_reference TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_session_id) REFERENCES inventory_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE RESTRICT,
        UNIQUE (inventory_session_id, share_id)
      );

      CREATE INDEX idx_inventory_sessions_year
      ON inventory_sessions (fiscal_year, serial_number);

      CREATE INDEX idx_inventory_items_difference
      ON inventory_items (difference_status, settlement_status);
    `
  },
  {
    version: 22,
    name: 'movement_difference_protocols',
    up: `
      CREATE TABLE movement_difference_protocols (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fiscal_year INTEGER NOT NULL,
        registry_number INTEGER NOT NULL,
        protocol_date TEXT NOT NULL,
        addy_document_id INTEGER,
        counterparty_unit TEXT NOT NULL,
        movement_direction TEXT NOT NULL,
        difference_type TEXT NOT NULL,
        share_id INTEGER NOT NULL,
        share_number TEXT NOT NULL,
        nominal_number TEXT NOT NULL,
        description TEXT NOT NULL,
        measurement_unit TEXT NOT NULL,
        document_quantity REAL NOT NULL,
        actual_quantity REAL NOT NULL,
        difference_quantity REAL NOT NULL,
        dispatch_date TEXT NOT NULL DEFAULT '',
        response_due_date TEXT NOT NULL DEFAULT '',
        response_date TEXT NOT NULL DEFAULT '',
        response_status TEXT NOT NULL DEFAULT 'Αναμένεται',
        response_notes TEXT NOT NULL DEFAULT '',
        escalation_date TEXT NOT NULL DEFAULT '',
        settlement_date TEXT NOT NULL DEFAULT '',
        settlement_reference TEXT NOT NULL DEFAULT '',
        settlement_status TEXT NOT NULL DEFAULT 'Εκκρεμεί',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (addy_document_id) REFERENCES addy_documents(id) ON DELETE SET NULL,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE RESTRICT,
        UNIQUE (fiscal_year, registry_number)
      );

      CREATE INDEX idx_movement_differences_year
      ON movement_difference_protocols (fiscal_year, registry_number);

      CREATE INDEX idx_movement_differences_status
      ON movement_difference_protocols (response_status, settlement_status);
    `
  },
  {
    version: 23,
    name: 'general_management_handover_and_archive',
    up: `
      ALTER TABLE shares ADD COLUMN archive_status TEXT NOT NULL DEFAULT 'Ενεργή';
      ALTER TABLE shares ADD COLUMN archived_at TEXT;
      ALTER TABLE shares ADD COLUMN archive_reason TEXT NOT NULL DEFAULT '';

      CREATE TABLE officer_terms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_type TEXT NOT NULL,
        full_identity TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT,
        order_reference TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE general_management_handovers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fiscal_year INTEGER NOT NULL,
        serial_number INTEGER NOT NULL,
        order_reference TEXT NOT NULL,
        start_date TEXT NOT NULL,
        completion_date TEXT,
        outgoing_officer TEXT NOT NULL,
        incoming_officer TEXT NOT NULL,
        inventory_session_id INTEGER,
        pending_documents TEXT NOT NULL DEFAULT '',
        outgoing_observations TEXT NOT NULL DEFAULT '',
        incoming_observations TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Σε εξέλιξη',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_session_id) REFERENCES inventory_sessions(id) ON DELETE SET NULL,
        UNIQUE (fiscal_year, serial_number)
      );

      CREATE TABLE general_management_handover_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        handover_id INTEGER NOT NULL,
        check_key TEXT NOT NULL,
        label TEXT NOT NULL,
        completed INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (handover_id) REFERENCES general_management_handovers(id) ON DELETE CASCADE,
        UNIQUE (handover_id, check_key)
      );

      CREATE TABLE share_archive_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        action_date TEXT NOT NULL,
        reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE RESTRICT
      );

      CREATE INDEX idx_officer_terms_role_dates
      ON officer_terms (role_type, start_date, end_date);

      CREATE INDEX idx_handovers_year_status
      ON general_management_handovers (fiscal_year, status);

      CREATE INDEX idx_share_archive_status
      ON shares (archive_status, share_number);

      INSERT INTO officer_terms (role_type, full_identity, start_date)
      SELECT 'Διοικητής', commander, date('now')
      FROM service_settings
      WHERE TRIM(commander) <> '';

      INSERT INTO officer_terms (role_type, full_identity, start_date)
      SELECT 'Π.Ε.Δ', ped, date('now')
      FROM service_settings
      WHERE TRIM(ped) <> '';

      INSERT INTO officer_terms (role_type, full_identity, start_date)
      SELECT 'Γενικός Διαχειριστής', manager, date('now')
      FROM service_settings
      WHERE TRIM(manager) <> '';
    `
  },
  {
    version: 24,
    name: 'exhp_support_files_and_eus_accounts',
    up: `
      ALTER TABLE service_settings ADD COLUMN audit_service_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE service_settings ADD COLUMN commander_registry_number TEXT NOT NULL DEFAULT '';
      ALTER TABLE service_settings ADD COLUMN commander_tax_number TEXT NOT NULL DEFAULT '';
      ALTER TABLE service_settings ADD COLUMN ped_registry_number TEXT NOT NULL DEFAULT '';
      ALTER TABLE service_settings ADD COLUMN ped_tax_number TEXT NOT NULL DEFAULT '';
      ALTER TABLE service_settings ADD COLUMN manager_registry_number TEXT NOT NULL DEFAULT '';
      ALTER TABLE service_settings ADD COLUMN manager_tax_number TEXT NOT NULL DEFAULT '';

      ALTER TABLE exhp_documents ADD COLUMN support_status TEXT NOT NULL DEFAULT 'Ελλιπής';
      ALTER TABLE exhp_documents ADD COLUMN submitted_to_eus INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE exhp_support_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_reason_id INTEGER NOT NULL,
        document_code TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL,
        required INTEGER NOT NULL DEFAULT 1,
        printable INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (issue_reason_id) REFERENCES exhp_issue_reasons(id) ON DELETE CASCADE
      );

      CREATE TABLE exhp_document_supports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exhp_document_id INTEGER NOT NULL,
        template_id INTEGER NOT NULL,
        document_reference TEXT NOT NULL DEFAULT '',
        completed INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (exhp_document_id) REFERENCES exhp_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (template_id) REFERENCES exhp_support_templates(id) ON DELETE RESTRICT,
        UNIQUE (exhp_document_id, template_id)
      );

      CREATE TABLE annual_account_packages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fiscal_year INTEGER NOT NULL UNIQUE,
        audit_service_name TEXT NOT NULL DEFAULT '',
        submission_due_date TEXT NOT NULL,
        submission_date TEXT NOT NULL DEFAULT '',
        committee_order_reference TEXT NOT NULL DEFAULT '',
        protocol_reference TEXT NOT NULL DEFAULT '',
        accountable_manager TEXT NOT NULL DEFAULT '',
        accountable_manager_registry_number TEXT NOT NULL DEFAULT '',
        accountable_manager_tax_number TEXT NOT NULL DEFAULT '',
        manager_term TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'Σε προετοιμασία',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE annual_account_checks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_id INTEGER NOT NULL,
        check_key TEXT NOT NULL,
        title TEXT NOT NULL,
        required INTEGER NOT NULL DEFAULT 1,
        completed INTEGER NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (package_id) REFERENCES annual_account_packages(id) ON DELETE CASCADE,
        UNIQUE (package_id, check_key)
      );

      CREATE INDEX idx_exhp_support_reason
      ON exhp_support_templates (issue_reason_id, sort_order);

      CREATE INDEX idx_exhp_document_support_status
      ON exhp_documents (fiscal_year, support_status, submitted_to_eus);

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Πρωτόκολλο Δευτεροβάθμιας Επιτροπής Επιθεώρησης και Διάθεσης', 0, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Λογιστική Τακτοποίηση Άχρηστου%';
      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Διαταγή αποδοχής διάθεσης και διαχειριστικής τακτοποίησης', 0, 2
      FROM exhp_issue_reasons WHERE name LIKE 'Λογιστική Τακτοποίηση Άχρηστου%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Κατάσταση απογραφής ή επίσημο στοιχείο διαπίστωσης διαφορών', 1, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%';
      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Ισχύων κατάλογος ονομαστικού και τιμοκατάλογος', 0, 2
      FROM exhp_issue_reasons WHERE name LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Διαταγή ή επίσημος κατάλογος μεταβολής Αριθμού Ονομαστικού', 0, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Μεταγραφή Υλικών%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Διαταγή κατασκευής ή μετασκευής', 0, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Μετασχηματισμός Υλικών%';
      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, 'ΕΦΕΔ 506', 'Πρωτόκολλο Μετασχηματισμού Υλικών', 1, 2
      FROM exhp_issue_reasons WHERE name LIKE 'Μετασχηματισμός Υλικών%';
      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Σχέδια ή λοιπά τεχνικά δικαιολογητικά', 0, 3
      FROM exhp_issue_reasons WHERE name LIKE 'Μετασχηματισμός Υλικών%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, 'ΔΥΠ/190', 'Κατάσταση Πλήρους Συνθέσεως Συλλογής', 1, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Συλλογές Εργαλείων%';
      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, 'ΔΥΠ/191', 'Φύλλο Μεταβολών Ειδών Συνθέσεως', 1, 2
      FROM exhp_issue_reasons WHERE name LIKE 'Συλλογές Εργαλείων%';
      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Διαταγή έγκρισης διάλυσης ή συγκρότησης συλλογής', 0, 3
      FROM exhp_issue_reasons WHERE name LIKE 'Συλλογές Εργαλείων%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, 'ΔΥΠ/9-10-11', 'Μηνιαίες καταστάσεις χορηγήσεων, αναλήψεων ή αντικαταστάσεων', 1, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Διαγραφή Ειδών Ιματισμού%';
      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, 'ΔΥΠ/8 / e-ΒΙΜΑΥ', 'Ατομικά στοιχεία και αποδείξεις χορηγήσεων', 0, 2
      FROM exhp_issue_reasons WHERE name LIKE 'Διαγραφή Ειδών Ιματισμού%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, 'ΕΦΕΔ 505', 'Πρωτόκολλο Διάθεσης Αναλώσιμων Υλικών', 1, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Διαγραφή Αναλώσιμου%';
      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Κλίμακα, Πίνακας Υλικού ή Διαταγή διάθεσης', 0, 2
      FROM exhp_issue_reasons WHERE name LIKE 'Διαγραφή Αναλώσιμου%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, 'ΦΕΛΥ', 'Φύλλο Ελέγχου Λογαριασμού Υλικού', 0, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Υποστήριξη Συμπληρωματικών%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Πρωτόκολλο ή κατάσταση διαπίστωσης της διαφοράς', 1, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Τακτοποίηση Διαφορών%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Διαταγή διαγραφής και στοιχεία μη υποστήριξης από το Σύστημα ΔΜ', 0, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Διαγραφή Ανταλλακτικών Εμπορίου%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, 'ΔΥΠ/192', 'Πρωτόκολλο Καταναλώσεως Πυρομαχικών Εκπαιδεύσεως', 1, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Διαγραφή Πυρομαχικών%';
      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, 'ΕΦΕΔ 410', 'Δελτίο Χορηγήσεων Πυρομαχικών', 1, 2
      FROM exhp_issue_reasons WHERE name LIKE 'Διαγραφή Πυρομαχικών%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, printable, sort_order)
      SELECT id, '', 'Διαταγή Προϊσταμένης Αρχής', 0, 1
      FROM exhp_issue_reasons WHERE name LIKE 'Κάθε Άλλη Περίπτωση%';

      INSERT OR IGNORE INTO exhp_document_supports (exhp_document_id, template_id)
      SELECT document.id, template.id
      FROM exhp_documents document
      JOIN exhp_issue_reasons reason ON reason.name = document.issue_reason
      JOIN exhp_support_templates template ON template.issue_reason_id = reason.id;

      UPDATE exhp_documents
      SET support_status = 'Πλήρης για ΕΥΣ'
      WHERE NOT EXISTS (
        SELECT 1
        FROM exhp_document_supports support
        JOIN exhp_support_templates template ON template.id = support.template_id
        WHERE support.exhp_document_id = exhp_documents.id
          AND template.required = 1
          AND support.completed = 0
      );

      UPDATE exhp_documents
      SET status = CASE
        WHEN support_status = 'Πλήρης για ΕΥΣ' THEN 'Οριστική'
        ELSE 'Προς Συμπλήρωση'
      END;
    `
  },
  {
    version: 25,
    name: 'editable_exhp_forms_and_material_composition',
    up: `
      ALTER TABLE exhp_document_supports ADD COLUMN form_data TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE exhp_document_supports ADD COLUMN required_override INTEGER;

      ALTER TABLE shares ADD COLUMN requires_composition INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE shares ADD COLUMN requires_change_sheet INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE share_composition_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL,
        line_number INTEGER NOT NULL DEFAULT 1,
        component_nominal_number TEXT NOT NULL DEFAULT '',
        component_description TEXT NOT NULL,
        measurement_unit TEXT NOT NULL DEFAULT '',
        quantity REAL NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
      );

      CREATE TABLE share_change_sheet_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL,
        change_date TEXT NOT NULL,
        order_reference TEXT NOT NULL DEFAULT '',
        previous_value TEXT NOT NULL DEFAULT '',
        new_value TEXT NOT NULL DEFAULT '',
        change_reason TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_share_composition_share
      ON share_composition_items (share_id, line_number);

      CREATE INDEX idx_share_change_sheet_share
      ON share_change_sheet_entries (share_id, change_date, id);

      INSERT INTO exhp_support_templates (
        issue_reason_id, document_code, title, required, printable, sort_order
      )
      SELECT reason.id, 'ΔΥΠ/190', 'Σύνθεση Υλικού', 0, 1, 90
      FROM exhp_issue_reasons reason
      WHERE NOT EXISTS (
        SELECT 1 FROM exhp_support_templates existing
        WHERE existing.issue_reason_id = reason.id
          AND existing.document_code = 'ΔΥΠ/190'
      );

      INSERT INTO exhp_support_templates (
        issue_reason_id, document_code, title, required, printable, sort_order
      )
      SELECT reason.id, 'ΔΥΠ/191', 'Φύλλο Μεταβολών Ειδών Συνθέσεως', 0, 1, 91
      FROM exhp_issue_reasons reason
      WHERE NOT EXISTS (
        SELECT 1 FROM exhp_support_templates existing
        WHERE existing.issue_reason_id = reason.id
          AND existing.document_code = 'ΔΥΠ/191'
      );

      UPDATE exhp_support_templates SET printable = 1;

      INSERT OR IGNORE INTO exhp_document_supports (
        exhp_document_id, template_id, required_override
      )
      SELECT document.id, template.id,
        CASE
          WHEN template.document_code = 'ΔΥΠ/190' AND EXISTS (
            SELECT 1
            FROM exhp_items item
            JOIN shares share ON share.id = item.share_id
            WHERE item.exhp_document_id = document.id
              AND share.requires_composition = 1
          ) THEN 1
          WHEN template.document_code = 'ΔΥΠ/191' AND EXISTS (
            SELECT 1
            FROM exhp_items item
            JOIN shares share ON share.id = item.share_id
            WHERE item.exhp_document_id = document.id
              AND share.requires_change_sheet = 1
          ) THEN 1
          ELSE 0
        END
      FROM exhp_documents document
      JOIN exhp_issue_reasons reason ON reason.name = document.issue_reason
      JOIN exhp_support_templates template ON template.issue_reason_id = reason.id
      WHERE template.document_code IN ('ΔΥΠ/190', 'ΔΥΠ/191');
    `
  },
  {
    version: 26,
    name: 'officer_registry_and_internal_transaction_forms',
    up: `
      ALTER TABLE officer_terms ADD COLUMN rank TEXT NOT NULL DEFAULT '';
      ALTER TABLE officer_terms ADD COLUMN corps TEXT NOT NULL DEFAULT '';
      ALTER TABLE officer_terms ADD COLUMN registry_number TEXT NOT NULL DEFAULT '';
      ALTER TABLE officer_terms ADD COLUMN assignment_order TEXT NOT NULL DEFAULT '';
      ALTER TABLE officer_terms ADD COLUMN relief_order TEXT NOT NULL DEFAULT '';
      ALTER TABLE officer_terms ADD COLUMN differences_ledger_reference TEXT NOT NULL DEFAULT '';

      UPDATE officer_terms
      SET assignment_order = order_reference
      WHERE TRIM(assignment_order) = '';
    `
  },
  {
    version: 27,
    name: 'initial_annual_inventory_excel_import',
    up: `
      ALTER TABLE shares ADD COLUMN main_material_number TEXT NOT NULL DEFAULT '';

      CREATE TABLE initial_inventory_imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        inventory_session_id INTEGER NOT NULL,
        inventory_date TEXT NOT NULL,
        source_file TEXT NOT NULL DEFAULT '',
        imported_rows INTEGER NOT NULL DEFAULT 0,
        imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_session_id) REFERENCES inventory_sessions(id) ON DELETE RESTRICT
      );

      CREATE INDEX idx_initial_inventory_import_date
      ON initial_inventory_imports (inventory_date);
    `
  },
  {
    version: 28,
    name: 'composition_projected_and_not_issued_quantities',
    up: `
      ALTER TABLE share_composition_items
      ADD COLUMN not_issued_quantity REAL NOT NULL DEFAULT 0;
    `
  },
  {
    version: 29,
    name: 'change_sheet_component_movements',
    up: `
      ALTER TABLE share_change_sheet_entries
      ADD COLUMN component_line_number INTEGER NOT NULL DEFAULT 1;

      ALTER TABLE share_change_sheet_entries
      ADD COLUMN movement_type TEXT NOT NULL DEFAULT 'ΧΡΕΩΣΗ';

      ALTER TABLE share_change_sheet_entries
      ADD COLUMN quantity REAL NOT NULL DEFAULT 0;
    `
  },
  {
    version: 30,
    name: 'addy_item_share_transaction_link',
    up: `
      ALTER TABLE addy_items
      ADD COLUMN share_transaction_id INTEGER REFERENCES share_transactions(id);

      CREATE INDEX idx_addy_items_share_transaction
      ON addy_items (share_transaction_id);
    `
  },
  {
    version: 31,
    name: 'addy_composition_snapshot',
    up: `
      ALTER TABLE addy_items
      ADD COLUMN composition_snapshot TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 32,
    name: 'restrict_exhp_composition_supports_and_add_other_document',
    up: `
      ALTER TABLE exhp_documents
      ADD COLUMN other_support_document TEXT NOT NULL DEFAULT '';

      DELETE FROM exhp_document_supports
      WHERE template_id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE template.document_code IN ('ΔΥΠ/190', 'ΔΥΠ/191')
          AND reason.name NOT LIKE 'Συλλογές Εργαλείων%'
      );

      DELETE FROM exhp_support_templates
      WHERE id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE template.document_code IN ('ΔΥΠ/190', 'ΔΥΠ/191')
          AND reason.name NOT LIKE 'Συλλογές Εργαλείων%'
      );

      UPDATE exhp_documents
      SET support_status = CASE
        WHEN EXISTS (
          SELECT 1
          FROM exhp_document_supports support
          JOIN exhp_support_templates template ON template.id = support.template_id
          WHERE support.exhp_document_id = exhp_documents.id
            AND COALESCE(support.required_override, template.required) = 1
            AND support.completed = 0
        ) THEN 'Ελλιπής'
        ELSE 'Πλήρης για ΕΥΣ'
      END;

      UPDATE exhp_documents
      SET status = CASE
        WHEN support_status = 'Πλήρης για ΕΥΣ' THEN 'Οριστική'
        ELSE 'Προς Συμπλήρωση'
      END;
    `
  },
  {
    version: 33,
    name: 'exhp_reason_recommendations',
    up: `
      ALTER TABLE exhp_issue_reasons
      ADD COLUMN recommendation_text TEXT NOT NULL DEFAULT '';

      ALTER TABLE exhp_issue_reasons
      ADD COLUMN first_opinion_text TEXT NOT NULL DEFAULT '';

      ALTER TABLE exhp_issue_reasons
      ADD COLUMN second_opinion_text TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 34,
    name: 'exhp_item_share_transaction_link',
    up: `
      ALTER TABLE exhp_items
      ADD COLUMN share_transaction_id INTEGER REFERENCES share_transactions(id);

      CREATE INDEX idx_exhp_items_share_transaction
      ON exhp_items (share_transaction_id);
    `
  },
  {
    version: 35,
    name: 'inventory_counting_committee',
    up: `
      ALTER TABLE inventory_sessions
      ADD COLUMN committee_president_rank TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_president_name TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_member_a_rank TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_member_a_name TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_member_b_rank TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions
      ADD COLUMN committee_member_b_name TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 36,
    name: 'management_type_setting',
    up: `
      ALTER TABLE service_settings
      ADD COLUMN management_type TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 37,
    name: 'internal_item_composition_snapshot',
    up: `
      ALTER TABLE internal_items
      ADD COLUMN composition_snapshot TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 38,
    name: 'exhp_index_fields',
    up: `
      ALTER TABLE exhp_documents
      ADD COLUMN index_field_6 TEXT NOT NULL DEFAULT '';

      ALTER TABLE exhp_documents
      ADD COLUMN index_field_7 TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 39,
    name: 'addy_index_fields',
    up: `
      ALTER TABLE addy_documents
      ADD COLUMN index_field_7 TEXT NOT NULL DEFAULT '';

      ALTER TABLE addy_documents
      ADD COLUMN index_field_8 TEXT NOT NULL DEFAULT '';

      ALTER TABLE addy_documents
      ADD COLUMN index_field_9 TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 40,
    name: 'general_management_handover_protocol_data',
    up: `
      ALTER TABLE general_management_handovers
      ADD COLUMN protocol_data TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 41,
    name: 'useless_material_support_reason_and_printable_forms',
    up: `
      UPDATE exhp_issue_reasons
      SET name = 'Λογιστική Τακτοποίηση Αχρήστου υλικού'
      WHERE name LIKE 'Λογιστική Τακτοποίηση Άχρηστου%';

      UPDATE exhp_support_templates
      SET printable = 1
      WHERE issue_reason_id IN (
        SELECT id
        FROM exhp_issue_reasons
        WHERE name = 'Λογιστική Τακτοποίηση Αχρήστου υλικού'
      );
    `
  },
  {
    version: 42,
    name: 'exhp_support_document_forms',
    up: `
      CREATE TABLE exhp_support_documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exhp_id INTEGER NOT NULL,
        document_type TEXT NOT NULL CHECK (
          document_type IN ('useless_material_a', 'useless_material_b', 'ammo_consumption')
        ),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (exhp_id) REFERENCES exhp_documents(id) ON DELETE CASCADE
      );

      CREATE TABLE exhp_document_useless_a (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        location TEXT,
        date TEXT,
        hdm_number TEXT,
        president TEXT,
        member_a TEXT,
        member_b TEXT,
        period_from TEXT,
        period_to TEXT,
        FOREIGN KEY (document_id) REFERENCES exhp_support_documents(id) ON DELETE CASCADE
      );

      CREATE TABLE exhp_document_useless_a_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        aa INTEGER,
        nomenclature_number TEXT,
        description TEXT,
        unit TEXT,
        quantity REAL,
        acquisition_price TEXT,
        acquisition_date TEXT,
        remarks TEXT,
        FOREIGN KEY (document_id) REFERENCES exhp_document_useless_a(id) ON DELETE CASCADE
      );

      CREATE TABLE exhp_document_useless_b (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        president TEXT,
        member_a TEXT,
        member_b TEXT,
        commander TEXT,
        general_manager TEXT,
        useless_manager TEXT,
        FOREIGN KEY (document_id) REFERENCES exhp_support_documents(id) ON DELETE CASCADE
      );

      CREATE TABLE exhp_document_useless_b_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        aa INTEGER,
        nomenclature_number TEXT,
        description TEXT,
        unit TEXT,
        qty_primary REAL,
        qty_secondary REAL,
        diff_plus REAL,
        diff_minus REAL,
        FOREIGN KEY (document_id) REFERENCES exhp_document_useless_b(id) ON DELETE CASCADE
      );

      CREATE TABLE exhp_document_ammo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        officer_rank TEXT,
        officer_name TEXT,
        unit TEXT,
        firing_date TEXT,
        day_of_week TEXT,
        copies_count INTEGER,
        FOREIGN KEY (document_id) REFERENCES exhp_support_documents(id) ON DELETE CASCADE
      );

      CREATE TABLE exhp_document_ammo_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        item_type TEXT CHECK (item_type IN ('consumed', 'empty')),
        description TEXT,
        quantity REAL,
        FOREIGN KEY (document_id) REFERENCES exhp_document_ammo(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_exhp_support_documents_exhp
      ON exhp_support_documents (exhp_id, document_type);

      CREATE INDEX idx_exhp_document_useless_a_document
      ON exhp_document_useless_a (document_id);

      CREATE INDEX idx_exhp_document_useless_a_items_document
      ON exhp_document_useless_a_items (document_id);

      CREATE INDEX idx_exhp_document_useless_b_document
      ON exhp_document_useless_b (document_id);

      CREATE INDEX idx_exhp_document_useless_b_items_document
      ON exhp_document_useless_b_items (document_id);

      CREATE INDEX idx_exhp_document_ammo_document
      ON exhp_document_ammo (document_id);

      CREATE INDEX idx_exhp_document_ammo_items_document
      ON exhp_document_ammo_items (document_id);
    `
  },
  {
    version: 43,
    name: 'exhp_support_document_item_share_numbers',
    up: `
      ALTER TABLE exhp_document_useless_a_items
      ADD COLUMN share_number TEXT;

      ALTER TABLE exhp_document_useless_b_items
      ADD COLUMN share_number TEXT;
    `
  },
  {
    version: 44,
    name: 'addy_external_consumables_without_share_card',
    up: `
      DROP INDEX IF EXISTS idx_addy_items_share_transaction;

      CREATE TABLE addy_items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        addy_document_id INTEGER NOT NULL,
        share_id INTEGER,
        share_number TEXT NOT NULL,
        nominal_number TEXT NOT NULL,
        material_type TEXT NOT NULL,
        transaction_type TEXT NOT NULL,
        quantity REAL NOT NULL,
        measurement_unit TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        unit_price REAL,
        share_transaction_id INTEGER REFERENCES share_transactions(id),
        composition_snapshot TEXT NOT NULL DEFAULT '',
        FOREIGN KEY (addy_document_id) REFERENCES addy_documents(id) ON DELETE CASCADE,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE
      );

      INSERT INTO addy_items_new (
        id, addy_document_id, share_id, share_number, nominal_number, material_type,
        transaction_type, quantity, measurement_unit, description, unit_price,
        share_transaction_id, composition_snapshot
      )
      SELECT
        id, addy_document_id, share_id, share_number, nominal_number, material_type,
        transaction_type, quantity, measurement_unit, description, unit_price,
        share_transaction_id, composition_snapshot
      FROM addy_items;

      DROP TABLE addy_items;
      ALTER TABLE addy_items_new RENAME TO addy_items;

      CREATE INDEX idx_addy_items_share_transaction
      ON addy_items (share_transaction_id);
    `
  },
  {
    version: 45,
    name: 'complete_official_exhp_support_form_sets',
    up: `
      UPDATE exhp_documents
      SET issue_reason = 'Λογιστική Τακτοποίηση Πάσης Φύσεως Αχρήστου Υλικού.'
      WHERE issue_reason IN (
        'Λογιστική Τακτοποίηση Άχρηστου Υλικού.',
        'Λογιστική Τακτοποίηση Αχρήστου υλικού'
      );

      UPDATE exhp_issue_reasons
      SET name = 'Λογιστική Τακτοποίηση Πάσης Φύσεως Αχρήστου Υλικού.'
      WHERE name IN (
        'Λογιστική Τακτοποίηση Άχρηστου Υλικού.',
        'Λογιστική Τακτοποίηση Αχρήστου υλικού'
      );

      UPDATE exhp_support_templates
      SET document_code = 'ΔΥΠ/9-10-11-189',
          title = 'Καταστάσεις ΔΥΠ/9, ΔΥΠ/10, ΔΥΠ/11 και Συγκεντρωτική ΔΥΠ/189',
          printable = 1
      WHERE issue_reason_id IN (
        SELECT id
        FROM exhp_issue_reasons
        WHERE name LIKE 'Διαγραφή Ειδών Ιματισμού%'
      )
        AND document_code = 'ΔΥΠ/9-10-11';

      UPDATE exhp_support_templates
      SET document_code = 'ΑΧΡΗΣΤΟ/1-23',
          title = 'Πρωτόκολλα και Αναλυτικές Καταστάσεις Αχρήστου Υλικού',
          printable = 1
      WHERE issue_reason_id IN (
        SELECT id
        FROM exhp_issue_reasons
        WHERE name = 'Λογιστική Τακτοποίηση Πάσης Φύσεως Αχρήστου Υλικού.'
      )
        AND sort_order = 1;
    `
  },
  {
    version: 46,
    name: 'clothing_items_and_distributions',
    up: `
      CREATE TABLE clothing_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        short_name TEXT,
        category TEXT NOT NULL CHECK (category IN ('ιματισμός', 'υπόδηση', 'ατομικά')),
        sort_order INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE clothing_distributions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exhp_id INTEGER NOT NULL,
        distribution_type TEXT NOT NULL CHECK (
          distribution_type IN ('initial', 'replacement', 'return')
        ),
        subunit TEXT NOT NULL,
        soldier_rank TEXT NOT NULL,
        soldier_name TEXT NOT NULL,
        soldier_sg_sm_sk TEXT,
        esso TEXT,
        release_date TEXT,
        signature INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        FOREIGN KEY (exhp_id) REFERENCES exhp_documents(id) ON DELETE CASCADE
      );

      CREATE TABLE clothing_distribution_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        distribution_id INTEGER NOT NULL,
        clothing_item_id INTEGER NOT NULL,
        quantity INTEGER DEFAULT 0,
        FOREIGN KEY (distribution_id)
          REFERENCES clothing_distributions(id) ON DELETE CASCADE,
        FOREIGN KEY (clothing_item_id)
          REFERENCES clothing_items(id) ON DELETE CASCADE
      );
    `
  },
  {
    version: 47,
    name: 'exhp_useless_material_statement_forms',
    up: `
      ALTER TABLE exhp_document_ammo_items ADD COLUMN share_number TEXT;
      ALTER TABLE exhp_document_ammo_items ADD COLUMN nomenclature_number TEXT;
      ALTER TABLE exhp_document_ammo_items ADD COLUMN unit TEXT;

      CREATE TABLE exhp_useless_statement_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exhp_id INTEGER NOT NULL,
        form_key TEXT NOT NULL,
        data_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL,
        UNIQUE (exhp_id, form_key),
        FOREIGN KEY (exhp_id) REFERENCES exhp_documents(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_exhp_useless_statement_forms_exhp
      ON exhp_useless_statement_forms (exhp_id, form_key);
    `
  },
  {
    version: 48,
    name: 'fix_exhp_reason_support_template_mapping',
    up: `
      DELETE FROM exhp_document_supports
      WHERE template_id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE reason.name LIKE 'Διαγραφή Αναλώσιμου Υλικού και Ειδών Σταθερών Χορηγιών%'
           OR reason.name IN (
             'Λογιστική Τακτοποίηση Άχρηστου Υλικού.',
             'Λογιστική Τακτοποίηση Αχρήστου υλικού',
             'Λογιστική Τακτοποίηση Πάσης Φύσεως Αχρήστου Υλικού.'
           )
      );

      DELETE FROM exhp_support_templates
      WHERE issue_reason_id IN (
        SELECT id
        FROM exhp_issue_reasons
        WHERE name LIKE 'Διαγραφή Αναλώσιμου Υλικού και Ειδών Σταθερών Χορηγιών%'
           OR name IN (
             'Λογιστική Τακτοποίηση Άχρηστου Υλικού.',
             'Λογιστική Τακτοποίηση Αχρήστου υλικού',
             'Λογιστική Τακτοποίηση Πάσης Φύσεως Αχρήστου Υλικού.'
           )
      );

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, required, printable, sort_order)
      SELECT id, 'ΕΦΕΔ 505', 'Πρωτόκολλο Διάθεσης Αναλώσιμων Υλικών', 1, 1, 1
      FROM exhp_issue_reasons
      WHERE name LIKE 'Διαγραφή Αναλώσιμου Υλικού και Ειδών Σταθερών Χορηγιών%';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, required, printable, sort_order)
      SELECT reason.id, template.document_code, template.title, 1, template.printable, template.sort_order
      FROM exhp_issue_reasons reason
      JOIN (
        SELECT 'ΑΧΡΗΣΤΟ/1-23' AS document_code, 'Πρωτόκολλο Επιθεώρησης Πρωτοβάθμιας Επιτροπής' AS title, 1 AS printable, 1 AS sort_order
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Κατάσταση Α Πρωτοβάθμιας Επιτροπής', 1, 2
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Κατάσταση Β Πρωτοβάθμιας Επιτροπής', 1, 3
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Κατάσταση Δ2 Πρωτοβάθμιας Επιτροπής', 1, 4
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Κατάσταση Δ3 Πρωτοβάθμιας Επιτροπής', 1, 5
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Πρωτόκολλο Διαφορών Δευτεροβάθμιας Επιτροπής', 1, 6
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Πρωτόκολλο Επιθεώρησης Δευτεροβάθμιας Επιτροπής', 1, 7
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Κατάσταση Α Δευτεροβάθμιας Επιτροπής', 1, 8
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Κατάσταση Β Δευτεροβάθμιας Επιτροπής', 1, 9
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Κατάσταση Δ2 Δευτεροβάθμιας Επιτροπής', 1, 10
        UNION ALL SELECT 'ΑΧΡΗΣΤΟ/1-23', 'Κατάσταση Δ3 Δευτεροβάθμιας Επιτροπής', 1, 11
      ) template
      WHERE reason.name IN (
        'Λογιστική Τακτοποίηση Άχρηστου Υλικού.',
        'Λογιστική Τακτοποίηση Αχρήστου υλικού',
        'Λογιστική Τακτοποίηση Πάσης Φύσεως Αχρήστου Υλικού.'
      );
    `
  },
  {
    version: 49,
    name: 'remove_homogeneous_material_price_list_support',
    up: `
      DELETE FROM exhp_document_supports
      WHERE template_id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE reason.name LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%'
          AND template.title = 'Ισχύων κατάλογος ονομαστικού και τιμοκατάλογος'
      );

      DELETE FROM exhp_support_templates
      WHERE id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE reason.name LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%'
          AND template.title = 'Ισχύων κατάλογος ονομαστικού και τιμοκατάλογος'
      );
    `
  },
  {
    version: 50,
    name: 'generic_exhp_support_document_forms',
    up: `
      CREATE TABLE exhp_document_generic_forms (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL UNIQUE,
        data_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES exhp_support_documents(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_exhp_document_generic_forms_document
      ON exhp_document_generic_forms (document_id);
    `
  },
  {
    version: 51,
    name: 'link_efed505_consumable_deletion_support',
    up: `
      INSERT OR IGNORE INTO exhp_issue_reasons (name, sort_order)
      SELECT 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.', 7
      WHERE NOT EXISTS (
        SELECT 1
        FROM exhp_issue_reasons
        WHERE name = 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.'
      );

      UPDATE exhp_documents
      SET issue_reason = 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.'
      WHERE issue_reason LIKE 'Διαγραφή Αναλ% Υλικού και Ειδών Σταθερών Χορηγιών%';

      UPDATE exhp_support_templates
      SET issue_reason_id = (
        SELECT id
        FROM exhp_issue_reasons
        WHERE name = 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.'
      )
      WHERE issue_reason_id IN (
        SELECT id
        FROM exhp_issue_reasons
        WHERE name LIKE 'Διαγραφή Αναλ% Υλικού και Ειδών Σταθερών Χορηγιών%'
          AND name <> 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.'
      );

      DELETE FROM exhp_document_supports
      WHERE template_id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE reason.name = 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.'
          AND template.document_code = 'ΕΦΕΔ 505'
          AND template.id <> (
            SELECT MIN(keep_template.id)
            FROM exhp_support_templates keep_template
            WHERE keep_template.issue_reason_id = template.issue_reason_id
              AND keep_template.document_code = 'ΕΦΕΔ 505'
          )
      );

      DELETE FROM exhp_support_templates
      WHERE id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE reason.name = 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.'
          AND template.document_code = 'ΕΦΕΔ 505'
          AND template.id <> (
            SELECT MIN(keep_template.id)
            FROM exhp_support_templates keep_template
            WHERE keep_template.issue_reason_id = template.issue_reason_id
              AND keep_template.document_code = 'ΕΦΕΔ 505'
          )
      );

      DELETE FROM exhp_issue_reasons
      WHERE name LIKE 'Διαγραφή Αναλ% Υλικού και Ειδών Σταθερών Χορηγιών%'
        AND name <> 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.';

      UPDATE exhp_support_templates
      SET title = 'Πρωτόκολλο Διαθέσεως Αναλωσίμου Υλικού',
          required = 1,
          printable = 1,
          sort_order = 1
      WHERE issue_reason_id = (
        SELECT id
        FROM exhp_issue_reasons
        WHERE name = 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.'
      )
        AND document_code = 'ΕΦΕΔ 505';

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, required, printable, sort_order)
      SELECT id, 'ΕΦΕΔ 505', 'Πρωτόκολλο Διαθέσεως Αναλωσίμου Υλικού', 1, 1, 1
      FROM exhp_issue_reasons
      WHERE name = 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.'
        AND NOT EXISTS (
          SELECT 1
          FROM exhp_support_templates template
          WHERE template.issue_reason_id = exhp_issue_reasons.id
            AND template.document_code = 'ΕΦΕΔ 505'
        );

      INSERT OR IGNORE INTO exhp_document_supports (exhp_document_id, template_id, required_override)
      SELECT document.id, template.id, NULL
      FROM exhp_documents document
      JOIN exhp_issue_reasons reason ON reason.name = document.issue_reason
      JOIN exhp_support_templates template ON template.issue_reason_id = reason.id
      WHERE reason.name = 'Διαγραφή Αναλωσίμου Υλικού και Ειδών Σταθερών Χορηγιών.'
        AND template.document_code = 'ΕΦΕΔ 505';
    `
  },
  {
    version: 52,
    name: 'rename_homogeneous_inventory_support_only',
    up: `
      DELETE FROM exhp_document_supports
      WHERE template_id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE reason.name LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%'
          AND template.title <> 'Κατάσταση απογραφής ή επίσημο στοιχείο διαπίστωσης διαφορών'
          AND template.title <> 'Κατάσταση Απογραφής'
      );

      DELETE FROM exhp_support_templates
      WHERE id IN (
        SELECT template.id
        FROM exhp_support_templates template
        JOIN exhp_issue_reasons reason ON reason.id = template.issue_reason_id
        WHERE reason.name LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%'
          AND template.title <> 'Κατάσταση απογραφής ή επίσημο στοιχείο διαπίστωσης διαφορών'
          AND template.title <> 'Κατάσταση Απογραφής'
      );

      UPDATE exhp_support_templates
      SET title = 'Κατάσταση Απογραφής',
          document_code = '',
          required = 1,
          printable = 1,
          sort_order = 1
      WHERE issue_reason_id IN (
        SELECT id
        FROM exhp_issue_reasons
        WHERE name LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%'
      )
        AND title IN (
          'Κατάσταση απογραφής ή επίσημο στοιχείο διαπίστωσης διαφορών',
          'Κατάσταση Απογραφής'
        );

      INSERT INTO exhp_support_templates (issue_reason_id, document_code, title, required, printable, sort_order)
      SELECT reason.id, '', 'Κατάσταση Απογραφής', 1, 1, 1
      FROM exhp_issue_reasons reason
      WHERE reason.name LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%'
        AND NOT EXISTS (
          SELECT 1
          FROM exhp_support_templates template
          WHERE template.issue_reason_id = reason.id
        );

      INSERT OR IGNORE INTO exhp_document_supports (exhp_document_id, template_id, required_override)
      SELECT document.id, template.id, NULL
      FROM exhp_documents document
      JOIN exhp_issue_reasons reason ON reason.name = document.issue_reason
      JOIN exhp_support_templates template ON template.issue_reason_id = reason.id
      WHERE reason.name LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%'
        AND template.title = 'Κατάσταση Απογραφής';
    `
  },
  {
    version: 53,
    name: 'material_serial_number_registry',
    up: `
      ALTER TABLE shares ADD COLUMN requires_serial_number INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE share_serial_numbers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        serial_number TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE,
        UNIQUE (share_id, position)
      );

      CREATE INDEX idx_share_serial_numbers_share
      ON share_serial_numbers (share_id, position);
    `
  },
  {
    version: 54,
    name: 'material_weapon_registry_flag',
    up: `
      ALTER TABLE shares ADD COLUMN requires_weapon_registry INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    version: 55,
    name: 'share_renumbering_and_inventory_periods',
    up: `
      ALTER TABLE shares ADD COLUMN previous_share_number TEXT NOT NULL DEFAULT '';

      ALTER TABLE inventory_sessions ADD COLUMN inventory_reason TEXT NOT NULL DEFAULT 'Τακτική Απογραφή';
      ALTER TABLE inventory_sessions ADD COLUMN period_start TEXT NOT NULL DEFAULT '';
      ALTER TABLE inventory_sessions ADD COLUMN period_end TEXT NOT NULL DEFAULT '';

      CREATE TABLE share_renumbering_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fiscal_year INTEGER NOT NULL UNIQUE,
        effective_date TEXT NOT NULL,
        inventory_session_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (inventory_session_id) REFERENCES inventory_sessions(id) ON DELETE RESTRICT
      );

      CREATE TABLE share_renumbering_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        share_id INTEGER NOT NULL,
        old_share_number TEXT NOT NULL,
        new_share_number TEXT NOT NULL DEFAULT '',
        archived INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (run_id) REFERENCES share_renumbering_runs(id) ON DELETE CASCADE,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE RESTRICT,
        UNIQUE (run_id, share_id)
      );
    `
  }
];

module.exports = {
  migrations
};
