const assert = require('assert');
const fs = require('fs');
const os = require('os');
const { performance } = require('perf_hooks');
const path = require('path');
const initSqlJs = require('sql.js');
const { createHeavyTaskRunner } = require('../src/workers/heavyTaskRunner');

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error && error.code === code);
}

async function run() {
  const runner = createHeavyTaskRunner({ defaultTimeout: 1000, concurrency: 2, cancelGraceMs: 30 });
  try {
    assert.strictEqual(runner.concurrency, 2);
    const progress = [];
    const cards = Array.from({ length: 250 }, (_unused, id) => ({ id }));
    const result = await runner.run('prepare-share-print', { cards }, {
      id: 'success',
      onProgress: (event) => progress.push(event)
    });
    assert.deepStrictEqual(result, cards);
    assert.ok(progress.length >= 3);
    assert.strictEqual(runner.activeCount(), 0);
    assert.strictEqual(runner.state('success'), 'completed');
    let generatedId = '';
    await runner.run('__test-delay', { duration: 0 }, {
      onStateChange: ({ id }) => { generatedId = id; }
    });
    assert.match(generatedId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const queueRunner = createHeavyTaskRunner({ defaultTimeout: 1000, concurrency: 1 });
    const states = [];
    const first = queueRunner.run('__test-delay', { duration: 80, value: 'first' }, {
      id: 'queue-first',
      onStateChange: ({ state }) => states.push(`first:${state}`)
    });
    const second = queueRunner.run('__test-delay', { duration: 10, value: 'second' }, {
      id: 'queue-second',
      onStateChange: ({ state }) => states.push(`second:${state}`)
    });
    assert.strictEqual(queueRunner.state('queue-second'), 'queued');
    assert.strictEqual(queueRunner.queuedCount(), 1);
    await expectCode(queueRunner.run('__test-delay', {}, { id: 'queue-second' }), 'WORKER_DUPLICATE');
    assert.deepStrictEqual(await Promise.all([first, second]), ['first', 'second']);
    assert.deepStrictEqual(states, [
      'first:queued', 'first:running', 'second:queued',
      'first:completed', 'second:running', 'second:completed'
    ]);
    await expectCode(queueRunner.run('__test-delay', {}, { id: 'queue-second' }), 'WORKER_DUPLICATE');
    await queueRunner.close();

    const sqlJsDirectory = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist');
    const SQL = await initSqlJs({ locateFile: (file) => path.join(sqlJsDirectory, file) });
    const database = new SQL.Database();
    database.exec('CREATE TABLE check_me (id INTEGER PRIMARY KEY); INSERT INTO check_me VALUES (1);');
    const integrity = await runner.run('database-integrity', {
      snapshot: database.export(),
      sqlJsDirectory
    }, { id: 'integrity' });
    database.close();
    assert.deepStrictEqual(integrity, { ok: true, details: ['ok'] });

    const canceled = runner.run('__test-delay', { duration: 1000 }, { id: 'cancel' });
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.strictEqual(runner.cancel('cancel'), true);
    await expectCode(canceled, 'WORKER_CANCELED');
    assert.strictEqual(runner.state('cancel'), 'cancelled');
    assert.strictEqual(runner.cancel('cancel'), false);

    const blocker = runner.run('__test-delay', { duration: 100 }, {
      id: 'cancel-blocker', resource: 'serial'
    });
    const cancelQueued = runner.run('__test-delay', { duration: 10 }, {
      id: 'cancel-queued', resource: 'serial'
    });
    assert.strictEqual(runner.state('cancel-queued'), 'queued');
    assert.strictEqual(runner.cancel('cancel-queued'), true);
    await expectCode(cancelQueued, 'WORKER_CANCELED');
    await blocker;

    await expectCode(
      runner.run('__test-delay', { duration: 200 }, { id: 'timeout', timeoutMs: 20 }),
      'WORKER_TIMEOUT'
    );
    assert.strictEqual(runner.state('timeout'), 'timed-out');

    await expectCode(runner.run('__test-crash', {}, { id: 'crash' }), 'WORKER_CRASH');
    assert.strictEqual(runner.state('crash'), 'failed');
    assert.strictEqual(await runner.run('__test-delay', {
      duration: 10,
      value: 'rerun-ok'
    }, { id: 'rerun' }), 'rerun-ok');

    const forced = runner.run('__test-cpu', { duration: 500 }, { id: 'forced-cancel' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.strictEqual(runner.cancel('forced-cancel'), true);
    await expectCode(forced, 'WORKER_CANCELED');
    assert.strictEqual(runner.state('forced-cancel'), 'cancelled');

    const resourceStates = [];
    const backup = runner.run('__test-delay', { duration: 80, value: 'backup' }, {
      id: 'backup-concurrent', resource: 'backup',
      onStateChange: ({ state }) => resourceStates.push(`backup:${state}`)
    });
    const excel = runner.run('__test-delay', { duration: 30, value: 'excel' }, {
      id: 'excel-concurrent',
      onStateChange: ({ state }) => resourceStates.push(`excel:${state}`)
    });
    const restore = runner.run('__test-delay', { duration: 10, value: 'restore' }, {
      id: 'restore-serialized', resource: 'backup',
      onStateChange: ({ state }) => resourceStates.push(`restore:${state}`)
    });
    await Promise.all([backup, excel, restore]);
    assert.ok(resourceStates.indexOf('excel:running') < resourceStates.indexOf('backup:completed'));
    assert.ok(resourceStates.indexOf('restore:running') > resourceStates.indexOf('backup:completed'));

    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-worker-owned-'));
    const partialPath = path.join(tempRoot, 'owned');
    await expectCode(runner.run('__test-owned-failure', { path: partialPath }, {
      id: 'owned-failure'
    }), 'TEST_FAILURE');
    assert.strictEqual(runner.state('owned-failure'), 'failed');
    assert.strictEqual(fs.existsSync(partialPath), false);
    const crashPath = path.join(tempRoot, 'crash-owned');
    await expectCode(runner.run('__test-owned-crash', { path: crashPath }, {
      id: 'owned-crash'
    }), 'WORKER_CRASH');
    assert.strictEqual(fs.existsSync(crashPath), false);
    fs.rmSync(tempRoot, { recursive: true, force: true });

    let eventLoopTicks = 0;
    const ticker = setInterval(() => { eventLoopTicks += 1; }, 5);
    const started = performance.now();
    const benchmark = await runner.run('__test-cpu', { duration: 250 }, {
      id: 'responsiveness-benchmark',
      timeoutMs: 2000
    });
    clearInterval(ticker);
    const elapsed = performance.now() - started;
    assert.ok(benchmark.checksum >= 0);
    const ticksPerSecond = eventLoopTicks / (elapsed / 1000);
    assert.ok(ticksPerSecond >= 40,
      `Expected responsive event loop, observed ${eventLoopTicks} ticks (${ticksPerSecond.toFixed(1)}/s)`);
    console.log(`heavyTaskRunner.test.js: OK (${elapsed.toFixed(1)} ms, ${eventLoopTicks} main-loop ticks)`);
  } finally {
    await runner.close();
  }

  const shutdownRunner = createHeavyTaskRunner({ defaultTimeout: 1000, cancelGraceMs: 30 });
  const activeDuringShutdown = shutdownRunner.run('__test-delay', { duration: 500 }, {
    id: 'shutdown-active'
  });
  const shutdown = shutdownRunner.close();
  await expectCode(activeDuringShutdown, 'WORKER_CANCELED');
  await shutdown;
  assert.strictEqual(shutdownRunner.state('shutdown-active'), 'cancelled');
  assert.strictEqual(shutdownRunner.isAccepting(), false);
  await expectCode(shutdownRunner.run('__test-delay'), 'WORKER_CLOSED');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
