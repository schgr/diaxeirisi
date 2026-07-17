import assert from 'node:assert/strict';
import { renderCompositionImportSection, renderInitialInventorySection } from '../src/ui/pages/settingsPage.js';

const html = renderInitialInventorySection();

assert.match(html, /Αρχική ενημέρωση μερίδων/);
assert.match(html, /data-download-initial-inventory-template/);
assert.match(html, /id="initial-inventory-form"/);
assert.match(html, /name="inventoryDate" type="date"/);
assert.match(html, /Εισαγωγή αρχικής απογραφής/);
assert.match(html, /data-initial-inventory-status/);

const compositionHtml = renderCompositionImportSection();
assert.match(compositionHtml, /Ενημέρωση συνθέσεων μερίδων/);
assert.match(compositionHtml, /data-download-composition-template/);
assert.match(compositionHtml, /data-import-compositions/);
assert.match(compositionHtml, /Προβλεπόμενη − Υπάρχουσα/);

console.log('settingsInitialInventory.test.mjs: OK');
