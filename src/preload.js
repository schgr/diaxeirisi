const { contextBridge, ipcRenderer } = require('electron');

async function invoke(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args);
  if (!result.ok) {
    throw result.error;
  }
  return result.data;
}

contextBridge.exposeInMainWorld('appApi', {
  app: {
    getVersion: () => invoke('app:get-version')
  },
  auth: {
    status: () => invoke('auth:status'),
    setup: (username, password, confirmation, securityQuestions) =>
      invoke('auth:setup', username, password, confirmation, securityQuestions),
    login: (username, password) => invoke('auth:login', username, password),
    changePassword: (currentPassword, newPassword, confirmation) =>
      invoke('auth:change-password', currentPassword, newPassword, confirmation),
    changeCredentials: (currentPassword, username, newPassword, confirmation) =>
      invoke('auth:change-credentials', currentPassword, username, newPassword, confirmation),
    createRecoveryCode: () => invoke('auth:create-recovery-code'),
    changeSecurityQuestions: (currentPassword, questions) =>
      invoke('auth:change-security-questions', currentPassword, questions),
    answerSecurityQuestions: (answers) => invoke('auth:answer-security-questions', answers),
    recover: (recoveryCode, username, newPassword, confirmation) =>
      invoke('auth:recover', recoveryCode, username, newPassword, confirmation),
    lock: () => invoke('auth:lock')
  },
  backup: {
    list: () => invoke('backup:list'),
    createAutomatic: () => invoke('backup:create-automatic'),
    createManual: () => invoke('backup:create-manual'),
    restore: () => invoke('backup:restore')
  },
  windowControls: {
    setFullscreen: (value) => invoke('window:set-fullscreen', value),
    minimize: () => invoke('window:minimize'),
    quit: () => invoke('window:quit')
  },
  print: {
    currentDocument: (options) => invoke('print:current-document', options)
  },
  export: {
    document: (format, payload) => invoke('export:document', format, payload)
  },
  shares: {
    list: () => invoke('shares:list'),
    getShareByNumber: (shareNumber) => invoke('shares:get-by-number', shareNumber),
    add: (payload) => invoke('shares:add', payload),
    getCard: (id, year) => invoke('shares:get-card', id, year),
    listMovedCards: (year) => invoke('shares:list-moved-cards', year),
    updateDetails: (id, payload) => invoke('shares:update-details', id, payload),
    listSerialRegistry: () => invoke('shares:list-serial-registry'),
    saveSerialNumbers: (id, entries) => invoke('shares:save-serial-numbers', id, entries),
    listAmmunitionBatchRegistry: () => invoke('shares:list-ammunition-batch-registry'),
    saveAmmunitionBatches: (id, entries) => invoke('shares:save-ammunition-batches', id, entries),
    saveComposition: (id, items) => invoke('shares:save-composition', id, items),
    saveChangeSheet: (id, entries) => invoke('shares:save-change-sheet', id, entries),
    choosePhoto: () => invoke('shares:choose-photo')
  },
  settings: {
    get: () => invoke('settings:get'),
    downloadInitialInventoryTemplate: () =>
      invoke('settings:download-initial-inventory-template'),
    importInitialInventory: (inventoryDate) =>
      invoke('settings:import-initial-inventory', inventoryDate),
    downloadCompositionTemplate: () => invoke('settings:download-composition-template'),
    importCompositions: () => invoke('settings:import-compositions'),
    saveServiceInfo: (payload) => invoke('settings:save-service', payload),
    saveFinancialOfficers: (payload) => invoke('settings:save-financial-officers', payload),
    saveAuditSettings: (payload) => invoke('settings:save-audit', payload),
    addDepartmentManager: (payload) => invoke('settings:add-department-manager', payload),
    updateDepartmentManager: (id, payload) =>
      invoke('settings:update-department-manager', id, payload),
    deleteDepartmentManager: (id) => invoke('settings:delete-department-manager', id),
    addRank: (payload) => invoke('settings:add-rank', payload),
    updateRank: (id, payload) => invoke('settings:update-rank', id, payload),
    deleteRank: (id) => invoke('settings:delete-rank', id),
    addMeasurementUnit: (payload) => invoke('settings:add-measurement-unit', payload),
    updateMeasurementUnit: (id, payload) =>
      invoke('settings:update-measurement-unit', id, payload),
    deleteMeasurementUnit: (id) => invoke('settings:delete-measurement-unit', id),
    addTransactionUnit: (payload) => invoke('settings:add-transaction-unit', payload),
    updateTransactionUnit: (id, payload) =>
      invoke('settings:update-transaction-unit', id, payload),
    deleteTransactionUnit: (id) => invoke('settings:delete-transaction-unit', id),
    addMaterialCategory: (payload) => invoke('settings:add-material-category', payload),
    updateMaterialCategory: (id, payload) =>
      invoke('settings:update-material-category', id, payload),
    deleteMaterialCategory: (id) => invoke('settings:delete-material-category', id),
    addRequestIssuingUnit: (payload) => invoke('settings:add-request-issuing-unit', payload),
    updateRequestIssuingUnit: (id, payload) =>
      invoke('settings:update-request-issuing-unit', id, payload),
    deleteRequestIssuingUnit: (id) => invoke('settings:delete-request-issuing-unit', id),
    addExhpIssueReason: (payload) => invoke('settings:add-exhp-issue-reason', payload),
    updateExhpIssueReasonTexts: (id, payload) =>
      invoke('settings:update-exhp-issue-reason-texts', id, payload),
    deleteExhpIssueReason: (id) => invoke('settings:delete-exhp-issue-reason', id)
  },
  transactions: {
    getStructure: () => invoke('transactions:get-structure'),
    getAddyReferenceData: () => invoke('transactions:addy-reference-data'),
    suggestShareNumber: (materialType) => invoke('transactions:suggest-share-number', materialType),
    saveAddy: (payload) => invoke('transactions:save-addy', payload),
    listExternalIndexRows: (year) => invoke('transactions:external-index-rows', year),
    updateAddyIndexFields: (documentId, payload) =>
      invoke('transactions:update-addy-index-fields', documentId, payload),
    listAddyDocuments: () => invoke('transactions:addy-documents'),
    getAddyDocument: (id) => invoke('transactions:get-addy-document', id),
    updateAddy: (id, payload) => invoke('transactions:update-addy', id, payload),
    deleteAddy: (id) => invoke('transactions:delete-addy', id),
    saveExhp: (payload) => invoke('transactions:save-exhp', payload),
    listExhpDocuments: () => invoke('transactions:exhp-documents'),
    getExhpDocument: (id) => invoke('transactions:get-exhp-document', id),
    updateExhpMetadata: (id, payload) => invoke('transactions:update-exhp-metadata', id, payload),
    deleteExhp: (id) => invoke('transactions:delete-exhp', id),
    updateExhpSupport: (documentId, supportId, payload) =>
      invoke('transactions:update-exhp-support', documentId, supportId, payload),
    updateExhpOtherSupport: (documentId, value) =>
      invoke('transactions:update-exhp-other-support', documentId, value),
    saveExhpSupportForm: (documentId, supportId, payload) =>
      invoke('transactions:save-exhp-support-form', documentId, supportId, payload),
    updateExhpIndexFields: (documentId, payload) =>
      invoke('transactions:update-exhp-index-fields', documentId, payload),
    listExhpIndexRows: (year) => invoke('transactions:exhp-index-rows', year),
    listFinancialYearMovementRows: (source, year, transactionType) =>
      invoke('transactions:financial-year-movements', source, year, transactionType)
  },
  exhpDocs: {
    getByExhp: (exhpId) => invoke('exhp-docs:get-by-exhp', exhpId),
    create: (exhpId, documentType) => invoke('exhp-docs:create', exhpId, documentType),
    delete: (documentId) => invoke('exhp-docs:delete', documentId),
    saveUselessA: (documentId, payload) =>
      invoke('exhp-docs:save-useless-a', documentId, payload),
    getUselessA: (documentId) => invoke('exhp-docs:get-useless-a', documentId),
    saveUselessB: (documentId, payload) =>
      invoke('exhp-docs:save-useless-b', documentId, payload),
    getUselessB: (documentId) => invoke('exhp-docs:get-useless-b', documentId),
    saveAmmo: (documentId, payload) => invoke('exhp-docs:save-ammo', documentId, payload),
    getAmmo: (documentId) => invoke('exhp-docs:get-ammo', documentId),
    saveGeneric: (documentId, payload) =>
      invoke('exhp-docs:save-generic', documentId, payload),
    getGeneric: (documentId) => invoke('exhp-docs:get-generic', documentId),
    getUselessStatements: (exhpId) => invoke('exhp-docs:get-useless-statements', exhpId),
    saveUselessStatement: (exhpId, formKey, payload) =>
      invoke('exhp-docs:save-useless-statement', exhpId, formKey, payload)
  },
  clothing: {
    getItems: () => invoke('clothing:get-items'),
    addItem: (payload) => invoke('clothing:add-item', payload),
    updateItem: (id, payload) => invoke('clothing:update-item', id, payload),
    deleteItem: (id) => invoke('clothing:delete-item', id),
    getDistributions: (exhpId) => invoke('clothing:get-distributions', exhpId),
    saveDistribution: (exhpId, distributionType, payload) =>
      invoke('clothing:save-distribution', exhpId, distributionType, payload),
    deleteDistribution: (id) => invoke('clothing:delete-distribution', id),
    getSummary: (month, year) => invoke('clothing:get-summary', month, year)
  },
  requests: {
    getReferenceData: () => invoke('requests:reference-data'),
    list: (year) => invoke('requests:list', year),
    save: (payload) => invoke('requests:save', payload),
    updateStatus: (id, status) => invoke('requests:update-status', id, status),
    getRenewalCandidates: () => invoke('requests:renewal-candidates'),
    postponeRenewal: (id) => invoke('requests:postpone-renewal', id),
    renew: (id, payload) => invoke('requests:renew', id, payload)
  },
  internal: {
    getReferenceData: () => invoke('internal:reference-data'),
    list: (year) => invoke('internal:list', year),
    listDepartmentBalances: (departmentManagerId) =>
      invoke('internal:department-balances', departmentManagerId),
    save: (payload) => invoke('internal:save', payload)
  },
  inventory: {
    getReferenceData: (asOfDate) => invoke('inventory:reference-data', asOfDate),
    createSession: (payload) => invoke('inventory:create-session', payload),
    getSession: (id) => invoke('inventory:get-session', id),
    saveCount: (payload) => invoke('inventory:save-count', payload),
    saveCommittee: (id, payload) => invoke('inventory:save-committee', id, payload),
    completeSession: (id) => invoke('inventory:complete-session', id),
    listDifferences: () => invoke('inventory:differences'),
    settleDifference: (id, reference) => invoke('inventory:settle-difference', id, reference)
  },
  yearEnd: {
    getStatus: () => invoke('year-end:status'),
    getRenumberingData: () => invoke('year-end:renumbering-data'),
    validateRenumbering: (payload) => invoke('year-end:validate-renumbering', payload),
    applyRenumbering: (payload) => invoke('year-end:apply-renumbering', payload),
    closeFiscalYear: (year) => invoke('year-end:close', year)
  },
  movementDifferences: {
    getReferenceData: () => invoke('movement-differences:reference-data'),
    create: (payload) => invoke('movement-differences:create', payload),
    list: (year) => invoke('movement-differences:list', year),
    get: (id) => invoke('movement-differences:get', id),
    recordResponse: (id, payload) => invoke('movement-differences:response', id, payload),
    settle: (id, payload) => invoke('movement-differences:settle', id, payload),
    escalate: (id, date) => invoke('movement-differences:escalate', id, date)
  },
  administration: {
    getReferenceData: () => invoke('administration:reference-data'),
    getManagementReport: (year) => invoke('administration:management-report', year),
    getBalanceDifferences: () => invoke('administration:balance-differences'),
    addOfficer: (payload) => invoke('administration:add-officer', payload),
    closeOfficer: (id, endDate) => invoke('administration:close-officer', id, endDate),
    createHandover: (payload) => invoke('administration:create-handover', payload),
    getHandover: (id) => invoke('administration:get-handover', id),
    updateHandoverCheck: (id, payload) =>
      invoke('administration:update-handover-check', id, payload),
    updateHandoverProtocol: (id, payload) =>
      invoke('administration:update-handover-protocol', id, payload),
    completeHandover: (id, payload) =>
      invoke('administration:complete-handover', id, payload),
    archiveShare: (payload) => invoke('administration:archive-share', payload),
    restoreShare: (id, actionDate) => invoke('administration:restore-share', id, actionDate)
  },
  annualAccounts: {
    get: (year) => invoke('annual-accounts:get', year),
    update: (id, payload) => invoke('annual-accounts:update', id, payload),
    updateCheck: (id, key, payload) => invoke('annual-accounts:update-check', id, key, payload),
    submit: (id, date) => invoke('annual-accounts:submit', id, date)
  }
});
