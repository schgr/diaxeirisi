const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  BLOCKED_NETWORK_PATTERNS,
  isRemoteUrlBlocked,
  isAllowedLocalResource,
  applyOfflineSessionPolicy,
  applyOfflineCommandLine
} = require('../src/offlinePolicy');

function run() {
  assert.strictEqual(isRemoteUrlBlocked('http://example.test/data'), true);
  assert.strictEqual(isRemoteUrlBlocked('https://example.test/data'), true);
  assert.strictEqual(isRemoteUrlBlocked('ws://example.test/socket'), true);
  assert.strictEqual(isRemoteUrlBlocked('wss://example.test/socket'), true);

  const localIndex = new URL(`file:///${path.resolve(__dirname, '..', 'src', 'ui', 'index.html').replace(/\\/g, '/')}`);
  assert.strictEqual(isAllowedLocalResource(localIndex.href), true);
  assert.strictEqual(isAllowedLocalResource('data:image/png;base64,AA=='), true);
  assert.strictEqual(isAllowedLocalResource('blob:null/test-id'), true);
  assert.strictEqual(isAllowedLocalResource('https://example.test/app.js'), false);
  assert.strictEqual(fs.existsSync(path.resolve(__dirname, '..', 'src', 'ui', 'index.html')), true);
  assert.strictEqual(fs.existsSync(path.resolve(__dirname, '..', 'src', 'preload.js')), true);

  let permissionRequestAllowed = true;
  let permissionCheckAllowed = true;
  let devicePermissionAllowed = true;
  let requestFilter;
  let requestHandler;
  const mockSession = {
    setPermissionRequestHandler(handler) {
      handler({}, 'camera', (allowed) => { permissionRequestAllowed = allowed; });
    },
    setPermissionCheckHandler(handler) {
      permissionCheckAllowed = handler({}, 'geolocation', 'https://example.test');
    },
    setDevicePermissionHandler(handler) {
      devicePermissionAllowed = handler({ deviceType: 'usb' });
    },
    webRequest: {
      onBeforeRequest(filter, handler) {
        requestFilter = filter;
        requestHandler = handler;
      }
    }
  };
  applyOfflineSessionPolicy(mockSession);
  assert.strictEqual(permissionRequestAllowed, false);
  assert.strictEqual(permissionCheckAllowed, false);
  assert.strictEqual(devicePermissionAllowed, false);
  assert.deepStrictEqual(requestFilter.urls, ['<all_urls>']);
  assert.deepStrictEqual(BLOCKED_NETWORK_PATTERNS, [
    'http://*/*',
    'https://*/*',
    'ws://*/*',
    'wss://*/*'
  ]);

  for (const url of [
    'http://example.test',
    'https://example.test',
    'ws://example.test',
    'wss://example.test'
  ]) {
    let decision;
    requestHandler({ url }, (result) => { decision = result; });
    assert.deepStrictEqual(decision, { cancel: true });
  }
  let localDecision;
  requestHandler({ url: localIndex.href }, (result) => { localDecision = result; });
  assert.deepStrictEqual(localDecision, { cancel: false });

  const switches = [];
  applyOfflineCommandLine({ appendSwitch: (value) => switches.push(value) });
  assert.deepStrictEqual(switches, [
    'disable-background-networking',
    'disable-component-update',
    'disable-client-side-phishing-detection',
    'no-pings'
  ]);

  const mainSource = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main.js'), 'utf8');
  assert.match(mainSource, /offlineOnly:\s*true/);
  assert.doesNotMatch(mainSource, /offlineOnly:\s*isWindows7Legacy/);

  const packageJson = require('../package.json');
  assert.ok(!packageJson.dependencies['electron-updater']);
  assert.ok(!packageJson.dependencies['update-electron-app']);
  console.log('offlinePolicy.test.js: OK');
}

run();
