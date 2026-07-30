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
assert.match(styles, /\.request-entry-all-row\s*\{[\s\S]*grid-template-columns:/);
assert.match(
  styles,
  /\.request-entry-all-row > \.request-header-grid,[\s\S]*display: contents;/
);
assert.match(styles, /@media \(max-width: 1700px\)[\s\S]*\.request-entry-all-row/);

console.log('Request entry single-row layout test passed.');
