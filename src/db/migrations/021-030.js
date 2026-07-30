const migrations021To030 = [
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
  }
];

module.exports = { migrations021To030 };
