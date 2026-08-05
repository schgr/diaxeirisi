const migrations063 = [
  {
    version: 63,
    name: 'training_ammunition_batch_book',
    up: `
      ALTER TABLE shares
      ADD COLUMN requires_training_ammunition_batch_book INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE share_training_ammunition_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        share_id INTEGER NOT NULL,
        position INTEGER NOT NULL,
        batch_number TEXT NOT NULL DEFAULT '',
        quantity REAL NOT NULL DEFAULT 0 CHECK (quantity >= 0),
        department TEXT NOT NULL DEFAULT '',
        notes TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (share_id) REFERENCES shares(id) ON DELETE CASCADE,
        UNIQUE (share_id, position)
      );

      CREATE INDEX idx_share_training_ammunition_batches_share
      ON share_training_ammunition_batches(share_id, position);
    `
  }
];

module.exports = { migrations063 };
