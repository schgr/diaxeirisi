'use strict';

const path = require('path');
const fs = require('fs');

const MAX_ARGUMENT_DEPTH = 12;
const MAX_ARGUMENT_ITEMS = 100000;
const MAX_ARGUMENT_CHARS = 16 * 1024 * 1024;

function senderUrl(event) {
  if (event && event.senderFrame && typeof event.senderFrame.url === 'string') {
    return event.senderFrame.url;
  }
  if (event && event.sender && typeof event.sender.getURL === 'function') {
    return event.sender.getURL();
  }
  return '';
}

function validateValue(value, state, depth = 0) {
  if (depth > MAX_ARGUMENT_DEPTH) return 'IPC_ARGUMENT_DEPTH';
  state.items += 1;
  if (state.items > MAX_ARGUMENT_ITEMS) return 'IPC_ARGUMENT_SIZE';
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    state.chars += value.length;
    return state.chars > MAX_ARGUMENT_CHARS ? 'IPC_ARGUMENT_SIZE' : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'IPC_ARGUMENT_TYPE';
  if (typeof value === 'boolean') return null;
  if (typeof value !== 'object') return 'IPC_ARGUMENT_TYPE';
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer || value instanceof Date) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const error = validateValue(item, state, depth + 1);
      if (error) return error;
    }
    return null;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return 'IPC_ARGUMENT_TYPE';
  for (const [key, item] of Object.entries(value)) {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
      return 'IPC_ARGUMENT_KEY';
    }
    const error = validateValue(item, state, depth + 1);
    if (error) return error;
  }
  return null;
}

function containsInvalidPath(value, isAllowedPath, depth = 0) {
  if (!value || typeof value !== 'object' || depth > MAX_ARGUMENT_DEPTH || ArrayBuffer.isView(value)) {
    return false;
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsInvalidPath(item, isAllowedPath, depth + 1));
  }
  return Object.entries(value).some(([key, item]) =>
    (/path$/i.test(key) && typeof item === 'string' && !isAllowedPath(item))
    || containsInvalidPath(item, isAllowedPath, depth + 1));
}

function createIpcSecurityPolicy(options = {}) {
  const isAllowedSenderUrl = options.isAllowedSenderUrl || (() => false);
  const allowedPathRoots = (options.allowedPathRoots || []).map((root) => path.resolve(root));

  function isAllowedPath(value) {
    if (!value) return true;
    let candidate;
    try {
      candidate = fs.realpathSync.native(String(value));
    } catch (_error) {
      return false;
    }
    return allowedPathRoots.some((root) => {
      let canonicalRoot;
      try {
        canonicalRoot = fs.realpathSync.native(root);
      } catch (_error) {
        return false;
      }
      const relative = path.relative(canonicalRoot, candidate);
      return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
    });
  }

  function validate(event, args) {
    if (!event || !event.sender || (typeof event.sender.isDestroyed === 'function' && event.sender.isDestroyed())) {
      return 'IPC_SENDER_INVALID';
    }
    if (event.senderFrame && event.sender.mainFrame && event.senderFrame !== event.sender.mainFrame) {
      return 'IPC_SENDER_INVALID';
    }
    if (!isAllowedSenderUrl(senderUrl(event))) return 'IPC_SENDER_INVALID';
    const argumentError = validateValue(args, { items: 0, chars: 0 });
    if (argumentError) return argumentError;
    if (containsInvalidPath(args, isAllowedPath)) return 'IPC_PATH_INVALID';
    return null;
  }

  return { validate, isAllowedPath };
}

module.exports = {
  createIpcSecurityPolicy,
  senderUrl,
  validateValue
};
