const { app, BrowserWindow, ipcMain, dialog, Menu, session } = require('electron');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const packageMetadata = require('../package.json');
const {
  configureApplicationMenu,
  shouldShowApplicationMenu,
  shouldToggleDevToolsForInput
} = require('./applicationMenu');
const { initializeDatabase } = require('./db/database');
const { createSettingsService } = require('./services/settingsService');
const { createSharesService } = require('./services/sharesService');
const { createTransactionsService } = require('./services/transactionsService');
const { createRequestsService } = require('./services/requestsService');
const { createInternalService } = require('./services/internalService');
const { createInventoryService } = require('./services/inventoryService');
const { createYearEndService } = require('./services/yearEndService');
const { createMovementDifferencesService } = require('./services/movementDifferencesService');
const { createAdministrationService } = require('./services/administrationService');
const { createAnnualAccountsService } = require('./services/annualAccountsService');
const { createInitialInventoryService } = require('./services/initialInventoryService');
const { createCompositionImportService } = require('./services/compositionImportService');
const { createExhpDocumentsService } = require('./services/exhpDocumentsService');
const { createClothingService } = require('./services/clothingService');
const { createSecurityService } = require('./services/securityService');
const { createKeyCatalogueService } = require('./services/keyCatalogueService');
const { createBackupService, applyPendingRestore } = require('./services/backupService');
const {
  sanitizeExportFilename
} = require('./services/documentExportService');
const { createLogger } = require('./utils/logger');
const { AppError, toAppError } = require('./core/errorHandler');
const { createHeavyTaskRunner } = require('./workers/heavyTaskRunner');
const { createShutdownCoordinator } = require('./appLifecycle');
const { registerAllIpcHandlers } = require('./ipc');
const { createIpcSecurityPolicy } = require('./ipc/security');
const {
  createOfflinePolicy,
  applyOfflineCommandLine,
} = require('./offlinePolicy');

applyOfflineCommandLine(app.commandLine);

const logger = createLogger('main');
const isWindows7Legacy = packageMetadata.buildFlavor === 'win7-legacy'
  && packageMetadata.legacyWindows7 === true;

let services;
let securityService;
let backupService;
let persistentDatabase;
let heavyTaskRunner;
let shutdownCoordinator;
let offlinePolicy;
let ipcSecurity;
let keyCatalogueService;
const pendingSessions = new Set();

app.on('session-created', (createdSession) => {
  if (offlinePolicy) offlinePolicy.applyToSession(createdSession);
  else pendingSessions.add(createdSession);
});

function runHeavyTask(event, task, payload, options = {}) {
  const taskId = options.taskId || crypto.randomUUID();
  return heavyTaskRunner.run(task, payload, {
    id: taskId,
    timeoutMs: options.timeoutMs,
    resource: options.resource,
    transferList: options.transferList,
    onProgress: (progress) => {
      if (event && event.sender && !event.sender.isDestroyed()) {
        event.sender.send('heavy-task:progress', progress);
      }
    }
  });
}

function createWindow() {
  const isBetaBuild = shouldShowApplicationMenu(app.getVersion());
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 680,
    title: isWindows7Legacy
      ? 'diaxeirisi Ylikoy - Windows 7 Legacy (Offline)'
      : 'diaxeirisi Ylikoy',
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    backgroundColor: '#f4f6f8',
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      devTools: isBetaBuild,
      spellcheck: false
    }
  });

  offlinePolicy.hardenWebContents(window.webContents);
  if (isBetaBuild) {
    window.webContents.on('before-input-event', (event, input) => {
      if (!shouldToggleDevToolsForInput(app.getVersion(), input)) return;
      event.preventDefault();
      if (window.webContents.isDevToolsOpened()) window.webContents.closeDevTools();
      else window.webContents.openDevTools({ mode: 'detach', activate: true });
    });
  }
  window.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

function configureOfflineMode() {
  const userDataPath = app.getPath('userData');
  offlinePolicy = createOfflinePolicy({
    appPath: app.getAppPath(),
    userDataPath
  });
  offlinePolicy.applyToSession(session.defaultSession);
  for (const createdSession of pendingSessions) offlinePolicy.applyToSession(createdSession);
  pendingSessions.clear();
  ipcSecurity = createIpcSecurityPolicy({
    isAllowedSenderUrl: offlinePolicy.isAllowedAppAssetUrl,
    allowedPathRoots: [path.join(userDataPath, 'photos')]
  });
  logger.info('Strict offline mode is active; HTTP(S), WebSocket and permissions are blocked.');
}

function registerIpcHandlers() {
  return registerAllIpcHandlers(ipcMain, {
    safeInvoke,
    app,
    BrowserWindow,
    dialog,
    fs,
    path,
    __dirname,
    offlineOnly: true,
    ipcSecurity,
    isWindows7Legacy,
    securityService,
    backupService,
    persistentDatabase,
    heavyTaskRunner,
    services,
    runHeavyTask,
    sanitizeExportFilename,
    printCurrentDocument,
    keyCatalogueService
  });
}

