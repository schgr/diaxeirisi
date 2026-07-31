'use strict';

const CHANNELS = Object.freeze([
  "backup:list",
  "backup:create-automatic",
  "backup:create-manual",
  "backup:restore",
  "backup:cancel"
]);

function registerBackupHandlers({
  register,
  safeInvoke,
  backupService,
  dialog,
  app
}) {
  const sendProgress = (event, progress) => {
    if (event && event.sender && !event.sender.isDestroyed()) {
      event.sender.send('backup:progress', progress);
    }
  };
  register('backup:list', async () => safeInvoke(() => backupService.list()));
  register('backup:create-automatic', async (event, taskId) =>
      safeInvoke(() => backupService.createAutomatic(true, {
        taskId,
        timeoutMs: 10 * 60 * 1000,
        onProgress: (progress) => sendProgress(event, progress)
      }))
    );
  register('backup:create-manual', async (event, taskId) =>
      safeInvoke(async () => {
        const result = await dialog.showOpenDialog({
          title: 'Επιλογή φακέλου αποθήκευσης αντιγράφου',
          properties: ['openDirectory', 'createDirectory']
        });
        if (result.canceled || !result.filePaths.length) return null;
        return backupService.createManual(result.filePaths[0], {
          taskId,
          timeoutMs: 10 * 60 * 1000,
          onProgress: (progress) => sendProgress(event, progress)
        });
      })
    );
  register('backup:restore', async (event, taskId) =>
      safeInvoke(async () => {
        const result = await dialog.showOpenDialog({
          title: 'Επιλογή αντιγράφου για επαναφορά',
          properties: ['openDirectory']
        });
        if (result.canceled || !result.filePaths.length) return null;
        const prepared = await backupService.prepareRestore(result.filePaths[0], {
          taskId,
          timeoutMs: 10 * 60 * 1000,
          onProgress: (progress) => sendProgress(event, progress)
        });
        setTimeout(() => {
          app.relaunch();
          app.quit();
        }, 250);
        return prepared;
      })
    );
  register('backup:cancel', async (_event, taskId) =>
      safeInvoke(() => backupService.cancel(taskId))
    );
}

module.exports = {
  CHANNELS,
  registerBackupHandlers
};
