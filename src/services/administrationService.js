const { AppError } = require('../core/errorHandler');
const { optionalText, requirePositiveId } = require('../core/validation');
const { createAdministrationRepository } = require('../db/administrationRepository');
const {
  OFFICER_ROLES,
  requireDate,
  validateArchive,
  validateHandover,
  validateOfficerTerm
} = require('../administration/administrationValidation');

const HANDOVER_CHECKS = [
  { key: 'documents', label: 'Παραδόθηκαν τα βιβλία, ευρετήρια και δικαιολογητικά της Διαχείρισης.' },
  { key: 'movements', label: 'Καταχωρίστηκαν όλες οι εξωτερικές και εσωτερικές διακινήσεις.' },
  { key: 'inventory', label: 'Ολοκληρώθηκε η απογραφή των υλικών της Γενικής Διαχείρισης.' },
  { key: 'differences', label: 'Οι διαφορές απογραφής καταγράφηκαν και παραπέμφθηκαν για τακτοποίηση.' },
  { key: 'partials', label: 'Συμφωνούν οι χρεώσεις των Μερικών Διαχειρίσεων με τη Γενική Διαχείριση.' },
  { key: 'pending', label: 'Καταγράφηκαν οι εκκρεμείς αιτήσεις, δοσοληψίες και δικαιολογητικά.' },
  { key: 'storage', label: 'Παραδόθηκαν οι χώροι, τα υλικά, τα κλειδιά και τα μέσα ασφαλείας.' }
];

