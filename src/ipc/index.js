'use strict';

const { registerAuthHandlers } = require('./authHandlers');
const { registerBackupHandlers } = require('./backupHandlers');
const { registerWindowHandlers } = require('./windowHandlers');
const { registerPrintHandlers } = require('./printHandlers');
const { registerSharesHandlers } = require('./sharesHandlers');
const { registerSettingsHandlers } = require('./settingsHandlers');
const { registerTransactionsHandlers } = require('./transactionsHandlers');
const { registerRequestsHandlers } = require('./requestsHandlers');
const { registerInventoryHandlers } = require('./inventoryHandlers');
const { registerAdministrationHandlers } = require('./administrationHandlers');
const { IPC_CHANNELS } = require('./channelCatalog');

const REGISTRARS = Object.freeze([
  registerAuthHandlers,
  registerBackupHandlers,
  registerWindowHandlers,
  registerPrintHandlers,
  registerSharesHandlers,
  registerSettingsHandlers,
  registerTransactionsHandlers,
  registerRequestsHandlers,
  registerInventoryHandlers,
  registerAdministrationHandlers
]);

function createIpcRegistrar(ipcMain, ipcSecurity) {
  const registeredChannels = new Set();
  return {
    registeredChannels,
    register(channel, handler) {
      if (registeredChannels.has(channel)) {
        throw new Error(`Duplicate IPC handler registration: ${channel}`);
      }
      registeredChannels.add(channel);
      ipcMain.handle(channel, async (event, ...args) => {
        const validationError = ipcSecurity && ipcSecurity.validate(event, args);
        if (validationError) {
          return {
            ok: false,
            error: {
              message: 'Μη έγκυρη προέλευση ή δεδομένα IPC.',
              code: validationError,
              details: null
            }
          };
        }
        return handler(event, ...args);
      });
    }
  };
}

function registerAllIpcHandlers(ipcMain, dependencies) {
  const registrar = createIpcRegistrar(ipcMain, dependencies.ipcSecurity);
  const context = { ...dependencies, register: registrar.register };
  for (const registerHandlers of REGISTRARS) registerHandlers(context);
  const registered = [...registrar.registeredChannels];
  if (
    registered.length !== IPC_CHANNELS.length
    || registered.some((channel, index) => channel !== IPC_CHANNELS[index])
  ) {
    throw new Error('Registered IPC channels do not match the channel catalog');
  }
  return registered;
}

module.exports = { createIpcRegistrar, registerAllIpcHandlers };
