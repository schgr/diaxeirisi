const BLOCKED_NETWORK_PATTERNS = Object.freeze([
  'http://*/*',
  'https://*/*',
  'ws://*/*',
  'wss://*/*'
]);

const LOCAL_RESOURCE_PROTOCOLS = new Set(['file:', 'data:', 'blob:', 'about:']);
const REMOTE_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);

function isRemoteUrlBlocked(value) {
  try {
    return REMOTE_PROTOCOLS.has(new URL(String(value)).protocol.toLowerCase());
  } catch (_error) {
    return true;
  }
}

function isAllowedLocalResource(value) {
  try {
    return LOCAL_RESOURCE_PROTOCOLS.has(new URL(String(value)).protocol.toLowerCase());
  } catch (_error) {
    return false;
  }
}

function applyOfflineSessionPolicy(targetSession) {
  if (!targetSession) throw new TypeError('Electron session is required.');

  targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });
  if (typeof targetSession.setPermissionCheckHandler === 'function') {
    targetSession.setPermissionCheckHandler(() => false);
  }
  if (typeof targetSession.setDevicePermissionHandler === 'function') {
    targetSession.setDevicePermissionHandler(() => false);
  }
  targetSession.webRequest.onBeforeRequest(
    { urls: ['<all_urls>'] },
    (details, callback) => callback({ cancel: !isAllowedLocalResource(details.url) })
  );
}

function applyOfflineCommandLine(commandLine) {
  for (const value of [
    'disable-background-networking',
    'disable-component-update',
    'disable-client-side-phishing-detection',
    'no-pings'
  ]) {
    commandLine.appendSwitch(value);
  }
}

module.exports = {
  BLOCKED_NETWORK_PATTERNS,
  LOCAL_RESOURCE_PROTOCOLS,
  isRemoteUrlBlocked,
  isAllowedLocalResource,
  applyOfflineSessionPolicy,
  applyOfflineCommandLine
};
