const migrations062 = [
  {
    version: 62,
    name: 'share_print_query_indexes',
    up: `
      CREATE INDEX idx_shares_print_order
      ON shares (
        archive_status,
        CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
        CAST(share_number AS INTEGER),
        share_number COLLATE NOCASE,
        id
      );

      CREATE INDEX idx_share_transactions_moved_year
      ON share_transactions (transaction_date, share_id)
      WHERE notes <> 'INITIAL_ANNUAL_INVENTORY';
    `
  }
];

module.exports = { migrations062 };
