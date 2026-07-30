const migrations051To061 = [
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
  },
  {
    version: 56,
    name: 'exhp_reason_title_case_and_nominal_transfer',
    up: `
      UPDATE exhp_documents
      SET issue_reason = CASE
        WHEN issue_reason LIKE 'Λογιστική Τακτοποίηση Πάσης%' OR issue_reason LIKE 'Λογιστική Τακτοποίηση Άχρηστου%' THEN 'Λογιστική Τακτοποίηση Πάσης Φύσεως Άχρηστου Υλικού.'
        WHEN issue_reason LIKE 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών%' THEN 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών Υλικών.'
        WHEN issue_reason LIKE 'Μεταγραφή Υλικών%' OR issue_reason LIKE 'Μεταβολή Υλικών%' THEN 'Μεταβολή Υλικών Λόγω Μεταβολής Του Αριθμού Ονομαστικού.'
        WHEN issue_reason LIKE 'Μετασχηματισμός Υλικών%' THEN 'Μετασχηματισμός Υλικών (Κατασκευή - Μετασκευή).'
        WHEN issue_reason LIKE 'Συλλογές Εργαλείων%' THEN 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.'
        WHEN issue_reason LIKE 'Διαγραφή Ειδών Ιματισμού%' THEN 'Διαγραφή Ειδών Ιματισμού - Υποδήσεως Και Λοιπών Ατομικών Ειδών - Χρέωση Επιστρεφομένων.'
        WHEN issue_reason LIKE 'Διαγραφή Αναλ%' THEN 'Διαγραφή Αναλώσιμου Υλικού Και Ειδών Σταθερών Χορηγήσεων.'
        WHEN issue_reason LIKE 'Υποστήριξη Συμπληρωματικών%' THEN 'Υποστήριξη Συμπληρωματικών Εγγραφών.'
        WHEN issue_reason LIKE 'Τακτοποίηση Διαφορών%' THEN 'Τακτοποίηση Διαφορών.'
        WHEN issue_reason LIKE 'Διαγραφή Αντ%' THEN 'Διαγραφή Αντ/κών Εμπορίου Που Δεν Υποστηρίζονται Από Το Σύστημα ΔΜ.'
        WHEN issue_reason LIKE 'Διαγραφή Πυρομαχικών%' THEN 'Διαγραφή Πυρομαχικών Εκπαιδεύσεως.'
        WHEN issue_reason LIKE 'Κάθε Άλλη Περίπτωση%' OR issue_reason LIKE 'Άλλη Περίπτωση%' THEN 'Άλλη Περίπτωση (Κατά Διαταγή Προϊσταμένης Αρχής).'
        ELSE issue_reason
      END;

      UPDATE exhp_issue_reasons
      SET name = CASE sort_order
        WHEN 1 THEN 'Λογιστική Τακτοποίηση Πάσης Φύσεως Άχρηστου Υλικού.'
        WHEN 2 THEN 'Λογιστική Τακτοποίηση Διαφορών Ομοειδών Υλικών.'
        WHEN 3 THEN 'Μεταβολή Υλικών Λόγω Μεταβολής Του Αριθμού Ονομαστικού.'
        WHEN 4 THEN 'Μετασχηματισμός Υλικών (Κατασκευή - Μετασκευή).'
        WHEN 5 THEN 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.'
        WHEN 6 THEN 'Διαγραφή Ειδών Ιματισμού - Υποδήσεως Και Λοιπών Ατομικών Ειδών - Χρέωση Επιστρεφομένων.'
        WHEN 7 THEN 'Διαγραφή Αναλώσιμου Υλικού Και Ειδών Σταθερών Χορηγήσεων.'
        WHEN 8 THEN 'Υποστήριξη Συμπληρωματικών Εγγραφών.'
        WHEN 9 THEN 'Τακτοποίηση Διαφορών.'
        WHEN 10 THEN 'Διαγραφή Αντ/κών Εμπορίου Που Δεν Υποστηρίζονται Από Το Σύστημα ΔΜ.'
        WHEN 11 THEN 'Διαγραφή Πυρομαχικών Εκπαιδεύσεως.'
        WHEN 12 THEN 'Άλλη Περίπτωση (Κατά Διαταγή Προϊσταμένης Αρχής).'
        ELSE name
      END
      WHERE sort_order BETWEEN 1 AND 12;
    `
  },
  {
    version: 57,
    name: 'rename_nominal_number_change_reason',
    up: `
      UPDATE exhp_documents
      SET issue_reason = 'Μεταβολή Υλικών Λόγω Αλλαγής Του Αριθμού Ονομαστικού.'
      WHERE issue_reason = 'Μεταβολή Υλικών Λόγω Μεταβολής Του Αριθμού Ονομαστικού.';

      UPDATE exhp_issue_reasons
      SET name = 'Μεταβολή Υλικών Λόγω Αλλαγής Του Αριθμού Ονομαστικού.'
      WHERE sort_order = 3;
    `
  },
  {
    version: 58,
    name: 'ammunition_batch_book',
    up: `
      ALTER TABLE shares ADD COLUMN requires_ammunition_batch_book INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE share_ammunition_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        batch_number TEXT NOT NULL DEFAULT '',
        quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE,
        UNIQUE (share_id, position)
      );

      CREATE INDEX idx_share_ammunition_batches_share
      ON share_ammunition_batches(share_id, position);
    `
  },
  {
    version: 59,
    name: 'exhp_composition_snapshot',
    up: `
      ALTER TABLE exhp_items
      ADD COLUMN composition_snapshot TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 60,
    name: 'fiscal_year_closure_archive',
    up: `
      ALTER TABLE service_settings
      ADD COLUMN active_fiscal_year INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE fiscal_year_closures (
        fiscal_year INTEGER PRIMARY KEY,
        next_fiscal_year INTEGER NOT NULL,
        closed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        inventory_session_id INTEGER NOT NULL,
        archive_snapshot TEXT NOT NULL,
        FOREIGN KEY (inventory_session_id) REFERENCES inventory_sessions(id) ON DELETE RESTRICT
      );
    `
  },
  {
    version: 61,
    name: 'ammunition_batch_departments',
    up: `
      ALTER TABLE share_ammunition_batches
      ADD COLUMN department TEXT NOT NULL DEFAULT '';
    `
  }
];

module.exports = { migrations051To061 };
