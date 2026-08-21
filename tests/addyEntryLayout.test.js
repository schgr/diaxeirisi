const assert = require('assert');
const fs = require('fs');
const path = require('path');

const formsStyles = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'ui', 'styles', 'forms.css'),
  'utf8'
);

assert.match(
  formsStyles,
  /\.addy-entry-grid\s*\{[\s\S]*?minmax\(145px, 0\.72fr\)[\s\S]*?minmax\(175px, 0\.9fr\)[\s\S]*?gap:\s*12px;/u,
  'Date and transaction-unit controls must have enough separate space.'
);
assert.match(
  formsStyles,
  /\.addy-entry-grid > \.field:nth-child\(1\) > span,[\s\S]*?\.addy-entry-grid > \.field:nth-child\(2\) > span[\s\S]*?white-space:\s*nowrap;/u
);

console.log('ADDY date and transaction-unit layout test passed.');
