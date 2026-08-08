'use strict';

const CHANNELS = Object.freeze([
  "transactions:get-structure",
  "transactions:addy-reference-data",
  "transactions:suggest-share-number",
  "transactions:save-addy",
  "transactions:save-addy-department-allocations",
  "transactions:external-index-rows",
  "transactions:update-addy-index-fields",
  "transactions:addy-documents",
  "transactions:get-addy-document",
  "transactions:update-addy",
  "transactions:delete-addy",
  "transactions:save-exhp",
  "transactions:exhp-documents",
  "transactions:get-exhp-document",
  "transactions:update-exhp-metadata",
  "transactions:delete-exhp",
  "transactions:update-exhp-support",
  "transactions:update-exhp-other-support",
  "transactions:save-exhp-support-form",
  "transactions:update-exhp-index-fields",
  "transactions:exhp-index-rows",
  "transactions:financial-year-movements",
  "exhp-docs:get-by-exhp",
  "exhp-docs:create",
  "exhp-docs:delete",
  "exhp-docs:save-useless-a",
  "exhp-docs:get-useless-a",
  "exhp-docs:save-useless-b",
  "exhp-docs:get-useless-b",
  "exhp-docs:save-ammo",
  "exhp-docs:get-ammo",
  "exhp-docs:save-generic",
  "exhp-docs:get-generic",
  "exhp-docs:get-useless-statements",
  "exhp-docs:save-useless-statement",
  "clothing:get-items",
  "clothing:add-item",
  "clothing:update-item",
  "clothing:delete-item",
  "clothing:get-distributions",
  "clothing:save-distribution",
  "clothing:delete-distribution",
  "clothing:get-summary"
]);

