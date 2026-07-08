function createRequestsRepository(db) {
  return {
    getNextSerial(year) {
      const row = db
        .prepare('SELECT COALESCE(MAX(serial_number), 0) + 1 AS nextSerial FROM supply_requests WHERE year = ?')
        .get(year);
      return row.nextSerial;
    },

    createRequest(payload) {
      const result = db
        .prepare(
          `
            INSERT INTO supply_requests (
              year,
              serial_number,
              request_date,
              requesting_unit,
              issuing_unit,
              protocol_number,
              renewed_from_request_id,
              status,
              notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          payload.year,
          payload.serialNumber,
          payload.requestDate,
          payload.requestingUnit,
          payload.issuingUnit,
          payload.protocolNumber,
          payload.renewedFromRequestId || null,
          payload.status,
          payload.notes
        );
      return result.lastInsertRowid;
    },

    createRequestItem(requestId, item) {
      db.prepare(
        `
          INSERT INTO supply_request_items (
            supply_request_id,
            nominal_number,
            description,
            quantity,
            measurement_unit,
            justification_code,
            priority_code,
            notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      ).run(
        requestId,
        item.nominalNumber,
        item.description,
        item.quantity,
        item.measurementUnit,
        item.justificationCode,
        item.priorityCode,
        item.notes
      );
    },

    listRequestsByYear(year) {
      return db
        .prepare(
          `
            SELECT
              id,
              serial_number,
              request_date,
              requesting_unit,
              issuing_unit,
              protocol_number,
              renewal_postponed_until,
              renewed_from_request_id,
              status,
              notes
            FROM supply_requests
            WHERE year = ?
            ORDER BY serial_number ASC
          `
        )
        .all(year);
    },

    listAllRequests() {
      return db
        .prepare(
          `
            SELECT
              id,
              year,
              serial_number,
              request_date,
              requesting_unit,
              issuing_unit,
              protocol_number,
              renewal_postponed_until,
              renewed_from_request_id,
              status,
              notes
            FROM supply_requests
            ORDER BY request_date ASC, id ASC
          `
        )
        .all();
    },

    markExpiredOwedRequests(cutoffDate) {
      db.prepare(
        `
          UPDATE supply_requests
          SET status = 'Διαγραμμένη'
          WHERE status IN ('Οφειλούμενη', 'Μερικώς Ικανοποιημένη')
            AND request_date <= ?
            AND NOT EXISTS (
              SELECT 1
              FROM supply_request_items item
              LEFT JOIN request_justification_codes code
                ON code.code = item.justification_code
              WHERE item.supply_request_id = supply_requests.id
                AND COALESCE(code.auto_delete_owed, 0) = 0
            )
        `
      ).run(cutoffDate);
    },

    listRequestJustificationCodes() {
      return db
        .prepare(
          `
            SELECT id, code, description, auto_delete_owed, sort_order
            FROM request_justification_codes
            ORDER BY sort_order ASC, id ASC
          `
        )
        .all();
    },

    listYears() {
      return db
        .prepare(
          `
            SELECT DISTINCT year
            FROM supply_requests
            ORDER BY year DESC
          `
        )
        .all()
        .map((row) => row.year);
    },

    listRequestItems(requestId) {
      return db
        .prepare(
          `
            SELECT
              id,
              nominal_number,
              description,
              quantity,
              measurement_unit,
              justification_code,
              priority_code,
              notes
            FROM supply_request_items
            WHERE supply_request_id = ?
            ORDER BY id ASC
          `
        )
        .all(requestId);
    },

    listFulfillmentMovements() {
      return db
        .prepare(
          `
            SELECT
              item.nominal_number,
              item.quantity,
              item.transaction_type,
              document.document_date
            FROM addy_items item
            JOIN addy_documents document
              ON document.id = item.addy_document_id
            WHERE item.nominal_number <> ''
            ORDER BY document.document_date ASC, item.id ASC
          `
        )
        .all();
    },

    updateStatus(id, status) {
      db.prepare('UPDATE supply_requests SET status = ? WHERE id = ?').run(status, id);
    },

    updateRequestProtocol(id, protocolNumber) {
      db.prepare('UPDATE supply_requests SET protocol_number = ? WHERE id = ?').run(protocolNumber, id);
    },

    postponeRenewal(id, untilDate) {
      db.prepare('UPDATE supply_requests SET renewal_postponed_until = ? WHERE id = ?').run(untilDate, id);
    },

    transaction(operation) {
      return db.transaction(operation)();
    }
  };
}

module.exports = {
  createRequestsRepository
};
