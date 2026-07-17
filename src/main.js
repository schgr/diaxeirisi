const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('./db/database');
const { createSettingsService } = require('./services/settingsService');
const { createSharesService } = require('./services/sharesService');
const { createTransactionsService } = require('./services/transactionsService');
const { createRequestsService } = require('./services/requestsService');
const { createInternalService } = require('./services/internalService');
const { createInventoryService } = require('./services/inventoryService');
const { createMovementDifferencesService } = require('./services/movementDifferencesService');
const { createAdministrationService } = require('./services/administrationService');
const { createAnnualAccountsService } = require('./services/annualAccountsService');
const { createInitialInventoryService } = require('./services/initialInventoryService');
const { createExhpDocumentsService } = require('./services/exhpDocumentsService');
const { createClothingService } = require('./services/clothingService');
const { createSecurityService } = require('./services/securityService');
const { createBackupService, applyPendingRestore } = require('./services/backupService');
const { createLogger } = require('./utils/logger');
const { AppError, toAppError } = require('./core/errorHandler');

const logger = createLogger('main');

let services;
let securityService;
let backupService;

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: 'diaxeirisi Ylikoy',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: '#f4f6f8',
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  window.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

function registerIpcHandlers() {
  ipcMain.handle('app:get-version', async () => safeInvoke(() => app.getVersion(), true));
  ipcMain.handle('auth:status', async () => safeInvoke(() => securityService.status(), true));
  ipcMain.handle('auth:setup', async (_event, password, confirmation) =>
    safeInvoke(() => securityService.setup(password, confirmation), true)
  );
  ipcMain.handle('auth:login', async (_event, password) =>
    safeInvoke(() => securityService.login(password), true)
  );
  ipcMain.handle('auth:change-password', async (_event, currentPassword, newPassword, confirmation) =>
    safeInvoke(() => securityService.changePassword(currentPassword, newPassword, confirmation))
  );
  ipcMain.handle('auth:lock', async () => safeInvoke(() => securityService.lock()));
  ipcMain.handle('backup:list', async () => safeInvoke(() => backupService.list()));
  ipcMain.handle('backup:create-automatic', async () =>
    safeInvoke(() => backupService.createAutomatic(true))
  );
  ipcMain.handle('backup:create-manual', async () =>
    safeInvoke(async () => {
      const result = await dialog.showOpenDialog({
        title: 'Επιλογή φακέλου αποθήκευσης αντιγράφου',
        properties: ['openDirectory', 'createDirectory']
      });
      if (result.canceled || !result.filePaths.length) return null;
      return backupService.createManual(result.filePaths[0]);
    })
  );
  ipcMain.handle('backup:restore', async () =>
    safeInvoke(async () => {
      const result = await dialog.showOpenDialog({
        title: 'Επιλογή αντιγράφου για επαναφορά',
        properties: ['openDirectory']
      });
      if (result.canceled || !result.filePaths.length) return null;
      const prepared = backupService.prepareRestore(result.filePaths[0]);
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 250);
      return prepared;
    })
  );
  ipcMain.handle('window:set-fullscreen', async (event, value) =>
    safeInvoke(() => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.setFullScreen(Boolean(value));
      }
      return window ? window.isFullScreen() : false;
    }, true)
  );
  ipcMain.handle('window:minimize', async (event) =>
    safeInvoke(() => {
      const window = BrowserWindow.fromWebContents(event.sender);
      if (window) {
        window.minimize();
      }
      return true;
    }, true)
  );
  ipcMain.handle('window:quit', async () =>
    safeInvoke(() => {
      app.quit();
      return true;
    }, true)
  );
  ipcMain.handle('print:current-document', async (event, options) =>
    safeInvoke(() => printCurrentDocument(event.sender, options))
  );
  ipcMain.handle('shares:list', async () => safeInvoke(() => services.shares.listShares()));
  ipcMain.handle('shares:get-by-number', async (_event, shareNumber) =>
    safeInvoke(() => services.shares.getShareByNumber(shareNumber))
  );
  ipcMain.handle('shares:add', async (_event, payload) =>
    safeInvoke(() => services.shares.addShare(payload))
  );
  ipcMain.handle('shares:get-card', async (_event, id, year) =>
    safeInvoke(() => services.shares.getShareCard(id, year))
  );
  ipcMain.handle('shares:update-details', async (_event, id, payload) =>
    safeInvoke(() => services.shares.updateShareDetails(id, payload))
  );
  ipcMain.handle('shares:list-serial-registry', async () =>
    safeInvoke(() => services.shares.listSerialNumberRegistry())
  );
  ipcMain.handle('shares:save-serial-numbers', async (_event, id, entries) =>
    safeInvoke(() => services.shares.saveSerialNumbers(id, entries))
  );
  ipcMain.handle('shares:save-composition', async (_event, id, items) =>
    safeInvoke(() => services.shares.saveComposition(id, items))
  );
  ipcMain.handle('shares:save-change-sheet', async (_event, id, entries) =>
    safeInvoke(() => services.shares.saveChangeSheet(id, entries))
  );
  ipcMain.handle('shares:choose-photo', async () =>
    safeInvoke(async () => {
      const result = await dialog.showOpenDialog({
        title: 'Επιλογή φωτογραφίας υλικού',
        properties: ['openFile'],
        filters: [
          { name: 'Εικόνες', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }
        ]
      });

      if (result.canceled || !result.filePaths.length) {
        return '';
      }

      const sourcePath = result.filePaths[0];
      const photosDirectory = path.join(app.getPath('userData'), 'photos');
      fs.mkdirSync(photosDirectory, { recursive: true });
      const extension = path.extname(sourcePath);
      const baseName = path.basename(sourcePath, extension).replace(/[^\p{L}\p{N}_-]+/gu, '_');
      const destinationPath = path.join(photosDirectory, `${Date.now()}-${baseName}${extension}`);
      fs.copyFileSync(sourcePath, destinationPath);
      return destinationPath;
    })
  );
  ipcMain.handle('settings:get', async () => safeInvoke(() => services.settings.getSettings()));
  ipcMain.handle('settings:download-initial-inventory-template', async () =>
    safeInvoke(async () => {
      const result = await dialog.showSaveDialog({
        title: 'Αποθήκευση προτύπου αρχικής απογραφής',
        defaultPath: 'Πρότυπο-Τελευταίας-Ετήσιας-Απογραφής.xlsx',
        filters: [{ name: 'Αρχείο Excel', extensions: ['xlsx'] }]
      });
      if (result.canceled || !result.filePath) return null;
      return services.initialInventory.writeTemplate(result.filePath);
    })
  );
  ipcMain.handle('settings:import-initial-inventory', async (_event, inventoryDate) =>
    safeInvoke(async () => {
      const result = await dialog.showOpenDialog({
        title: 'Επιλογή τελευταίας ετήσιας απογραφής',
        properties: ['openFile'],
        filters: [{ name: 'Αρχείο Excel', extensions: ['xlsx'] }]
      });
      if (result.canceled || !result.filePaths.length) return null;
      return services.initialInventory.importWorkbook(result.filePaths[0], inventoryDate);
    })
  );
  ipcMain.handle('settings:save-service', async (_event, payload) =>
    safeInvoke(() => services.settings.saveServiceInfo(payload))
  );
  ipcMain.handle('settings:save-financial-officers', async (_event, payload) =>
    safeInvoke(() => services.settings.saveFinancialOfficers(payload))
  );
  ipcMain.handle('settings:save-audit', async (_event, payload) =>
    safeInvoke(() => services.settings.saveAuditSettings(payload))
  );
  ipcMain.handle('settings:add-department-manager', async (_event, payload) =>
    safeInvoke(() => services.settings.addDepartmentManager(payload))
  );
  ipcMain.handle('settings:update-department-manager', async (_event, id, payload) =>
    safeInvoke(() => services.settings.updateDepartmentManager(id, payload))
  );
  ipcMain.handle('settings:delete-department-manager', async (_event, id) =>
    safeInvoke(() => services.settings.deleteDepartmentManager(id))
  );
  ipcMain.handle('settings:add-rank', async (_event, payload) =>
    safeInvoke(() => services.settings.addRank(payload))
  );
  ipcMain.handle('settings:update-rank', async (_event, id, payload) =>
    safeInvoke(() => services.settings.updateRank(id, payload))
  );
  ipcMain.handle('settings:delete-rank', async (_event, id) =>
    safeInvoke(() => services.settings.deleteRank(id))
  );
  ipcMain.handle('settings:add-measurement-unit', async (_event, payload) =>
    safeInvoke(() => services.settings.addMeasurementUnit(payload))
  );
  ipcMain.handle('settings:update-measurement-unit', async (_event, id, payload) =>
    safeInvoke(() => services.settings.updateMeasurementUnit(id, payload))
  );
  ipcMain.handle('settings:delete-measurement-unit', async (_event, id) =>
    safeInvoke(() => services.settings.deleteMeasurementUnit(id))
  );
  ipcMain.handle('settings:add-transaction-unit', async (_event, payload) =>
    safeInvoke(() => services.settings.addTransactionUnit(payload))
  );
  ipcMain.handle('settings:update-transaction-unit', async (_event, id, payload) =>
    safeInvoke(() => services.settings.updateTransactionUnit(id, payload))
  );
  ipcMain.handle('settings:delete-transaction-unit', async (_event, id) =>
    safeInvoke(() => services.settings.deleteTransactionUnit(id))
  );
  ipcMain.handle('settings:add-material-category', async (_event, payload) =>
    safeInvoke(() => services.settings.addMaterialCategory(payload))
  );
  ipcMain.handle('settings:update-material-category', async (_event, id, payload) =>
    safeInvoke(() => services.settings.updateMaterialCategory(id, payload))
  );
  ipcMain.handle('settings:delete-material-category', async (_event, id) =>
    safeInvoke(() => services.settings.deleteMaterialCategory(id))
  );
  ipcMain.handle('settings:add-request-issuing-unit', async (_event, payload) =>
    safeInvoke(() => services.settings.addRequestIssuingUnit(payload))
  );
  ipcMain.handle('settings:update-request-issuing-unit', async (_event, id, payload) =>
    safeInvoke(() => services.settings.updateRequestIssuingUnit(id, payload))
  );
  ipcMain.handle('settings:delete-request-issuing-unit', async (_event, id) =>
    safeInvoke(() => services.settings.deleteRequestIssuingUnit(id))
  );
  ipcMain.handle('settings:add-exhp-issue-reason', async (_event, payload) =>
    safeInvoke(() => services.settings.addExhpIssueReason(payload))
  );
  ipcMain.handle('settings:update-exhp-issue-reason-texts', async (_event, id, payload) =>
    safeInvoke(() => services.settings.updateExhpIssueReasonTexts(id, payload))
  );
  ipcMain.handle('settings:delete-exhp-issue-reason', async (_event, id) =>
    safeInvoke(() => services.settings.deleteExhpIssueReason(id))
  );
  ipcMain.handle('transactions:get-structure', async () =>
    safeInvoke(() => services.transactions.getStructure())
  );
  ipcMain.handle('transactions:addy-reference-data', async () =>
    safeInvoke(() => services.transactions.getAddyReferenceData())
  );
  ipcMain.handle('transactions:suggest-share-number', async (_event, materialType) =>
    safeInvoke(() => services.transactions.suggestShareNumber(materialType))
  );
  ipcMain.handle('transactions:save-addy', async (_event, payload) =>
    safeInvoke(() => services.transactions.saveAddy(payload))
  );
  ipcMain.handle('transactions:external-index-rows', async (_event, year) =>
    safeInvoke(() => services.transactions.listExternalTransactionIndexRows(year))
  );
  ipcMain.handle('transactions:update-addy-index-fields', async (_event, documentId, payload) =>
    safeInvoke(() => services.transactions.updateAddyIndexFields(documentId, payload))
  );
  ipcMain.handle('transactions:addy-documents', async () =>
    safeInvoke(() => services.transactions.listAddyDocuments())
  );
  ipcMain.handle('transactions:get-addy-document', async (_event, id) =>
    safeInvoke(() => services.transactions.getAddyDocument(id))
  );
  ipcMain.handle('transactions:save-exhp', async (_event, payload) =>
    safeInvoke(() => services.transactions.saveExhp(payload))
  );
  ipcMain.handle('transactions:exhp-documents', async () =>
    safeInvoke(() => services.transactions.listExhpDocuments())
  );
  ipcMain.handle('transactions:get-exhp-document', async (_event, id) =>
    safeInvoke(() => services.transactions.getExhpDocument(id))
  );
  ipcMain.handle('transactions:update-exhp-support', async (_event, documentId, supportId, payload) =>
    safeInvoke(() => services.transactions.updateExhpSupport(documentId, supportId, payload))
  );
  ipcMain.handle('transactions:update-exhp-other-support', async (_event, documentId, value) =>
    safeInvoke(() => services.transactions.updateExhpOtherSupportDocument(documentId, value))
  );
  ipcMain.handle('transactions:save-exhp-support-form', async (_event, documentId, supportId, payload) =>
    safeInvoke(() => services.transactions.saveExhpSupportForm(documentId, supportId, payload))
  );
  ipcMain.handle('transactions:update-exhp-index-fields', async (_event, documentId, payload) =>
    safeInvoke(() => services.transactions.updateExhpIndexFields(documentId, payload))
  );
  ipcMain.handle('transactions:exhp-index-rows', async (_event, year) =>
    safeInvoke(() => services.transactions.listExhpIndexRows(year))
  );
  ipcMain.handle('exhp-docs:get-by-exhp', async (_event, exhpId) =>
    safeInvoke(() => services.exhpDocs.getDocumentsForExhp(exhpId))
  );
  ipcMain.handle('exhp-docs:create', async (_event, exhpId, documentType) =>
    safeInvoke(() => services.exhpDocs.createDocument(exhpId, documentType))
  );
  ipcMain.handle('exhp-docs:delete', async (_event, documentId) =>
    safeInvoke(() => services.exhpDocs.deleteDocument(documentId))
  );
  ipcMain.handle('exhp-docs:save-useless-a', async (_event, documentId, payload) =>
    safeInvoke(() => services.exhpDocs.saveUselessA(documentId, payload))
  );
  ipcMain.handle('exhp-docs:get-useless-a', async (_event, documentId) =>
    safeInvoke(() => services.exhpDocs.getUselessA(documentId))
  );
  ipcMain.handle('exhp-docs:save-useless-b', async (_event, documentId, payload) =>
    safeInvoke(() => services.exhpDocs.saveUselessB(documentId, payload))
  );
  ipcMain.handle('exhp-docs:get-useless-b', async (_event, documentId) =>
    safeInvoke(() => services.exhpDocs.getUselessB(documentId))
  );
  ipcMain.handle('exhp-docs:save-ammo', async (_event, documentId, payload) =>
    safeInvoke(() => services.exhpDocs.saveAmmo(documentId, payload))
  );
  ipcMain.handle('exhp-docs:get-ammo', async (_event, documentId) =>
    safeInvoke(() => services.exhpDocs.getAmmo(documentId))
  );
  ipcMain.handle('exhp-docs:save-generic', async (_event, documentId, payload) =>
    safeInvoke(() => services.exhpDocs.saveGeneric(documentId, payload))
  );
  ipcMain.handle('exhp-docs:get-generic', async (_event, documentId) =>
    safeInvoke(() => services.exhpDocs.getGeneric(documentId))
  );
  ipcMain.handle('exhp-docs:get-useless-statements', async (_event, exhpId) =>
    safeInvoke(() => services.exhpDocs.getUselessStatements(exhpId))
  );
  ipcMain.handle('exhp-docs:save-useless-statement', async (_event, exhpId, formKey, payload) =>
    safeInvoke(() => services.exhpDocs.saveUselessStatement(exhpId, formKey, payload))
  );
  ipcMain.handle('clothing:get-items', async () =>
    safeInvoke(() => services.clothing.getClothingItems())
  );
  ipcMain.handle('clothing:add-item', async (_event, payload) =>
    safeInvoke(() => services.clothing.addClothingItem(payload))
  );
  ipcMain.handle('clothing:update-item', async (_event, id, payload) =>
    safeInvoke(() => services.clothing.updateClothingItem(id, payload))
  );
  ipcMain.handle('clothing:delete-item', async (_event, id) =>
    safeInvoke(() => services.clothing.deleteClothingItem(id))
  );
  ipcMain.handle('clothing:get-distributions', async (_event, exhpId) =>
    safeInvoke(() => services.clothing.getDistributionsForExhp(exhpId))
  );
  ipcMain.handle('clothing:save-distribution', async (_event, exhpId, distributionType, payload) =>
    safeInvoke(() => services.clothing.saveDistribution(exhpId, distributionType, payload))
  );
  ipcMain.handle('clothing:delete-distribution', async (_event, id) =>
    safeInvoke(() => services.clothing.deleteDistribution(id))
  );
  ipcMain.handle('clothing:get-summary', async (_event, month, year) =>
    safeInvoke(() => services.clothing.getSummary(month, year))
  );
  ipcMain.handle('requests:reference-data', async () =>
    safeInvoke(() => services.requests.getReferenceData())
  );
  ipcMain.handle('requests:list', async (_event, year) =>
    safeInvoke(() => services.requests.listRequests(year))
  );
  ipcMain.handle('requests:save', async (_event, payload) =>
    safeInvoke(() => services.requests.saveRequest(payload))
  );
  ipcMain.handle('requests:update-status', async (_event, id, status) =>
    safeInvoke(() => services.requests.updateStatus(id, status))
  );
  ipcMain.handle('requests:renewal-candidates', async () =>
    safeInvoke(() => services.requests.getRenewalCandidates())
  );
  ipcMain.handle('requests:postpone-renewal', async (_event, id) =>
    safeInvoke(() => services.requests.postponeRenewal(id))
  );
  ipcMain.handle('requests:renew', async (_event, id, payload) =>
    safeInvoke(() => services.requests.renewRequest(id, payload))
  );
  ipcMain.handle('internal:reference-data', async () =>
    safeInvoke(() => services.internal.getReferenceData())
  );
  ipcMain.handle('internal:list', async (_event, year) =>
    safeInvoke(() => services.internal.listMovements(year))
  );
  ipcMain.handle('internal:department-balances', async (_event, departmentManagerId) =>
    safeInvoke(() => services.internal.listDepartmentBalances(departmentManagerId))
  );
  ipcMain.handle('internal:save', async (_event, payload) =>
    safeInvoke(() => services.internal.saveMovement(payload))
  );
  ipcMain.handle('inventory:reference-data', async (_event, asOfDate) =>
    safeInvoke(() => services.inventory.getReferenceData(asOfDate))
  );
  ipcMain.handle('inventory:create-session', async (_event, payload) =>
    safeInvoke(() => services.inventory.createSession(payload))
  );
  ipcMain.handle('inventory:get-session', async (_event, id) =>
    safeInvoke(() => services.inventory.getSession(id))
  );
  ipcMain.handle('inventory:save-count', async (_event, payload) =>
    safeInvoke(() => services.inventory.saveCount(payload))
  );
  ipcMain.handle('inventory:save-committee', async (_event, id, payload) =>
    safeInvoke(() => services.inventory.saveCommittee(id, payload))
  );
  ipcMain.handle('inventory:complete-session', async (_event, id) =>
    safeInvoke(() => services.inventory.completeSession(id))
  );
  ipcMain.handle('inventory:differences', async () =>
    safeInvoke(() => services.inventory.listDifferences())
  );
  ipcMain.handle('inventory:settle-difference', async (_event, id, reference) =>
    safeInvoke(() => services.inventory.settleDifference(id, reference))
  );
  ipcMain.handle('movement-differences:reference-data', async () =>
    safeInvoke(() => services.movementDifferences.getReferenceData())
  );
  ipcMain.handle('movement-differences:create', async (_event, payload) =>
    safeInvoke(() => services.movementDifferences.createProtocol(payload))
  );
  ipcMain.handle('movement-differences:list', async (_event, year) =>
    safeInvoke(() => services.movementDifferences.listProtocols(year))
  );
  ipcMain.handle('movement-differences:get', async (_event, id) =>
    safeInvoke(() => services.movementDifferences.getProtocol(id))
  );
  ipcMain.handle('movement-differences:response', async (_event, id, payload) =>
    safeInvoke(() => services.movementDifferences.recordResponse(id, payload))
  );
  ipcMain.handle('movement-differences:settle', async (_event, id, payload) =>
    safeInvoke(() => services.movementDifferences.settleProtocol(id, payload))
  );
  ipcMain.handle('movement-differences:escalate', async (_event, id, date) =>
    safeInvoke(() => services.movementDifferences.escalateProtocol(id, date))
  );
  ipcMain.handle('administration:reference-data', async () =>
    safeInvoke(() => services.administration.getReferenceData())
  );
  ipcMain.handle('administration:add-officer', async (_event, payload) =>
    safeInvoke(() => services.administration.addOfficerTerm(payload))
  );
  ipcMain.handle('administration:close-officer', async (_event, id, endDate) =>
    safeInvoke(() => services.administration.closeOfficerTerm(id, endDate))
  );
  ipcMain.handle('administration:create-handover', async (_event, payload) =>
    safeInvoke(() => services.administration.createHandover(payload))
  );
  ipcMain.handle('administration:get-handover', async (_event, id) =>
    safeInvoke(() => services.administration.getHandover(id))
  );
  ipcMain.handle('administration:update-handover-check', async (_event, id, payload) =>
    safeInvoke(() => services.administration.updateHandoverCheck(id, payload))
  );
  ipcMain.handle('administration:update-handover-protocol', async (_event, id, payload) =>
    safeInvoke(() => services.administration.updateHandoverProtocol(id, payload))
  );
  ipcMain.handle('administration:complete-handover', async (_event, id, payload) =>
    safeInvoke(() => services.administration.completeHandover(id, payload))
  );
  ipcMain.handle('administration:archive-share', async (_event, payload) =>
    safeInvoke(() => services.administration.archiveShare(payload))
  );
  ipcMain.handle('administration:restore-share', async (_event, id, actionDate) =>
    safeInvoke(() => services.administration.restoreShare(id, actionDate))
  );
  ipcMain.handle('annual-accounts:get', async (_event, year) =>
    safeInvoke(() => services.annualAccounts.getPackage(year))
  );
  ipcMain.handle('annual-accounts:update', async (_event, id, payload) =>
    safeInvoke(() => services.annualAccounts.updatePackage(id, payload))
  );
  ipcMain.handle('annual-accounts:update-check', async (_event, id, key, payload) =>
    safeInvoke(() => services.annualAccounts.updateCheck(id, key, payload))
  );
  ipcMain.handle('annual-accounts:submit', async (_event, id, date) =>
    safeInvoke(() => services.annualAccounts.submitPackage(id, date))
  );
}

