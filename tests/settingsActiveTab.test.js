const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const settingsPage = [
  path.join(__dirname, '..', 'src', 'ui', 'pages', 'settingsPage.js'),
  path.join(__dirname, '..', 'src', 'ui', 'pages', 'settings', 'settingsPage.js')
].map((file) => fs.readFileSync(file, 'utf8')).join('\n');

assert.match(
  settingsPage,
  /querySelectorAll\('\[data-settings-panel\]'\)[\s\S]*\.find\(\(panel\) => !panel\.hidden\)/
);
assert.doesNotMatch(settingsPage, /<h3>Εμπόριο<\/h3>/u);
assert.doesNotMatch(settingsPage, /id="commerce-business-form"/u);
assert.match(settingsPage, /commerce-companies-table-wrap/u);
assert.match(settingsPage, /data-material-card-flags-mount/u);
assert.match(settingsPage, /async function loadMaterialCardSettings/u);
assert.match(settingsPage, /if \(subtab === 'material-card-settings'\)/u);
assert.strictEqual((settingsPage.match(/data-no-page-draft/gu) || []).length, 7);
assert.match(settingsPage, /id="service-form"[^>]+data-no-page-draft/u);
assert.match(settingsPage, /id="officers-form"[^>]+data-no-page-draft/u);
assert.match(settingsPage, /§ ΔΣ-1/u);
assert.match(settingsPage, /§ ΔΣ-2/u);
assert.match(settingsPage, /§ ΔΣ-3/u);
assert.match(settingsPage, /const submenu = panel\.querySelector\('\[data-settings-submenu\]'\)/);
assert.match(settingsPage, /if \(submenu\) submenu\.hidden = true/);
assert.doesNotMatch(settingsPage, /data-settings-back/u);
assert.doesNotMatch(settingsPage, /Πίσω στις Ρυθμίσεις/u);
assert.doesNotMatch(
  settingsPage.match(/<nav[^>]+data-settings-submenu[\s\S]*?<\/nav>/u)?.[0] || '',
  /data-settings-back/u
);
assert.doesNotMatch(settingsPage, /settingsSubtab="initial-records"\]`\)\?\.click\(\)/);
assert.match(settingsPage, /activePanel\?\.dataset\.settingsPanel \|\| ''/);
assert.match(
  settingsPage,
  /renderSettingsPage\([\s\S]*container,[\s\S]*settingsApi,[\s\S]*window\.appApi\.clothing,[\s\S]*showToast,[\s\S]*activeTab,[\s\S]*window\.appApi\.shares/
);

console.log('Settings active-tab refresh test passed.');
