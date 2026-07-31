import { createRequire } from 'node:module';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';

const require = createRequire(import.meta.url);
const { createHeavyTaskRunner } = require('../src/workers/heavyTaskRunner');

const TASKS = 20;
const rssBeforePool = process.memoryUsage().rss;
const runner = createHeavyTaskRunner({ concurrency: 2, defaultTimeout: 5000 });
const durations = [];

try {
  // Warm both persistent workers so this measures steady-state dispatch overhead.
  await Promise.all([
    runner.run('__test-delay', { duration: 0 }),
    runner.run('__test-delay', { duration: 0 })
  ]);
  const rssAfterWarmup = process.memoryUsage().rss;
  const delay = monitorEventLoopDelay({ resolution: 10 });
  delay.enable();
  for (let index = 0; index < TASKS; index += 1) {
    const started = performance.now();
    await runner.run('__test-delay', { duration: 0 });
    durations.push(performance.now() - started);
  }
  let maximumTimerStallMs = 0;
  let previousTick = performance.now();
  const ticker = setInterval(() => {
    const now = performance.now();
    maximumTimerStallMs = Math.max(maximumTimerStallMs, now - previousTick - 5);
    previousTick = now;
  }, 5);
  await Promise.all([
    runner.run('__test-cpu', { duration: 250 }),
    runner.run('__test-cpu', { duration: 250 })
  ]);
  clearInterval(ticker);
  await new Promise((resolve) => setTimeout(resolve, 20));
  delay.disable();
  const peakRss = process.memoryUsage().rss;
  const result = {
    tasks: TASKS,
    concurrency: runner.concurrency,
    meanDispatchMs: durations.reduce((sum, value) => sum + value, 0) / durations.length,
    minMs: Math.min(...durations),
    maxMs: Math.max(...durations),
    rssBeforePool,
    rssAfterWarmup,
    peakRss,
    poolRssDelta: peakRss - rssBeforePool,
    eventLoopMaxMs: Number(delay.max) / 1e6,
    maximumTimerStallMs,
    budgets: {
      meanDispatchMs: 10,
      eventLoopMaxMs: 50,
      poolRssDeltaBytes: 48 * 1024 * 1024
    }
  };
  result.passed = result.meanDispatchMs <= result.budgets.meanDispatchMs
    && result.eventLoopMaxMs <= result.budgets.eventLoopMaxMs
    && result.maximumTimerStallMs <= result.budgets.eventLoopMaxMs
    && result.poolRssDelta <= result.budgets.poolRssDeltaBytes;
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
} finally {
  await runner.close({ drain: true });
}
