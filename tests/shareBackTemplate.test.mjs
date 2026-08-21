import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { renderSharePrintDocument } from '../src/ui/shares/sharePrint.js';

const html = renderSharePrintDocument({
  share: {
    nominalNumber: '1005121409436', shareNumber: '31', description: 'ΥΛΙΚΟ ΔΟΚΙΜΗΣ',
    materialCode: '', measurementUnit: 'Τεμάχια', unitPrice: 1
  },
  openingTransfer: { balance: 40, inventoryDate: '2025-12-31' },
  transactions: Array.from({ length: 13 }, (_unused, index) => ({
    serialNumber: index + 1,
    date: '2026-08-21',
    transactionUnit: '501 Μ/Κ ΤΠ/ΓΔΥ',
    registryNumber: `Χ-${index + 1}`,
    imports: index + 1,
    exports: 0,
    balance: 40 + index + 1
  }))
});
const styles = await readFile(new URL('../src/ui/styles/official-prints.css', import.meta.url), 'utf8');

assert.match(html, /official-share-back-sheet/u);
assert.doesNotMatch(html, /meridas-back-k2309-clean\.png/u);
assert.match(html, /<th>23<\/th><th>24<\/th>/u);
assert.match(html, /21\/8\/2026/u);
assert.match(html, /501 Μ\/Κ ΤΠ\/ΓΔΥ/u);
assert.match(html, /ΑΠΟ ΜΕΤΑΦΟΡΑ/u);
assert.match(html, /ΓΙΑ ΜΕΤΑΦΟΡΑ/u);
assert.match(html, /Κ 2309ΔΥΠ/u);
assert.match(html, /32\. ΥΠΑΡΧΟΝΤΑ/u);
assert.match(html, /33\. ΔΙΑΦΟΡΑ/u);
assert.match(html, /official-share-back-date-heading/u);
assert.match(styles, /\.official-share-back-table th:nth-child\(2\) \{ width: 9%; \}/u);
assert.match(styles, /\.official-share-back-table th:nth-child\(3\) \{ width: 15%; \}/u);
assert.match(styles, /\.official-share-back-table th:nth-child\(4\) \{ width: 16%; \}/u);
assert.match(styles, /\.official-share-back-table th:nth-child\(8\) \{ width: 15%; \}/u);
assert.match(styles, /tbody tr:not\(\.official-share-back-transfer-row\)[\s\S]*font-size: clamp\(10px, 0\.92vw, 12px\);/u);
assert.match(styles, /\.official-share-back-table tbody td[\s\S]*overflow: hidden;[\s\S]*white-space: nowrap;/u);

console.log('Generated official material-share back-page test passed.');