function createAdministrationService(db) {
  const repository = createAdministrationRepository(db);

  return {
    getReferenceData() {
      const recordedOfficers = repository.listOfficerTerms().map(mapOfficer);
      const partialManagers = repository.listDepartmentManagers();
      const syntheticPartials = partialManagers
        .filter((manager) => !recordedOfficers.some((officer) =>
          officer.roleType === `Μερικός Διαχειριστής - ${manager.department_name}` &&
          officer.active
        ))
        .map((manager) => ({
          id: `partial-${manager.id}`,
          roleType: `Μερικός Διαχειριστής - ${manager.department_name}`,
          fullIdentity: manager.department_head,
          rank: '',
          corps: '',
          registryNumber: '',
          startDate: '',
          endDate: '',
          assignmentOrder: '',
          reliefOrder: '',
          differencesLedgerReference: '',
          orderReference: '',
          notes: 'Αυτόματη εγγραφή από τις Ρυθμίσεις',
          active: true,
          synthetic: true
        }));
      return {
        today: new Date().toISOString().slice(0, 10),
        officerRoles: [
          ...OFFICER_ROLES,
          ...partialManagers.map((manager) => `Μερικός Διαχειριστής - ${manager.department_name}`)
        ],
        officers: [...recordedOfficers, ...syntheticPartials],
        handovers: repository.listHandovers().map(mapHandover),
        inventories: repository.listCompletedInventories().map(mapInventory),
        activeShares: repository.listSharesByArchiveStatus('Ενεργή').map(mapShare),
        archivedShares: repository.listSharesByArchiveStatus('Αρχειοθετημένη').map(mapShare)
      };
    },

    addOfficerTerm(payload) {
      const term = validateOfficerTerm(payload);
      const duplicate = repository.listOfficerTerms().find(
        (item) => item.role_type === term.roleType && item.end_date === null
      );
      if (duplicate) {
        throw new AppError(
          `Υπάρχει ήδη ενεργή θητεία για την ιδιότητα "${term.roleType}". Κλείσε πρώτα την προηγούμενη.`,
          'VALIDATION_ERROR'
        );
      }
      const id = repository.createOfficerTerm(term);
      return { id, message: 'Η ανάληψη καθηκόντων καταχωρίστηκε.' };
    },

    closeOfficerTerm(id, endDate) {
      const officerId = requirePositiveId(id);
      const date = requireDate(endDate, 'Ημερομηνία παράδοσης');
      const officer = repository.listOfficerTerms().find((item) => item.id === officerId);
      if (!officer) throw new AppError('Η εγγραφή οργάνου δεν βρέθηκε.', 'NOT_FOUND');
      if (officer.end_date) {
        throw new AppError('Η θητεία έχει ήδη ολοκληρωθεί.', 'VALIDATION_ERROR');
      }
      if (date < officer.start_date) {
        throw new AppError('Η ημερομηνία παράδοσης προηγείται της ανάληψης.', 'VALIDATION_ERROR');
      }
      repository.closeOfficerTerm(officerId, date);
      return { message: 'Η θητεία ολοκληρώθηκε.' };
    },

    createHandover(payload) {
      const handover = validateHandover(payload);
      let id;
      repository.transaction(() => {
        const serialNumber = repository.getNextHandoverSerial(handover.fiscalYear);
        id = repository.createHandover({ ...handover, serialNumber });
        HANDOVER_CHECKS.forEach((check) => repository.insertHandoverCheck(id, check));
      });
      return { id, message: 'Το πρωτόκολλο παράδοσης δημιουργήθηκε.' };
    },

    getHandover(id) {
      const handoverId = requirePositiveId(id);
      const handover = repository.getHandover(handoverId);
      if (!handover) throw new AppError('Το πρωτόκολλο παράδοσης δεν βρέθηκε.', 'NOT_FOUND');
      return {
        ...mapHandover(handover),
        checks: repository.listHandoverChecks(handoverId).map(mapCheck)
      };
    },

    updateHandoverCheck(id, payload) {
      const checkId = requirePositiveId(id);
      repository.updateHandoverCheck(
        checkId,
        Boolean(payload && payload.completed),
        optionalText(payload && payload.notes)
      );
      return { message: 'Ο έλεγχος ενημερώθηκε.' };
    },

    updateHandoverProtocol(id, payload) {
      const handoverId = requirePositiveId(id);
      const handover = repository.getHandover(handoverId);
      if (!handover) throw new AppError('Το πρωτόκολλο παράδοσης δεν βρέθηκε.', 'NOT_FOUND');
      repository.updateHandoverProtocol(handoverId, normalizeHandoverProtocol(payload));
      return { message: 'Τα στοιχεία του εντύπου ΕΦΕΔ 500 αποθηκεύτηκαν.' };
    },

    completeHandover(id, payload) {
      const handoverId = requirePositiveId(id);
      const handover = repository.getHandover(handoverId);
      if (!handover) throw new AppError('Το πρωτόκολλο παράδοσης δεν βρέθηκε.', 'NOT_FOUND');
      if (handover.status === 'Ολοκληρωμένη') {
        throw new AppError('Η παράδοση έχει ήδη ολοκληρωθεί.', 'VALIDATION_ERROR');
      }
      const checks = repository.listHandoverChecks(handoverId);
      if (checks.some((check) => !check.completed)) {
        throw new AppError('Πρέπει να ολοκληρωθούν όλοι οι έλεγχοι πριν κλείσει η παράδοση.', 'VALIDATION_ERROR');
      }
      if (!handover.inventory_session_id) {
        throw new AppError('Για την ολοκλήρωση απαιτείται συνδεδεμένη ολοκληρωμένη απογραφή.', 'VALIDATION_ERROR');
      }
      const completionDate = requireDate(payload && payload.completionDate, 'Ημερομηνία ολοκλήρωσης');
      if (completionDate < handover.start_date) {
        throw new AppError('Η ολοκλήρωση δεν μπορεί να προηγείται της έναρξης.', 'VALIDATION_ERROR');
      }
      repository.completeHandover(handoverId, {
        completionDate,
        outgoingObservations: optionalText(payload.outgoingObservations),
        incomingObservations: optionalText(payload.incomingObservations)
      });
      return { message: 'Η παράδοση της Γενικής Διαχείρισης ολοκληρώθηκε και κλειδώθηκε.' };
    },

    archiveShare(payload) {
      const archive = validateArchive(payload);
      const share = repository.getShare(archive.shareId);
      if (!share) throw new AppError('Η Μερίδα δεν βρέθηκε.', 'NOT_FOUND');
      if (share.archive_status === 'Αρχειοθετημένη') {
        throw new AppError('Η Μερίδα είναι ήδη αρχειοθετημένη.', 'VALIDATION_ERROR');
      }
      if (Number(share.accounting_balance) !== 0 || Number(share.charged_quantity) !== 0) {
        throw new AppError(
          'Η Μερίδα μπορεί να αρχειοθετηθεί μόνο όταν το λογιστικό και το χρεωμένο υπόλοιπο είναι μηδέν.',
          'INSUFFICIENT_BALANCE'
        );
      }
      repository.transaction(() => {
        repository.setShareArchiveStatus(archive.shareId, 'Αρχειοθετημένη', archive.actionDate, archive.reason);
        repository.createArchiveEvent(archive.shareId, 'Αρχειοθέτηση', archive.actionDate, archive.reason);
      });
      return { message: 'Η Μερίδα μεταφέρθηκε στο αρχείο.' };
    },

    restoreShare(id, actionDate) {
      const shareId = requirePositiveId(id);
      const date = requireDate(actionDate, 'Ημερομηνία επαναφοράς');
      const share = repository.getShare(shareId);
      if (!share) throw new AppError('Η Μερίδα δεν βρέθηκε.', 'NOT_FOUND');
      if (share.archive_status !== 'Αρχειοθετημένη') {
        throw new AppError('Η Μερίδα είναι ήδη ενεργή.', 'VALIDATION_ERROR');
      }
      repository.transaction(() => {
        repository.setShareArchiveStatus(shareId, 'Ενεργή', null, '');
        repository.createArchiveEvent(shareId, 'Επαναφορά', date, 'Επαναφορά σε ενεργή χρήση');
      });
      return { message: 'Η Μερίδα επανήλθε στις ενεργές Μερίδες.' };
    }
  };
}

