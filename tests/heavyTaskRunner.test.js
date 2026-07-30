const assert = require('assert');
const { performance } = require('perf_hooks');
const path = require('path');
const initSqlJs = require('sql.js');
const { createHeavyTaskRunner } = require('../src/workers/heavyTaskRunner');

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error && error.code === code);
}

async function run() {
  const runner = createHeavyTaskRunner({ defaultTimeout: 1000 });
  try {
    const progress = [];
    const cards = Array.from({ length: 250 }, (_unused, id) => ({ id }));
    const result = await runner.run('prepare-share-print', {
      cards
    }, {
      id: 'success',
      onProgress: (event) => progress.push(event)
    });
    assert.deepStrictEqual(result, cards);
    assert.ok(progress.length >= 3);
    assert.strictEqual(runner.activeCount(), 0);

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
    assert.strictEqual(runner.activeCount(), 0);

    await expectCode(
      runner.run('__test-delay', { duration: 200 }, { id: 'timeout', timeoutMs: 20 }),
      'WORKER_TIMEOUT'
    );
    assert.strictEqual(runner.activeCount(), 0);

    await expectCode(runner.run('__test-crash', {}, { id: 'crash' }), 'WORKER_CRASH');
    assert.strictEqual(await runner.run('__test-delay', {
      duration: 10,
      value: 'rerun-ok'
    }, { id: 'rerun' }), 'rerun-ok');

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
    assert.ok(
      ticksPerSecond >= 40,
      `Expected responsive event loop, observed ${eventLoopTicks} ticks (${ticksPerSecond.toFixed(1)}/s)`
    );
    console.log(`heavyTaskRunner.test.js: OK (${elapsed.toFixed(1)} ms, ${eventLoopTicks} main-loop ticks)`);
  } finally {
    await runner.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
