const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const navigation = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'ui', 'navigation.js'),
  'utf8'
);

assert.doesNotMatch(navigation, /Offline-first prototype/);
assert.doesNotMatch(navigation, /ΣΧΕΔΙΟ ΛΕΙΤΟΥΡΓΙΑΣ · ΔΙΑΧΕΙΡΙΣΗ ΥΛΙΚΟΥ/);
assert.match(navigation, /<h2>Διαχείριση Υλικού<\/h2>/);

console.log('Home heading cleanup test passed.');
