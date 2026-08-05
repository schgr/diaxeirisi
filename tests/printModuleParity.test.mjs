import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRE_SPLIT_COMMIT = 'b99e543642ecbc649f8758e0f4439ebdca1f7c9b';
const previousSource = execFileSync(
  'git',
  ['show', `${PRE_SPLIT_COMMIT}:src/ui/pages/printsPage.js`],
  { cwd: root, encoding: 'utf8' }
);
const currentSources = [
  'src/ui/pages/printsPage.js',
  'src/ui/prints/administrationPrint.js',
  'src/ui/prints/indexPrint.js',
  'src/ui/prints/inventoryPrint.js',
  'src/ui/prints/shareCardPrint.js',
  'src/ui/prints/shareRegistryPrint.js'
].map((file) => fs.readFileSync(path.join(root, file), 'utf8'));

function extractFunction(source, name) {
  const marker = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`, 'u');
  const match = marker.exec(source);
  assert.ok(match, `Missing function ${name}`);
  const open = source.indexOf('{', match.index);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '{') depth += 1;
    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        return source
          .slice(match.index, index + 1)
          .replace(/^export\s+/u, '')
          .replace(/\r\n/g, '\n');
      }
    }
  }
  assert.fail(`Unterminated function ${name}`);
}

const criticalFunctions = [
  'renderPrintsPage',
  'renderInventoryStatement',
  'renderShareCardBatchPreview',
  'renderExternalTransactionsIndex',
  'renderChargeCreditOrdersIndex',
  'renderMaterialRegistryPages',
  'renderSharesByCategoryPages',
  'selectFirstMaterialPerAddy',
  'renderIndexAnnualSignatures'
];

for (const name of criticalFunctions) {
  const currentSource = currentSources.find((source) =>
    new RegExp(`function\\s+${name}\\s*\\(`, 'u').test(source)
  );
  assert.ok(currentSource, `Current module missing ${name}`);
  assert.strictEqual(
    extractFunction(currentSource, name),
    extractFunction(previousSource, name),
    `${name} changed during the module split`
  );
}

console.log(`printModuleParity.test.mjs: OK (${criticalFunctions.length} exact function comparisons)`);
