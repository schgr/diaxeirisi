import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/pages/inventoryPage.js', import.meta.url), 'utf8');

assert.match(source, /const selectedId = selectedSessionId \|\| null;/u);
assert.doesNotMatch(source, /id="inventory-title"/u);
assert.match(source, /<th>Α\/Α<\/th><th>Ημερομηνία<\/th><th>Αιτιολογία<\/th>/u);
assert.match(source, /title: inventoryReason/u);
assert.match(source, /session\.inventoryReason \|\| session\.title/u);

console.log('Inventory page reason-only and on-demand preview layout test passed.');
