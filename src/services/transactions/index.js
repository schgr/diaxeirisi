const { transactionSections } = require('../../transactions/transactionSections');
const { createTransactionsRepository } = require('../../db/transactionsRepository');
const { validateAddy } = require('../../transactions/addyValidation');
const { validateExhp, isNominalNumberTransferReason } = require('../../transactions/exhpValidation');
const { requirePositiveId } = require('../../core/validation');
const { createTransactionQueryService } = require('./transactionQueryService');
const { createAddyService } = require('./addyService');
const { createExhpService } = require('./exhpService');
const { createIndexRegistryService } = require('./indexRegistryService');
const shared = require('./shared');

function createTransactionsService(db, settingsService) {
  const repository = createTransactionsRepository(db);
  const dependencies = {
    repository,
    settingsService,
    transactionSections,
    validateAddy,
    validateExhp,
    isNominalNumberTransferReason,
    requirePositiveId,
    shared
  };
  const query = createTransactionQueryService(dependencies);
  const addy = createAddyService(dependencies);
  const exhp = createExhpService(dependencies);
  const indexes = createIndexRegistryService(dependencies);

  return {
    getStructure: query.getStructure,
    getAddyReferenceData: query.getAddyReferenceData,
    suggestShareNumber: query.suggestShareNumber,
    saveAddy: addy.saveAddy,
    saveAddyDepartmentAllocations: addy.saveAddyDepartmentAllocations,
    saveExhp: exhp.saveExhp,
    listExhpDocuments: exhp.listExhpDocuments,
    getExhpDocument: exhp.getExhpDocument,
    updateExhpMetadata: exhp.updateExhpMetadata,
    deleteExhpDocument: exhp.deleteExhpDocument,
    updateExhpOtherSupportDocument: exhp.updateExhpOtherSupportDocument,
    updateExhpIndexFields: indexes.updateExhpIndexFields,
    updateAddyIndexFields: indexes.updateAddyIndexFields,
    updateExhpSupport: exhp.updateExhpSupport,
    saveExhpSupportForm: exhp.saveExhpSupportForm,
    listExhpIndexRows: indexes.listExhpIndexRows,
    listFinancialYearMovementRows: indexes.listFinancialYearMovementRows,
    listAddyDocuments: addy.listAddyDocuments,
    updateAddyDocument: addy.updateAddyDocument,
    deleteAddyDocument: addy.deleteAddyDocument,
    getAddyDocument: addy.getAddyDocument,
    listExternalTransactionIndexRows: indexes.listExternalTransactionIndexRows
  };
}

module.exports = { createTransactionsService };
