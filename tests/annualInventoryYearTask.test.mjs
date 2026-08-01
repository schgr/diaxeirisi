import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/pages/financialYearTasksPage.js', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../src/ui/renderer.js', import.meta.url), 'utf8');

assert.match(source, /Καταστάσεις Απογραφής Έτους/u);
assert.match(source, /data-annual-inventory-from[\s\S]*data-annual-inventory-to/u);
assert.match(source, /periodStart,[\s\S]*periodEnd,[\s\S]*inventoryReason: 'Ετήσια απογραφή Διαχείρισης'/u);
assert.match(source, /renderAnnualInventoryCommitteeFields\('Πρόεδρος', 'president'\)/u);
assert.match(source, /renderInventoryStatement\(settings, session\)/u);
assert.match(source, /inventoryApi\.createSession/u);
assert.match(renderer, /window\.appApi\.settings,[\s\S]*window\.appApi\.inventory,[\s\S]*showToast/u);

console.log('Annual inventory financial-year task test passed.');
