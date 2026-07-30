const migrations041To050 = [
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
  }
];

module.exports = { migrations041To050 };
