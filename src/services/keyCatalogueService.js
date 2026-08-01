'use strict';

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

const SEARCH_RELATIVE_PATH = path.join('_next', 'data');

function findSearchFile(rootPath) {
  const candidates = [
    rootPath,
    path.join(rootPath, 'htdocs')
  ];
  for (const candidate of candidates) {
    const dataRoot = path.join(candidate, SEARCH_RELATIVE_PATH);
    if (!fs.existsSync(dataRoot) || !fs.statSync(dataRoot).isDirectory()) continue;
    const buildDirectories = fs.readdirSync(dataRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .sort((left, right) => left.name.localeCompare(right.name, 'en'));
    for (const directory of buildDirectories) {
      const searchFile = path.join(dataRoot, directory.name, 'search.json');
      if (fs.existsSync(searchFile) && fs.statSync(searchFile).isFile()) return searchFile;
    }
  }
  return null;
}

function createKeyCatalogueService(options = {}) {
  const WorkerClass = options.Worker || Worker;
  const workerFile = options.workerFile || path.join(__dirname, '..', 'workers', 'keyCatalogueWorker.js');
  const configFile = options.configFile || '';
  let worker = null;
  let configuredRoot = '';
  let requestId = 0;
  const pending = new Map();

  function ensureWorker() {
    if (worker) return worker;
    worker = new WorkerClass(workerFile);
    if (typeof worker.unref === 'function') worker.unref();
    worker.on('message', (message) => {
      const record = pending.get(message.id);
      if (!record) return;
      pending.delete(message.id);
      if (message.error) {
        const error = new Error(message.error.message);
        error.code = message.error.code;
        record.reject(error);
      } else {
        record.resolve(message.result);
      }
    });
    const failPending = (error) => {
      for (const record of pending.values()) record.reject(error);
      pending.clear();
      worker = null;
    };
    worker.on('error', failPending);
    worker.on('exit', (code) => {
      if (code !== 0) failPending(Object.assign(
        new Error('Η αναζήτηση στον Κατάλογο ΚΕΥ τερματίστηκε απρόσμενα.'),
        { code: 'KEY_CATALOGUE_WORKER_EXIT' }
      ));
      worker = null;
    });
    return worker;
  }

  function send(type, payload = {}) {
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      pending.set(id, { resolve, reject });
      ensureWorker().postMessage({ id, type, ...payload });
    });
  }

  async function configure(rootPath) {
    const resolvedRoot = path.resolve(String(rootPath || ''));
    const searchFile = findSearchFile(resolvedRoot);
    if (!searchFile) {
      const error = new Error('Ο επιλεγμένος φάκελος δεν περιέχει έγκυρο Κατάλογο ΚΕΥ.');
      error.code = 'KEY_CATALOGUE_INVALID';
      throw error;
    }
    const result = await send('load', { searchFile });
    configuredRoot = resolvedRoot;
    if (configFile) {
      fs.mkdirSync(path.dirname(configFile), { recursive: true });
      fs.writeFileSync(configFile, JSON.stringify({ rootPath: configuredRoot }), 'utf8');
    }
    return { configured: true, itemCount: result.itemCount };
  }

  async function initialize() {
    if (!configFile || !fs.existsSync(configFile)) return status();
    try {
      const saved = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      return await configure(saved.rootPath);
    } catch (_error) {
      configuredRoot = '';
      return status();
    }
  }

  async function search(query, limit = 50) {
    if (!configuredRoot) return { configured: false, items: [] };
    const normalizedQuery = String(query || '').trim();
    if (normalizedQuery.length < 2) return { configured: true, items: [] };
    return {
      configured: true,
      items: await send('search', {
        query: normalizedQuery,
        limit: Math.min(100, Math.max(1, Number(limit) || 50))
      })
    };
  }

  function status() {
    return { configured: Boolean(configuredRoot) };
  }

  async function close() {
    const current = worker;
    worker = null;
    if (current) await current.terminate();
  }

  return { initialize, configure, search, status, close, findSearchFile };
}

module.exports = { createKeyCatalogueService, findSearchFile };
