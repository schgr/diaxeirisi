import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRE_SPLIT_COMMIT = 'ed43b7528a9f50c810dec1542186e7d36267844c';
const previousSource = execFileSync(
  'git',
  ['show', `${PRE_SPLIT_COMMIT}:src/ui/transactions/exhpSupportDocuments.js`],
  { cwd: root, encoding: 'utf8' }
);
const currentFiles = [
  'src/ui/transactions/exhpSupportDocuments.js',
  'src/ui/transactions/exhpSupportChecklist.js',
  'src/ui/transactions/exhpSupportFolder.js',
  'src/ui/transactions/exhpSupportTemplateModal.js',
  'src/exhpForm/supportingDocs/officialSupportRenderer.js'
].filter((file) => fs.existsSync(path.join(root, file)));
const currentSources = currentFiles.map((file) => ({
  file,
  source: fs.readFileSync(path.join(root, file), 'utf8')
}));

function functionNames(source) {
  return [...source.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gmu)]
    .map((match) => match[1]);
}

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

const originalNames = functionNames(previousSource);
assert.ok(originalNames.length > 0, 'No original EXHP support-document functions found.');
for (const name of originalNames) {
  const matches = currentSources.filter(({ source }) =>
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`, 'u').test(source)
  );
  assert.strictEqual(matches.length, 1, `${name} must have exactly one implementation; found ${matches.length}.`);
  assert.strictEqual(
    extractFunction(matches[0].source, name),
    extractFunction(previousSource, name),
    `${name} changed while moving to ${matches[0].file}.`
  );
}

console.log(`exhpSupportDocumentsParity.test.mjs: OK (${originalNames.length} exact function comparisons)`);
