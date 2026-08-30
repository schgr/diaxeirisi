import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function source(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function count(sourceText, pattern) {
  return (sourceText.match(pattern) || []).length;
}

const renderer = await source('src/ui/renderer.js');
const addyEvents = await source('src/ui/transactions/addy/addyEvents.js');
const settings = await source('src/ui/pages/settings/settingsPage.js');
const administration = await source('src/ui/pages/administration/administrationPage.js');
const officialActions = await source('src/ui/transactions/exhp/officialDocuments/officialDocumentActions.js');
const supportTemplate = await source('src/ui/transactions/exhpSupportTemplateModal.js');

// Navigation destroys the previous section subtree before every page mount.
assert.match(renderer, /pageRoot\.innerHTML\s*=\s*`[\s\S]*section-root/);
assert.match(renderer, /const sectionRoot = pageRoot\.querySelector\('#section-root'\)/);

// ADDY's coordinator removes the previous delegated handlers before attaching new ones.
assert.match(addyEvents, /container\.removeEventListener\('input', container\.__addyInputHandler\)/);
assert.match(addyEvents, /container\.removeEventListener\('click', container\.__addyClickHandler\)/);
assert.match(addyEvents, /container\.__addyInputHandler\s*=\s*inputHandler/);
assert.match(addyEvents, /container\.__addyClickHandler\s*=\s*clickHandler/);

// Settings binds delegated handlers with stable identities and explicit teardown.
assert.ok(count(settings, /container\.addEventListener\('click'/g) >= 3);
assert.ok(count(settings, /container\.removeEventListener\('click'/g) >= 3);
assert.match(settings, /settingsDeletesClickHandler/);
assert.match(settings, /settingsRequestClickHandler/);
assert.match(settings, /settingsTransactionClickHandler/);

// Administration and EXHP modal actions are scoped to freshly-created DOM roots.
assert.match(administration, /container\.innerHTML\s*=\s*`/);
assert.match(officialActions, /const modal = document\.createElement\('div'\)/);
assert.match(officialActions, /modal\.addEventListener\('click'/);
assert.match(supportTemplate, /const modal = document\.createElement\('div'\)/);
assert.match(supportTemplate, /modal\.addEventListener\('click'/);

console.log('UI lifecycle regression safeguards passed for renderer, ADDY, Settings, Administration and EXHP flows.');
