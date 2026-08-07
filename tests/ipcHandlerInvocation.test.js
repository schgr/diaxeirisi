const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registerBackupHandlers } = require('../src/ipc/backupHandlers');
const { registerPrintHandlers } = require('../src/ipc/printHandlers');
const { registerSharesHandlers } = require('../src/ipc/sharesHandlers');

function createRegistry() {
  const handlers = new Map();
  return {
    handlers,
    register(channel, handler) {
      handlers.set(channel, handler);
    },
    invoke(channel, ...args) {
      const handler = handlers.get(channel);
      assert.ok(handler, `handler not registered: ${channel}`);
      return handler(...args);
    }
  };
}

function createEvent() {
  const sent = [];
  return {
    sent,
    destroyed: false,
    sender: {
      sent,
      isDestroyed() {
        return this.destroyed === true;
      },
      send(channel, payload) {
        sent.push([channel, payload]);
      }
    }
  };
}

const safeInvoke = (operation) => operation();

async function runBackupHandlers() {
  const registry = createRegistry();
  const calls = [];
  const dialogResults = [];
  const relaunched = [];
  const backupService = {
    list: () => ['backup-1'],
    createAutomatic(includeSnapshot, options) {
      calls.push(['createAutomatic', includeSnapshot]);
      options.onProgress({ percent: 40 });
      return { created: true };
    },
    createManual(directory, options) {
      calls.push(['createManual', directory]);
      options.onProgress({ percent: 100 });
      return { directory };
    },
    prepareRestore(directory, options) {
      calls.push(['prepareRestore', directory]);
      options.onProgress({ percent: 10 });
      return { directory };
    },
    cancel(taskId) {
      calls.push(['cancel', taskId]);
      return true;
    }
  };

  registerBackupHandlers({
    register: registry.register.bind(registry),
    safeInvoke,
    backupService,
    dialog: { showOpenDialog: async () => dialogResults.shift() },
    app: {
      relaunch: () => relaunched.push('relaunch'),
      quit: () => relaunched.push('quit')
    }
  });

  assert.deepStrictEqual(await registry.invoke('backup:list'), ['backup-1']);

  const automaticEvent = createEvent();
  assert.deepStrictEqual(await registry.invoke('backup:create-automatic', automaticEvent, 'task-1'), { created: true });
  assert.deepStrictEqual(automaticEvent.sent, [['backup:progress', { percent: 40 }]]);

  const destroyedEvent = createEvent();
  destroyedEvent.sender.destroyed = true;
  dialogResults.push({ canceled: false, filePaths: ['/backups/manual'] });
  assert.deepStrictEqual(
    await registry.invoke('backup:create-manual', destroyedEvent, 'task-2'),
    { directory: '/backups/manual' }
  );
  assert.deepStrictEqual(destroyedEvent.sent, [], 'progress is not sent to a destroyed window');

  dialogResults.push({ canceled: true, filePaths: [] });
  assert.strictEqual(await registry.invoke('backup:create-manual', createEvent(), 'task-3'), null);

  dialogResults.push({ canceled: false, filePaths: [] });
  assert.strictEqual(await registry.invoke('backup:restore', createEvent(), 'task-4'), null);

  const restoreEvent = createEvent();
  dialogResults.push({ canceled: false, filePaths: ['/backups/restore'] });
  assert.deepStrictEqual(
    await registry.invoke('backup:restore', restoreEvent, 'task-5'),
    { directory: '/backups/restore' }
  );
  assert.deepStrictEqual(restoreEvent.sent, [['backup:progress', { percent: 10 }]]);
  assert.deepStrictEqual(relaunched, [], 'the application restarts only after the response is delivered');
  await new Promise((resolve) => setTimeout(resolve, 400));
  assert.deepStrictEqual(relaunched, ['relaunch', 'quit']);

  assert.strictEqual(await registry.invoke('backup:cancel', createEvent(), 'task-6'), true);
  assert.deepStrictEqual(calls, [
    ['createAutomatic', true],
    ['createManual', '/backups/manual'],
    ['prepareRestore', '/backups/restore'],
    ['cancel', 'task-6']
  ]);
}

