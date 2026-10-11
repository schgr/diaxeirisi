const assert = require('node:assert/strict');
const path = require('node:path');
const { registerBackupHandlers } = require('../src/ipc/backupHandlers');

async function run() {
  const handlers = new Map();
  const selectedFolder = path.resolve('saved-backup');
  let selection;
  let dialogOptions;
  const preparedPaths = [];
  let relaunches = 0;
  let quits = 0;
  registerBackupHandlers({
    register: (channel, handler) => handlers.set(channel, handler),
    safeInvoke: (operation) => operation(),
    dialog: { showOpenDialog: async (options) => { dialogOptions = options; return selection; } },
    backupService: { prepareRestore: async (folder) => { preparedPaths.push(folder); return { ready: true }; } },
    app: { relaunch: () => { relaunches++; }, quit: () => { quits++; } }
  });
  selection = { canceled: false, filePaths: [path.join(selectedFolder, 'backup-manifest.json')] };
  assert.deepEqual(await handlers.get('backup:restore')({}, 'manual-task', 'file'), { ready: true });
  assert.deepEqual(dialogOptions.properties, ['openFile']);
  assert.equal(preparedPaths[0], selectedFolder);
  selection = { canceled: false, filePaths: [selectedFolder] };
  await handlers.get('backup:restore')({}, 'folder-task');
  assert.deepEqual(dialogOptions.properties, ['openDirectory']);
  assert.equal(preparedPaths[1], selectedFolder);
  selection = { canceled: true, filePaths: [] };
  assert.equal(await handlers.get('backup:restore')({}, 'cancel-task', 'file'), null);
  assert.equal(preparedPaths.length, 2);
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(relaunches, 2);
  assert.equal(quits, 2);
  console.log('Backup restore selection tests passed.');
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
