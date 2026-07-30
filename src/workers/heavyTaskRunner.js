const path = require('path');
const { Worker } = require('worker_threads');

class HeavyTaskError extends Error {
  constructor(message, code, cause) {
    super(message);
    this.name = 'HeavyTaskError';
    this.code = code;
    this.cause = cause;
  }
}

function createHeavyTaskRunner(options = {}) {
  const workerFile = options.workerFile || path.join(__dirname, 'heavyTaskWorker.js');
  const defaultTimeout = options.defaultTimeout || 120000;
  const active = new Map();

  function run(task, payload = {}, runOptions = {}) {
    const id = String(runOptions.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    if (active.has(id)) {
      return Promise.reject(new HeavyTaskError('Η εργασία εκτελείται ήδη.', 'WORKER_DUPLICATE'));
    }
    const timeoutMs = Number(runOptions.timeoutMs || defaultTimeout);
    const worker = new Worker(workerFile);
    active.set(id, worker);

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = async (error, result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        active.delete(id);
        worker.removeAllListeners();
        await worker.terminate().catch(() => {});
        if (error) reject(error);
        else resolve(result);
      };
      const timer = setTimeout(() => {
        finish(new HeavyTaskError('Η εργασία ξεπέρασε το επιτρεπόμενο χρονικό όριο.', 'WORKER_TIMEOUT'));
      }, timeoutMs);
      worker.on('message', (message) => {
        if (message.type === 'progress') {
          if (runOptions.onProgress) runOptions.onProgress({ id, ...message });
        } else if (message.type === 'result') {
          finish(null, message.result);
        } else if (message.type === 'error') {
          finish(new HeavyTaskError(message.error.message, message.error.code, message.error));
        }
      });
      worker.on('error', (error) => {
        finish(new HeavyTaskError('Αποτυχία worker χωρίς τερματισμό της εφαρμογής.', 'WORKER_CRASH', error));
      });
      worker.on('exit', (code) => {
        if (!settled) {
          finish(new HeavyTaskError(`Ο worker τερματίστηκε απρόσμενα (${code}).`, 'WORKER_CRASH'));
        }
      });
      worker.postMessage({ type: 'run', task, payload });
    });
  }

  function cancel(id) {
    const worker = active.get(String(id));
    if (!worker) return false;
    worker.postMessage({ type: 'cancel' });
    return true;
  }

  async function close() {
    const workers = [...active.values()];
    active.clear();
    await Promise.all(workers.map((worker) => worker.terminate().catch(() => {})));
  }

  return { run, cancel, close, activeCount: () => active.size };
}

module.exports = { createHeavyTaskRunner, HeavyTaskError };
