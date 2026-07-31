import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createShareFilterController,
  filterAndRankShares,
  prepareShareSearchIndex,
  renderRows
} from '../src/ui/shares/shareList.js';

const shares = [
  { id: 1, shareNumber: '10', nominalNumber: 'Α-10', description: 'ΑΝΤΛΙΑ ΠΕΤΡΕΛΑΙΟΥ', materialType: 'Υλικό' },
  { id: 2, shareNumber: '20', nominalNumber: 'Β-20', description: 'Συσσωρευτής οχήματος', materialType: 'Υλικό' },
  { id: 3, shareNumber: '30', nominalNumber: 'Γ-30', description: '<img src=x onerror=alert(1)>', materialType: 'Άλλο' }
];

const prepared = prepareShareSearchIndex(shares);
assert.strictEqual(prepareShareSearchIndex(shares), prepared, 'normalized fields must be cached per loaded dataset');
assert.deepEqual(filterAndRankShares(shares, { description: 'αντλια' }).map(({ id }) => id), [1]);
assert.deepEqual(filterAndRankShares(shares, { description: 'συσσωρευτησ' }).map(({ id }) => id), [2]);

const timers = [];
const scheduler = {
  setTimeout(callback) {
    const timer = { callback, canceled: false };
    timers.push(timer);
    return timer;
  },
  clearTimeout(timer) { timer.canceled = true; }
};
const delivered = [];
const controller = createShareFilterController(shares, {
  scheduler,
  delay: 10,
  onResults: (rows) => delivered.push(rows.map(({ id }) => id))
});
controller.schedule({ description: 'α' });
controller.schedule({ description: 'αν' });
controller.schedule({ description: 'αντ' });
assert.equal(timers.filter(({ canceled }) => !canceled).length, 1, 'rapid typing must leave one pending request');
timers.forEach(({ callback }) => callback());
assert.deepEqual(delivered, [[1]], 'canceled filter requests must not publish stale results');
controller.schedule({ description: 'συσ' });
controller.cancel();
timers.at(-1).callback();
assert.deepEqual(delivered, [[1]], 'explicit cancellation must suppress late results');

const selectedHtml = renderRows(shares, false, 2);
assert.match(selectedHtml, /data-share-id="2"[^>]*aria-selected="true"/u);
assert.doesNotMatch(selectedHtml, /<img src=x/u, 'user-controlled content must remain escaped');
assert.equal((selectedHtml.match(/data-share-id=/gu) || []).length, shares.length);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src', 'ui', 'shares', 'shareList.js'), 'utf8');
assert.match(source, /removeEventListener/u, 'bound list events must have a disposal path');
assert.doesNotMatch(source, /addEventListener\('change',\s*applyFilters/u);

console.log('shareListResponsiveness.test.mjs: OK');
