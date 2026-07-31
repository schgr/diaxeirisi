import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { filterAndRankShares, prepareShareSearchIndex, renderRows } from '../src/ui/shares/shareList.js';
import { normalize } from '../src/ui/shares/shared.js';

const COUNTS = [1500, 5000, 10000];
const STALL_BUDGET_MS = 250;
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='));
const outputPath = outputArgument ? path.resolve(outputArgument.slice('--output='.length)) : null;

async function measureStall(operation) {
  const scheduled = performance.now();
  let timerDelayMs = 0;
  const timer = new Promise((resolve) => setTimeout(() => {
    timerDelayMs = performance.now() - scheduled;
    resolve();
  }, 0));
  const started = performance.now();
  const value = operation();
  const elapsedMs = performance.now() - started;
  await timer;
  return {
    value,
    elapsedMs: Number(elapsedMs.toFixed(2)),
    stallMs: Number(timerDelayMs.toFixed(2))
  };
}

const results = [];
for (const count of COUNTS) {
  const shares = Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    shareNumber: String(index + 1),
    nominalNumber: `N-${index + 1}`,
    description: index % 10 === 0 ? `ΑΝΤΛΙΑ ΥΛΙΚΟΥ ${index + 1}` : `Υλικό ${index + 1}`,
    materialType: index % 2 ? 'Υλικό' : 'Ανταλλακτικό',
    accountingBalance: index,
    chargedQuantity: 0,
    differenceQuantity: -index,
    statusTone: 'balanced',
    status: 'Ισοσκελισμένο'
  }));
  prepareShareSearchIndex(shares);
  const legacy = await measureStall(() => {
    const filter = normalize('υλικο');
    const filtered = shares.filter((share) => normalize(share.description).includes(filter));
    return renderRows(filtered);
  });
  const filter = await measureStall(() => filterAndRankShares(shares, { description: 'αντλια' }));
  const render = await measureStall(() => renderRows(filter.value.slice(0, 100)));
  const maximumStallMs = Math.max(filter.stallMs, render.stallMs);
  assert.equal(filter.value.length, Math.ceil(count / 10));
  assert.ok(maximumStallMs <= STALL_BUDGET_MS);
  results.push({
    records: count,
    matches: filter.value.length,
    legacyNormalizeAndFullRenderMs: legacy.elapsedMs,
    legacyStallMs: legacy.stallMs,
    filterMs: filter.elapsedMs,
    firstPageRenderMs: render.elapsedMs,
    maximumStallMs,
    stallBudgetMs: STALL_BUDGET_MS
  });
}

const report = { deterministic: true, pageSize: 100, results };
if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
