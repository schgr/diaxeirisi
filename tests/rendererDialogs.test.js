const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const uiRoot = path.join(__dirname, '..', 'src', 'ui');
const nativeDialogPattern = /\b(?:window\.)?(?:confirm|alert|prompt)\s*\(/u;
const files = [];
const pending = [uiRoot];

while (pending.length) {
  const directory = pending.pop();
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) pending.push(target);
    else if (entry.isFile() && /\.(?:js|mjs)$/u.test(entry.name)) files.push(target);
  }
}

const offenders = files
  .filter((file) => nativeDialogPattern.test(fs.readFileSync(file, 'utf8')))
  .map((file) => path.relative(uiRoot, file));

assert.deepEqual(
  offenders,
  [],
  `Native renderer dialogs can break fullscreen focus: ${offenders.join(', ')}`
);

const dialogsSource = fs.readFileSync(path.join(uiRoot, 'components', 'dialogs.js'), 'utf8');
assert.match(dialogsSource, /export function showConfirmDialog/u);
assert.match(dialogsSource, /export function showAlertDialog/u);
assert.match(dialogsSource, /previouslyFocused\.focus/u);

console.log('Renderer dialogs use the shared non-native modal.');
