import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../src/ui/pages/financialYearTasksPage.js', import.meta.url), 'utf8');
const renderer = fs.readFileSync(new URL('../src/ui/renderer.js', import.meta.url), 'utf8');
const styles = fs.readFileSync(new URL('../src/ui/styles/transactions-settings.css', import.meta.url), 'utf8');

assert.match(source, /Καταστάσεις Απογραφής Έτους/u);
assert.match(source, /data-annual-inventory-from[\s\S]*data-annual-inventory-to/u);
assert.match(source, /periodStart,[\s\S]*periodEnd,[\s\S]*inventoryReason: 'Ετήσια απογραφή Διαχείρισης'/u);
assert.match(source, /renderAnnualInventoryCommitteeFields\('Πρόεδρος', 'president'\)/u);
assert.match(source, /renderInventoryStatement\(settings, session\)/u);
assert.match(source, /inventoryApi\.createSession/u);
assert.match(renderer, /window\.appApi\.settings,[\s\S]*window\.appApi\.inventory,[\s\S]*showToast/u);
assert.match(source, /data-annual-document-pages/u);
assert.match(styles, /\.annual-share-print-preview \[data-annual-document-pages\][\s\S]*display:\s*flex;[\s\S]*flex-direction:\s*column;/u);
assert.match(styles, /data-annual-document-pages\] > \.official-share-page[\s\S]*flex:\s*0 0 auto;[\s\S]*aspect-ratio:\s*210 \/ 297;/u);

console.log('Annual inventory financial-year task test passed.');