function mapOfficer(row) {
  return {
    id: row.id,
    roleType: row.role_type,
    fullIdentity: row.full_identity,
    rank: row.rank || '',
    corps: row.corps || '',
    registryNumber: row.registry_number || '',
    startDate: row.start_date,
    endDate: row.end_date || '',
    orderReference: row.order_reference,
    assignmentOrder: row.assignment_order || row.order_reference || '',
    reliefOrder: row.relief_order || '',
    differencesLedgerReference: row.differences_ledger_reference || '',
    notes: row.notes,
    active: row.end_date === null
  };
}

function mapHandover(row) {
  return {
    id: row.id,
    fiscalYear: row.fiscal_year,
    serialNumber: row.serial_number,
    orderReference: row.order_reference,
    startDate: row.start_date,
    completionDate: row.completion_date || '',
    outgoingOfficer: row.outgoing_officer,
    incomingOfficer: row.incoming_officer,
    inventorySessionId: row.inventory_session_id,
    inventoryReference: row.inventory_serial
      ? `${row.inventory_serial}`
      : '',
    pendingDocuments: row.pending_documents,
    outgoingObservations: row.outgoing_observations,
    incomingObservations: row.incoming_observations,
    protocolData: parseProtocolData(row.protocol_data),
    status: row.status,
    checkCount: Number(row.check_count || 0),
    completedCheckCount: Number(row.completed_check_count || 0)
  };
}

function normalizeHandoverProtocol(payload = {}) {
  const textFields = [
    'place', 'assignmentEndDate', 'inventoryStatementDate', 'shareRangeFrom', 'shareRangeTo',
    'sampleCountingDetails', 'samplePercentageWords', 'samplePercentageNumber',
    'surplusesReference', 'deficitsReference', 'inventoryInspectionReference',
    'inventoryInspectionDate', 'inventoryInspectionType', 'financialInspectionReference',
    'financialInspectionDate', 'financialInspectionType', 'separateStorageDescription',
    'highValueSecurity', 'fuelSecurity', 'managementPending', 'receivingObservations',
    'outgoingObservations', 'inventoryCommitteePresident', 'generalManagerAssistants',
    'accountingSupervisor'
  ];
  const normalized = Object.fromEntries(
    textFields.map((field) => [field, optionalText(payload[field])])
  );
  normalized.fullCountCompleted = Boolean(payload.fullCountCompleted);
  normalized.separateStorage = ['yes', 'no'].includes(payload.separateStorage)
    ? payload.separateStorage
    : '';
  normalized.assistants = Array.isArray(payload.assistants)
    ? payload.assistants.slice(0, 3).map((assistant) => ({
        rank: optionalText(assistant && assistant.rank),
        name: optionalText(assistant && assistant.name),
        categories: optionalText(assistant && assistant.categories),
        shareRangeFrom: optionalText(assistant && assistant.shareRangeFrom),
        shareRangeTo: optionalText(assistant && assistant.shareRangeTo)
      }))
    : [];
  return normalized;
}

function parseProtocolData(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function mapCheck(row) {
  return {
    id: row.id,
    key: row.check_key,
    label: row.label,
    completed: Boolean(row.completed),
    notes: row.notes
  };
}

function mapInventory(row) {
  return {
    id: row.id,
    fiscalYear: row.fiscal_year,
    serialNumber: row.serial_number,
    inventoryDate: row.inventory_date,
    title: row.title
  };
}

function mapShare(row) {
  return {
    id: row.id,
    shareNumber: row.share_number,
    nominalNumber: row.nominal_number,
    description: row.description,
    measurementUnit: row.measurement_unit,
    accountingBalance: Number(row.accounting_balance),
    chargedQuantity: Number(row.charged_quantity),
    archiveStatus: row.archive_status,
    archivedAt: row.archived_at || '',
    archiveReason: row.archive_reason
  };
}

module.exports = {
  HANDOVER_CHECKS,
  createAdministrationService
};
