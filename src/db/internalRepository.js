const { listActiveShares } = require('./shareQueries');

function createInternalRepository(db) {
  return {
    listShares() {
      return listActiveShares(db).map((share) => ({
        id: share.id,
        share_number: share.share_number,
        nominal_number: share.nominal_number,
        description: share.description,
        measurement_unit: share.measurement_unit,
        accounting_balance: share.accounting_balance,
        charged_quantity: share.charged_quantity,
        requires_composition: share.requires_composition
      }));
    },

    getShare(id) {
      return db.prepare('SELECT * FROM shares WHERE id = ?').get(id);
    },

    listCompositionItems(shareId) {
      return db.prepare(`
        SELECT component_nominal_number, component_description,
               measurement_unit, quantity, notes
        FROM share_composition_items
        WHERE share_id = ?
        ORDER BY line_number, id
      `).all(shareId);
    },

    listDepartmentManagers() {
      return db
        .prepare(
          `
            SELECT id, department_name, department_head
            FROM department_managers
            ORDER BY sort_order, id
          `
        )
        .all();
    },

    getServiceSettings() {
      return db.prepare(`
        SELECT service_name, manager
        FROM service_settings
        WHERE id = 1
      `).get();
    },

    getDepartmentManager(id) {
      return db.prepare('SELECT * FROM department_managers WHERE id = ?').get(id);
    },

    getNextSerial(fiscalYear) {
      const row = db
        .prepare(
          `
            SELECT COALESCE(MAX(serial_number), 0) + 1 AS next_serial
            FROM internal_documents
            WHERE fiscal_year = ?
          `
        )
        .get(fiscalYear);
      return Number(row ? row.next_serial : 1);
    },

    getDepartmentShareBalance(departmentManagerId, shareId) {
      const row = db
        .prepare(
          `
            SELECT COALESCE(SUM(
              CASE
                WHEN document.movement_type = 'Χορήγηση' THEN item.quantity
                ELSE -item.quantity
              END
            ), 0) AS balance
            FROM internal_items item
            JOIN internal_documents document ON document.id = item.internal_document_id
            WHERE document.department_manager_id = ?
              AND item.share_id = ?
          `
        )
        .get(departmentManagerId, shareId);
      return Number(row ? row.balance : 0);
    },

    createDocument(payload) {
      return db
        .prepare(
          `
            INSERT INTO internal_documents (
              fiscal_year, serial_number, document_date, department_manager_id,
              department_name, department_head, movement_type, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          payload.fiscalYear,
          payload.serialNumber,
          payload.documentDate,
          payload.departmentManagerId,
          payload.departmentName,
          payload.departmentHead,
          payload.movementType,
          payload.notes
        ).lastInsertRowid;
    },

    createItem(documentId, payload) {
      db.prepare(
        `
          INSERT INTO internal_items (
            internal_document_id, share_id, share_number, nominal_number,
            description, measurement_unit, quantity, composition_snapshot
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        documentId,
        payload.shareId,
        payload.shareNumber,
        payload.nominalNumber,
        payload.description,
        payload.measurementUnit,
        payload.quantity,
        payload.composition && payload.composition.length
          ? JSON.stringify(payload.composition)
          : ''
      );
    },

    adjustChargedQuantity(shareId, delta) {
      db.prepare(
        `
          UPDATE shares
          SET charged_quantity = charged_quantity + ?
          WHERE id = ?
        `
      ).run(delta, shareId);
    },

    listDocuments(year) {
      return db
        .prepare(
          `
            SELECT document.id, document.serial_number, document.document_date,
                   document.department_name, document.department_head,
                   document.movement_type, document.notes,
                   item.share_number, item.nominal_number, item.description,
                   item.measurement_unit, item.quantity,
                   share.projected_quantity,
                   (
                     SELECT COALESCE(SUM(
                       CASE WHEN previous_document.movement_type = 'Χορήγηση'
                         THEN previous_item.quantity ELSE -previous_item.quantity END
                     ), 0)
                     FROM internal_items previous_item
                     JOIN internal_documents previous_document
                       ON previous_document.id = previous_item.internal_document_id
                     WHERE previous_document.department_manager_id = document.department_manager_id
                       AND previous_item.share_id = item.share_id
                       AND (
                         previous_document.document_date < document.document_date
                         OR (
                           previous_document.document_date = document.document_date
                           AND previous_document.id <= document.id
                         )
                       )
                   ) AS running_balance
            FROM internal_documents document
            JOIN internal_items item ON item.internal_document_id = document.id
            JOIN shares share ON share.id = item.share_id
            WHERE document.fiscal_year = ?
            ORDER BY document.serial_number DESC
          `
        )
        .all(year);
    },

    listDepartmentBalances(departmentManagerId) {
      return db.prepare(`
        SELECT
          item.share_id,
          item.share_number,
          item.nominal_number,
          item.description,
          item.measurement_unit,
          document.department_name,
          share.projected_quantity,
          SUM(CASE WHEN document.movement_type = 'Χορήγηση' THEN item.quantity ELSE 0 END) AS issued_quantity,
          SUM(CASE WHEN document.movement_type = 'Επιστροφή' THEN item.quantity ELSE 0 END) AS returned_quantity,
          SUM(CASE WHEN document.movement_type = 'Χορήγηση' THEN item.quantity ELSE -item.quantity END) AS final_quantity,
          MAX(CASE WHEN document.movement_type = 'Χορήγηση' THEN document.document_date END) AS last_issue_date,
          MAX(CASE WHEN document.movement_type = 'Επιστροφή' THEN document.document_date END) AS last_return_date
        FROM internal_items item
        JOIN internal_documents document ON document.id = item.internal_document_id
        JOIN shares share ON share.id = item.share_id
        WHERE document.department_manager_id = ?
        GROUP BY
          item.share_id, item.share_number, item.nominal_number,
          item.description, item.measurement_unit, document.department_name,
          share.projected_quantity
        HAVING final_quantity > 0
        ORDER BY
          CASE WHEN item.share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
          CAST(item.share_number AS INTEGER),
          item.share_number COLLATE NOCASE,
          item.share_id
      `).all(departmentManagerId);
    },

    listDepartmentCompositionMovements(departmentManagerId) {
      return db.prepare(`
        SELECT document.movement_type, item.share_id, item.composition_snapshot
        FROM internal_items item
        JOIN internal_documents document ON document.id = item.internal_document_id
        WHERE document.department_manager_id = ?
          AND TRIM(item.composition_snapshot) <> ''
        ORDER BY document.document_date, document.id, item.id
      `).all(departmentManagerId);
    },

    listShareSerialNumbers(shareId) {
      return db.prepare(`
        SELECT serial_number
        FROM share_serial_numbers
        WHERE share_id = ?
          AND TRIM(serial_number) <> ''
        ORDER BY position, id
      `).all(shareId);
    },

    listShareAmmunitionBatches(shareId, departmentName) {
      return db.prepare(`
        SELECT batch_number
        FROM share_ammunition_batches
        WHERE share_id = ?
          AND department = ?
          AND TRIM(batch_number) <> ''
        ORDER BY position, id
      `).all(shareId, departmentName);
    },

    transaction(operation) {
      return db.transaction(operation)();
    }
  };
}

module.exports = {
  createInternalRepository
};