function registerTransactionsHandlers({
  register,
  safeInvoke,
  services
}) {
  register('transactions:get-structure', async () =>
      safeInvoke(() => services.transactions.getStructure())
    );
  register('transactions:addy-reference-data', async () =>
      safeInvoke(() => services.transactions.getAddyReferenceData())
    );
  register('transactions:suggest-share-number', async (_event, materialType) =>
      safeInvoke(() => services.transactions.suggestShareNumber(materialType))
    );
  register('transactions:save-addy', async (_event, payload) =>
      safeInvoke(() => services.transactions.saveAddy(payload))
    );
  register('transactions:save-addy-department-allocations', async (_event, documentId, payload) =>
      safeInvoke(() => services.transactions.saveAddyDepartmentAllocations(documentId, payload))
    );
  register('transactions:external-index-rows', async (_event, year) =>
      safeInvoke(() => services.transactions.listExternalTransactionIndexRows(year))
    );
  register('transactions:update-addy-index-fields', async (_event, documentId, payload) =>
      safeInvoke(() => services.transactions.updateAddyIndexFields(documentId, payload))
    );
  register('transactions:addy-documents', async () =>
      safeInvoke(() => services.transactions.listAddyDocuments())
    );
  register('transactions:get-addy-document', async (_event, id) =>
      safeInvoke(() => services.transactions.getAddyDocument(id))
    );
  register('transactions:update-addy', async (_event, id, payload) =>
      safeInvoke(() => services.transactions.updateAddyDocument(id, payload))
    );
  register('transactions:delete-addy', async (_event, id) =>
      safeInvoke(() => services.transactions.deleteAddyDocument(id))
    );
  register('transactions:save-exhp', async (_event, payload) =>
      safeInvoke(() => services.transactions.saveExhp(payload))
    );
  register('transactions:exhp-documents', async () =>
      safeInvoke(() => services.transactions.listExhpDocuments())
    );
  register('transactions:get-exhp-document', async (_event, id) =>
      safeInvoke(() => services.transactions.getExhpDocument(id))
    );
  register('transactions:update-exhp-metadata', async (_event, id, payload) =>
      safeInvoke(() => services.transactions.updateExhpMetadata(id, payload))
    );
  register('transactions:delete-exhp', async (_event, id) =>
      safeInvoke(() => services.transactions.deleteExhpDocument(id))
    );
  register('transactions:update-exhp-support', async (_event, documentId, supportId, payload) =>
      safeInvoke(() => services.transactions.updateExhpSupport(documentId, supportId, payload))
    );
  register('transactions:update-exhp-other-support', async (_event, documentId, value) =>
      safeInvoke(() => services.transactions.updateExhpOtherSupportDocument(documentId, value))
    );
  register('transactions:save-exhp-support-form', async (_event, documentId, supportId, payload) =>
      safeInvoke(() => services.transactions.saveExhpSupportForm(documentId, supportId, payload))
    );
  register('transactions:update-exhp-index-fields', async (_event, documentId, payload) =>
      safeInvoke(() => services.transactions.updateExhpIndexFields(documentId, payload))
    );
  register('transactions:exhp-index-rows', async (_event, year) =>
      safeInvoke(() => services.transactions.listExhpIndexRows(year))
    );
  register('transactions:financial-year-movements', async (_event, source, year, transactionType) =>
      safeInvoke(() => services.transactions.listFinancialYearMovementRows(source, year, transactionType))
    );
  register('exhp-docs:get-by-exhp', async (_event, exhpId) =>
      safeInvoke(() => services.exhpDocs.getDocumentsForExhp(exhpId))
    );
  register('exhp-docs:create', async (_event, exhpId, documentType) =>
      safeInvoke(() => services.exhpDocs.createDocument(exhpId, documentType))
    );
  register('exhp-docs:delete', async (_event, documentId) =>
      safeInvoke(() => services.exhpDocs.deleteDocument(documentId))
    );
  register('exhp-docs:save-useless-a', async (_event, documentId, payload) =>
      safeInvoke(() => services.exhpDocs.saveUselessA(documentId, payload))
    );
  register('exhp-docs:get-useless-a', async (_event, documentId) =>
      safeInvoke(() => services.exhpDocs.getUselessA(documentId))
    );
  register('exhp-docs:save-useless-b', async (_event, documentId, payload) =>
      safeInvoke(() => services.exhpDocs.saveUselessB(documentId, payload))
    );
  register('exhp-docs:get-useless-b', async (_event, documentId) =>
      safeInvoke(() => services.exhpDocs.getUselessB(documentId))
    );
  register('exhp-docs:save-ammo', async (_event, documentId, payload) =>
      safeInvoke(() => services.exhpDocs.saveAmmo(documentId, payload))
    );
  register('exhp-docs:get-ammo', async (_event, documentId) =>
      safeInvoke(() => services.exhpDocs.getAmmo(documentId))
    );
  register('exhp-docs:save-generic', async (_event, documentId, payload) =>
      safeInvoke(() => services.exhpDocs.saveGeneric(documentId, payload))
    );
  register('exhp-docs:get-generic', async (_event, documentId) =>
      safeInvoke(() => services.exhpDocs.getGeneric(documentId))
    );
  register('exhp-docs:get-useless-statements', async (_event, exhpId) =>
      safeInvoke(() => services.exhpDocs.getUselessStatements(exhpId))
    );
  register('exhp-docs:save-useless-statement', async (_event, exhpId, formKey, payload) =>
      safeInvoke(() => services.exhpDocs.saveUselessStatement(exhpId, formKey, payload))
    );
  register('clothing:get-items', async () =>
      safeInvoke(() => services.clothing.getClothingItems())
    );
  register('clothing:add-item', async (_event, payload) =>
      safeInvoke(() => services.clothing.addClothingItem(payload))
    );
  register('clothing:update-item', async (_event, id, payload) =>
      safeInvoke(() => services.clothing.updateClothingItem(id, payload))
    );
  register('clothing:delete-item', async (_event, id) =>
      safeInvoke(() => services.clothing.deleteClothingItem(id))
    );
  register('clothing:get-distributions', async (_event, exhpId) =>
      safeInvoke(() => services.clothing.getDistributionsForExhp(exhpId))
    );
  register('clothing:save-distribution', async (_event, exhpId, distributionType, payload) =>
      safeInvoke(() => services.clothing.saveDistribution(exhpId, distributionType, payload))
    );
  register('clothing:delete-distribution', async (_event, id) =>
      safeInvoke(() => services.clothing.deleteDistribution(id))
    );
  register('clothing:get-summary', async (_event, month, year) =>
      safeInvoke(() => services.clothing.getSummary(month, year))
    );
}

module.exports = {
  CHANNELS,
  registerTransactionsHandlers
};
