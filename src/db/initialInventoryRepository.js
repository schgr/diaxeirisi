function createInitialInventoryRepository(db) {
  return {
    getLatestImportDate() {
      const row = db.prepare(`
        SELECT MAX(inventory_date) AS inventory_date
        FROM initial_inventory_imports
      `).get();
      return row ? row.inventory_date : null;
    },

    ensureReferenceValues(item) {
      db.transaction(() => {
        db.prepare(`
          INSERT OR IGNORE INTO measurement_units (name, sort_order)
          VALUES (?, COALESCE((SELECT MAX(sort_order) + 1 FROM measurement_units), 1))
        `).run(item.measurementUnit);
        db.prepare(`
          INSERT OR IGNORE INTO material_categories (name, sort_order)
          VALUES (?, COALESCE((SELECT MAX(sort_order) + 1 FROM material_categories), 1))
        `).run(item.materialCategory);
      })();
    },

    findShareByNumber(shareNumber) {
      return db.prepare('SELECT * FROM shares WHERE share_number = ?').get(shareNumber);
    },

    createShare(item) {
      return db.prepare(`
        INSERT INTO shares (
          share_number, nominal_number, description, material_type,
          material_code, main_material_number, measurement_unit,
          projected_quantity, accounting_balance, charged_quantity
        ) VALUES (?, ?, ?, ?, '', ?, ?, 0, ?, 0)
      `).run(
        item.shareNumber,
        item.nominalNumber,
        item.description,
        item.materialCategory,
        item.mainMaterialNumber,
        item.measurementUnit,
        item.quantity
      ).lastInsertRowid;
    },

    updateShare(id, item) {
      db.prepare(`
        UPDATE shares
        SET nominal_number = ?,
            description = ?,
            material_type = ?,
            main_material_number = ?,
            measurement_unit = ?,
            accounting_balance = ?,
            charged_quantity = 0,
            archive_status = 'Ενεργή',
            archived_at = NULL,
            archive_reason = ''
        WHERE id = ?
      `).run(
        item.nominalNumber,
        item.description,
        item.materialCategory,
        item.mainMaterialNumber,
        item.measurementUnit,
        item.quantity,
        id
      );
    },

    deletePreviousOpeningTransactions(shareId) {
      db.prepare(`
        DELETE FROM share_transactions
        WHERE share_id = ? AND notes = 'INITIAL_ANNUAL_INVENTORY'
      `).run(shareId);
    },

    createOpeningTransaction(shareId, inventoryDate, quantity) {
      db.prepare(`
        INSERT INTO share_transactions (
          share_id, transaction_date, transaction_unit, transaction_type,
          document_reference, quantity, notes
        ) VALUES (?, ?, 'ΑΡΧΙΚΗ ΑΠΟΓΡΑΦΗ', 'Χρέωση', ?, ?, 'INITIAL_ANNUAL_INVENTORY')
      `).run(
        shareId,
        inventoryDate,
        `ΤΕΛΕΥΤΑΙΑ ΕΤΗΣΙΑ ΑΠΟΓΡΑΦΗ ${inventoryDate.slice(0, 4)}`,
        quantity
      );
    },

    getNextInventorySerial(fiscalYear) {
      const row = db.prepare(`
        SELECT COALESCE(MAX(serial_number), 0) + 1 AS next_serial
        FROM inventory_sessions WHERE fiscal_year = ?
      `).get(fiscalYear);
      return Number(row ? row.next_serial : 1);
    },

    createInventorySession(inventoryDate, serialNumber, sourceFile) {
      return db.prepare(`
        INSERT INTO inventory_sessions (
          fiscal_year, serial_number, inventory_date, title, notes,
          status, completed_at
        ) VALUES (?, ?, ?, 'Τελευταία Ετήσια Απογραφή', ?, 'Ολοκληρωμένη', CURRENT_TIMESTAMP)
      `).run(
        Number(inventoryDate.slice(0, 4)),
        serialNumber,
        inventoryDate,
        `Αρχική ενημέρωση από Excel: ${sourceFile}`
      ).lastInsertRowid;
    },

    createInventoryItem(sessionId, shareId, item) {
      db.prepare(`
        INSERT INTO inventory_items (
          inventory_session_id, share_id, share_number, nominal_number,
          description, measurement_unit, accounting_balance,
          partial_management_quantity, expected_warehouse_quantity,
          first_count, second_count, final_count, difference,
          difference_status, settlement_status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, NULL, ?, 0, 'Ισοσκελισμένη', 'Δεν απαιτείται', 'Εισαγωγή αρχικής απογραφής')
      `).run(
        sessionId,
        shareId,
        item.shareNumber,
        item.nominalNumber,
        item.description,
        item.measurementUnit,
        item.quantity,
        item.quantity,
        item.quantity,
        item.quantity
      );
    },

    createImportRecord(sessionId, inventoryDate, sourceFile, count) {
      db.prepare(`
        INSERT INTO initial_inventory_imports (
          inventory_session_id, inventory_date, source_file, imported_rows
        ) VALUES (?, ?, ?, ?)
      `).run(sessionId, inventoryDate, sourceFile, count);
    },

    transaction(operation) {
      return db.transaction(operation)();
    }
  };
}

module.exports = {
  createInitialInventoryRepository
};
