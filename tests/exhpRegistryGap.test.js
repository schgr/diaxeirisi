const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeDatabase } = require('../src/db/database');
const { createTransactionsRepository } = require('../src/db/transactionsRepository');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-exhp-gap-'));
  try {
    const db = await initializeDatabase(directory);
    const repository = createTransactionsRepository(db);
    const ids = [1, 2, 3, 4].map((registryNumber) => repository.createExhpDocument({
      fiscalYear: 2026,
      registryNumber,
      documentDate: '2026-08-29',
      serviceUnit: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ',
      issueReason: 'ΔΟΚΙΜΗ',
      approvalReference: '',
      otherSupportDocument: '',
      notes: '',
      status: 'Καταχωρημένη'
    }));

    repository.deleteExhpDocument(ids[1]);
    assert.equal(repository.getNextExhpRegistryNumber(2026), 2);

    repository.createExhpDocument({
      fiscalYear: 2026,
      registryNumber: 2,
      documentDate: '2026-08-29',
      serviceUnit: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ',
      issueReason: 'ΔΟΚΙΜΗ',
      approvalReference: '',
      otherSupportDocument: '',
      notes: '',
      status: 'Καταχωρημένη'
    });
    assert.equal(repository.getNextExhpRegistryNumber(2026), 5);
    console.log('EXHP first-available registry-number test passed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
