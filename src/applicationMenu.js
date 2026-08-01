function shouldShowApplicationMenu(version) {
  return String(version || '').toLowerCase().includes('beta');
}

function shouldToggleDevToolsForInput(version, input) {
  return shouldShowApplicationMenu(version)
    && input?.type === 'keyDown'
    && String(input.key || '').toUpperCase() === 'F12';
}

function createApplicationMenuTemplate(BrowserWindow) {
  return [
    {
      label: 'Προβολή',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        {
          label: 'Εργαλεία προγραμματιστή',
          accelerator: 'F12',
          click() {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow && !focusedWindow.isDestroyed()) {
              focusedWindow.webContents.openDevTools({ mode: 'detach', activate: true });
            }
          }
        },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    }
  ];
}

function configureApplicationMenu({ Menu, BrowserWindow, version }) {
  if (!shouldShowApplicationMenu(version)) {
    Menu.setApplicationMenu(null);
    return null;
  }
  const menu = Menu.buildFromTemplate(createApplicationMenuTemplate(BrowserWindow));
  Menu.setApplicationMenu(menu);
  return menu;
}

module.exports = {
  shouldShowApplicationMenu,
  shouldToggleDevToolsForInput,
  createApplicationMenuTemplate,
  configureApplicationMenu
};
