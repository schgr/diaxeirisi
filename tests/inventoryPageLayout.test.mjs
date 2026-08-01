import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/pages/inventoryPage.js', import.meta.url), 'utf8');

assert.match(source, /const selectedId = selectedSessionId \|\| null;/u);
assert.doesNotMatch(source, /id="inventory-title"/u);
assert.match(source, /<th>Α\/Α<\/th><th>Ημερομηνία<\/th><th>Αιτιολογία<\/th>/u);
assert.match(source, /title: inventoryReason/u);
assert.match(source, /session\.inventoryReason \|\| session\.title/u);
assert.match(source, /const previewSettings = await settingsApi\.get\(\);/u);
assert.match(source, /openInventoryStatementModal\(previewSettings, session\)/u);
assert.match(source, /class="request-document-modal inventory-statement-modal"/u);
assert.match(source, /id="inventory-period-start"[\s\S]*id="inventory-period-end"/u);
assert.match(source, /inventoryDate: periodEnd,[\s\S]*periodStart,[\s\S]*periodEnd/u);

console.log('Inventory page reason-only and on-demand preview layout test passed.');
