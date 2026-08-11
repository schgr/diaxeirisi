import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync(new URL('../src/ui/styles/share-print-ui.css', import.meta.url), 'utf8');
assert.match(css, /@media screen[\s\S]*\.exhp-document-backdrop \.exhp-field-18-signature[\s\S]*font-size: 7px;[\s\S]*font-size: 6px;/u);
assert.match(css, /@media print[\s\S]*\.exhp-faithful-page \.exhp-static-overlay[\s\S]*calc\(1vw \+ 2px\)/u);
assert.match(css, /\.exhp-faithful-page \.exhp-field-15-signature,[\s\S]*\.exhp-faithful-page \.exhp-field-18-signature[\s\S]*translateX\(-5px\)/u);
assert.match(css, /\.exhp-credit-field-15-signature \.exhp-officer-signature strong[\s\S]*font-size: clamp\(8px, 0\.72vw, 11px\)/u);
assert.match(css, /\.exhp-credit-field-15-signature \.exhp-officer-signature em[\s\S]*font-size: clamp\(7px, 0\.64vw, 10px\)/u);
assert.match(css, /\.exhp-faithful-back-side \.exhp-static-overlay[\s\S]*calc\(1vw \+ 4px\)/u);
assert.match(css, /\.exhp-faithful-back-side \.exhp-back-signature \.exhp-officer-signature strong[\s\S]*calc\(0\.92vw \+ 2px\)/u);

console.log('EXHP preview and print-specific typography rules are present.');
