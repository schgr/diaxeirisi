import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const administration = await readFile(new URL('../src/ui/pages/administrationPage.js', import.meta.url), 'utf8');
const controlledMaterials = await readFile(new URL('../src/ui/administration/controlledMaterials.js', import.meta.url), 'utf8');
const registryStyles = await readFile(new URL('../src/ui/styles/registries-legacy.css', import.meta.url), 'utf8');
const indexStyles = await readFile(new URL('../src/ui/styles/print-indexes.css', import.meta.url), 'utf8');
const bookStyles = await readFile(new URL('../src/ui/styles/share-print-ui.css', import.meta.url), 'utf8');

assert.doesNotMatch(administration, /<article class="serial-registry-print-page print-document-area">\s*<h2>/u);
assert.doesNotMatch(administration, /<article class="ammunition-batch-preview-page">\s*<h2>/u);
assert.doesNotMatch(controlledMaterials, /<article class="controlled-material-print print-document-area">\s*<h2>ΒΙΒΛΙΟ/u);

assert.match(registryStyles, /\.serial-number-registry-table th:nth-child\(4\) \{ width: 30%; \}/u);
assert.match(registryStyles, /\.serial-number-registry-print-table th:nth-child\(4\) \{ width: 30%; \}/u);
assert.match(registryStyles, /\.serial-number-registry-table th:nth-child\(5\) \{ width: 9%; \}/u);
assert.match(registryStyles, /\.serial-number-registry-table th:nth-child\(6\) \{ width: 14%; \}/u);
assert.match(indexStyles, /\.ammunition-batch-registry-table th:nth-child\(4\) \{ width: 24%; \}/u);
assert.match(indexStyles, /\.ammunition-batch-registry-table th:nth-child\(9\) \{ width: 11%; \}/u);
assert.match(indexStyles, /\.ammunition-batch-preview-page \.ammunition-batch-registry-table th:nth-child\(4\),[\s\S]*width: 31%;/u);
assert.match(bookStyles, /\.controlled-materials-table th:nth-child\(4\) \{ width: 32%; \}/u);
assert.match(bookStyles, /\.controlled-materials-table th:nth-child\(5\) \{ width: 10%; \}/u);
assert.match(bookStyles, /\.controlled-material-category-heading[\s\S]*height:\s*26px/u);
assert.match(bookStyles, /\.controlled-material-category-heading th[\s\S]*font-size:\s*inherit;/u);
assert.match(bookStyles, /\.controlled-material-print footer[\s\S]*text-align:\s*right;/u);
assert.match(bookStyles, /\.controlled-materials-table \.material-description-cell[\s\S]*word-break:\s*normal;/u);
assert.match(administration, /home-tile-code">§ ΒΜ-1/u);
assert.match(administration, /home-tile-code">§ ΒΜ-5/u);
assert.match(administration, /data-back-to-books-registries/u);
assert.match(administration, /ammunition-batch-actions-cell/u);

console.log('Administration book screen/print layout tests passed.');
