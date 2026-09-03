const { AppError } = require('../core/errorHandler');
const { optionalText, requirePositiveId, requireText } = require('../core/validation');

const OFFICER_ROLES = [
  'Διοικητής',
  'Π.Ε.Δ',
  'Γενικός Διαχειριστής',
  'Βοηθός Γενικού Διαχειριστή'
];

function requireDate(value, fieldName) {
  const date = requireText(value, fieldName);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError(`Το πεδίο "${fieldName}" δεν έχει έγκυρη ημερομηνία.`, 'VALIDATION_ERROR');
  }
  return date;
}

function validateOfficerTerm(payload) {
  const roleType = requireText(payload && payload.roleType, 'Ιδιότητα');
  if (!OFFICER_ROLES.includes(roleType) && !roleType.startsWith('Μερικός Διαχειριστής')) {
    throw new AppError('Η ιδιότητα του οργάνου δεν είναι έγκυρη.', 'VALIDATION_ERROR');
  }
  return {
    roleType,
    fullIdentity: requireText(payload.fullIdentity, 'Βαθμός και ονοματεπώνυμο'),
    rank: optionalText(payload.rank),
    corps: optionalText(payload.corps),
    registryNumber: optionalText(payload.registryNumber),
    startDate: requireDate(payload.startDate, 'Ημερομηνία ανάληψης'),
    orderReference: optionalText(payload.assignmentOrder || payload.orderReference),
    assignmentOrder: optionalText(payload.assignmentOrder || payload.orderReference),
    reliefOrder: optionalText(payload.reliefOrder),
    differencesLedgerReference: optionalText(payload.differencesLedgerReference),
    notes: optionalText(payload.notes)
  };
}

function validateHandover(payload) {
  const startDate = requireDate(payload && payload.startDate, 'Ημερομηνία έναρξης');
  return {
    fiscalYear: Number(startDate.slice(0, 4)),
    startDate,
    orderReference: requireText(payload.orderReference, 'Διαταγή παράδοσης'),
    outgoingOfficer: requireText(payload.outgoingOfficer, 'Παραδίδων'),
    incomingOfficer: requireText(payload.incomingOfficer, 'Παραλαμβάνων'),
    inventorySessionId: payload.inventorySessionId
      ? requirePositiveId(payload.inventorySessionId, 'Απογραφή')
      : null,
    pendingDocuments: optionalText(payload.pendingDocuments)
  };
}

function validateArchive(payload) {
  const actionDate = requireDate(payload.actionDate, 'Ημερομηνία');
  if (!actionDate.endsWith('-12-31')) {
    throw new AppError('Η αρχειοθέτηση Μερίδας γίνεται μόνο στις 31/12 του αντίστοιχου οικονομικού έτους.', 'ARCHIVE_DATE_INVALID');
  }
  return {
    shareId: requirePositiveId(payload && payload.shareId, 'Μερίδα'),
    actionDate,
    reason: requireText(payload.reason, 'Αιτιολογία αρχειοθέτησης')
  };
}

module.exports = {
  OFFICER_ROLES,
  requireDate,
  validateArchive,
  validateHandover,
  validateOfficerTerm
};
