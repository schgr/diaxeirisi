'use strict';

const CHANNELS = Object.freeze([
  "settings:get",
  "settings:download-initial-inventory-template",
  "settings:import-initial-inventory",
  "settings:download-composition-template",
  "settings:import-compositions",
  "settings:save-service",
  "settings:save-financial-officers",
  "settings:save-audit",
  "settings:add-department-manager",
  "settings:update-department-manager",
  "settings:delete-department-manager",
  "settings:add-rank",
  "settings:update-rank",
  "settings:delete-rank",
  "settings:add-measurement-unit",
  "settings:update-measurement-unit",
  "settings:delete-measurement-unit",
  "settings:add-transaction-unit",
  "settings:update-transaction-unit",
  "settings:delete-transaction-unit",
  "settings:add-material-category",
  "settings:update-material-category",
  "settings:delete-material-category",
  "settings:add-request-issuing-unit",
  "settings:update-request-issuing-unit",
  "settings:delete-request-issuing-unit",
  "settings:add-exhp-issue-reason",
  "settings:update-exhp-issue-reason-texts",
  "settings:delete-exhp-issue-reason"
]);

const EXCEL_FILTERS = [{ name: 'Αρχείο Excel', extensions: ['xlsx'] }];

function registerSettingsHandlers({
  register,
  safeInvoke,
  services,
  backupService,
  runHeavyTask,
  dialog
}) {
  async function saveTemplate(title, defaultPath, writeTemplate) {
    const result = await dialog.showSaveDialog({ title, defaultPath, filters: EXCEL_FILTERS });
    if (result.canceled || !result.filePath) return null;
    return writeTemplate(result.filePath);
  }

  async function importWorkbook(event, taskId, title, importMatrix) {
    const result = await dialog.showOpenDialog({
      title,
      properties: ['openFile'],
      filters: EXCEL_FILTERS
    });
    if (result.canceled || !result.filePaths.length) return null;
    await backupService.createAutomatic(true, { timeoutMs: 10 * 60 * 1000 });
    const matrix = await runHeavyTask(event, 'read-excel-matrix', {
      filePath: result.filePaths[0]
    }, { taskId, timeoutMs: 180000 });
    return importMatrix(matrix, result.filePaths[0]);
  }

  register('settings:get', async () => safeInvoke(() => services.settings.getSettings()));
  register('settings:download-initial-inventory-template', async () =>
      safeInvoke(() => saveTemplate(
        'Αποθήκευση προτύπου αρχικής απογραφής',
        'Πρότυπο-Τελευταίας-Ετήσιας-Απογραφής.xlsx',
        (filePath) => services.initialInventory.writeTemplate(filePath)
      ))
    );
  register('settings:import-initial-inventory', async (event, inventoryDate, taskId) =>
      safeInvoke(() => importWorkbook(
        event,
        taskId,
        'Επιλογή τελευταίας ετήσιας απογραφής',
        (matrix, filePath) => services.initialInventory.importMatrix(matrix, filePath, inventoryDate)
      ))
    );
  register('settings:download-composition-template', async () =>
      safeInvoke(() => saveTemplate(
        'Αποθήκευση προτύπου συνθέσεων μερίδων',
        'Πρότυπο-Συνθέσεων-Μερίδων.xlsx',
        (filePath) => services.compositionImport.writeTemplate(filePath)
      ))
    );
  register('settings:import-compositions', async (event, taskId, inventoryDate) =>
      safeInvoke(() => importWorkbook(
        event,
        taskId,
        'Επιλογή αρχείου συνθέσεων μερίδων',
        (matrix) => services.compositionImport.importMatrix(matrix, inventoryDate)
      ))
    );
  register('settings:save-service', async (_event, payload) =>
      safeInvoke(() => services.settings.saveServiceInfo(payload))
    );
  register('settings:save-financial-officers', async (_event, payload) =>
      safeInvoke(() => services.settings.saveFinancialOfficers(payload))
    );
  register('settings:save-audit', async (_event, payload) =>
      safeInvoke(() => services.settings.saveAuditSettings(payload))
    );
  register('settings:add-department-manager', async (_event, payload) =>
      safeInvoke(() => services.settings.addDepartmentManager(payload))
    );
  register('settings:update-department-manager', async (_event, id, payload) =>
      safeInvoke(() => services.settings.updateDepartmentManager(id, payload))
    );
  register('settings:delete-department-manager', async (_event, id) =>
      safeInvoke(() => services.settings.deleteDepartmentManager(id))
    );
  register('settings:add-rank', async (_event, payload) =>
      safeInvoke(() => services.settings.addRank(payload))
    );
  register('settings:update-rank', async (_event, id, payload) =>
      safeInvoke(() => services.settings.updateRank(id, payload))
    );
  register('settings:delete-rank', async (_event, id) =>
      safeInvoke(() => services.settings.deleteRank(id))
    );
  register('settings:add-measurement-unit', async (_event, payload) =>
      safeInvoke(() => services.settings.addMeasurementUnit(payload))
    );
  register('settings:update-measurement-unit', async (_event, id, payload) =>
      safeInvoke(() => services.settings.updateMeasurementUnit(id, payload))
    );
  register('settings:delete-measurement-unit', async (_event, id) =>
      safeInvoke(() => services.settings.deleteMeasurementUnit(id))
    );
  register('settings:add-transaction-unit', async (_event, payload) =>
      safeInvoke(() => services.settings.addTransactionUnit(payload))
    );
  register('settings:update-transaction-unit', async (_event, id, payload) =>
      safeInvoke(() => services.settings.updateTransactionUnit(id, payload))
    );
  register('settings:delete-transaction-unit', async (_event, id) =>
      safeInvoke(() => services.settings.deleteTransactionUnit(id))
    );
  register('settings:add-material-category', async (_event, payload) =>
      safeInvoke(() => services.settings.addMaterialCategory(payload))
    );
  register('settings:update-material-category', async (_event, id, payload) =>
      safeInvoke(() => services.settings.updateMaterialCategory(id, payload))
    );
  register('settings:delete-material-category', async (_event, id) =>
      safeInvoke(() => services.settings.deleteMaterialCategory(id))
    );
  register('settings:add-request-issuing-unit', async (_event, payload) =>
      safeInvoke(() => services.settings.addRequestIssuingUnit(payload))
    );
  register('settings:update-request-issuing-unit', async (_event, id, payload) =>
      safeInvoke(() => services.settings.updateRequestIssuingUnit(id, payload))
    );
  register('settings:delete-request-issuing-unit', async (_event, id) =>
      safeInvoke(() => services.settings.deleteRequestIssuingUnit(id))
    );
  register('settings:add-exhp-issue-reason', async (_event, payload) =>
      safeInvoke(() => services.settings.addExhpIssueReason(payload))
    );
  register('settings:update-exhp-issue-reason-texts', async (_event, id, payload) =>
      safeInvoke(() => services.settings.updateExhpIssueReasonTexts(id, payload))
    );
  register('settings:delete-exhp-issue-reason', async (_event, id) =>
      safeInvoke(() => services.settings.deleteExhpIssueReason(id))
    );
}

module.exports = {
  CHANNELS,
  registerSettingsHandlers
};