async function runPrintHandlers() {
  const registry = createRegistry();
  const heavyTasks = [];
  const dialogResults = [];
  const printed = [];

  registerPrintHandlers({
    register: registry.register.bind(registry),
    safeInvoke,
    heavyTaskRunner: { cancel: (taskId) => `canceled:${taskId}` },
    runHeavyTask: async (_event, name, payload, options) => {
      heavyTasks.push([name, payload, options]);
      return { name };
    },
    persistentDatabase: { exportSnapshot: () => new Uint8Array([1, 2, 3]) },
    path,
    __dirname: path.join('/app', 'src'),
    dialog: { showSaveDialog: async () => dialogResults.shift() },
    sanitizeExportFilename: (value) => String(value || 'έγγραφο').replace(/[\\/]/g, '_'),
    printCurrentDocument: (sender, options) => {
      printed.push([sender, options]);
      return { printed: true };
    }
  });

  const printEvent = createEvent();
  assert.deepStrictEqual(
    await registry.invoke('print:current-document', printEvent, { landscape: true }),
    { printed: true }
  );
  assert.deepStrictEqual(printed, [[printEvent.sender, { landscape: true }]]);

  assert.strictEqual(await registry.invoke('heavy-task:cancel', createEvent(), 'task-7'), 'canceled:task-7');

  await registry.invoke('database:integrity-check', createEvent(), 'task-8');
  const [integrityName, integrityPayload, integrityOptions] = heavyTasks[0];
  assert.strictEqual(integrityName, 'database-integrity');
  assert.deepStrictEqual([...integrityPayload.snapshot], [1, 2, 3]);
  assert.strictEqual(integrityPayload.sqlJsDirectory, path.join('/app', 'node_modules', 'sql.js', 'dist'));
  assert.strictEqual(integrityOptions.taskId, 'task-8');
  assert.strictEqual(integrityOptions.transferList.length, 1, 'a full snapshot buffer is transferred, not copied');

  dialogResults.push({ canceled: true });
  assert.deepStrictEqual(
    await registry.invoke('export:document', createEvent(), 'excel', { title: 'Καρτέλα' }, 'task-9'),
    { canceled: true }
  );
  assert.strictEqual(heavyTasks.length, 1, 'a canceled dialog does not start an export task');

  dialogResults.push({ canceled: false, filePath: '/exports/Καρτέλα.doc' });
  const wordExport = await registry.invoke(
    'export:document',
    createEvent(),
    'word',
    { title: 'Καρτέλα/2026', html: '<p></p>' },
    'task-10'
  );
  assert.deepStrictEqual(wordExport, {
    canceled: false,
    filePath: '/exports/Καρτέλα.doc',
    message: 'Το αρχείο «Καρτέλα_2026.doc» αποθηκεύτηκε.'
  });
  const [exportName, exportPayload, exportOptions] = heavyTasks[1];
  assert.strictEqual(exportName, 'export-document');
  assert.strictEqual(exportPayload.format, 'word');
  assert.strictEqual(exportPayload.document.title, 'Καρτέλα_2026', 'the sanitized title is exported');
  assert.strictEqual(exportPayload.document.html, '<p></p>');
  assert.strictEqual(exportOptions.taskId, 'task-10');

  dialogResults.push({ canceled: false, filePath: '/exports/other.xlsx' });
  await registry.invoke('export:document', createEvent(), 'κάτι άλλο', { title: 'Άλλο' }, 'task-11');
  assert.strictEqual(heavyTasks[2][1].format, 'excel', 'unknown formats fall back to Excel');
}

