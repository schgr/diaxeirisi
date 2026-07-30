const migrations011To020 = [
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
  }
];

module.exports = { migrations011To020 };