function printCurrentDocument(webContents, options) {
  return new Promise((resolve) => {
    webContents.print(
      {
        silent: false,
        printBackground: true,
        color: true,
        margins: { marginType: 'none' },
        landscape: Boolean(options && options.landscape),
        scaleFactor: 100,
        pagesPerSheet: 1,
        pageSize: 'A4'
      },
      (success, failureReason) => {
        if (!success) {
          resolve({ printed: false, failureReason: failureReason || '' });
          return;
        }
        resolve({ printed: true });
      }
    );
  });
}

async function safeInvoke(operation, allowLocked = false) {
  try {
    if (!allowLocked && securityService && !securityService.isUnlocked()) {
      throw new AppError('Η εφαρμογή είναι κλειδωμένη.', 'AUTH_REQUIRED');
    }
    return { ok: true, data: await operation() };
  } catch (error) {
    const appError = toAppError(error);
    logger.error(appError.message, appError);
    return { ok: false, error: appError };
  }
}

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  applyPendingRestore(userDataPath);
  securityService = createSecurityService(userDataPath);
  const database = await initializeDatabase(userDataPath);
  backupService = createBackupService(userDataPath);
  try {
    backupService.createAutomatic();
  } catch (error) {
    logger.error('Δεν ήταν δυνατή η δημιουργία αυτόματου αντιγράφου.', error);
  }
  const settingsService = createSettingsService(database);
  services = {
    shares: createSharesService(database),
    settings: settingsService,
    transactions: createTransactionsService(database, settingsService),
    requests: createRequestsService(database, settingsService),
    internal: createInternalService(database),
    inventory: createInventoryService(database),
    movementDifferences: createMovementDifferencesService(database),
    administration: createAdministrationService(database),
    annualAccounts: createAnnualAccountsService(database),
    initialInventory: createInitialInventoryService(database),
    exhpDocs: createExhpDocumentsService(database),
    clothing: createClothingService(database)
  };
  registerIpcHandlers();
  createWindow();

  const backupInterval = setInterval(() => {
    try {
      backupService.createAutomatic();
    } catch (error) {
      logger.error('Δεν ήταν δυνατή η δημιουργία προγραμματισμένου αντιγράφου.', error);
    }
  }, 6 * 60 * 60 * 1000);
  backupInterval.unref();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