async function runSharesHandlers() {
  const registry = createRegistry();
  const calls = [];
  const dialogResults = [];
  const userDataDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-share-photo-'));

  const shares = new Proxy({}, {
    get: (_target, name) => (...args) => {
      calls.push([name, args]);
      return `${String(name)}:ok`;
    }
  });

  registerSharesHandlers({
    register: registry.register.bind(registry),
    safeInvoke,
    services: { shares },
    runHeavyTask: async (_event, name, payload, options) => ({ name, payload, options }),
    dialog: { showOpenDialog: async () => dialogResults.shift() },
    fs,
    path,
    app: { getPath: () => userDataDirectory }
  });

  try {
    assert.strictEqual(await registry.invoke('shares:list'), 'listShares:ok');
    assert.strictEqual(await registry.invoke('shares:get-by-number', createEvent(), '12'), 'getShareByNumber:ok');
    assert.strictEqual(await registry.invoke('shares:add', createEvent(), { shareNumber: '12' }), 'addShare:ok');
    assert.strictEqual(await registry.invoke('shares:get-card', createEvent(), 3, 2026), 'getShareCard:ok');
    assert.strictEqual(await registry.invoke('shares:list-moved-cards', createEvent(), 2026), 'listMovedShareCards:ok');
    assert.strictEqual(await registry.invoke('shares:update-details', createEvent(), 3, {}), 'updateShareDetails:ok');
    assert.strictEqual(await registry.invoke('shares:list-serial-registry'), 'listSerialNumberRegistry:ok');
    assert.strictEqual(await registry.invoke('shares:save-serial-numbers', createEvent(), 3, []), 'saveSerialNumbers:ok');
    assert.strictEqual(await registry.invoke('shares:list-weapon-registry'), 'listWeaponRegistry:ok');
    assert.strictEqual(await registry.invoke('shares:save-weapon-registry', createEvent(), 3, []), 'saveWeaponRegistry:ok');
    assert.strictEqual(await registry.invoke('shares:save-composition', createEvent(), 3, []), 'saveComposition:ok');
    assert.strictEqual(await registry.invoke('shares:save-change-sheet', createEvent(), 3, []), 'saveChangeSheet:ok');
    assert.deepStrictEqual(
      calls.map(([name]) => name),
      [
        'listShares',
        'getShareByNumber',
        'addShare',
        'getShareCard',
        'listMovedShareCards',
        'updateShareDetails',
        'listSerialNumberRegistry',
        'saveSerialNumbers',
        'listWeaponRegistry',
        'saveWeaponRegistry',
        'saveComposition',
        'saveChangeSheet'
      ]
    );
    assert.deepStrictEqual(calls[1][1], ['12']);
    assert.deepStrictEqual(calls[3][1], [3, 2026]);

    const batch = await registry.invoke('shares:get-cards-batch', createEvent(), { taskId: 'task-12', ids: [1] });
    assert.strictEqual(batch.name, 'prepare-share-print');
    assert.strictEqual(batch.options.taskId, 'task-12');
    assert.strictEqual(batch.payload.cards, 'getShareCardsBatch:ok');

    dialogResults.push({ canceled: true, filePaths: [] });
    assert.strictEqual(await registry.invoke('shares:choose-photo'), '');

    dialogResults.push({ canceled: false, filePaths: [] });
    assert.strictEqual(await registry.invoke('shares:choose-photo'), '');

    const textFile = path.join(userDataDirectory, 'not-an-image.png');
    fs.writeFileSync(textFile, 'δεν είναι εικόνα');
    dialogResults.push({ canceled: false, filePaths: [textFile] });
    await assert.rejects(
      registry.invoke('shares:choose-photo'),
      (error) => error.code === 'INVALID_IMAGE_FILE'
    );

    const pngFile = path.join(userDataDirectory, 'φωτογραφία υλικού.png');
    fs.writeFileSync(pngFile, Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(8)
    ]));
    dialogResults.push({ canceled: false, filePaths: [pngFile] });
    const storedPath = await registry.invoke('shares:choose-photo');
    assert.strictEqual(path.dirname(storedPath), path.join(userDataDirectory, 'photos'));
    assert.match(path.basename(storedPath), /^\d+-φωτογραφία_υλικού\.png$/u);
    assert.ok(fs.existsSync(storedPath), 'the selected photo is copied into the user data directory');
  } finally {
    fs.rmSync(userDataDirectory, { recursive: true, force: true });
  }
}

async function run() {
  await runBackupHandlers();
  await runPrintHandlers();
  await runSharesHandlers();
  console.log('ipcHandlerInvocation.test.js: OK');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
