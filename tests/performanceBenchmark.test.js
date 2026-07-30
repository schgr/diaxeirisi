const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(
  path.join(root, 'benchmarks', 'performanceBenchmark.mjs'),
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
}

assert.match(source, /fs\.mkdtempSync/u);
assert.doesNotMatch(source, /app\.getPath\s*\(\s*['"]userData/u);
console.log('performanceBenchmark.test.js: OK (deterministic 1,500-share reports and limits)');
