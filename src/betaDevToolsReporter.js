function serializeDiagnostic(value) {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack
    };
  }
  if (typeof value === 'string') return value;
  if (value === undefined) return 'undefined';
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_error) {
    return String(value);
  }
}

function createBetaDevToolsReporter({ enabled, send, maxPending = 100 }) {
  const pending = [];
  let rendererReady = false;

  async function dispatch(entry) {
    try {
      await send(entry);
      return true;
    } catch (_error) {
      return false;
    }
  }

  function remember(entry) {
    pending.push(entry);
    if (pending.length > maxPending) pending.shift();
  }

  function report(...values) {
    if (!enabled) return;
    const entry = {
      source: 'Κύρια διεργασία',
      timestamp: new Date().toISOString(),
      details: values.map(serializeDiagnostic)
    };
    if (!rendererReady) {
      remember(entry);
      return;
    }
    dispatch(entry).then((sent) => {
      if (!sent) remember(entry);
    });
  }

  async function setRendererReady() {
    if (!enabled) return;
    rendererReady = true;
    const queued = pending.splice(0, pending.length);
    for (const entry of queued) {
      if (!(await dispatch(entry))) remember(entry);
    }
  }

  return { report, setRendererReady };
}

function installConsoleErrorMirror({ enabled, reporter, consoleObject = console }) {
  if (!enabled) return () => {};
  const originalError = consoleObject.error;
  consoleObject.error = (...values) => {
    originalError.apply(consoleObject, values);
    reporter.report(...values);
  };
  return () => {
    consoleObject.error = originalError;
  };
}

module.exports = {
  createBetaDevToolsReporter,
  installConsoleErrorMirror,
  serializeDiagnostic
};
