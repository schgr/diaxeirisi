const path = require('path');
const fs = require('fs');
const { fileURLToPath } = require('url');

const NETWORK_PROTOCOLS = new Set(['http:', 'https:', 'ws:', 'wss:']);
const EMBEDDED_PROTOCOLS = new Set(['data:', 'blob:']);
const appliedSessions = new WeakSet();

function isPathInside(candidate, root) {
  let resolvedCandidate;
  let resolvedRoot;
  try {
    resolvedCandidate = fs.realpathSync.native(candidate);
    resolvedRoot = fs.realpathSync.native(root);
  } catch (_error) {
    return false;
  }
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function filePathFromUrl(value) {
  try {
    const parsed = new URL(String(value));
    if (parsed.protocol !== 'file:') return null;
    return fileURLToPath(parsed);
  } catch (_error) {
    return null;
  }
}

function createOfflinePolicy(options = {}) {
  const appRoot = path.resolve(options.appPath || process.cwd());
  const userDataRoot = path.resolve(options.userDataPath || appRoot);
  const allowedFileRoots = Object.freeze([
    appRoot,
    path.join(userDataRoot, 'photos')
  ]);
  const canonicalRoots = new Map();
  const canonicalRoot = (root) => {
    if (canonicalRoots.has(root)) return canonicalRoots.get(root);
    try {
      const canonical = fs.realpathSync.native(root);
      canonicalRoots.set(root, canonical);
      return canonical;
    } catch (_error) {
      return null;
    }
  };
  const canonicalAppRoot = canonicalRoot(appRoot);

  function fileUrlInside(value, roots) {
    const candidate = filePathFromUrl(value);
    if (!candidate) return false;
    let canonicalCandidate;
    try {
      canonicalCandidate = fs.realpathSync.native(candidate);
    } catch (_error) {
      return false;
    }
    return roots.some((root) => {
      const resolvedRoot = canonicalRoot(root);
      if (!resolvedRoot) return false;
      const relative = path.relative(resolvedRoot, canonicalCandidate);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  }

  function isAllowedFileUrl(value) {
    return fileUrlInside(value, allowedFileRoots);
  }

  function isAllowedAppAssetUrl(value) {
    return canonicalAppRoot ? fileUrlInside(value, [canonicalAppRoot]) : false;
  }

  function isAllowedRequestUrl(value) {
    try {
      const parsed = new URL(String(value));
      if (parsed.protocol === 'file:') return isAllowedFileUrl(parsed.href);
      if (parsed.protocol === 'devtools:' || parsed.protocol === 'chrome-devtools:') return true;
      // No production flow requires arbitrary data/blob resources.
      if (EMBEDDED_PROTOCOLS.has(parsed.protocol)) return false;
      if (NETWORK_PROTOCOLS.has(parsed.protocol)) return false;
      return parsed.protocol === 'about:' && parsed.href === 'about:blank';
    } catch (_error) {
      return false;
    }
  }

  function isAllowedNavigationUrl(value) {
    return isAllowedAppAssetUrl(value);
  }

  function applyToSession(targetSession) {
    if (!targetSession) throw new TypeError('Electron session is required.');
    if (appliedSessions.has(targetSession)) return false;
    appliedSessions.add(targetSession);

    targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    if (typeof targetSession.setPermissionCheckHandler === 'function') {
      targetSession.setPermissionCheckHandler(() => false);
    }
    if (typeof targetSession.setDevicePermissionHandler === 'function') {
      targetSession.setDevicePermissionHandler(() => false);
    }
    if (typeof targetSession.setUSBProtectedClassesHandler === 'function') {
      targetSession.setUSBProtectedClassesHandler(() => []);
    }
    targetSession.webRequest.onBeforeRequest(
      { urls: ['<all_urls>'] },
      (details, callback) => callback({ cancel: !isAllowedRequestUrl(details.url) })
    );
    targetSession.on('will-download', (event, item) => {
      event.preventDefault();
      if (item && typeof item.cancel === 'function') item.cancel();
    });
    return true;
  }

  function hardenWebContents(webContents) {
    webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const blockRemoteNavigation = (event, targetUrl) => {
      if (!isAllowedNavigationUrl(targetUrl)) event.preventDefault();
    };
    webContents.on('will-navigate', blockRemoteNavigation);
    webContents.on('will-redirect', blockRemoteNavigation);
    webContents.on('will-attach-webview', (event) => event.preventDefault());
  }

  return {
    allowedFileRoots,
    isAllowedAppAssetUrl,
    isAllowedFileUrl,
    isAllowedRequestUrl,
    isAllowedNavigationUrl,
    applyToSession,
    hardenWebContents
  };
}

function applyOfflineCommandLine(commandLine) {
  for (const value of [
    'disable-background-networking',
    'disable-component-update',
    'disable-client-side-phishing-detection',
    'disable-domain-reliability',
    'no-pings'
  ]) {
    commandLine.appendSwitch(value);
  }
}

module.exports = {
  createOfflinePolicy,
  applyOfflineCommandLine,
  filePathFromUrl,
  isPathInside
};
