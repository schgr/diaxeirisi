import assert from 'node:assert/strict';
import fs from 'node:fs';

const administration = [
  '../src/ui/pages/administrationPage.js',
  '../src/ui/pages/administration/administrationPage.js'
].map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
const financialYear = fs.readFileSync(new URL('../src/ui/pages/financialYearTasksPage.js', import.meta.url), 'utf8');
const transactions = fs.readFileSync(new URL('../src/ui/pages/transactionsPage.js', import.meta.url), 'utf8');
const addyForm = [
  '../src/ui/transactions/addyForm.js',
  '../src/ui/transactions/addy/addyState.js',
  '../src/ui/transactions/addy/addyCalculations.js',
  '../src/ui/transactions/addy/addyDom.js',
  '../src/ui/transactions/addy/addyEvents.js'
].filter((file) => fs.existsSync(new URL(file, import.meta.url)))
  .map((file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8'))
  .join('\n');
const documentExport = fs.readFileSync(new URL('../src/ui/documentExport.js', import.meta.url), 'utf8');

assert.match(administration, /Σύνθεση που δεν καταχωρήθηκε/u);
assert.doesNotMatch(administration, /Σύνθεση που δεν καταχωρίστηκε/u);
assert.match(administration, /data-preview-archive-table[^>]*>Προβολή</u);
assert.match(administration, /openArchivedSharesPreview/u);
assert.match(administration, /data-print-archive-table[^>]*>Εκτύπωση</u);
assert.match(administration, /data-close-archive-preview[^>]*>Κλείσιμο</u);
assert.match(financialYear, /openArchivedSharesPreview/u);
assert.match(documentExport, /archived-shares-preview-backdrop/u);

assert.match(transactions, /const exhpReasons = referenceData\.exhpIssueReasons\.map/u);
assert.match(transactions, /displayNumber: index \+ 1/u);
assert.match(transactions, /home-tile-code">§ ΕΧΠ-\$\{reason\.displayNumber\}/u);
assert.doesNotMatch(transactions, />Δεν έχει επιλεγεί αιτιολογία\.<\/span>/u);
assert.doesNotMatch(addyForm, /Δεν έχει επιλεγεί αιτιολογία\./u);

console.log('Archive preview and EXHP reason label tests passed.');
