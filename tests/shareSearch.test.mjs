import assert from 'node:assert/strict';
import { filterAndRankShares } from '../src/ui/pages/sharesPage.js';

const shares = [
  { id: 1, description: 'ΚΙΤ ΑΝΤΑΛΛΑΚΤΙΚΩΝ', materialType: 'Υλικό' },
  { id: 2, description: 'ΠΡΟΣΤΑΤΕΥΤΙΚΟ ΚΑΛΥΜΜΑ', materialType: 'Υλικό' },
  { id: 3, description: 'ΑΝΤΛΙΑ ΠΕΤΡΕΛΑΙΟΥ', materialType: 'Υλικό' },
  { id: 4, description: 'ΑΝΤΙ-ΣΚΗΝΟ', materialType: 'Υλικό' },
  { id: 5, description: 'Συσσωρευτής οχήματος', materialType: 'Υλικό' }
];

const ranked = filterAndRankShares(shares, { description: 'αντ' });
assert.deepEqual(
  ranked.map((share) => share.id),
  [4, 3, 1],
  'οι περιγραφές που αρχίζουν με τα πρώτα γράμματα πρέπει να εμφανίζονται πρώτες'
);

assert.deepEqual(
  filterAndRankShares(shares, { description: 'καλυμμα' }).map((share) => share.id),
  [2],
  'η αναζήτηση πρέπει να αγνοεί τους τόνους'
);

assert.deepEqual(
  filterAndRankShares(shares, { description: 'συσσωρευτης' }).map((share) => share.id),
  [5],
  'η αναζήτηση πρέπει να εξομοιώνει το τελικό ς'
);

assert.deepEqual(
  filterAndRankShares(shares, { description: 'αντισκηνο' }).map((share) => share.id),
  [4],
  'η αναζήτηση πρέπει να αγνοεί βασικά σημεία στίξης'
);

console.log('shareSearch.test.mjs: OK');
