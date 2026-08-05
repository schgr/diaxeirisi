const migrations064 = [
  {
    version: 64,
    name: 'weapon_registry_entries',
    up: `
      CREATE TABLE share_weapon_registry_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        registry_number TEXT NOT NULL DEFAULT '',
        source_unit TEXT NOT NULL DEFAULT '',
        document_year TEXT NOT NULL DEFAULT '',
        current_department TEXT NOT NULL DEFAULT '',
        assignment_from TEXT NOT NULL DEFAULT '',
        assignment_date TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE,
        UNIQUE (share_id, position)
      );

      CREATE INDEX idx_share_weapon_registry_entries_share
      ON share_weapon_registry_entries(share_id, position);
    `
  }
];

module.exports = { migrations064 };
