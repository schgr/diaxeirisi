import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const card = await readFile(new URL('../src/ui/shares/shareCard.js', import.meta.url), 'utf8');
const details = await readFile(new URL('../src/ui/shares/shareDetails.js', import.meta.url), 'utf8');

assert.match(details, /function selectDetailField/u);
assert.match(card, /collectMaterialTypes\(\[\{ materialType: card\.share\.materialType \}\], settings\?\.materialCategories\)/u);
assert.match(card, /selectDetailField\('Είδος υλικού', 'materialType', card\.share\.materialType, materialTypes, true\)/u);
assert.match(card, /data-share-detail="projectedQuantity"/u);
assert.ok(card.includes("modal.querySelector('[data-share-detail=\"materialType\"]').disabled = false;"));
assert.match(card, /data-cancel-share-details/u);
assert.match(card, /openShareCard\(card, sharesApi, showToast, settings, options\)/u);
assert.match(card, /projectedQuantity: details\.projectedQuantity\.value/u);
assert.match(card, /materialType: details\.materialType\.value\.trim\(\)/u);

console.log('Share-card edit mode and save/cancel regression checks passed.');
