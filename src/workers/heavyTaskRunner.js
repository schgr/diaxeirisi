const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

const TERMINAL_STATES = new Set(['cancelled', 'completed', 'failed', 'timed-out']);

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
  const requestedConcurrency = Number(options.concurrency || 2);
  const concurrency = Number.isFinite(requestedConcurrency) ? Math.max(1, Math.floor(requestedConcurrency)) : 2;
  const cancelGraceMs = Math.max(10, Number(options.cancelGraceMs || 1000));
  const WorkerClass = options.Worker || Worker;
  const queue = [];
  const tasks = new Map();
  const history = new Map();
  const pendingPromises = new Set();
  const slots = [];
  let accepting = true;
  let closePromise = null;

  function setState(record, state) {
    record.state = state;
    history.set(record.id, state);
    while (history.size > 1000) history.delete(history.keys().next().value);
    if (record.onStateChange) {
      try {
        record.onStateChange({ id: record.id, state });
      } catch (_error) {
        console.error('Σφάλμα σε callback heavy task.', _error);
      }
    }
  }

  function spawnSlot() {
    const slot = { worker: new WorkerClass(workerFile), task: null, retiring: false };
    slots.push(slot);
    slot.worker.on('message', (message) => handleMessage(slot, message));
    slot.worker.on('error', (error) => handleWorkerFailure(slot, error));
    slot.worker.on('exit', (code) => {
      if (!slot.retiring && slot.task) {
        handleWorkerFailure(slot, new Error(`Worker exited with code ${code}`));
      }
    });
    return slot;
  }

  function replaceSlot(slot) {
    const index = slots.indexOf(slot);
    if (index < 0 || !accepting) return;
    slot.retiring = true;
    slot.worker.removeAllListeners();
    void slot.worker.terminate().catch(() => {});
    const replacement = { worker: new WorkerClass(workerFile), task: null, retiring: false };
    slots[index] = replacement;
    replacement.worker.on('message', (message) => handleMessage(replacement, message));
    replacement.worker.on('error', (error) => handleWorkerFailure(replacement, error));
    replacement.worker.on('exit', (code) => {
      if (!replacement.retiring && replacement.task) {
        handleWorkerFailure(replacement, new Error(`Worker exited with code ${code}`));
      }
    });
  }

  function resourceBusy(resource, except) {
    if (!resource) return false;
    return [...tasks.values()].some((item) =>
      item !== except
        && item.resource === resource
        && (item.state === 'running' || item.state === 'cancelling' || item.settling));
  }

  function dispatch() {
    if (!accepting && queue.length === 0) return;
    for (const slot of slots) {
      if (slot.task || slot.retiring) continue;
      const index = queue.findIndex((record) => !resourceBusy(record.resource, record));
      if (index < 0) break;
      const [record] = queue.splice(index, 1);
      if (record.state !== 'queued') continue;
      slot.task = record;
      record.slot = slot;
      setState(record, 'running');
      record.timer = setTimeout(() => timeout(record), record.timeoutMs);
      try {
        slot.worker.postMessage({
          type: 'run',
          id: record.id,
          task: record.task,
          payload: record.payload,
          cancelBuffer: record.cancelBuffer
        }, record.transferList);
      } catch (error) {
        void finish(record, 'failed', new HeavyTaskError(
          'Δεν ήταν δυνατή η αποστολή της εργασίας στον worker.',
          'WORKER_DISPATCH_FAILED',
          error
        ));
      }
    }
  }

  async function finish(record, state, error, result) {
    if (TERMINAL_STATES.has(record.state) || record.settling) return;
    record.settling = true;
    clearTimeout(record.timer);
    clearTimeout(record.forceTimer);
    const slot = record.slot;
    if (slot && slot.task === record) slot.task = null;
    tasks.delete(record.id);
    if (error && record.cleanupPaths.size) {
      await Promise.all([...record.cleanupPaths].map((ownedPath) =>
        fs.promises.rm(ownedPath, { recursive: true, force: true }).catch(() => {})
      ));
    }
    setState(record, state);
    if (error) record.reject(error);
    else record.resolve(result);
    dispatch();
  }

  function forceStop(record, error, state) {
    if (TERMINAL_STATES.has(record.state)) return;
    const slot = record.slot;
    if (slot) replaceSlot(slot);
    void finish(record, state, error);
  }

  function requestCancellation(record, state, error) {
    if (record.state === 'queued') {
      const index = queue.indexOf(record);
      if (index >= 0) queue.splice(index, 1);
      void finish(record, state, error);
      return;
    }
    if (record.state !== 'running' && record.state !== 'cancelling') return;
    record.cancelFinalState = state;
    record.cancelError = error;
    Atomics.store(record.cancelView, 0, 1);
    setState(record, 'cancelling');
    record.slot.worker.postMessage({ type: 'cancel', id: record.id });
    record.forceTimer = setTimeout(() => forceStop(record, error, state), cancelGraceMs);
  }

  function timeout(record) {
    requestCancellation(record, 'timed-out', new HeavyTaskError(
      'Η εργασία ξεπέρασε το επιτρεπόμενο χρονικό όριο.',
      'WORKER_TIMEOUT'
    ));
  }

  function handleMessage(slot, message) {
    const record = slot.task;
    if (!record || !message || message.id !== record.id) return;
    if (message.type === 'progress') {
      if (record.onProgress && record.state === 'running') {
        try {
          record.onProgress({ id: record.id, ...message });
        } catch (_error) {
          console.error('Σφάλμα σε callback heavy task.', _error);
        }
      }
      return;
    }
    if (message.type === 'cleanup-path' && typeof message.path === 'string') {
      record.cleanupPaths.add(path.resolve(message.path));
      return;
    }
    if (message.type === 'result') {
      void finish(record, 'completed', null, message.result);
      return;
    }
    if (message.type === 'error') {
      const canceled = message.error && message.error.code === 'WORKER_CANCELED';
      if (canceled && record.cancelError) {
        void finish(record, record.cancelFinalState, record.cancelError);
      } else {
        void finish(record, canceled ? 'cancelled' : 'failed', new HeavyTaskError(
          message.error.message,
          message.error.code,
          message.error
        ));
      }
    }
  }

  function handleWorkerFailure(slot, cause) {
    const record = slot.task;
    if (!record || TERMINAL_STATES.has(record.state)) return;
    replaceSlot(slot);
    void finish(record, 'failed', new HeavyTaskError(
      'Αποτυχία worker χωρίς τερματισμό της εφαρμογής.',
      'WORKER_CRASH',
      cause
    ));
  }

  function run(task, payload = {}, runOptions = {}) {
    if (!accepting) {
      return Promise.reject(new HeavyTaskError(
        'Δεν γίνονται δεκτές νέες εργασίες κατά το κλείσιμο.',
        'WORKER_CLOSED'
      ));
    }
    const id = String(runOptions.id || crypto.randomUUID());
    if (tasks.has(id) || history.has(id)) {
      return Promise.reject(new HeavyTaskError(
        'Η εργασία εκτελείται ήδη ή το αναγνωριστικό έχει χρησιμοποιηθεί.',
        'WORKER_DUPLICATE'
      ));
    }
    return new Promise((resolve, reject) => {
      const record = {
        id,
        task,
        payload,
        transferList: Array.isArray(runOptions.transferList) ? runOptions.transferList : [],
        timeoutMs: Number(runOptions.timeoutMs || defaultTimeout),
        resource: runOptions.resource || (String(task).startsWith('backup-') ? 'backup' : ''),
        onProgress: runOptions.onProgress,
        onStateChange: runOptions.onStateChange,
        resolve,
        reject,
        state: 'queued',
        slot: null,
        timer: null,
        forceTimer: null,
        cleanupPaths: new Set(),
        settling: false
      };
      record.cancelBuffer = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
      record.cancelView = new Int32Array(record.cancelBuffer);
      tasks.set(id, record);
      setState(record, 'queued');
      queue.push(record);
      dispatch();
    });
  }

  function cancel(id) {
    const record = tasks.get(String(id));
    if (!record || TERMINAL_STATES.has(record.state) || record.state === 'cancelling') return false;
    requestCancellation(record, 'cancelled', new HeavyTaskError(
      'Η εργασία ακυρώθηκε.',
      'WORKER_CANCELED'
    ));
    return true;
  }

  async function close(closeOptions = {}) {
    if (closePromise) return closePromise;
    accepting = false;
    const drain = Boolean(closeOptions.drain);
    closePromise = (async () => {
      if (!drain) {
        for (const record of [...tasks.values()]) cancel(record.id);
      }
      await Promise.allSettled([...pendingPromises]);
      await Promise.all(slots.map(async (slot) => {
        slot.retiring = true;
        slot.worker.removeAllListeners();
        await slot.worker.terminate().catch(() => {});
      }));
    })();
    return closePromise;
  }

  for (let index = 0; index < concurrency; index += 1) spawnSlot();

  // Store the externally observable promise so shutdown can wait for cleanup.
  const originalRun = run;
  function trackedRun(...args) {
    const promise = originalRun(...args);
    pendingPromises.add(promise);
    void promise.then(
      () => pendingPromises.delete(promise),
      () => pendingPromises.delete(promise)
    );
    return promise;
  }

  return {
    run: trackedRun,
    cancel,
    close,
    activeCount: () => tasks.size,
    queuedCount: () => queue.length,
    state: (id) => tasks.get(String(id))?.state || history.get(String(id)),
    isAccepting: () => accepting,
    concurrency
  };
}

module.exports = { createHeavyTaskRunner, HeavyTaskError };
