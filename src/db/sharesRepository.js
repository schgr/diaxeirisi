const SHARE_PRINT_CHUNK_SIZE = 400;

function forShareIdChunks(shareIds, query) {
  const rows = [];
  for (let offset = 0; offset < shareIds.length; offset += SHARE_PRINT_CHUNK_SIZE) {
    rows.push(...query(shareIds.slice(offset, offset + SHARE_PRINT_CHUNK_SIZE)));
  }
  return rows;
}

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
              requires_serial_number,
              requires_weapon_registry,
              requires_ammunition_batch_book,
              requires_training_ammunition_batch_book,
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

    getFiscalYearArchive(year) {
      return db.prepare(`
        SELECT archive_snapshot
        FROM fiscal_year_closures
        WHERE fiscal_year = ?
      `).get(year);
    },

    listShareIdsWithTransactionsForYear(year) {
      return db.prepare(`
        SELECT DISTINCT share_id
        FROM share_transactions
        WHERE transaction_date >= ?
          AND transaction_date <= ?
          AND notes <> 'INITIAL_ANNUAL_INVENTORY'
        ORDER BY share_id
      `).all(`${year}-01-01`, `${year}-12-31`).map((row) => Number(row.share_id));
    },

    listSharePrintRows(year, options = {}) {
      const filters = ["shares.archive_status = 'Ενεργή'"];
      const params = [];
      if (options.mode === 'single') {
        filters.push('shares.id = ?');
        params.push(Number(options.shareId));
      }
      if (options.mode === 'moved') {
        filters.push(`shares.id IN (
          SELECT moved.share_id
          FROM share_transactions moved
          WHERE moved.transaction_date >= ?
            AND moved.transaction_date <= ?
            AND moved.notes <> 'INITIAL_ANNUAL_INVENTORY'
        )`);
        params.push(`${year}-01-01`, `${year}-12-31`);
      }
      if (options.fromShareNumber) {
        filters.push('CAST(shares.share_number AS INTEGER) >= ?');
        params.push(Number(options.fromShareNumber));
      }
      if (options.toShareNumber) {
        filters.push('CAST(shares.share_number AS INTEGER) <= ?');
        params.push(Number(options.toShareNumber));
      }
      return db.prepare(`
        SELECT
          shares.id,
          shares.share_number,
          shares.nominal_number,
          shares.description,
          shares.material_type,
          shares.material_code,
          shares.main_material_number,
          shares.measurement_unit,
          shares.projected_quantity,
          shares.accounting_balance,
          shares.charged_quantity,
          shares.unit_price,
          shares.photo_path,
          shares.requires_composition,
          shares.requires_serial_number,
          shares.requires_weapon_registry,
          shares.requires_ammunition_batch_book,
          shares.requires_training_ammunition_batch_book,
          shares.requires_change_sheet
        FROM shares
        WHERE ${filters.join(' AND ')}
        ORDER BY CASE WHEN shares.share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
                 CAST(shares.share_number AS INTEGER), shares.share_number COLLATE NOCASE, shares.id
      `).all(...params);
    },

    listTransactionsForSharePrint(year, shareIds) {
      if (!shareIds.length) return [];
      return forShareIdChunks(shareIds, (chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        return db.prepare(`
          SELECT id, share_id, transaction_date, transaction_unit, transaction_type,
                 document_reference, quantity, notes
          FROM share_transactions
          WHERE share_id IN (${placeholders})
            AND transaction_date >= ?
            AND transaction_date <= ?
            AND notes <> 'INITIAL_ANNUAL_INVENTORY'
          ORDER BY share_id, transaction_date, id
        `).all(...chunk, `${year}-01-01`, `${year}-12-31`);
      });
    },

    listBalancesBeforeYearForSharePrint(year, shareIds) {
      if (!shareIds.length) return [];
      return forShareIdChunks(shareIds, (chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        return db.prepare(`
          SELECT share_id, COALESCE(SUM(
            CASE WHEN transaction_type = 'Χρέωση' THEN quantity ELSE -quantity END
          ), 0) AS movement
          FROM share_transactions
          WHERE share_id IN (${placeholders}) AND transaction_date < ?
          GROUP BY share_id
        `).all(...chunk, `${year}-01-01`);
      });
    },

    listInventoriesForSharePrint(year, shareIds) {
      if (!shareIds.length) return [];
      return forShareIdChunks(shareIds, (chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        return db.prepare(`
          SELECT id, share_id, transaction_date, quantity, document_reference
          FROM share_transactions
          WHERE share_id IN (${placeholders})
            AND transaction_date <= ?
            AND notes = 'INITIAL_ANNUAL_INVENTORY'
          ORDER BY share_id, transaction_date DESC, id DESC
        `).all(...chunk, `${year}-12-31`);
      });
    },

    listCompositionsForSharePrint(shareIds) {
      if (!shareIds.length) return [];
      return forShareIdChunks(shareIds, (chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        return db.prepare(`
          SELECT id, share_id, line_number, component_nominal_number,
                 component_description, measurement_unit, quantity,
                 not_issued_quantity, notes
          FROM share_composition_items
          WHERE share_id IN (${placeholders})
          ORDER BY share_id, line_number, id
        `).all(...chunk);
      });
    },

    listChangeSheetsForSharePrint(shareIds) {
      if (!shareIds.length) return [];
      return forShareIdChunks(shareIds, (chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        return db.prepare(`
          SELECT id, share_id, change_date, order_reference, previous_value,
                 new_value, change_reason, notes, component_line_number,
                 movement_type, quantity
          FROM share_change_sheet_entries
          WHERE share_id IN (${placeholders})
          ORDER BY share_id, change_date, id
        `).all(...chunk);
      });
    },

    listAssignmentsForSharePrint(shareIds) {
      if (!shareIds.length) return [];
      return forShareIdChunks(shareIds, (chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        return db.prepare(`
          SELECT *
          FROM (
            SELECT
              item.share_id,
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
            WHERE item.share_id IN (${placeholders})
            GROUP BY item.share_id, document.department_manager_id,
                     document.department_name, document.department_head
          ) assignment
          WHERE assignment.quantity > 0
          ORDER BY assignment.share_id, assignment.department COLLATE NOCASE ASC
        `).all(...chunk);
      });
    },

    listDocumentMovementsForSharePrint(year, shareIds) {
      if (!shareIds.length) return [];
      return forShareIdChunks(shareIds, (chunk) => {
        const placeholders = chunk.map(() => '?').join(',');
        return db.prepare(`
          SELECT movement.share_id,
                 movement.id AS transaction_id,
                 movement.transaction_date,
                 movement.transaction_type,
                 movement.quantity,
                 'ΑΔΔΥ' AS source_type,
                 document.id AS document_number,
                 item.composition_snapshot
          FROM addy_items item
          JOIN addy_documents document ON document.id = item.addy_document_id
          JOIN share_transactions movement ON
            movement.id = item.share_transaction_id
            OR (
              item.share_transaction_id IS NULL
              AND movement.share_id = item.share_id
              AND movement.transaction_date = document.document_date
              AND movement.document_reference LIKE 'ΑΔΔΥ ' || document.id || ' /%'
            )
          WHERE movement.share_id IN (${placeholders})
            AND movement.transaction_date >= ?
            AND movement.transaction_date <= ?
          UNION ALL
          SELECT movement.share_id,
                 movement.id AS transaction_id,
                 movement.transaction_date,
                 movement.transaction_type,
                 movement.quantity,
                 'ΕΧΠ' AS source_type,
                 document.registry_number AS document_number,
                 item.composition_snapshot
          FROM exhp_items item
          JOIN exhp_documents document ON document.id = item.exhp_document_id
          JOIN share_transactions movement ON
            movement.id = item.share_transaction_id
            OR (
              item.share_transaction_id IS NULL
              AND movement.share_id = item.share_id
              AND movement.transaction_date = document.document_date
              AND movement.document_reference = 'ΕΧΠ ' || document.registry_number || '/' || document.fiscal_year
            )
          WHERE movement.share_id IN (${placeholders})
            AND movement.transaction_date >= ?
            AND movement.transaction_date <= ?
          ORDER BY 1, 3, 2
        `).all(
          ...chunk, `${year}-01-01`, `${year}-12-31`,
          ...chunk, `${year}-01-01`, `${year}-12-31`
        );
      });
    },

    listDocumentCompositionMovements(shareId, year) {
      return db.prepare(`
        SELECT movement.id AS transaction_id,
               movement.transaction_date,
               movement.transaction_type,
               movement.quantity,
               'ΑΔΔΥ' AS source_type,
               document.id AS document_number,
               item.composition_snapshot
        FROM addy_items item
        JOIN addy_documents document ON document.id = item.addy_document_id
        JOIN share_transactions movement ON
          movement.id = item.share_transaction_id
          OR (
            item.share_transaction_id IS NULL
            AND movement.share_id = item.share_id
            AND movement.transaction_date = document.document_date
            AND movement.document_reference LIKE 'ΑΔΔΥ ' || document.id || ' /%'
          )
        WHERE movement.share_id = ?
          AND movement.transaction_date >= ?
          AND movement.transaction_date <= ?
        UNION ALL
        SELECT movement.id AS transaction_id,
               movement.transaction_date,
               movement.transaction_type,
               movement.quantity,
               'ΕΧΠ' AS source_type,
               document.registry_number AS document_number,
               item.composition_snapshot
        FROM exhp_items item
        JOIN exhp_documents document ON document.id = item.exhp_document_id
        JOIN share_transactions movement ON
          movement.id = item.share_transaction_id
          OR (
            item.share_transaction_id IS NULL
            AND movement.share_id = item.share_id
            AND movement.transaction_date = document.document_date
            AND movement.document_reference = 'ΕΧΠ ' || document.registry_number || '/' || document.fiscal_year
          )
        WHERE movement.share_id = ?
          AND movement.transaction_date >= ?
          AND movement.transaction_date <= ?
        ORDER BY transaction_date, transaction_id
      `).all(
        shareId, `${year}-01-01`, `${year}-12-31`,
        shareId, `${year}-01-01`, `${year}-12-31`
      );
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
              requires_serial_number = ?,
              requires_weapon_registry = ?,
              requires_ammunition_batch_book = ?,
              requires_training_ammunition_batch_book = ?,
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
        payload.requiresSerialNumber ? 1 : 0,
        payload.requiresWeaponRegistry ? 1 : 0,
        payload.requiresAmmunitionBatchBook ? 1 : 0,
        payload.requiresTrainingAmmunitionBatchBook ? 1 : 0,
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
            SELECT *
            FROM (
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
            ) assignment
            WHERE assignment.quantity > 0
            ORDER BY assignment.department COLLATE NOCASE ASC
          `
        )
        .all(shareId);
    },

    listSerialNumberShares() {
      return db.prepare(`
        SELECT *
        FROM shares
        WHERE archive_status = 'Ενεργή'
          AND requires_serial_number = 1
          AND accounting_balance > 0
        ORDER BY
          CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
          CAST(share_number AS INTEGER), share_number COLLATE NOCASE, id
      `).all();
    },

    listSerialNumbers(shareId) {
      return db.prepare(`
        SELECT position, serial_number, notes
        FROM share_serial_numbers
        WHERE share_id = ?
        ORDER BY position
      `).all(shareId);
    },

    saveSerialNumbers(shareId, entries) {
      db.transaction(() => {
        const statement = db.prepare(`
          INSERT INTO share_serial_numbers (share_id, position, serial_number, notes)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(share_id, position) DO UPDATE SET
            serial_number = excluded.serial_number,
            notes = excluded.notes,
            updated_at = CURRENT_TIMESTAMP
        `);
        entries.forEach((entry) => statement.run(
          shareId,
          entry.position,
          entry.serialNumber,
          entry.notes
        ));
      })();
    },

    listAmmunitionBatchShares() {
      return db.prepare(`
        SELECT *
        FROM shares
        WHERE archive_status = 'Ενεργή'
          AND requires_ammunition_batch_book = 1
          AND accounting_balance > 0
        ORDER BY CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
                 CAST(share_number AS INTEGER), share_number COLLATE NOCASE, id
      `).all();
    },

    listAmmunitionBatches(shareId) {
      return db.prepare(`
        SELECT position, batch_number, quantity, department, notes
        FROM share_ammunition_batches
        WHERE share_id = ?
        ORDER BY position
      `).all(shareId);
    },

    replaceAmmunitionBatches(shareId, entries) {
      db.transaction(() => {
        db.prepare('DELETE FROM share_ammunition_batches WHERE share_id = ?').run(shareId);
        const insert = db.prepare(`
          INSERT INTO share_ammunition_batches (
            share_id, position, batch_number, quantity, department, notes
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        entries.forEach((entry, index) => insert.run(
          shareId,
          index + 1,
          entry.batchNumber,
          entry.quantity,
          entry.department,
          entry.notes
        ));
      })();
    },

    listTrainingAmmunitionBatchShares() {
      return db.prepare(`
        SELECT *
        FROM shares
        WHERE archive_status = 'Ενεργή'
          AND requires_training_ammunition_batch_book = 1
          AND accounting_balance > 0
        ORDER BY CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
                 CAST(share_number AS INTEGER), share_number COLLATE NOCASE, id
      `).all();
    },

    listTrainingAmmunitionBatches(shareId) {
      return db.prepare(`
        SELECT position, batch_number, quantity, department, notes
        FROM share_training_ammunition_batches
        WHERE share_id = ?
        ORDER BY position
      `).all(shareId);
    },

    replaceTrainingAmmunitionBatches(shareId, entries) {
      db.transaction(() => {
        db.prepare('DELETE FROM share_training_ammunition_batches WHERE share_id = ?').run(shareId);
        const insert = db.prepare(`
          INSERT INTO share_training_ammunition_batches (
            share_id, position, batch_number, quantity, department, notes
          )
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        entries.forEach((entry, index) => insert.run(
          shareId,
          index + 1,
          entry.batchNumber,
          entry.quantity,
          entry.department,
          entry.notes
        ));
      })();
    },

    listWeaponRegistryShares() {
      return db.prepare(`
        SELECT * FROM shares
        WHERE archive_status = 'Ενεργή' AND requires_weapon_registry = 1
        ORDER BY CASE WHEN main_material_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
                 CAST(main_material_number AS INTEGER), main_material_number COLLATE NOCASE, id
      `).all();
    },

    listWeaponRegistryEntries(shareId) {
      return db.prepare(`
        SELECT position, details, registry_number, source_unit, document_year,
               current_department, assignment_from, delivered_outside_unit,
               assignment_date, notes
        FROM share_weapon_registry_entries
        WHERE share_id = ?
        ORDER BY position
      `).all(shareId);
    },

    replaceWeaponRegistryEntries(shareId, entries) {
      db.transaction(() => {
        db.prepare('DELETE FROM share_weapon_registry_entries WHERE share_id = ?').run(shareId);
        const insert = db.prepare(`
          INSERT INTO share_weapon_registry_entries (
            share_id, position, details, registry_number, source_unit, document_year,
            current_department, assignment_from, delivered_outside_unit, assignment_date, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        entries.forEach((entry, index) => insert.run(
          shareId, index + 1, entry.details, entry.registryNumber, entry.sourceUnit,
          entry.entryYear, entry.currentDepartment, entry.fromDate,
          entry.deliveredOutsideUnit, entry.deliveredDate, entry.notes
        ));
      })();
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
