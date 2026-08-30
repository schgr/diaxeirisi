const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  createOfflinePolicy,
  applyOfflineCommandLine
} = require('../src/offlinePolicy');

function createMockSession() {
  const state = {};
  return {
    state,
    setPermissionRequestHandler(handler) { state.permissionRequest = handler; },
    setPermissionCheckHandler(handler) { state.permissionCheck = handler; },
    setDevicePermissionHandler(handler) { state.devicePermission = handler; },
    setUSBProtectedClassesHandler(handler) { state.usbProtectedClasses = handler; },
    webRequest: {
      onBeforeRequest(filter, handler) {
        state.requestFilter = filter;
        state.request = handler;
      }
    },
    on(name, handler) { state[name] = handler; }
  };
}

function requestDecision(mockSession, url, resourceType = 'xhr') {
  let decision;
  mockSession.state.request({ url, resourceType }, (result) => { decision = result; });
  return decision;
}

function createMockWebContents() {
  const handlers = new Map();
  return {
    handlers,
    setWindowOpenHandler(handler) { this.openHandler = handler; },
    on(name, handler) { handlers.set(name, handler); }
  };
}

function prevented(handler, url) {
  let wasPrevented = false;
  handler({ preventDefault: () => { wasPrevented = true; } }, url);
  return wasPrevented;
}

function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-offline-'));
  try {
    const appPath = path.join(root, 'application');
    const userDataPath = path.join(root, 'user-data');
    const appAsset = path.join(appPath, 'src', 'ui', 'index.html');
    const photo = path.join(userDataPath, 'photos', 'material.png');
    const secretDatabase = path.join(userDataPath, 'data', 'dchsi.sqlite');
    fs.mkdirSync(path.dirname(appAsset), { recursive: true });
    fs.mkdirSync(path.dirname(photo), { recursive: true });
    fs.mkdirSync(path.dirname(secretDatabase), { recursive: true });
    fs.writeFileSync(appAsset, '<!doctype html>');
    fs.writeFileSync(photo, 'photo');
    fs.writeFileSync(secretDatabase, 'private');

    for (const buildFlavor of ['standard', 'win7-legacy']) {
      const policy = createOfflinePolicy({ appPath, userDataPath, buildFlavor });
      assert.strictEqual(policy.isAllowedRequestUrl(pathToFileURL(appAsset).href), true);
      assert.strictEqual(policy.isAllowedRequestUrl(pathToFileURL(photo).href), true);
      assert.strictEqual(policy.isAllowedRequestUrl(pathToFileURL(secretDatabase).href), false);
      assert.strictEqual(policy.isAllowedRequestUrl(pathToFileURL(path.join(root, 'outside.txt')).href), false);
      assert.strictEqual(policy.isAllowedRequestUrl('data:image/png;base64,AA=='), false);
      assert.strictEqual(policy.isAllowedRequestUrl('blob:null/test-id'), false);
      assert.strictEqual(policy.isAllowedRequestUrl('about:blank'), true);
      assert.strictEqual(policy.isAllowedNavigationUrl('about:blank'), false);
      assert.strictEqual(policy.isAllowedAppAssetUrl(pathToFileURL(photo).href), false);

      const defaultSession = createMockSession();
      const partitionSession = createMockSession();
      assert.strictEqual(policy.applyToSession(defaultSession), true);
      assert.strictEqual(policy.applyToSession(defaultSession), false);
      assert.strictEqual(policy.applyToSession(partitionSession), true);
      assert.deepStrictEqual(defaultSession.state.requestFilter.urls, ['<all_urls>']);

      let permissionAllowed = true;
      defaultSession.state.permissionRequest({}, 'camera', (allowed) => { permissionAllowed = allowed; });
      assert.strictEqual(permissionAllowed, false);
      assert.strictEqual(defaultSession.state.permissionCheck({}, 'geolocation', 'file:///app'), false);
      assert.strictEqual(defaultSession.state.devicePermission({ deviceType: 'usb' }), false);
      assert.deepStrictEqual(defaultSession.state.usbProtectedClasses(), []);

      for (const remoteUrl of [
        'http://example.test/fetch',
        'https://example.test/xhr',
        'ws://example.test/socket',
        'wss://example.test/socket',
        'https://example.test/redirect-target'
      ]) {
        assert.deepStrictEqual(requestDecision(defaultSession, remoteUrl), { cancel: true });
      }
      assert.deepStrictEqual(requestDecision(defaultSession, pathToFileURL(appAsset).href, 'script'),
        { cancel: false });
      assert.deepStrictEqual(requestDecision(defaultSession, pathToFileURL(secretDatabase).href, 'xhr'),
        { cancel: true });

      let downloadPrevented = false;
      let downloadCancelled = false;
      defaultSession.state['will-download'](
        { preventDefault: () => { downloadPrevented = true; } },
        { cancel: () => { downloadCancelled = true; } }
      );
      assert.strictEqual(downloadPrevented, true);
      assert.strictEqual(downloadCancelled, true);

      const webContents = createMockWebContents();
      policy.hardenWebContents(webContents);
      assert.deepStrictEqual(webContents.openHandler({ url: 'https://example.test' }), { action: 'deny' });
      assert.strictEqual(prevented(webContents.handlers.get('will-navigate'), 'https://example.test'), true);
      assert.strictEqual(prevented(webContents.handlers.get('will-redirect'), 'https://example.test'), true);
      assert.strictEqual(prevented(webContents.handlers.get('will-navigate'), pathToFileURL(appAsset).href), false);
      assert.strictEqual(prevented(webContents.handlers.get('will-navigate'), pathToFileURL(photo).href), true);
      let webviewPrevented = false;
      webContents.handlers.get('will-attach-webview')({
        preventDefault: () => { webviewPrevented = true; }
      });
      assert.strictEqual(webviewPrevented, true);
    }

    const switches = [];
    applyOfflineCommandLine({ appendSwitch: (value) => switches.push(value) });
    assert.deepStrictEqual(switches, [
      'disable-background-networking',
      'disable-component-update',
      'disable-client-side-phishing-detection',
      'disable-domain-reliability',
      'no-pings'
    ]);

    const mainSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main.js'), 'utf8');
    assert.match(mainSource, /app\.on\('session-created'/);
    assert.match(mainSource, /offlineOnly:\s*true/);
    assert.match(mainSource, /contextIsolation:\s*true/);
    assert.match(mainSource, /nodeIntegration:\s*false/);
    assert.match(mainSource, /sandbox:\s*true/);
    assert.doesNotMatch(mainSource, /offlineOnly:\s*isWindows7Legacy/);
    const htmlSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'ui', 'index.html'), 'utf8');
    assert.match(htmlSource, /connect-src 'none'/);
    assert.match(htmlSource, /object-src 'none'/);
    assert.match(htmlSource, /frame-src 'none'/);

    const packageJson = require('../package.json');
    assert.ok(!packageJson.dependencies['electron-updater']);
    assert.ok(!packageJson.dependencies['update-electron-app']);
    console.log('offlinePolicy.test.js: OK');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

run();
