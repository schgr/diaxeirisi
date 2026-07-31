function createPersistenceCoordinator(options) {
  const persist = options.persist;
  const debounceMs = options.debounceMs === undefined ? 250 : Number(options.debounceMs);
  const maxDelayMs = options.maxDelayMs === undefined ? 2000 : Number(options.maxDelayMs);
  const scheduler = options.scheduler || {
    setTimeout,
    clearTimeout
  };
  const onError = options.onError || (() => {});
  let dirty = false;
  let debounceTimer = null;
  let maximumTimer = null;
  let lastError = null;

  function cancelTimers() {
    if (debounceTimer !== null) scheduler.clearTimeout(debounceTimer);
    if (maximumTimer !== null) scheduler.clearTimeout(maximumTimer);
    debounceTimer = null;
    maximumTimer = null;
  }

  function schedule() {
    if (!dirty) return;
    if (debounceMs <= 0) {
      flush();
      return;
    }
    if (debounceTimer !== null) scheduler.clearTimeout(debounceTimer);
    debounceTimer = scheduler.setTimeout(runScheduledFlush, debounceMs);
    if (debounceTimer && typeof debounceTimer.unref === 'function') debounceTimer.unref();
    if (maximumTimer === null) {
      maximumTimer = scheduler.setTimeout(runScheduledFlush, maxDelayMs);
      if (maximumTimer && typeof maximumTimer.unref === 'function') maximumTimer.unref();
    }
  }

  function runScheduledFlush() {
    cancelTimers();
    try {
      flush();
    } catch (error) {
      onError(error);
      schedule();
    }
  }

  function markDirty(shouldSchedule = true) {
    dirty = true;
    if (shouldSchedule) schedule();
  }

  function flush() {
    cancelTimers();
    if (!dirty) return false;
    try {
      persist();
      dirty = false;
      lastError = null;
      return true;
    } catch (error) {
      dirty = true;
      lastError = error;
      throw error;
    }
  }

  function restoreDirty(value) {
    if (value) {
      dirty = true;
      if (debounceTimer === null && maximumTimer === null) schedule();
    } else {
      dirty = false;
      cancelTimers();
    }
  }

  function close() {
    cancelTimers();
  }

  return {
    markDirty,
    flush,
    close,
    isDirty: () => dirty,
    restoreDirty,
    lastError: () => lastError
  };
}

module.exports = { createPersistenceCoordinator };
