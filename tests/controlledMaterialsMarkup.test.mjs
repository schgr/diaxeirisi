import assert from 'node:assert/strict';
import {
  CONTROLLED_MATERIAL_CATEGORIES,
  renderControlledMaterialsBook,
  renderWeaponRegistry
} from '../src/ui/administration/controlledMaterials.js';

const book = renderControlledMaterialsBook([
  {
    share: {
      shareNumber: '2',
      mainMaterialNumber: '50000',
      description: 'Διόπτρα <νυκτός>',
      projectedQuantity: 2,
      accountingBalance: 7
    }
  },
  {
    share: {
      shareNumber: '1',
      mainMaterialNumber: '01161',
      description: 'Τυφέκιο',
      projectedQuantity: 5,
      accountingBalance: 3
    }
  },
  { share: { shareNumber: '3', mainMaterialNumber: '', projectedQuantity: 1, accountingBalance: 1 } }
]);

const bodyRows = book.match(/<tr data-controlled-category="\d+">[\s\S]*?<\/tr>/gu);
assert.equal(bodyRows.length, 2, 'shares outside the controlled categories are skipped');
assert.match(bodyRows[0], /<td>1<\/td>/u);
assert.match(bodyRows[0], /<td>1<\/td>[\s\S]*<td>01161<\/td>/u, 'rows are sorted by material code');
assert.match(bodyRows[0], /data-controlled-category="1"/u);
assert.match(bodyRows[1], /Διόπτρα &lt;νυκτός&gt;/u, 'descriptions are escaped');
assert.match(bodyRows[1], /data-controlled-category="12"/u);
assert.match(book, /<option value="continuous">/u);
assert.match(book, /<option value="by-category">/u);
for (const category of CONTROLLED_MATERIAL_CATEGORIES) {
  assert.match(
    book,
    new RegExp(`<tr><td>${category.id}</td><td>\\d{5} - \\d{5}</td>`, 'u'),
    `the settings table is missing category ${category.id}`
  );
}

assert.match(
  renderControlledMaterialsBook([]),
  /Δεν υπάρχουν μερίδες που αντιστοιχούν στις κατηγορίες ελεγχομένων υλικών\./u
);

const registry = renderWeaponRegistry([
  {
    share: { id: 9, mainMaterialNumber: '01200', nominalNumber: 'ΑΟ-2', description: 'Πιστόλι' },
    entries: [
      { registryNumber: '10', details: 'Δεύτερο' },
      { registryNumber: '', details: 'Χωρίς μητρώο' },
      { registryNumber: '2', details: 'Πρώτο' }
    ]
  },
  {
    share: { id: 4, mainMaterialNumber: '01161', nominalNumber: 'ΑΟ-1', description: 'Τυφέκιο' },
    entries: []
  }
]);

const options = [...registry.matchAll(/<option value="(\d+)">/gu)].map((match) => match[1]);
assert.deepEqual(options, ['4', '9'], 'weapons are listed by ascending material code');

const books = registry.match(/<article class="weapon-registry-book"[\s\S]*?<\/article>/gu);
assert.equal(books.length, 2);
assert.doesNotMatch(books[0], /hidden/u, 'the first registry book stays visible');
assert.match(books[1], /hidden/u, 'the remaining registry books start hidden');
assert.match(books[1], /data-share-id="9"/u);

const entryValues = [...books[1].matchAll(/name="details" value="([^"]*)"/gu)].map((match) => match[1]);
assert.deepEqual(
  entryValues,
  ['Πρώτο', 'Δεύτερο', 'Χωρίς μητρώο'],
  'entries are sorted numerically and entries without a registry number go last'
);

assert.match(renderWeaponRegistry([]), /Δεν υπάρχουν μερίδες με ενεργό Μητρώο Οπλισμού\./u);

console.log('controlledMaterialsMarkup.test.mjs: OK');
