import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRE_SPLIT_COMMIT = 'ed43b7528a9f50c810dec1542186e7d36267844c';
const previousSource = execFileSync(
  'git',
  ['show', `${PRE_SPLIT_COMMIT}:src/ui/transactions/exhpOfficialDocuments.js`],
  { cwd: root, encoding: 'utf8' }
);
const moduleFiles = [
  'src/ui/transactions/exhpOfficialDocuments.js',
  'src/ui/transactions/exhp/officialDocuments/officialDocumentState.js',
  'src/ui/transactions/exhp/officialDocuments/officialDocumentValidation.js',
  'src/ui/transactions/exhp/officialDocuments/officialDocumentRules.js',
  'src/ui/transactions/exhp/officialDocuments/officialDocumentRenderer.js',
  'src/ui/transactions/exhp/officialDocuments/officialDocumentActions.js',
  'src/ui/transactions/exhp/officialDocuments/officialDocumentPrint.js'
].filter((file) => fs.existsSync(path.join(root, file)));
const currentSources = moduleFiles.map((file) => ({
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
assert.strictEqual(originalNames.length, 52, 'Unexpected official-document baseline function count.');
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

const api = await import('../src/ui/transactions/exhpOfficialDocuments.js');
assert.deepStrictEqual(Object.keys(api).sort(), [
  'USELESS_MATERIAL_FORMS',
  'autofillShareDocumentRow',
  'bindShareRows',
  'collectExhpDocumentPreviewData',
  'ensureExhpSupportDocument',
  'isAmmoConsumptionReason',
  'isUselessMaterialReason',
  'openExhpDocumentModal',
  'openUselessMaterialFormModal',
  'prepareUselessProtocolData',
  'previewExhpDocument',
  'renderAmmoTable',
  'renderExhpDocumentItemRow',
  'renderUselessBForm',
  'renderUselessMaterialTabs',
  'saveDraftExhpDocuments',
  'saveExhpDocumentForm',
  'validateSharedMaterialPayload'
].sort());

const sample = {
  documentReference: 'REF-1',
  documentDate: '2026-08-29',
  committeeOrder: 'ORD-2',
  chairman: 'ΠΡΟΕΔΡΟΣ',
  member1: 'ΜΕΛΟΣ Α',
  member2: 'ΜΕΛΟΣ Β',
  items: [{
    shareNumber: '12',
    nominalNumber: 'N-1',
    description: 'Υλικό <Α>',
    measurementUnit: 'ΤΕΜ',
    quantity: 2,
    notes: 'Σημείωση'
  }]
};
const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
assert.strictEqual(hash(api.renderUselessMaterialTabs()), '505ed81af91f782f888bcc418b425c38402d61f07a7bd13be145692044c7d6a1');
assert.strictEqual(hash(api.renderUselessBForm({ secondary: sample })), 'c25b684998aac50e51128538fff504be5a0497df0e579e7f2982bbcad209aff4');
assert.strictEqual(hash(api.renderAmmoTable('Δοκιμή', 'consumed', sample.items)), '5571110eab438126b3bd21b5cd6a94253b9e55048940a833a192c6bd0034541c');
assert.strictEqual(hash(api.renderExhpDocumentItemRow('consumed', sample.items[0], 2)), '368f014d5a1b181994897364041d2d91db9fbdf3061fa72c173722ad4b855c90');
assert.deepStrictEqual(api.USELESS_MATERIAL_FORMS.map((form) => form.key), [
  'primary_inspection', 'primary_a', 'primary_b', 'primary_d2', 'primary_d3',
  'differences', 'secondary_inspection', 'secondary_a', 'secondary_b', 'secondary_d2', 'secondary_d3'
]);
assert.strictEqual(api.isUselessMaterialReason('Λογιστική τακτοποίηση άχρηστου υλικού'), true);
assert.strictEqual(api.isAmmoConsumptionReason('Διαγραφή καταναλωθέντων πυρομαχικών'), true);

console.log(`exhpOfficialDocumentsParity.test.mjs: OK (${originalNames.length} exact function comparisons + output characterization)`);
