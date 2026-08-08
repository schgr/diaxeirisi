const migrations067 = [
  {
    version: 67,
    name: 'cleanup_orphaned_addy_items',
    up: `
      DELETE FROM addy_items
      WHERE NOT EXISTS (
        SELECT 1
        FROM addy_documents
        WHERE addy_documents.id = addy_items.addy_document_id
      );
    `
  }
];

module.exports = { migrations067 };
