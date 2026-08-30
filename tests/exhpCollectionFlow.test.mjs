import assert from 'node:assert/strict';
import fs from 'node:fs';

const helpers = fs.readFileSync(new URL('../src/ui/transactions/entryHelpers.js', import.meta.url), 'utf8');
const form = [
  '../src/ui/transactions/addyForm.js',
  '../src/ui/transactions/addy/addyState.js',
  '../src/ui/transactions/addy/addyCalculations.js',
  '../src/ui/transactions/addy/addyDom.js',
  '../src/ui/transactions/addy/addyEvents.js'
].filter((file) => fs.existsSync(new URL(file, import.meta.url)))
  .map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n');
const page = fs.readFileSync(new URL('../src/ui/pages/transactionsPage.js', import.meta.url), 'utf8');
const service = [
  '../src/services/transactions/transactionQueryService.js',
  '../src/services/transactions/exhpService.js',
  '../src/services/transactions/shared.js'
].map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');

assert.match(helpers, /data-collection-quantity/u);
assert.match(helpers, /collectionShare\.composition\.map/u);
assert.doesNotMatch(helpers, /referenceShares\.filter/u);
assert.match(helpers, /Υλικά Φύλλου Μεταβολών/u);
assert.match(helpers, /data-view-exhp-document/u);
assert.match(form, /openToolCollectionCreditDialog\([\s\S]*referenceData\.shares,[\s\S]*transactionType,[\s\S]*quantity/u);
assert.match(form, /share\?\.requiresComposition/u);
assert.match(form, /const collectionTransfer = isToolCollectionReason\(exhpReason\.value\);/u);
assert.match(form, /projectedQuantity: componentQuantity/u);
assert.match(form, /function buildToolCompositionChargeItems/u);
assert.match(form, /transactionType: 'Χρέωση'/u);
assert.match(form, /state\.exhpItems\.push\([\s\S]*\.\.\.componentCharges/u);
assert.match(helpers, /data-collection-share-number/u);
assert.match(helpers, /components\.map\(\(\{ share, sourceShare, item \}, index\) =>/u);
assert.match(helpers, /value=""/u);
assert.match(helpers, /isCredit \? `<td><input data-collection-share-number/u);
assert.match(helpers, /data-close-collection-credit[\s\S]*data-save-collection-credit/u);
assert.match(form, /const componentCharges = transactionType === 'Πίστωση'/u);
assert.match(form, /if \(!share && !nominalTransfer\)/u);
assert.match(form, /transactionType: 'Χρέωση'/u);
assert.match(form, /notIssuedQuantity: item\.notIssuedQuantity/u);
assert.match(form, /composition/u);
assert.match(service, /saveToolCollectionTransfers/u);
assert.match(service, /listCompositionChangeSheetEntries/u);
assert.match(service, /addChangeSheetCompositionCharges/u);
assert.match(service, /creditSerial = 'Φ\.Μ\.'/u);
assert.doesNotMatch(helpers, /data-component-share-number/u);
assert.match(helpers, /<select data-component-unit>/u);
assert.doesNotMatch(form, /Βρέθηκε μη αποθηκευμένη εργασία/u);
assert.match(page, /<select id="exhp-measurement-unit" disabled>/u);
assert.match(page, /id="exhp-edit-items-mount"/u);
assert.match(page, /data-exhp-edit-item/u);
assert.match(page, /renderEditableExhpItems/u);

console.log('EXHP tool-collection flow and registered preview test passed.');
