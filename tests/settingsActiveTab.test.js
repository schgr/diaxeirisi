const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const settingsPage = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'ui', 'pages', 'settingsPage.js'),
  'utf8'
);

assert.match(
  settingsPage,
  /querySelectorAll\('\[data-settings-panel\]'\)[\s\S]*\.find\(\(panel\) => !panel\.hidden\)/
);
assert.doesNotMatch(settingsPage, /<h3>Εμπόριο<\/h3>/u);
assert.doesNotMatch(settingsPage, /id="commerce-business-form"/u);
assert.match(settingsPage, /commerce-companies-table-wrap/u);
assert.match(settingsPage, /const submenu = panel\.querySelector\('\[data-settings-submenu\]'\)/);
assert.match(settingsPage, /if \(submenu\) submenu\.hidden = true/);
assert.doesNotMatch(settingsPage, /settingsSubtab="initial-records"\]`\)\?\.click\(\)/);
assert.match(settingsPage, /activePanel\?\.dataset\.settingsPanel \|\| ''/);
assert.match(
  settingsPage,
  /renderSettingsPage\([\s\S]*container,[\s\S]*settingsApi,[\s\S]*window\.appApi\.clothing,[\s\S]*showToast,[\s\S]*activeTab,[\s\S]*window\.appApi\.shares/
);

console.log('Settings active-tab refresh test passed.');
