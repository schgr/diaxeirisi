import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const [controller, renderer, addySources, charges, requests] = await Promise.all([
  readFile(new URL('src/ui/pageDrafts.js', root), 'utf8'),
  readFile(new URL('src/ui/renderer.js', root), 'utf8'),
  Promise.all([
    'src/ui/transactions/addyForm.js',
    'src/ui/transactions/addy/addyState.js',
    'src/ui/transactions/addy/addyCalculations.js',
    'src/ui/transactions/addy/addyDom.js',
    'src/ui/transactions/addy/addyEvents.js'
  ].map((file) => readFile(new URL(file, root), 'utf8').catch(() => ''))),
  readFile(new URL('src/ui/pages/chargesPage.js', root), 'utf8'),
  readFile(new URL('src/ui/pages/requestsPage.js', root), 'utf8')
]);
const addy = addySources.join('\n');

assert.match(controller, /window\.localStorage\.setItem/u);
assert.match(controller, /draftsApi\.save/u);
assert.match(controller, /input, select, textarea/u);
assert.match(controller, /\['button', 'file', 'hidden', 'password', 'reset', 'submit'\]/u);
assert.match(renderer, /pageDrafts\.deactivate\(\)/u);
assert.match(renderer, /restoreActivePageDraft\(sectionRoot\)/u);
assert.match(renderer, /beforeunload/u);
assert.match(addy, /ADDY_DRAFT_KEY/u);
assert.match(addy, /EXHP_DRAFT_KEY/u);
assert.match(charges, /INTERNAL_MOVEMENT_DRAFT_KEY/u);
assert.match(charges, /persistInternalMovementDrafts\(state\)/u);
assert.match(requests, /REQUEST_DRAFT_KEY/u);
assert.match(requests, /persistRequestDraft\(state\)/u);

console.log('Application-wide page and transaction draft persistence test passed.');
