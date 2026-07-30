'use strict';

const CHANNELS = Object.freeze([
  "print:current-document",
  "heavy-task:cancel",
  "database:integrity-check",
  "export:document"
]);

function registerPrintHandlers({
  register,
  safeInvoke,
  heavyTaskRunner,
  runHeavyTask,
  persistentDatabase,
  path,
  __dirname,
  dialog,
  sanitizeExportFilename,
  printCurrentDocument
}) {
  register('print:current-document', async (event, options) =>
      safeInvoke(() => printCurrentDocument(event.sender, options))
    );
  register('heavy-task:cancel', async (_event, taskId) =>
      safeInvoke(() => heavyTaskRunner.cancel(taskId), true)
    );
  register('database:integrity-check', async (event, taskId) =>
      safeInvoke(() => runHeavyTask(event, 'database-integrity', {
        snapshot: persistentDatabase.exportSnapshot(),
        sqlJsDirectory: path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist')
      }, { taskId, timeoutMs: 60000 }))
    );
  register('export:document', async (event, format, payload, taskId) =>
      safeInvoke(async () => {
        const exportFormat = format === 'word' ? 'word' : 'excel';
        const title = sanitizeExportFilename(payload && payload.title);
        const extension = exportFormat === 'word' ? 'doc' : 'xlsx';
        const result = await dialog.showSaveDialog({
          title: exportFormat === 'word' ? 'Εξαγωγή σε Word' : 'Εξαγωγή σε Excel',
          defaultPath: `${title}.${extension}`,
          filters: [{
            name: exportFormat === 'word' ? 'Αρχείο Word' : 'Αρχείο Excel',
            extensions: [extension]
          }]
        });
        if (result.canceled || !result.filePath) return { canceled: true };
        await runHeavyTask(event, 'export-document', {
          format: exportFormat,
          filePath: result.filePath,
          document: { ...payload, title }
        }, { taskId, timeoutMs: 180000 });
        return {
          canceled: false,
          filePath: result.filePath,
          message: `Το αρχείο «${title}.${extension}» αποθηκεύτηκε.`
        };
      })
    );
}

module.exports = {
  CHANNELS,
  registerPrintHandlers
};
