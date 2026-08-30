const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDraftsService } = require('../src/services/draftsService');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-drafts-'));

try {
  const service = createDraftsService(root);
  assert.strictEqual(service.getDraft('addy'), null);

  const saved = service.saveDraft('addy', { description: 'Δοκιμή', items: [1, 2] });
  assert.deepStrictEqual(saved.data, { description: 'Δοκιμή', items: [1, 2] });
  assert.match(saved.updatedAt, /^\d{4}-\d{2}-\d{2}T/u);
  assert.deepStrictEqual(service.getDraft('addy'), saved);
  assert.strictEqual(fs.existsSync(path.join(root, 'drafts.json.tmp')), false);

  service.clearDraft('addy');
  assert.strictEqual(service.getDraft('addy'), null);
  assert.deepStrictEqual(
    JSON.parse(fs.readFileSync(path.join(root, 'drafts.json'), 'utf8')),
    {}
  );

  console.log('draftsService.test.js: OK');
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
