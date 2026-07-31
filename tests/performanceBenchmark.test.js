const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'benchmarks', 'performanceBenchmark.mjs'),
  'utf8'
);
const persistenceSource = fs.readFileSync(
  path.join(root, 'benchmarks', 'persistenceMutationBenchmark.mjs'),
  'utf8'
);
const sharePrintSource = fs.readFileSync(
  path.join(root, 'benchmarks', 'sharePrintBatchBenchmark.mjs'),
  'utf8'
);
const shareUiSource = fs.readFileSync(
  path.join(root, 'benchmarks', 'shareUiResponsivenessBenchmark.mjs'),
  'utf8'
);
const baseline = JSON.parse(
  fs.readFileSync(path.join(root, 'benchmarks', 'results', 'baseline.json'), 'utf8')
);
const after = JSON.parse(
  fs.readFileSync(path.join(root, 'benchmarks', 'results', 'after.json'), 'utf8')
);

for (const report of [baseline, after]) {
  assert.strictEqual(report.dataset.deterministic, true);
  assert.strictEqual(report.dataset.shares, 1500);
  assert.ok(report.dataset.transactions >= 6750);
  assert.deepStrictEqual(report.dataset.fiscalYears, [2023, 2024, 2025, 2026]);
  assert.ok(report.dataset.photos > 0);
  assert.ok(report.dataset.compositions > 0);
  assert.ok(report.dataset.serialRegistries > 0);
  assert.ok(report.dataset.ammunitionRegistries > 0);
  assert.ok(report.rssMb <= report.limits.rssMb);
  assert.ok(report.stalls.maximumMainMs <= report.limits.mainStall);
  assert.ok(report.stalls.maximumRendererMs <= report.limits.rendererStall);
  assert.ok(report.stalls.maximumWorkerMs <= report.limits.workerStall);
  assert.strictEqual(report.limits.rendererStall, 500);
}

assert.match(source, /fs\.mkdtempSync/u);
assert.doesNotMatch(source, /app\.getPath\s*\(\s*['"]userData/u);
assert.match(source, /rendererStall:\s*500/u);
assert.match(source, /peakRssMb/u);
assert.match(persistenceSource, /COUNTS\s*=\s*\[1,\s*100,\s*1000\]/u);
assert.match(persistenceSource, /immediate/u);
assert.match(persistenceSource, /writeBehind/u);
assert.match(sharePrintSource, /COUNTS\s*=\s*\[1500,\s*5000,\s*10000\]/u);
assert.match(sharePrintSource, /maximumQueries/u);
assert.match(sharePrintSource, /TOTAL_BUDGETS_MS/u);
assert.match(shareUiSource, /COUNTS\s*=\s*\[1500,\s*5000,\s*10000\]/u);
assert.match(shareUiSource, /STALL_BUDGET_MS/u);
console.log('performanceBenchmark.test.js: OK (deterministic 1,500-share reports and limits)');
