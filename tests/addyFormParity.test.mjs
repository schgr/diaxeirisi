import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const moduleFiles = [
  'src/ui/transactions/addyForm.js',
  'src/ui/transactions/addy/addyState.js',
  'src/ui/transactions/addy/addyCalculations.js',
  'src/ui/transactions/addy/addyDom.js',
  'src/ui/transactions/addy/addyEvents.js'
].filter((file) => fs.existsSync(path.join(root, file)));
const sources = moduleFiles.map((file) => ({
  file,
  source: fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n')
}));
const expectedHashes = {
  exhpDraftKey: 'e9cebee86a225f0ee6e015f18bccf414114a012be6d9404deb6de5c91bcd0811',
  scheduleAddyDraftSave: '788f7fe623e0952b659accec3148ba64e4e0f293542aaa094b86b576e41c87ee',
  scheduleExhpDraftSave: '730eb41ce090dc97aec177ec64b0edbab6d5fbe4972e8c4f1e3ec70c391e0a37',
  buildToolCompositionChargeItems: 'd93e2a4466abc0d04cf25fb268710e5e05c0c368bdb490abe7fe2ae36866713d',
  bindAddyForm: '73b94c09c143760dc593fe1898eddfc750b710ae609a3bcfefdeb17419cf7c2f',
  restoreAddyEntryFocus: '894750b959f3427329c9494ed7c8d0923d769bbd03e9d59b0f14b29a6acada2b',
  openAddyEditDialog: '00f7eee24ff173e66f10c83cac7dde692b9654be7bf704a4de2bc4e6eb482518',
  confirmAddyAction: 'dde55bc242787bed6f9d92481c9ec03311b1cf839001a2ce3ab2371f9f791717',
  openAddyShareSelectionDialog: '213486c9a94ac9ee471b2ea22ad20ba8320c962f5c2d8b23e18d6950c7b4c528',
  openAddyDepartmentAllocationDialog: '83374d180a87927fb6e764971e3e62a988b8e0a2a7823758e42b6d3f66852f31',
  formatAddyShareBalance: 'daefd80747ee579facc70754aff7cc170e5477a27047329f7f80e20b97f6f379',
  exceedsDepartmentCreditBalance: '78146d12e21b696835c1c8b3a308ef53cedca8e2d1eec62f45d92190eb95eff2',
  escapeAddyEditHtml: '36eccca1bf010152eb57c069015a63663f42a64999913cb0753e9eb2755e4e33',
  clearIssuedExhpDraftState: '60524c2ea21deaae8766009f196c26e3f38f121287de8a120fd7b92a0121a421'
};

function topLevelFunctions(source) {
  const matches = [...source.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gmu)];
  return matches.map((match, index) => ({
    name: match[1],
    text: source
      .slice(match.index, matches[index + 1]?.index ?? source.length)
      .trimEnd()
      .replace(/^export\s+/u, '')
  }));
}

const implementations = sources.flatMap(({ file, source }) =>
  topLevelFunctions(source).map((entry) => ({ file, ...entry }))
);
for (const [name, expectedHash] of Object.entries(expectedHashes)) {
  const matches = implementations.filter((entry) => entry.name === name);
  assert.strictEqual(matches.length, 1, `${name} must have exactly one implementation; found ${matches.length}.`);
  const actualHash = crypto.createHash('sha256').update(matches[0].text).digest('hex');
  assert.strictEqual(actualHash, expectedHash, `${name} changed in ${matches[0].file}.`);
}

const api = await import('../src/ui/transactions/addyForm.js');
assert.deepStrictEqual(Object.keys(api).sort(), ['bindAddyForm', 'exceedsDepartmentCreditBalance']);
assert.strictEqual(api.exceedsDepartmentCreditBalance('2.0000001', '2'), false);
assert.strictEqual(api.exceedsDepartmentCreditBalance('2.001', '2'), true);

console.log(`addyFormParity.test.mjs: OK (${Object.keys(expectedHashes).length} exact working-tree function hashes)`);
