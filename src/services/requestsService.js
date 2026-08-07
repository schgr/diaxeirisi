const { createRequestsRepository } = require('../db/requestsRepository');
const { AppError } = require('../core/errorHandler');
const { differenceInDays, toIsoDate } = require('../core/dates');
const { normalizeText: normalize } = require('../core/text');
const { requirePositiveId } = require('../core/validation');
const { validateSupplyRequest } = require('../requests/requestValidation');

function createRequestsService(db, settingsService) {
  const repository = createRequestsRepository(db);

  function getCurrentYear() {
    return new Date().getFullYear();
  }

  function applyRetentionPolicy() {
    const today = new Date();
    const cutoff = new Date(today.getFullYear() - 1, today.getMonth(), 0);
    repository.markExpiredOwedRequests(toIsoDate(cutoff));
  }

  function synchronizeRequestStatuses() {
    applyRetentionPolicy();
    const requests = loadAllRequestsWithItems(repository);
    const fulfillmentByRequest = calculateFulfillment(repository, requests);

    for (const request of requests) {
      if (request.status === 'Διαγραμμένη') {
        continue;
      }

      const fulfilledItems = fulfillmentByRequest.get(request.id) || [];
      const hasItems = fulfilledItems.length > 0;
      const allFulfilled = hasItems && fulfilledItems.every((item) => item.fulfilledQuantity >= item.quantity);
      const partlyFulfilled = hasItems && fulfilledItems.some((item) => item.fulfilledQuantity > 0);
      const status = allFulfilled
        ? 'Ικανοποιήθηκε'
        : partlyFulfilled
          ? 'Μερικώς Ικανοποιημένη'
          : 'Οφειλούμενη';

      if (request.status !== status) {
        repository.updateStatus(request.id, status);
      }
    }

    return fulfillmentByRequest;
  }

  function listRequests(year = getCurrentYear()) {
    const fulfillmentByRequest = synchronizeRequestStatuses();
    const settings = settingsService.getSettings();
    const measurementUnitCodes = new Map(settings.measurementUnits.map((unit) => [unit.name, unit.code || unit.name]));
    return repository.listRequestsByYear(Number(year)).map((request) => ({
      id: request.id,
      serialNumber: request.serial_number,
      protocolInput: request.protocol_number || '',
      protocolNumber: formatProtocolNumber(request.serial_number, request.protocol_number),
      requestDate: request.request_date,
      requestingUnit: request.requesting_unit,
      issuingUnit: request.issuing_unit,
      serviceLocation: settings.serviceInfo.serviceLocation,
      manager: settings.financialOfficers.manager,
      ped: settings.financialOfficers.ped,
      status: request.status,
      notes: request.notes,
      items: repository.listRequestItems(request.id).map((row) =>
        mapItem(row, measurementUnitCodes, fulfillmentByRequest.get(request.id))
      )
    }));
  }

  return {
    getReferenceData() {
      synchronizeRequestStatuses();
      const settings = settingsService.getSettings();
      const currentYear = getCurrentYear();
      const years = new Set(repository.listYears());
      years.add(currentYear);
      return {
        requestingUnit: settings.serviceInfo.serviceName,
        serviceLocation: settings.serviceInfo.serviceLocation,
        manager: settings.financialOfficers.manager,
        ped: settings.financialOfficers.ped,
        measurementUnits: settings.measurementUnits,
        justificationCodes: repository.listRequestJustificationCodes().map((row) => ({
          id: row.id,
          code: row.code,
          description: row.description,
          autoDeleteOwed: Boolean(row.auto_delete_owed)
        })),
        issuingUnits: settings.requestIssuingUnits,
        today: new Date().toISOString().slice(0, 10),
        year: currentYear,
        years: [...years].sort((a, b) => b - a)
      };
    },

    listRequests,

    saveRequest(payload) {
      const request = validateSupplyRequest(payload);
      const validCodes = new Set(repository.listRequestJustificationCodes().map((row) => row.code));
      const invalidCode = request.items.find((item) => !validCodes.has(item.justificationCode));
      if (invalidCode) {
        throw new AppError(`Ο κωδικός αιτιολογίας ${invalidCode.justificationCode} δεν υπάρχει στις Ρυθμίσεις.`, 'VALIDATION_ERROR');
      }

      let requestId;
      let serialNumber;

      repository.transaction(() => {
        serialNumber = repository.getNextSerial(request.year);
        requestId = repository.createRequest({
          ...request,
          serialNumber,
          status: 'Οφειλούμενη'
        });

        for (const item of request.items) {
          repository.createRequestItem(requestId, item);
        }
      });

      return {
        id: requestId,
        serialNumber,
        protocolNumber: formatProtocolNumber(serialNumber, request.protocolNumber),
        message: `Η αίτηση ${formatProtocolNumber(serialNumber, request.protocolNumber)} αποθηκεύτηκε.`
      };
    },

    updateStatus(id, status) {
      if (!['Οφειλούμενη', 'Μερικώς Ικανοποιημένη', 'Ικανοποιήθηκε', 'Ακυρώθηκε', 'Διαγραμμένη'].includes(status)) {
        throw new AppError('Μη έγκυρη κατάσταση αίτησης.', 'VALIDATION_ERROR');
      }

      repository.updateStatus(requirePositiveId(id), status);
      return { ok: true };
    },

    getRenewalCandidates() {
      const fulfillmentByRequest = synchronizeRequestStatuses();
      const currentYear = getCurrentYear();
      const today = new Date().toISOString().slice(0, 10);
      const deadline = `${currentYear}-01-10`;
      const renewedIds = new Set(
        repository.listAllRequests()
          .map((request) => request.renewed_from_request_id)
          .filter(Boolean)
      );

      return repository
        .listAllRequests()
        .filter((request) => {
          const requestYear = Number(request.year || String(request.request_date).slice(0, 4));
          return (
            requestYear < currentYear &&
            !renewedIds.has(request.id) &&
            !['Ικανοποιήθηκε', 'Διαγραμμένη', 'Ακυρώθηκε'].includes(request.status) &&
            (!request.renewal_postponed_until || request.renewal_postponed_until <= today)
          );
        })
        .map((request) => ({
          id: request.id,
          serialNumber: request.serial_number,
          protocolNumber: formatProtocolNumber(request.serial_number, request.protocol_number),
          requestDate: request.request_date,
          status: request.status,
          deadline,
          daysRemaining: Math.max(0, differenceInDays(deadline, today)),
          expired: today > deadline,
          items: repository.listRequestItems(request.id).map((row) =>
            mapItem(row, new Map(), fulfillmentByRequest.get(request.id))
          )
        }));
    },

    postponeRenewal(id) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      repository.postponeRenewal(requirePositiveId(id), tomorrow.toISOString().slice(0, 10));
      return { ok: true };
    },

    renewRequest(id, payload = {}) {
      synchronizeRequestStatuses();
      const sourceId = requirePositiveId(id);
      const source = repository.listAllRequests().find((request) => request.id === sourceId);
      if (!source) {
        throw new AppError('Η αίτηση δεν βρέθηκε.', 'NOT_FOUND');
      }

      const sourceItems = repository.listRequestItems(sourceId);
      const currentYear = getCurrentYear();
      let requestId;
      let serialNumber;

      repository.transaction(() => {
        serialNumber = repository.getNextSerial(currentYear);
        requestId = repository.createRequest({
          year: currentYear,
          serialNumber,
          requestDate: new Date().toISOString().slice(0, 10),
          requestingUnit: source.requesting_unit,
          issuingUnit: source.issuing_unit,
          protocolNumber: String(payload.protocolNumber || '').trim(),
          renewedFromRequestId: sourceId,
          status: 'Οφειλούμενη',
          notes: source.notes || ''
        });

        for (const item of sourceItems) {
          repository.createRequestItem(requestId, {
            nominalNumber: item.nominal_number,
            description: item.description,
            quantity: item.quantity,
            measurementUnit: item.measurement_unit,
            justificationCode: item.justification_code,
            priorityCode: item.priority_code,
            notes: item.notes
          });
        }

        repository.updateStatus(sourceId, 'Διαγραμμένη');
      });

      return {
        id: requestId,
        serialNumber,
        protocolNumber: formatProtocolNumber(serialNumber, payload.protocolNumber),
        message: `Δημιουργήθηκε νέα αίτηση ${formatProtocolNumber(serialNumber, payload.protocolNumber)}.`
      };
    }
  };
}

