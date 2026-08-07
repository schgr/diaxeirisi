'use strict';

const { HANDLER_MODULES } = require('./handlerModules');
const { IPC_CHANNELS } = require('./channelCatalog');

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
  let verified = 0;
  for (const module of HANDLER_MODULES) {
    module.register(context);
    const registered = [...registrar.registeredChannels].slice(verified);
    if (
      registered.length !== module.channels.length
      || registered.some((channel, index) => channel !== module.channels[index])
    ) {
      throw new Error(`Registered IPC channels do not match the ${module.name} channel catalog`);
    }
    verified += registered.length;
  }
  const registered = [...registrar.registeredChannels];
  if (registered.length !== IPC_CHANNELS.length) {
    throw new Error('Registered IPC channels do not match the channel catalog');
  }
  return registered;
}

module.exports = { createIpcRegistrar, registerAllIpcHandlers };
