const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createAdministrationService } = require('../src/services/administrationService');
async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'handover-delete-'));
  try {
    const db = await initializeDatabase(directory);
    const service = createAdministrationService(db);
    const payload = { startDate: '2026-06-20', orderReference: 'TEST', outgoingOfficer: 'Α', incomingOfficer: 'Β' };
    const first = service.createHandover(payload);
    const second = service.createHandover({ ...payload, startDate: '2026-06-15' });
    const third = service.createHandover(payload);
    assert.deepStrictEqual(service.getReferenceData().handovers.map(item => item.id), [first.id, second.id, third.id]);
    service.deleteHandover(second.id);
    assert.throws(() => service.getHandover(second.id), /δεν βρέθηκε/);
    assert.strictEqual(db.prepare('SELECT COUNT(*) AS count FROM general_management_handover_checks WHERE handover_id = ?').get(second.id).count, 0);
    assert.strictEqual(service.getHandover(first.id).checks.length, 7);
    assert.strictEqual(service.getHandover(third.id).checks.length, 7);
    assert.throws(() => service.deleteHandover(-1));
    assert.throws(() => service.deleteHandover(second.id), /δεν βρέθηκε/);
    console.log('handoverDeletion.test.js: OK');
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
