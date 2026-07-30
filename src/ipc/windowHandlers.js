'use strict';

const CHANNELS = Object.freeze([
  "window:set-fullscreen",
  "window:minimize",
  "window:quit"
]);

function registerWindowHandlers({
  register,
  safeInvoke,
  BrowserWindow,
  app
}) {
  register('window:set-fullscreen', async (event, value) =>
      safeInvoke(() => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
          window.setFullScreen(Boolean(value));
        }
        return window ? window.isFullScreen() : false;
      }, true)
    );
  register('window:minimize', async (event) =>
      safeInvoke(() => {
        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) {
          window.minimize();
        }
        return true;
      }, true)
    );
  register('window:quit', async () =>
      safeInvoke(() => {
        app.quit();
        return true;
      }, true)
    );
}

module.exports = {
  CHANNELS,
  registerWindowHandlers
};
