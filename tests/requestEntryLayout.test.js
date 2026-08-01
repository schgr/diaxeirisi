const assert = require('assert');
const fs = require('fs');
const path = require('path');

const requestsPage = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'ui', 'pages', 'requestsPage.js'),
  'utf8'
);
const stylesEntryPath = path.join(__dirname, '..', 'src', 'ui', 'styles.css');
const stylesEntry = fs.readFileSync(stylesEntryPath, 'utf8');
const styles = Array.from(
  stylesEntry.matchAll(/@import url\(['"](.+?)['"]\);/g),
  (match) => fs.readFileSync(path.resolve(path.dirname(stylesEntryPath), match[1]), 'utf8')
).join('');

assert.match(requestsPage, /class="request-entry-all-row"/);
const requestEntryMarkup = requestsPage.match(/<div class="request-entry-all-row">([\s\S]*?)<\/div>/)?.[1] || '';
assert.doesNotMatch(requestEntryMarkup, /class="request-header-grid"/);
assert.doesNotMatch(requestEntryMarkup, /class="request-line-grid/);
assert.match(requestEntryMarkup, /id="request-date"[\s\S]*id="request-add-item"/);
assert.match(styles, /\.request-entry-all-row\s*\{[\s\S]*grid-template-columns:/);
assert.match(styles, /@media \(max-width: 1700px\)[\s\S]*\.request-entry-all-row/);
assert.match(requestsPage, /Προαιρετική αναζήτηση στον Κατάλογο ΚΕΥ/);
assert.match(requestsPage, /Δεν βρέθηκε υλικό\. Μπορείτε να συνεχίσετε με χειροκίνητη καταχώρηση\./);
assert.match(requestsPage, /textContent = item\.description/);
assert.match(requestsPage, /search\.addEventListener\('input'/);
assert.doesNotMatch(requestsPage, /search\.addEventListener\('change'/);
assert.match(styles, /\.key-catalogue-result-list\s*\{[\s\S]*overflow: auto;/);
assert.match(requestsPage, /renderRequestItemBarcode\(item\)/);
assert.doesNotMatch(requestsPage, /getKeyCatalogueImage|key-catalogue-image-overlay/);
assert.doesNotMatch(requestsPage, /request-document-notes-cell" rowspan=/);
assert.match(styles, /\.request-line-barcode\s*\{[\s\S]*height:\s*30px/);
assert.match(
  styles,
  /Keep the complete request entry form on one row[\s\S]*\.request-entry-all-row\s*\{[\s\S]*min-width:\s*1850px;[\s\S]*grid-template-columns:/
);
assert.match(
  styles,
  /\.request-entry-all-row #request-add-item\s*\{[\s\S]*min-width:\s*96px;[\s\S]*white-space:\s*nowrap;/
);
assert.match(styles, /\.request-panel\s*\{[\s\S]*overflow-x:\s*auto;/);
assert.match(
  requestsPage,
  /renderRequestsPage\(container, requestsApi, settingsApi, showToast, 'requests'\)/
);
assert.match(requestsPage, /bindRequestsTabs\(container, activeTab\)/);

console.log('Request entry single-row layout test passed.');
