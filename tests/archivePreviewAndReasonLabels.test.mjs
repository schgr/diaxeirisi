import assert from 'node:assert/strict';
import fs from 'node:fs';

const administration = fs.readFileSync(new URL('../src/ui/pages/administrationPage.js', import.meta.url), 'utf8');
const financialYear = fs.readFileSync(new URL('../src/ui/pages/financialYearTasksPage.js', import.meta.url), 'utf8');
const transactions = fs.readFileSync(new URL('../src/ui/pages/transactionsPage.js', import.meta.url), 'utf8');
const addyForm = fs.readFileSync(new URL('../src/ui/transactions/addyForm.js', import.meta.url), 'utf8');
const documentExport = fs.readFileSync(new URL('../src/ui/documentExport.js', import.meta.url), 'utf8');

assert.match(administration, /Σύνθεση που δεν καταχωρήθηκε/u);
assert.doesNotMatch(administration, /Σύνθεση που δεν καταχωρίστηκε/u);
assert.match(administration, /data-preview-archive-table[^>]*>Προβολή</u);
assert.match(administration, /openArchivedSharesPreview/u);
assert.match(administration, /data-print-archive-table[^>]*>Εκτύπωση</u);
assert.match(administration, /data-close-archive-preview[^>]*>Κλείσιμο</u);
assert.match(financialYear, /openArchivedSharesPreview/u);
assert.match(documentExport, /archived-shares-preview-backdrop/u);

assert.match(
  transactions,
  /\['ΑΥ', 'ΟΥ', 'ΜΥ', 'ΚΜ', 'ΣΥ', 'ΔΙΧ', 'ΔΑ', 'ΣΕ', 'ΤΔ', 'ΔΑΕ', 'ΠΕ', 'ΑΠ'\]/u
);
assert.match(transactions, /home-tile-code">§ ΕΧΠ-\$\{escapeHtml\(aitiologia\.code\.toUpperCase\(\)\)\}/u);
assert.doesNotMatch(transactions, />Δεν έχει επιλεγεί αιτιολογία\.<\/span>/u);
assert.doesNotMatch(addyForm, /Δεν έχει επιλεγεί αιτιολογία\./u);

console.log('Archive preview and EXHP reason label tests passed.');