async function printCurrentDocument(webContents, options) {
  const landscape = Boolean(options && options.landscape);
  const requestedTitle = sanitizeExportFilename(options && options.title);
  const previousTitle = await webContents.executeJavaScript('document.title', true).catch(() => '');
  const ownerWindow = BrowserWindow.fromWebContents(webContents);
  const previousWindowTitle = ownerWindow?.getTitle() || '';
  if (requestedTitle) {
    await webContents.executeJavaScript(
      `document.title = ${JSON.stringify(requestedTitle)}`,
      true
    ).catch(() => {});
    ownerWindow?.setTitle(requestedTitle);
  }
  const result = await new Promise((resolve) => {
    webContents.print(
      {
        silent: false,
        printBackground: true,
        color: true,
        margins: { marginType: 'none' },
        landscape,
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
  if (previousTitle) {
    await webContents.executeJavaScript(
      `document.title = ${JSON.stringify(previousTitle)}`,
      true
    ).catch(() => {});
  }
  if (ownerWindow && previousWindowTitle) {
    ownerWindow.setTitle(previousWindowTitle);
  }
  return result;
}

async function safeInvoke(operation, allowLocked = false) {
  try {
    if (!allowLocked && securityService && !securityService.isUnlocked()) {
      throw new AppError('Η εφαρμογή είναι κλειδωμένη.', 'AUTH_REQUIRED');
    }
    return { ok: true, data: await operation() };
  } catch (error) {
    const appError = toAppError(error);
    logger.error(
      (error && error.message) || appError.message,
      {
        code: appError.code,
        stack: error && error.stack,
        details: appError.details
      }
    );
    return { ok: false, error: appError };
  }
}

app.whenReady().then(async () => {
  configureOfflineMode();
  configureApplicationMenu({ Menu, BrowserWindow, version: app.getVersion() });
  const userDataPath = app.getPath('userData');
  heavyTaskRunner = createHeavyTaskRunner({ defaultTimeout: 10 * 60 * 1000 });
  keyCatalogueService = createKeyCatalogueService({
    configFile: path.join(app.getPath('userData'), 'key-catalogue.json')
  });
  await keyCatalogueService.initialize();
  await applyPendingRestore(userDataPath, heavyTaskRunner);
  securityService = createSecurityService(userDataPath);
  const database = await initializeDatabase(userDataPath, {
    offerBackupRecovery: async ({ mainExists }) => {
      const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Ασφαλής ανάκτηση', 'Ακύρωση'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: 'Ανάκτηση βάσης δεδομένων',
        message: mainExists
          ? 'Η κύρια βάση δεδομένων είναι κατεστραμμένη.'
          : 'Η κύρια βάση δεδομένων λείπει.',
        detail: 'Βρέθηκε έγκυρο προηγούμενο αντίγραφο (.bak). Θέλετε να ανακτηθεί με ασφάλεια;'
      });
      return result.response === 0;
    }
  });
  persistentDatabase = database;
  shutdownCoordinator = createShutdownCoordinator({
    app,
    database: persistentDatabase,
    workerRunner: heavyTaskRunner,
    onError: (error) => {
      logger.error('Δεν ήταν δυνατή η τελική ασφαλής αποθήκευση της βάσης.', error);
      dialog.showErrorBox(
        'Αποτυχία ασφαλούς κλεισίματος',
        'Η βάση δεν αποθηκεύτηκε με ασφάλεια. Η εφαρμογή θα παραμείνει ανοικτή.'
      );
    }
  });
  backupService = createBackupService(userDataPath, {
    runner: heavyTaskRunner,
    flush: () => database.flush(),
    exportSnapshot: () => database.exportSnapshot(),
    transferableSnapshots: true
  });
  const settingsService = createSettingsService(database);
  services = {
    shares: createSharesService(database),
    settings: settingsService,
    transactions: createTransactionsService(database, settingsService),
    requests: createRequestsService(database, settingsService),
    internal: createInternalService(database),
    inventory: createInventoryService(database),
    yearEnd: createYearEndService(database),
    movementDifferences: createMovementDifferencesService(database),
    administration: createAdministrationService(database),
    annualAccounts: createAnnualAccountsService(database),
    initialInventory: createInitialInventoryService(database),
    compositionImport: createCompositionImportService(database),
    exhpDocs: createExhpDocumentsService(database),
    clothing: createClothingService(database)
  };
  registerIpcHandlers();
  createWindow();
  setImmediate(() => {
    backupService.createAutomatic().catch((error) => {
      logger.error('Δεν ήταν δυνατή η δημιουργία αυτόματου αντιγράφου.', error);
    });
  });

  const backupInterval = setInterval(() => {
    backupService.createAutomatic().catch((error) => {
      logger.error('Δεν ήταν δυνατή η δημιουργία προγραμματισμένου αντιγράφου.', error);
    });
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

app.on('before-quit', (event) => {
  if (shutdownCoordinator) shutdownCoordinator.beforeQuit(event);
});
