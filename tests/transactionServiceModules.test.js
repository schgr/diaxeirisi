const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const baseline = execFileSync(
  'git',
  ['show', '65374ff65dc02b1ddd1b7f992b8764b877f02ccb:src/services/transactionsService.js'],
  { cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }
);
const directory = path.join(root, 'src', 'services', 'transactions');
const modules = [
  'transactionQueryService.js',
  'addyService.js',
  'exhpService.js',
  'indexRegistryService.js',
  'shared.js'
].map((file) => fs.readFileSync(path.join(directory, file), 'utf8')).join('\n');
const facade = fs.readFileSync(path.join(directory, 'index.js'), 'utf8');

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

function extractMethod(source, name) {
  const pattern = new RegExp(`^\\s{4}${name}\\(`, 'm');
  const match = pattern.exec(source);
  assert.ok(match, `Missing method ${name}`);
  let parentheses = 0;
  let bodyStart = -1;
  for (let index = source.indexOf('(', match.index); index < source.length; index += 1) {
    if (source[index] === '(') parentheses += 1;
    if (source[index] === ')' && --parentheses === 0) {
      bodyStart = source.indexOf('{', index);
      break;
    }
  }
  return blockAt(source, match.index, bodyStart).trim();
}

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.ok(start >= 0, `Missing helper ${name}`);
  return blockAt(source, start, source.indexOf('{', start)).trim();
}

const baselineFacade = baseline.slice(0, baseline.indexOf('function mapExhpSupportTemplate'));
const publicApi = Array.from(
  baselineFacade.matchAll(/^    ([A-Za-z][A-Za-z0-9_]*)\(/gm),
  (match) => match[1]
).filter((name) => !['Number', 'String'].includes(name));
const currentApi = Array.from(
  facade.matchAll(/^    ([A-Za-z][A-Za-z0-9_]*): /gm),
  (match) => match[1]
);
assert.deepStrictEqual(currentApi, publicApi, 'Public API or method order changed.');
for (const name of publicApi) {
  if (name === 'updateAddyDocument') continue;
  assert.strictEqual(extractMethod(modules, name), extractMethod(baseline, name), `${name} changed.`);
}

const helperNames = Array.from(
  baseline.matchAll(/^function ([A-Za-z][A-Za-z0-9_]*)/gm),
  (match) => match[1]
).filter((name) => name !== 'createTransactionsService');
for (const name of helperNames) {
  assert.strictEqual(extractFunction(modules, name), extractFunction(baseline, name), `${name} changed.`);
}

console.log(
  `transactionServiceModules.test.js: OK (${publicApi.length} public methods, ${helperNames.length} helpers exact)`
);
