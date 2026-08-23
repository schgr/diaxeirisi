import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRE_SPLIT_COMMIT = 'c01ee0da7e53e78fe5460250312b0d449d7c6335';
const baseline = execFileSync(
  'git',
  ['show', `${PRE_SPLIT_COMMIT}:src/ui/pages/sharesPage.js`],
  { cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
);
const files = [
  'src/ui/pages/sharesPage.js',
  'src/ui/shares/shareCard.js',
  'src/ui/shares/shareComposition.js',
  'src/ui/shares/shareDetails.js',
  'src/ui/shares/shareList.js',
  'src/ui/shares/sharePrint.js',
  'src/ui/shares/shared.js'
];
const current = files.map((file) => fs.readFileSync(path.join(root, file), 'utf8'));
const combined = current.join('\n');

function blockAt(source, start, openingBrace) {
  let depth = 0;
  let quote = '';
  let template = false;
  let escaped = false;
  for (let index = openingBrace; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = Boolean(quote || template);
      continue;
    }
    if (quote) {
      if (character === quote) quote = '';
      continue;
    }
    if (template) {
      if (character === '`') template = false;
      continue;
    }
    if (character === "'" || character === '"') quote = character;
    else if (character === '`') template = true;
    else if (character === '{') depth += 1;
    else if (character === '}' && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed block at ${start}`);
}

function extractFunction(source, name) {
  const pattern = new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\(`, 'm');
  const match = pattern.exec(source);
  assert.ok(match, `Missing function ${name}`);
  let parentheses = 0;
  let openingBrace = -1;
  for (let index = source.indexOf('(', match.index); index < source.length; index += 1) {
    if (source[index] === '(') parentheses += 1;
    if (source[index] === ')' && --parentheses === 0) {
      openingBrace = source.indexOf('{', index);
      break;
    }
  }
  assert.notStrictEqual(openingBrace, -1, `Missing body for ${name}`);
  return blockAt(source, match.index, openingBrace)
    .replace(/^export\s+/u, '')
    .replace(/\r\n/g, '\n');
}

const functionNames = Array.from(
  baseline.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z][A-Za-z0-9_]*)\(/gm),
  (match) => match[1]
);
const intentionallyChanged = new Set([
  'bindLiveFilters',
  'bindShareCardOpen',
  'descriptionMatchRank',
  'filterAndRankShares',
  'openShareCard',
  'printMaterialFormDocument',
  'renderCompositionDocument',
  'renderCompositionDocumentFooter',
  'renderCompositionRows',
  'renderOfficialShareBackPage',
  'renderRows',
  'renderSharesPage',
  'setCompositionLocked'
]);
assert.strictEqual(new Set(functionNames).size, functionNames.length, 'Baseline has duplicate function names.');

for (const name of functionNames) {
  if (intentionallyChanged.has(name)) continue;
  const owners = current.filter((source) =>
    new RegExp(`^(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\(`, 'm').test(source)
  );
  assert.strictEqual(owners.length, 1, `${name} must have exactly one module owner.`);
  assert.strictEqual(
    extractFunction(owners[0], name),
    extractFunction(baseline, name),
    `${name} changed during the module split.`
  );
}

const expectedExports = [
  'filterAndRankShares',
  'numberToGreekWords',
  'renderChangeSheetDocument',
  'renderCompositionDocument',
  'renderCompositionDocumentFooter',
  'renderRows',
  'renderShareBackTemplate',
  'renderSharePrintDocument',
  'renderSharesPage'
].sort();
const pageModule = await import(
  `${pathToFileURL(path.join(root, 'src/ui/pages/sharesPage.js')).href}?parity=${Date.now()}`
);
assert.deepStrictEqual(Object.keys(pageModule).sort(), expectedExports, 'Public shares page API changed.');

assert.match(combined, /removeEventListener/u, 'Intentional listeners must provide cleanup.');
assert.ok(
  fs.readFileSync(path.join(root, 'src/ui/pages/sharesPage.js'), 'utf8').split(/\r?\n/u).length < 200,
  'sharesPage.js is no longer a small page coordinator.'
);

for (const file of files) {
  await import(`${pathToFileURL(path.join(root, file)).href}?resolve=${Date.now()}`);
}

console.log(
  `sharePageModules.test.mjs: OK (${files.length} modules, ${functionNames.length} exact function comparisons)`
);
