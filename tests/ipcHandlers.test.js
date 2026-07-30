const assert = require('assert');
const path = require('path');
const { IPC_CHANNELS } = require('../src/ipc/channelCatalog');
const {
  createIpcRegistrar,
  registerAllIpcHandlers
} = require('../src/ipc');

function createDependencies(safeInvoke) {
  const callable = new Proxy(() => undefined, {
    get: () => callable,
    apply: () => undefined
  });
  return {
    safeInvoke,
    app: callable,
    BrowserWindow: callable,
    dialog: callable,
    fs: callable,
    path,
    __dirname: path.resolve(__dirname, '..', 'src'),
    offlineOnly: true,
    isWindows7Legacy: false,
    securityService: callable,
    backupService: callable,
    persistentDatabase: callable,
    heavyTaskRunner: callable,
    services: callable,
    runHeavyTask: callable,
    sanitizeExportFilename: callable,
    printCurrentDocument: callable
  };
}

async function run() {
  const handlers = new Map();
  const registered = registerAllIpcHandlers(
    {
      handle(channel, handler) {
        assert.strictEqual(handlers.has(channel), false, `duplicate ipcMain.handle: ${channel}`);
        handlers.set(channel, handler);
      }
    },
    createDependencies((_operation, allowLocked = false) => ({ allowLocked }))
  );

  assert.deepStrictEqual(registered, IPC_CHANNELS);
  assert.deepStrictEqual([...handlers.keys()], IPC_CHANNELS);
  assert.strictEqual(IPC_CHANNELS.length, 156);

  const registrar = createIpcRegistrar({ handle() {} });
  registrar.register('test:duplicate', () => undefined);
  assert.throws(
    () => registrar.register('test:duplicate', () => undefined),
    /Duplicate IPC handler registration: test:duplicate/
  );

  const expectedAllowLocked = [
    'app:get-version',
    'app:get-runtime-info',
    'auth:status',
    'auth:setup',
    'auth:login',
    'auth:answer-security-questions',
    'auth:recover',
    'window:set-fullscreen',
    'window:minimize',
    'window:quit',
    'heavy-task:cancel'
  ];
  for (const channel of expectedAllowLocked) {
    const result = await handlers.get(channel)();
    assert.strictEqual(result.allowLocked, true, `${channel} must remain available while locked`);
  }

  for (const channel of ['auth:change-password', 'backup:list', 'print:current-document']) {
    const result = await handlers.get(channel)();
    assert.strictEqual(result.allowLocked, false, `${channel} must remain locked`);
  }

  const smokeCalls = [];
  const smokeHandlers = new Map();
  const smokeDependencies = createDependencies(async (operation) => ({
    ok: true,
    data: await operation()
  }));
  smokeDependencies.securityService = {
    login(username) {
      smokeCalls.push(`login:${username}`);
      return true;
    }
  };
  smokeDependencies.services = {
    shares: { listShares: () => smokeCalls.push('shares') },
    transactions: { getStructure: () => smokeCalls.push('transactions') },
    settings: { getSettings: () => smokeCalls.push('settings') }
  };
  smokeDependencies.backupService = {
    list: () => smokeCalls.push('backup')
  };
  smokeDependencies.printCurrentDocument = () => smokeCalls.push('print');
  registerAllIpcHandlers(
    { handle: (channel, handler) => smokeHandlers.set(channel, handler) },
    smokeDependencies
  );
  await smokeHandlers.get('auth:login')(null, 'operator', 'secret');
  await smokeHandlers.get('shares:list')();
  await smokeHandlers.get('transactions:get-structure')();
  await smokeHandlers.get('settings:get')();
  await smokeHandlers.get('backup:list')();
  await smokeHandlers.get('print:current-document')({ sender: {} }, {});
  assert.deepStrictEqual(smokeCalls, [
    'login:operator',
    'shares',
    'transactions',
    'settings',
    'backup',
    'print'
  ]);

  console.log(`ipcHandlers.test.js: OK (${IPC_CHANNELS.length} unique channels)`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
