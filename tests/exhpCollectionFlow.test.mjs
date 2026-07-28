import assert from 'node:assert/strict';
import fs from 'node:fs';

const helpers = fs.readFileSync(new URL('../src/ui/transactions/entryHelpers.js', import.meta.url), 'utf8');
const form = fs.readFileSync(new URL('../src/ui/transactions/addyForm.js', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../src/services/transactionsService.js', import.meta.url), 'utf8');

assert.match(helpers, /data-collection-quantity/u);
assert.match(helpers, /collectionShare\.composition\.map/u);
assert.doesNotMatch(helpers, /referenceShares\.filter/u);
assert.match(helpers, /max="\$\{Number\(item\.chargedQuantity \|\| 0\)\}"/u);
assert.match(helpers, /data-view-exhp-document/u);
assert.match(form, /openToolCollectionCreditDialog\(share, referenceData\.shares\)/u);
assert.match(form, /share\?\.requiresComposition/u);
assert.match(form, /const collectionTransfer = isToolCollectionReason\(exhpReason\.value\);/u);
assert.match(form, /collectionVirtualCredit/u);
assert.match(service, /saveToolCollectionTransfers/u);
assert.match(service, /listCompositionChangeSheetEntries/u);
assert.match(service, /addChangeSheetCompositionCharges/u);
assert.match(service, /creditSerial = 'Φ\.Μ\.'/u);

console.log('EXHP tool-collection flow and registered preview test passed.');
