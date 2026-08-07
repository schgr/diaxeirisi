'use strict';

const { HANDLER_MODULES } = require('./handlerModules');

const IPC_CHANNELS = Object.freeze(
  HANDLER_MODULES.flatMap((module) => module.channels)
);

module.exports = { IPC_CHANNELS };
