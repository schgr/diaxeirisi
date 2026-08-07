'use strict';

const authHandlers = require('./authHandlers');
const backupHandlers = require('./backupHandlers');
const windowHandlers = require('./windowHandlers');
const printHandlers = require('./printHandlers');
const sharesHandlers = require('./sharesHandlers');
const settingsHandlers = require('./settingsHandlers');
const transactionsHandlers = require('./transactionsHandlers');
const requestsHandlers = require('./requestsHandlers');
const inventoryHandlers = require('./inventoryHandlers');
const administrationHandlers = require('./administrationHandlers');

const HANDLER_MODULES = Object.freeze([
  { name: 'auth', channels: authHandlers.CHANNELS, register: authHandlers.registerAuthHandlers },
  { name: 'backup', channels: backupHandlers.CHANNELS, register: backupHandlers.registerBackupHandlers },
  { name: 'window', channels: windowHandlers.CHANNELS, register: windowHandlers.registerWindowHandlers },
  { name: 'print', channels: printHandlers.CHANNELS, register: printHandlers.registerPrintHandlers },
  { name: 'shares', channels: sharesHandlers.CHANNELS, register: sharesHandlers.registerSharesHandlers },
  { name: 'settings', channels: settingsHandlers.CHANNELS, register: settingsHandlers.registerSettingsHandlers },
  {
    name: 'transactions',
    channels: transactionsHandlers.CHANNELS,
    register: transactionsHandlers.registerTransactionsHandlers
  },
  { name: 'requests', channels: requestsHandlers.CHANNELS, register: requestsHandlers.registerRequestsHandlers },
  { name: 'inventory', channels: inventoryHandlers.CHANNELS, register: inventoryHandlers.registerInventoryHandlers },
  {
    name: 'administration',
    channels: administrationHandlers.CHANNELS,
    register: administrationHandlers.registerAdministrationHandlers
  }
].map((module) => Object.freeze(module)));

module.exports = { HANDLER_MODULES };
