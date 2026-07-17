import assert from 'node:assert/strict';
import { renderInitialInventorySection } from '../src/ui/pages/settingsPage.js';

const html = renderInitialInventorySection();

assert.match(html, /Αρχική ενημέρωση μερίδων/);
assert.match(html, /data-download-initial-inventory-template/);
assert.match(html, /id="initial-inventory-form"/);
assert.match(html, /name="inventoryDate" type="date"/);
assert.match(html, /Εισαγωγή αρχικής απογραφής/);
assert.match(html, /data-initial-inventory-status/);

console.log('settingsInitialInventory.test.mjs: OK');