function formatProtocolNumber(serialNumber, protocolNumber) {
  const protocol = String(protocolNumber || '').trim();
  return protocol ? `Φ.600.14/${serialNumber}/${protocol}` : `Φ.600.14/${serialNumber}`;
}

function loadAllRequestsWithItems(repository) {
  return repository.listAllRequests().map((request) => ({
    ...request,
    items: repository.listRequestItems(request.id).map((item) => ({
      id: item.id,
      nominalNumber: item.nominal_number,
      quantity: Number(item.quantity) || 0
    }))
  }));
}

function calculateFulfillment(repository, requests) {
  const quantitiesByNominal = new Map();
  for (const movement of repository.listFulfillmentMovements()) {
    const nominal = normalize(movement.nominal_number);
    const sign = movement.transaction_type === 'Χρέωση' ? 1 : -1;
    const quantity = Math.max(0, (quantitiesByNominal.get(nominal) || 0) + sign * Number(movement.quantity || 0));
    quantitiesByNominal.set(nominal, quantity);
  }

  const fulfillmentByRequest = new Map();
  for (const request of requests) {
    const fulfilledItems = request.items.map((item) => {
      const nominal = normalize(item.nominalNumber);
      const available = quantitiesByNominal.get(nominal) || 0;
      const fulfilledQuantity = Math.min(item.quantity, Math.max(0, available));
      quantitiesByNominal.set(nominal, Math.max(0, available - fulfilledQuantity));
      return {
        id: item.id,
        quantity: item.quantity,
        fulfilledQuantity
      };
    });
    fulfillmentByRequest.set(request.id, fulfilledItems);
  }

  return fulfillmentByRequest;
}

function mapItem(row, measurementUnitCodes = new Map(), fulfillment = []) {
  const fulfillmentItem = fulfillment.find((item) => item.id === row.id);
  return {
    id: row.id,
    nominalNumber: row.nominal_number,
    description: row.description,
    quantity: row.quantity,
    measurementUnit: row.measurement_unit,
    measurementUnitCode: measurementUnitCodes.get(row.measurement_unit) || row.measurement_unit,
    justificationCode: row.justification_code,
    priorityCode: row.priority_code,
    notes: row.notes,
    fulfilledQuantity: fulfillmentItem ? fulfillmentItem.fulfilledQuantity : 0,
    isFulfilled: fulfillmentItem ? fulfillmentItem.fulfilledQuantity >= Number(row.quantity || 0) : false
  };
}

module.exports = {
  createRequestsService
};
