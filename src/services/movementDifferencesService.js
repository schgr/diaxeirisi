const { AppError } = require('../core/errorHandler');
const { requirePositiveId } = require('../core/validation');
const { createMovementDifferencesRepository } = require('../db/movementDifferencesRepository');
const {
  validateMovementDifference,
  validateResponse
} = require('../transactions/movementDifferenceValidation');

function createMovementDifferencesService(db) {
  const repository = createMovementDifferencesRepository(db);

  return {
    getReferenceData() {
      return {
        today: localDate(new Date()),
        shares: repository.listShares().map((row) => ({
          id: row.id,
          shareNumber: row.share_number,
          nominalNumber: row.nominal_number,
          description: row.description,
          measurementUnit: row.measurement_unit
        })),
        addyDocuments: repository.listAddyDocuments().map((row) => ({
          id: row.id,
          documentDate: row.document_date,
          transactionUnit: row.transaction_unit
        }))
      };
    },

    createProtocol(payload) {
      const protocol = validateMovementDifference(payload);
      const share = repository.getShare(protocol.shareId);
      if (!share) throw new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND');

      if (protocol.addyDocumentId) {
        const addy = repository.getAddyDocument(protocol.addyDocumentId);
        if (!addy) throw new AppError('Το ΑΔΔΥ δεν βρέθηκε.', 'NOT_FOUND');
      }

      const dispatchDate = protocol.dispatchDate || protocol.protocolDate;
      const responseDueDate = addDays(dispatchDate, 15);
      let id;
      let registryNumber;
      repository.transaction(() => {
        registryNumber = repository.getNextRegistryNumber(protocol.fiscalYear);
        id = repository.createProtocol({
          ...protocol,
          registryNumber,
          dispatchDate,
          responseDueDate,
          shareNumber: share.share_number,
          nominalNumber: share.nominal_number,
          description: share.description,
          measurementUnit: share.measurement_unit
        });
      });

      return {
        id,
        registryNumber,
        message: `Το Πρωτόκολλο Διαφορών ${registryNumber}/${protocol.fiscalYear} αποθηκεύτηκε.`
      };
    },

    listProtocols(year = new Date().getFullYear()) {
      const today = localDate(new Date());
      return repository.listProtocols(Number(year)).map((row) => mapProtocol(row, today));
    },

    getProtocol(id) {
      const row = repository.getProtocol(requirePositiveId(id));
      if (!row) throw new AppError('Το Πρωτόκολλο Διαφορών δεν βρέθηκε.', 'NOT_FOUND');
      return mapProtocol(row, localDate(new Date()), repository.getServiceName());
    },

    recordResponse(id, payload) {
      const protocolId = requirePositiveId(id);
      const response = validateResponse(payload);
      if (!repository.getProtocol(protocolId)) {
        throw new AppError('Το Πρωτόκολλο Διαφορών δεν βρέθηκε.', 'NOT_FOUND');
      }
      repository.updateResponse(protocolId, response);
      return { message: 'Η απάντηση καταχωρίστηκε.' };
    },

    settleProtocol(id, payload) {
      const protocolId = requirePositiveId(id);
      const settlementReference = String(payload && payload.settlementReference || '').trim();
      const settlementDate = String(payload && payload.settlementDate || '').trim() || localDate(new Date());
      if (!settlementReference) {
        throw new AppError('Συμπλήρωσε το δικαιολογητικό τελικής τακτοποίησης.', 'VALIDATION_ERROR');
      }
      repository.updateSettlement(protocolId, { settlementDate, settlementReference });
      return { message: 'Το πρωτόκολλο σημειώθηκε ως τακτοποιημένο.' };
    },

    escalateProtocol(id, escalationDate) {
      const protocolId = requirePositiveId(id);
      repository.markEscalated(protocolId, String(escalationDate || '').trim() || localDate(new Date()));
      return { message: 'Καταχωρίστηκε η αποστολή στην Προϊστάμενη Αρχή.' };
    }
  };
}

function mapProtocol(row, today, serviceName = '') {
  const overdue =
    row.response_status === 'Αναμένεται' &&
    row.response_due_date &&
    row.response_due_date < today;
  return {
    id: row.id,
    fiscalYear: row.fiscal_year,
    registryNumber: row.registry_number,
    protocolDate: row.protocol_date,
    addyDocumentId: row.addy_document_id,
    counterpartyUnit: row.counterparty_unit,
    movementDirection: row.movement_direction,
    differenceType: row.difference_type,
    shareId: row.share_id,
    shareNumber: row.share_number,
    nominalNumber: row.nominal_number,
    description: row.description,
    measurementUnit: row.measurement_unit,
    documentQuantity: Number(row.document_quantity),
    actualQuantity: Number(row.actual_quantity),
    differenceQuantity: Number(row.difference_quantity),
    dispatchDate: row.dispatch_date,
    responseDueDate: row.response_due_date,
    responseDate: row.response_date,
    responseStatus: overdue ? 'Εκπρόθεσμη Απάντηση' : row.response_status,
    responseNotes: row.response_notes,
    overdue,
    escalationDate: row.escalation_date,
    settlementDate: row.settlement_date,
    settlementReference: row.settlement_reference,
    settlementStatus: row.settlement_status,
    notes: row.notes,
    serviceName
  };
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return localDate(date);
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

module.exports = {
  createMovementDifferencesService
};
