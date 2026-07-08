function createSharesRepository(db) {
  return {
    listShares() {
      return db
        .prepare(
          `
            SELECT
              id,
              share_number,
              nominal_number,
              description,
              material_type,
              material_code,
              main_material_number,
              measurement_unit,
              projected_quantity,
              accounting_balance,
              charged_quantity,
              unit_price,
              photo_path,
              requires_composition,
              requires_change_sheet
            FROM shares
            WHERE archive_status = 'Ενεργή'
            ORDER BY
              CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
              CAST(share_number AS INTEGER) ASC,
              share_number COLLATE NOCASE ASC,
              id ASC
          `
        )
        .all();
    },

    createShare(payload) {
      const result = db
        .prepare(
          `
            INSERT INTO shares (
              share_number,
              nominal_number,
              description,
              material_type,
              material_code,
              main_material_number,
              projected_quantity,
              accounting_balance,
              charged_quantity
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          payload.shareNumber,
          payload.nominalNumber,
          payload.description,
          payload.materialType,
          payload.materialCode || '',
          payload.mainMaterialNumber || '',
          payload.projectedQuantity || 0,
          payload.accountingBalance,
          payload.chargedQuantity
        );

      return this.getShare(result.lastInsertRowid);
    },

    getShare(id) {
      return db.prepare('SELECT * FROM shares WHERE id = ?').get(id);
    },

    getShareByNumber(shareNumber) {
      return db.prepare('SELECT * FROM shares WHERE share_number = ?').get(shareNumber);
    },

    updateShareDetails(id, payload) {
      db.prepare(
        `
          UPDATE shares
          SET share_number = ?,
              nominal_number = ?,
              description = ?,
              material_type = ?,
              material_code = ?,
              main_material_number = ?,
              projected_quantity = ?,
              accounting_balance = ?,
              charged_quantity = ?,
              unit_price = ?,
              photo_path = ?,
              requires_composition = ?,
              requires_change_sheet = ?
          WHERE id = ?
        `
      ).run(
        payload.shareNumber,
        payload.nominalNumber,
        payload.description,
        payload.materialType,
        payload.materialCode,
        payload.mainMaterialNumber,
        payload.projectedQuantity,
        payload.accountingBalance,
        payload.chargedQuantity,
        payload.unitPrice,
        payload.photoPath,
        payload.requiresComposition ? 1 : 0,
        payload.requiresChangeSheet ? 1 : 0,
        id
      );

      return this.getShare(id);
    },

    getTransactionBalanceBeforeYear(shareId, year) {
      const row = db
        .prepare(
          `
            SELECT COALESCE(SUM(
              CASE
                WHEN transaction_type = 'Χρέωση' THEN quantity
                ELSE -quantity
              END
            ), 0) AS movement
            FROM share_transactions
            WHERE share_id = ?
              AND transaction_date < ?
          `
        )
        .get(shareId, `${year}-01-01`);
      return row ? row.movement : 0;
    },

    getOpeningInventoryBeforeYear(shareId, year) {
      return db.prepare(`
        SELECT transaction_date, quantity, document_reference
        FROM share_transactions
        WHERE share_id = ?
          AND transaction_date < ?
          AND notes = 'INITIAL_ANNUAL_INVENTORY'
        ORDER BY transaction_date DESC, id DESC
        LIMIT 1
      `).get(shareId, `${year}-01-01`);
    },

    getOpeningInventoryForCardYear(shareId, year) {
      return db.prepare(`
        SELECT transaction_date, quantity, document_reference
        FROM share_transactions
        WHERE share_id = ?
          AND transaction_date <= ?
          AND notes = 'INITIAL_ANNUAL_INVENTORY'
        ORDER BY transaction_date DESC, id DESC
        LIMIT 1
      `).get(shareId, `${year}-12-31`);
    },

    listShareTransactionsForYear(shareId, year) {
      return db
        .prepare(
          `
            SELECT
              id,
              transaction_date,
              transaction_unit,
              transaction_type,
              document_reference,
              quantity,
              notes
            FROM share_transactions
            WHERE share_id = ?
              AND transaction_date >= ?
              AND transaction_date <= ?
              AND notes <> 'INITIAL_ANNUAL_INVENTORY'
            ORDER BY transaction_date ASC, id ASC
          `
        )
        .all(shareId, `${year}-01-01`, `${year}-12-31`);
    },

    listShareAssignments(shareId) {
      return db
        .prepare(
          `
            SELECT
              MIN(document.id) AS id,
              document.department_head AS holder_name,
              document.department_name AS department,
              SUM(
                CASE
                  WHEN document.movement_type = 'Χορήγηση' THEN item.quantity
                  ELSE -item.quantity
                END
              ) AS quantity,
              MAX(document.document_date) AS assigned_at,
              '' AS notes
            FROM internal_items item
            JOIN internal_documents document ON document.id = item.internal_document_id
            WHERE item.share_id = ?
            GROUP BY document.department_manager_id, document.department_name, document.department_head
            HAVING SUM(
              CASE
                WHEN document.movement_type = 'Χορήγηση' THEN item.quantity
                ELSE -item.quantity
              END
            ) > 0
            ORDER BY document.department_name COLLATE NOCASE ASC
          `
        )
        .all(shareId);
    },

    listCompositionItems(shareId) {
      return db.prepare(`
        SELECT *
        FROM share_composition_items
        WHERE share_id = ?
        ORDER BY line_number, id
      `).all(shareId);
    },

    replaceCompositionItems(shareId, items) {
      db.transaction(() => {
        db.prepare('DELETE FROM share_composition_items WHERE share_id = ?').run(shareId);
        const insert = db.prepare(`
          INSERT INTO share_composition_items (
            share_id, line_number, component_nominal_number, component_description,
            measurement_unit, quantity, not_issued_quantity, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        items.forEach((item, index) => insert.run(
          shareId,
          index + 1,
          item.componentNominalNumber,
          item.componentDescription,
          item.measurementUnit,
          item.projectedQuantity,
          item.notIssuedQuantity,
          item.notes
        ));
      })();
    },

    listChangeSheetEntries(shareId) {
      return db.prepare(`
        SELECT *
        FROM share_change_sheet_entries
        WHERE share_id = ?
        ORDER BY change_date, id
      `).all(shareId);
    },

    replaceChangeSheetEntries(shareId, entries) {
      db.transaction(() => {
        db.prepare('DELETE FROM share_change_sheet_entries WHERE share_id = ?').run(shareId);
        const insert = db.prepare(`
          INSERT INTO share_change_sheet_entries (
            share_id, change_date, order_reference, previous_value,
            new_value, change_reason, notes, component_line_number,
            movement_type, quantity
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        entries.forEach((entry) => insert.run(
          shareId,
          entry.changeDate,
          entry.orderReference,
          entry.previousValue,
          entry.newValue,
          entry.changeReason,
          entry.notes,
          entry.componentLineNumber,
          entry.movementType,
          entry.quantity
        ));
      })();
    }
  };
}

module.exports = {
  createSharesRepository
};
