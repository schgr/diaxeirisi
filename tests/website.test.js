const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'docs', 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'docs', 'styles.css'), 'utf8');
const script = fs.readFileSync(path.join(root, 'docs', 'app.js'), 'utf8');

assert.match(html, /<html lang="el"/);
assert.match(html, /data-download-link/);
assert.match(html, /Έκδοση 0\.13\.212/);
assert.match(html, /id="features"/);
assert.match(html, /id="download"/);
assert.match(css, /@media \(max-width: 780px\)/);
assert.match(css, /\[data-reveal\]\.visible/);
assert.match(script, /\.github\.io/);
assert.match(script, /releases\/latest/);

console.log('website.test.js: OK');
