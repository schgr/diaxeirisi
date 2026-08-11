const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL } = require('url');
const { IPC_CHANNELS } = require('../src/ipc/channelCatalog');
const { createIpcSecurityPolicy } = require('../src/ipc/security');
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
    ipcSecurity: { validate: () => null },
    isWindows7Legacy: false,
    securityService: callable,
    backupService: callable,
    persistentDatabase: callable,
    heavyTaskRunner: callable,
    services: callable,
    runHeavyTask: callable,
    sanitizeExportFilename: callable,
    printCurrentDocument: callable,
    keyCatalogueService: callable
  };
}

async function run() {
  const backupHandlerSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ipc', 'backupHandlers.js'),
    'utf8'
  );
  assert.match(backupHandlerSource, /app\.relaunch\(\)[\s\S]*app\.quit\(\)/u);
  assert.doesNotMatch(backupHandlerSource, /app\.exit\(/u);
  assert.match(backupHandlerSource, /event\.sender[\s\S]*!event\.sender\.isDestroyed\(\)/u);
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
  assert.strictEqual(IPC_CHANNELS.length, 165);

  const registrar = createIpcRegistrar({ handle() {} });
  registrar.register('test:duplicate', () => undefined);
  assert.throws(
    () => registrar.register('test:duplicate', () => undefined),
    /Duplicate IPC handler registration: test:duplicate/
  );

  const securityRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-ipc-security-'));
  const appUrl = pathToFileURL(path.join(securityRoot, 'app', 'index.html')).href;
  const photosRoot = path.join(securityRoot, 'user-data', 'photos');
  fs.mkdirSync(photosRoot, { recursive: true });
  fs.writeFileSync(path.join(photosRoot, 'safe.png'), 'safe');
  const ipcSecurity = createIpcSecurityPolicy({
    isAllowedSenderUrl: (url) => url === appUrl,
    allowedPathRoots: [photosRoot]
  });
  const securedHandlers = new Map();
  const securedRegistrar = createIpcRegistrar({
    handle: (channel, handler) => securedHandlers.set(channel, handler)
  }, ipcSecurity);
  securedRegistrar.register('secured:test', async (_event, payload) => ({ ok: true, data: payload }));
  const validEvent = { sender: { isDestroyed: () => false }, senderFrame: { url: appUrl } };
  assert.deepStrictEqual(await securedHandlers.get('secured:test')(validEvent, {
    photoPath: path.join(photosRoot, 'safe.png')
  }), { ok: true, data: { photoPath: path.join(photosRoot, 'safe.png') } });
  assert.strictEqual(
    (await securedHandlers.get('secured:test')({
      sender: { isDestroyed: () => false },
      senderFrame: { url: 'https://example.test' }
    }, {}))
      .error.code,
    'IPC_SENDER_INVALID'
  );
  assert.strictEqual(
    (await securedHandlers.get('secured:test')(validEvent, { photoPath: path.join(securityRoot, 'secret') }))
      .error.code,
    'IPC_PATH_INVALID'
  );
  const tooDeep = {};
  let cursor = tooDeep;
  for (let index = 0; index < 14; index += 1) cursor = cursor.next = {};
  assert.strictEqual(
    (await securedHandlers.get('secured:test')(validEvent, tooDeep)).error.code,
    'IPC_ARGUMENT_DEPTH'
  );
  fs.rmSync(securityRoot, { recursive: true, force: true });

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
