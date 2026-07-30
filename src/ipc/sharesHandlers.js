'use strict';

const CHANNELS = Object.freeze([
  "shares:list",
  "shares:get-by-number",
  "shares:add",
  "shares:get-card",
  "shares:get-cards-batch",
  "shares:list-moved-cards",
  "shares:update-details",
  "shares:list-serial-registry",
  "shares:save-serial-numbers",
  "shares:list-ammunition-batch-registry",
  "shares:save-ammunition-batches",
  "shares:save-composition",
  "shares:save-change-sheet",
  "shares:choose-photo"
]);

function registerSharesHandlers({
  register,
  safeInvoke,
  services,
  runHeavyTask,
  dialog,
  fs,
  path
}) {
  register('shares:list', async () => safeInvoke(() => services.shares.listShares()));
  register('shares:get-by-number', async (_event, shareNumber) =>
      safeInvoke(() => services.shares.getShareByNumber(shareNumber))
    );
  register('shares:add', async (_event, payload) =>
      safeInvoke(() => services.shares.addShare(payload))
    );
  register('shares:get-card', async (_event, id, year) =>
      safeInvoke(() => services.shares.getShareCard(id, year))
    );
  register('shares:get-cards-batch', async (event, payload) =>
      safeInvoke(async () => {
        const cards = services.shares.getShareCardsBatch(payload);
        return runHeavyTask(event, 'prepare-share-print', { cards }, {
          taskId: payload && payload.taskId,
          timeoutMs: 120000
        });
      })
    );
  register('shares:list-moved-cards', async (_event, year) =>
      safeInvoke(() => services.shares.listMovedShareCards(year))
    );
  register('shares:update-details', async (_event, id, payload) =>
      safeInvoke(() => services.shares.updateShareDetails(id, payload))
    );
  register('shares:list-serial-registry', async () =>
      safeInvoke(() => services.shares.listSerialNumberRegistry())
    );
  register('shares:save-serial-numbers', async (_event, id, entries) =>
      safeInvoke(() => services.shares.saveSerialNumbers(id, entries))
    );
  register('shares:list-ammunition-batch-registry', async () =>
      safeInvoke(() => services.shares.listAmmunitionBatchRegistry())
    );
  register('shares:save-ammunition-batches', async (_event, id, entries) =>
      safeInvoke(() => services.shares.saveAmmunitionBatches(id, entries))
    );
  register('shares:save-composition', async (_event, id, items) =>
      safeInvoke(() => services.shares.saveComposition(id, items))
    );
  register('shares:save-change-sheet', async (_event, id, entries) =>
      safeInvoke(() => services.shares.saveChangeSheet(id, entries))
    );
  register('shares:choose-photo', async () =>
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
}

module.exports = {
  CHANNELS,
  registerSharesHandlers
};
