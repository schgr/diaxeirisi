function createShutdownCoordinator({ app, database, workerRunner, onError }) {
  let shutdownPromise = null;
  let allowQuit = false;
  let continuationScheduled = false;

  async function shutdown() {
    if (!shutdownPromise) {
      shutdownPromise = (async () => {
        let shutdownError;
        try {
          if (database) await Promise.resolve(database.flush());
        } catch (error) {
          shutdownError = error;
        }
        try {
          if (workerRunner) await workerRunner.close();
        } catch (error) {
          if (!shutdownError) shutdownError = error;
        }
        if (shutdownError) throw shutdownError;
      })().catch((error) => {
        shutdownPromise = null;
        throw error;
      });
    }
    return shutdownPromise;
  }

  function beforeQuit(event) {
    if (allowQuit) return;
    event.preventDefault();
    if (continuationScheduled) return;
    continuationScheduled = true;
    shutdown().then(() => {
      allowQuit = true;
      app.quit();
    }).catch((error) => {
      continuationScheduled = false;
      if (onError) onError(error);
    });
  }

  return { beforeQuit, shutdown, isQuitAllowed: () => allowQuit };
}

module.exports = { createShutdownCoordinator };
