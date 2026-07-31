function createLogger(scope) {
  function write(level, message, meta) {
    if (level === 'info' && process.env.DCHSI_TEST_QUIET === '1') return;
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] [${scope}] ${message}`;
    if (meta) {
      console[level === 'error' ? 'error' : 'log'](line, meta);
    } else {
      console[level === 'error' ? 'error' : 'log'](line);
    }
  }

  return {
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta)
  };
}

module.exports = {
  createLogger
};
