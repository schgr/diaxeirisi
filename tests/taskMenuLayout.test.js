const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const sharesPage = read('src/ui/pages/sharesPage.js');
assert.match(
  sharesPage,
  /import \{[^}]*\brenderRows\b[^}]*\} from '\.\.\/shares\/shareList\.js';/,
  'The compositions page must import renderRows into its local module scope.'
);

for (const relativePath of [
  'src/ui/pages/financialYearTasksPage.js',
  'src/ui/pages/transactionsPage.js',
  'src/ui/pages/movementDifferencesPage.js',
  'src/ui/pages/printsPage.js'
]) {
  assert.match(
    read(relativePath),
    /uniform-task-menu/,
    `${relativePath} must use the shared task-menu layout.`
  );
}

const layoutCss = read('src/ui/styles/share-print-ui.css');
assert.match(layoutCss, /\.uniform-task-menu\s*\{[\s\S]*?grid-template-columns:\s*repeat\(5,/);
assert.match(layoutCss, /@media \(max-width:\s*950px\)[\s\S]*?\.uniform-task-menu/);

console.log('taskMenuLayout.test.js: OK');
