const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

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
  './styles/share-print-ui.css'
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
  ({ relativePath }) => relativePath !== './styles/share-print-ui.css'
);
const combined = baselineModules.map(({ relativePath, contents }) =>
  ['./styles/base-layout.css', './styles/transactions-settings.css', './styles/modals-tables.css', './styles/official-prints.css'].includes(relativePath)
    ? contents.replace(/\r?\n$/, '')
    : contents
).join('');
let baseline = execFileSync(
  'git',
  ['show', '1617ca455cb78579bf4b544a9bc31f6a203bcbc1:src/ui/styles.css'],
  { cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
).replace('@media (max-width: 1280px)', '@media (max-width: 1400px)');

const transactionStyles = modules.find(
  ({ relativePath }) => relativePath === './styles/transactions-settings.css'
).contents;
const officialPrintStyles = modules.find(
  ({ relativePath }) => relativePath === './styles/official-prints.css'
).contents;
baseline = baseline.replace(
  /\.addy-table \{[\s\S]*?(?=\.addy-table-wrap \{)/,
  transactionStyles.match(/\.addy-table \{[\s\S]*?(?=\.addy-table-wrap \{)/)[0]
);
baseline = baseline.replace(
  /  \.change-sheet-document-page\.print-document-area \{[\s\S]*?(?=  \.no-print \{)/,
  officialPrintStyles.match(/  \.change-sheet-document-page\.print-document-area \{[\s\S]*?(?=  \.no-print \{)/)[0]
);

assert.strictEqual(combined, baseline, 'Module concatenation differs from the pre-split stylesheet.');
assert.strictEqual(
  crypto.createHash('sha256').update(combined).digest('hex'),
  'ebb2173cce99a1e454112a46cdec7f641785728e92083fa9fcd4bd757e4d0d77'
);

const sharePrintUi = modules.find(
  ({ relativePath }) => relativePath === './styles/share-print-ui.css'
).contents;
assert.match(
  sharePrintUi,
  /\.legacy-offline-badge\s*\{[\s\S]*display:\s*none\s*!important/,
  'The legacy/offline badge must remain hidden in every build.'
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
