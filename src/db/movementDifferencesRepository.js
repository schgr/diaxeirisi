const { listActiveShares } = require('./shareQueries');

function createMovementDifferencesRepository(db) {
  return {
    listShares() {
      return listActiveShares(db).map((share) => ({
        id: share.id,
        share_number: share.share_number,
        nominal_number: share.nominal_number,
        description: share.description,
        measurement_unit: share.measurement_unit
      }));
    },

    getShare(id) {
      return db.prepare('SELECT * FROM shares WHERE id = ?').get(id);
    },

    listAddyDocuments() {
      return db
        .prepare(
          `
            SELECT id, document_date, transaction_unit
            FROM addy_documents
            ORDER BY document_date DESC, id DESC
          `
        )
        .all();
    },

    getAddyDocument(id) {
      return db.prepare('SELECT * FROM addy_documents WHERE id = ?').get(id);
    },

    getServiceName() {
      const row = db.prepare('SELECT service_name FROM service_settings WHERE id = 1').get();
      return row ? row.service_name : '';
    },

    getNextRegistryNumber(fiscalYear) {
      const row = db
        .prepare(
          `
            SELECT COALESCE(MAX(registry_number), 0) + 1 AS next_number
            FROM movement_difference_protocols
            WHERE fiscal_year = ?
          `
        )
        .get(fiscalYear);
      return Number(row ? row.next_number : 1);
    },

    createProtocol(payload) {
      return db
        .prepare(
          `
            INSERT INTO movement_difference_protocols (
              fiscal_year, registry_number, protocol_date, addy_document_id,
              counterparty_unit, movement_direction, difference_type,
              share_id, share_number, nominal_number, description, measurement_unit,
              document_quantity, actual_quantity, difference_quantity,
              dispatch_date, response_due_date, notes
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          payload.fiscalYear,
          payload.registryNumber,
          payload.protocolDate,
          payload.addyDocumentId,
          payload.counterpartyUnit,
          payload.movementDirection,
          payload.differenceType,
          payload.shareId,
          payload.shareNumber,
          payload.nominalNumber,
          payload.description,
          payload.measurementUnit,
          payload.documentQuantity,
          payload.actualQuantity,
          payload.differenceQuantity,
          payload.dispatchDate,
          payload.responseDueDate,
          payload.notes
        ).lastInsertRowid;
    },

    listProtocols(year) {
      return db
        .prepare(
          `
            SELECT *
            FROM movement_difference_protocols
            WHERE fiscal_year = ?
            ORDER BY registry_number DESC
          `
        )
        .all(year);
    },

    getProtocol(id) {
      return db.prepare('SELECT * FROM movement_difference_protocols WHERE id = ?').get(id);
    },

    updateResponse(id, payload) {
      db.prepare(
        `
          UPDATE movement_difference_protocols
          SET response_date = ?,
              response_status = ?,
              response_notes = ?,
              settlement_status = CASE
                WHEN ? = 'Έγινε δεκτή' THEN 'Προς Τακτοποίηση'
                ELSE settlement_status
              END
          WHERE id = ?
        `
      ).run(
        payload.responseDate,
        payload.responseStatus,
        payload.responseNotes,
        payload.responseStatus,
        id
      );
    },

    updateSettlement(id, payload) {
      db.prepare(
        `
          UPDATE movement_difference_protocols
          SET settlement_date = ?,
              settlement_reference = ?,
              settlement_status = 'Τακτοποιήθηκε'
          WHERE id = ?
        `
      ).run(payload.settlementDate, payload.settlementReference, id);
    },

    markEscalated(id, escalationDate) {
      db.prepare(
        `
          UPDATE movement_difference_protocols
          SET escalation_date = ?,
              settlement_status = 'Σε Προϊστάμενη Αρχή'
          WHERE id = ?
        `
      ).run(escalationDate, id);
    },

    transaction(operation) {
      return db.transaction(operation)();
    }
  };
}

module.exports = {
  createMovementDifferencesRepository
};
