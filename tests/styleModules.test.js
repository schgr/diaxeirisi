const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const uiDirectory = path.join(root, 'src', 'ui');
const entryPath = path.join(uiDirectory, 'styles.css');
const entry = fs.readFileSync(entryPath, 'utf8');
const expectedImports = [
  './styles/tokens.css',
  './styles/base-layout.css',
  './styles/forms.css',
  './styles/transactions-settings.css',
  './styles/print-indexes.css',
  './styles/transaction-documents.css',
  './styles/modals-tables.css',
  './styles/official-prints.css',
  './styles/registries-legacy.css',
  './styles/share-print-ui.css',
  './styles/document-preview.css'
];
const actualImports = Array.from(
  entry.matchAll(/@import url\(['"](.+?)['"]\);/g),
  (match) => match[1]
);

assert.deepStrictEqual(actualImports, expectedImports, 'Stylesheet import order changed.');
assert.match(
  fs.readFileSync(path.join(uiDirectory, 'index.html'), 'utf8'),
  /<link rel="stylesheet" href="\.\/styles\.css"\s*\/?>/
);

const modules = actualImports.map((relativePath) => {
  const absolutePath = path.resolve(uiDirectory, relativePath);
  assert.ok(fs.existsSync(absolutePath), `Missing stylesheet module: ${relativePath}`);
  return {
    relativePath,
    absolutePath,
    contents: fs.readFileSync(absolutePath, 'utf8')
  };
});
const baselineModules = modules.filter(
  ({ relativePath }) => !['./styles/share-print-ui.css', './styles/document-preview.css'].includes(relativePath)
);
const combined = baselineModules.map(({ relativePath, contents }) =>
  ['./styles/base-layout.css', './styles/transactions-settings.css', './styles/official-prints.css'].includes(relativePath)
    ? contents.replace(/\r\n/g, '\n').replace(/\n$/, '')
    : contents.replace(/\r\n/g, '\n')
).join('');
assert.strictEqual(
  crypto.createHash('sha256').update(combined).digest('hex'),
  'e016a4068da057ee16637bbb7abc31f2e4b06fbcdcb52c376d8ede2a1957d41e',
  'The ordered stylesheet-module snapshot changed unexpectedly.'
);

const sharePrintUi = modules.find(
  ({ relativePath }) => relativePath === './styles/share-print-ui.css'
).contents;
const documentPreview = modules.find(
  ({ relativePath }) => relativePath === './styles/document-preview.css'
).contents;
const officialPrints = modules.find(
  ({ relativePath }) => relativePath === './styles/official-prints.css'
).contents;
assert.match(
  officialPrints,
  /\.exhp-supporting-documents-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,[\s\S]*grid-template-rows:\s*repeat\(5,[\s\S]*grid-auto-flow:\s*column/,
  'EXHP supporting documents must use a 5x2 column-first layout.'
);
assert.match(
  sharePrintUi,
  /\.legacy-offline-badge\s*\{[\s\S]*display:\s*none\s*!important/,
  'The legacy/offline badge must remain hidden in every build.'
);
assert.match(
  documentPreview,
  /Shared on-screen document viewer[\s\S]*100dvh/,
  'Every document preview must use the shared viewport-aware viewer.'
);
assert.match(
  sharePrintUi,
  /\.all-share-controls\s*\{[\s\S]*grid-template-columns:/,
  'All-share controls must define their five-column row.'
);
assert.match(
  sharePrintUi,
  /#print-share-from,[\s\S]*#print-share-to\s*\{[\s\S]*width:\s*100%/,
  'The from/to share fields must have equal sizing rules.'
);

for (const { absolutePath, contents } of modules) {
  for (const match of contents.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)) {
    const resource = match[2].trim();
    if (/^(?:data:|https?:|#)/i.test(resource)) continue;
    const resourcePath = path.resolve(path.dirname(absolutePath), resource);
    assert.ok(fs.existsSync(resourcePath), `Broken CSS resource URL: ${resource}`);
  }
}

console.log(`Stylesheet module test passed (${modules.length} files, exact cascade preserved).`);
