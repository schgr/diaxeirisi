const { AppError } = require('../core/errorHandler');
const { optionalText, requirePositiveId } = require('../core/validation');

function validateInventorySession(payload) {
  const inventoryDate = optionalText(payload && payload.inventoryDate) || new Date().toISOString().slice(0, 10);
  return {
    inventoryDate,
    fiscalYear: Number(inventoryDate.slice(0, 4)),
    inventoryReason: optionalText(payload && payload.inventoryReason) || 'Τακτική Απογραφή',
    title: optionalText(payload && payload.title) || 'Ετήσια Απογραφή Γενικής Διαχείρισης',
    notes: optionalText(payload && payload.notes),
    committeePresidentRank: optionalText(payload && payload.committeePresidentRank),
    committeePresidentName: optionalText(payload && payload.committeePresidentName),
    committeeMemberARank: optionalText(payload && payload.committeeMemberARank),
    committeeMemberAName: optionalText(payload && payload.committeeMemberAName),
    committeeMemberBRank: optionalText(payload && payload.committeeMemberBRank),
    committeeMemberBName: optionalText(payload && payload.committeeMemberBName)
  };
}

function validateInventoryCount(payload) {
  const firstCount = requireCount(payload && payload.firstCount, 'Πρώτη καταμέτρηση');
  const secondValue = payload && payload.secondCount;
  const secondText = secondValue === null || secondValue === undefined ? '' : String(secondValue).trim();
  const secondCount = secondText === '' ? null : requireCount(secondText, 'Δεύτερη καταμέτρηση');

  return {
    sessionId: requirePositiveId(payload && payload.sessionId, 'Απογραφή'),
    shareId: requirePositiveId(payload && payload.shareId, 'Μερίδα'),
    firstCount,
    secondCount,
    notes: optionalText(payload && payload.notes)
  };
}

function validateInventoryCommittee(payload) {
  return {
    committeePresidentRank: optionalText(payload && payload.committeePresidentRank),
    committeePresidentName: optionalText(payload && payload.committeePresidentName),
    committeeMemberARank: optionalText(payload && payload.committeeMemberARank),
    committeeMemberAName: optionalText(payload && payload.committeeMemberAName),
    committeeMemberBRank: optionalText(payload && payload.committeeMemberBRank),
    committeeMemberBName: optionalText(payload && payload.committeeMemberBName)
  };
}

function requireCount(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new AppError(`Το πεδίο "${fieldName}" πρέπει να είναι μη αρνητικός αριθμός.`, 'VALIDATION_ERROR');
  }
  return number;
}

module.exports = {
  validateInventoryCommittee,
  validateInventoryCount,
  validateInventorySession
};
