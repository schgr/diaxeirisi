const assert = require('node:assert/strict');
const fs = require('node:fs');

const preload = fs.readFileSync('src/preload.js', 'utf8');

assert.match(preload, /async function prepareCurrentDocumentForPrint\(\)/u);
assert.match(preload, /source\.querySelectorAll\('\.print-document-area'\)/u);
assert.match(preload, /await nextAnimationFrame\(\);[\s\S]*await nextAnimationFrame\(\);/u);
assert.match(preload, /currentDocument:\s*async \(options = \{\}\) => \{[\s\S]*await prepareCurrentDocumentForPrint\(\);/u);

console.log('Print preparation timing test passed.');
