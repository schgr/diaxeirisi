const { app, BrowserWindow, ipcMain, dialog, Menu, session } = require('electron');
const fs = require('fs');
const path = require('path');
const packageMetadata = require('../package.json');
const { shouldShowApplicationMenu } = require('./applicationMenu');
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
const { createBackupService, applyPendingRestore } = require('./services/backupService');
const {
  sanitizeExportFilename
} = require('./services/documentExportService');
const { createLogger } = require('./utils/logger');
const { AppError, toAppError } = require('./core/errorHandler');
const { createHeavyTaskRunner } = require('./workers/heavyTaskRunner');
const { createShutdownCoordinator } = require('./appLifecycle');
const { registerAllIpcHandlers } = require('./ipc');
const {
  applyOfflineSessionPolicy,
  applyOfflineCommandLine,
  isAllowedLocalResource
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

function runHeavyTask(event, task, payload, options = {}) {
  const taskId = options.taskId || `${task}-${Date.now()}`;
  return heavyTaskRunner.run(task, payload, {
    id: taskId,
    timeoutMs: options.timeoutMs,
    onProgress: (progress) => {
      if (event && !event.sender.isDestroyed()) {
        event.sender.send('heavy-task:progress', progress);
      }
    }
  });
}

function createWindow() {
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
      spellcheck: false
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, targetUrl) => {
    if (!isAllowedLocalResource(targetUrl)) {
      event.preventDefault();
    }
  });
  window.loadFile(path.join(__dirname, 'ui', 'index.html'));
}

function configureOfflineMode() {
  applyOfflineSessionPolicy(session.defaultSession);
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
    isWindows7Legacy,
    securityService,
    backupService,
    persistentDatabase,
    heavyTaskRunner,
    services,
    runHeavyTask,
    sanitizeExportFilename,
    printCurrentDocument
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
    logger.error(appError.message, appError);
    return { ok: false, error: appError };
  }
}

app.whenReady().then(async () => {
  configureOfflineMode();
  if (!shouldShowApplicationMenu(app.getVersion())) {
    Menu.setApplicationMenu(null);
  }
  const userDataPath = app.getPath('userData');
  heavyTaskRunner = createHeavyTaskRunner({ defaultTimeout: 10 * 60 * 1000 });
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
    exportSnapshot: () => database.exportSnapshot()
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
