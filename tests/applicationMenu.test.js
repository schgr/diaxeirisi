const assert = require('node:assert/strict');
const {
  shouldShowApplicationMenu,
  shouldToggleDevToolsForInput,
  createApplicationMenuTemplate,
  configureApplicationMenu
} = require('../src/applicationMenu');

assert.equal(shouldShowApplicationMenu('0.13.214'), false);
assert.equal(shouldShowApplicationMenu('0.13.214-beta'), true);
assert.equal(shouldShowApplicationMenu('0.13.214-BETA.1'), true);
assert.equal(shouldShowApplicationMenu(''), false);
assert.equal(
  shouldToggleDevToolsForInput('0.13.237-beta', { type: 'keyDown', key: 'F12' }),
  true
);
assert.equal(
  shouldToggleDevToolsForInput('0.13.237', { type: 'keyDown', key: 'F12' }),
  false
);
assert.equal(
  shouldToggleDevToolsForInput('0.13.237-beta', { type: 'keyDown', key: 'F11' }),
  false
);

let openedWith = null;
const focusedWindow = {
  isDestroyed: () => false,
  webContents: {
    openDevTools(options) {
      openedWith = options;
    }
  }
};
const BrowserWindow = {
  getFocusedWindow: () => focusedWindow
};
const template = createApplicationMenuTemplate(BrowserWindow);
const developerToolsItem = template[0].submenu.find((item) => item.accelerator === 'F12');
assert.ok(developerToolsItem);
developerToolsItem.click();
assert.deepEqual(openedWith, { mode: 'detach', activate: true });

const menuCalls = [];
const Menu = {
  buildFromTemplate(value) {
    menuCalls.push(['build', value]);
    return { value };
  },
  setApplicationMenu(value) {
    menuCalls.push(['set', value]);
  }
};
assert.equal(configureApplicationMenu({ Menu, BrowserWindow, version: '1.0.0' }), null);
assert.equal(menuCalls.at(-1)[1], null);
assert.ok(configureApplicationMenu({ Menu, BrowserWindow, version: '1.0.0-beta' }));
assert.equal(menuCalls.at(-1)[0], 'set');

console.log('Application menu edition tests passed.');
