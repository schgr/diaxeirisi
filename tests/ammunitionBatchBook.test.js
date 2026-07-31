const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');

async function run() {
  const administrationSource = fs.readFileSync(
    path.join(__dirname, '..', 'src', 'ui', 'pages', 'administrationPage.js'),
    'utf8'
  );
  assert.match(
    administrationSource,
    /data-print-ammunition-batches\s+data-export-title="Βιβλίο Μερίδων Β\.Φ"/u
  );

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-ammunition-batches-'));
  try {
    const db = await initializeDatabase(directory);
    const shares = createSharesService(db);
    shares.addShare(makeShare('10', 'ΠΥΡΟΜΑΧΙΚΑ Α'));
    shares.addShare(makeShare('20', 'ΠΥΡΟΜΑΧΙΚΑ Β'));

    const first = shares.listShares().find((share) => share.shareNumber === '10');
    const second = shares.listShares().find((share) => share.shareNumber === '20');
    shares.updateShareDetails(first.id, { requiresAmmunitionBatchBook: true });
    db.prepare(`
      INSERT INTO department_managers (department_name, department_head, sort_order)
      VALUES ('Α Πυρχία', 'Διοικητής Α', 1)
    `).run();
    const departmentId = db.prepare('SELECT id FROM department_managers WHERE department_name = ?')
      .get('Α Πυρχία').id;
    db.prepare(`
      INSERT INTO internal_documents (
        fiscal_year, serial_number, document_date, department_manager_id,
        department_name, department_head, movement_type, notes
      ) VALUES (2026, 1, '2026-01-10', ?, 'Α Πυρχία', 'Διοικητής Α', 'Χορήγηση', '')
    `).run(departmentId);
    const documentId = db.prepare('SELECT id FROM internal_documents WHERE department_manager_id = ?')
      .get(departmentId).id;
    db.prepare(`
      INSERT INTO internal_items (
        internal_document_id, share_id, share_number, nominal_number,
        description, measurement_unit, quantity, composition_snapshot
      ) VALUES (?, ?, '10', 'AO-10', 'ΠΥΡΟΜΑΧΙΚΑ Α', 'Τεμάχια', 200, '')
    `).run(documentId, first.id);
    let registry = shares.listAmmunitionBatchRegistry();
    assert.deepStrictEqual(registry.map((item) => item.share.shareNumber), ['10']);
    assert.strictEqual(registry[0].share.requiresAmmunitionBatchBook, true);
    assert.deepStrictEqual(registry[0].departments, [{ department: 'Α Πυρχία', quantity: 200 }]);

    shares.saveAmmunitionBatches(first.id, [
      { batchNumber: 'ΠΥΡ-001', quantity: 120, department: 'Α Πυρχία', notes: 'Πρώτη μερίδα' },
      { batchNumber: 'ΠΥΡ-002', quantity: 80, department: 'Α Πυρχία', notes: '' }
    ]);
    registry = shares.listAmmunitionBatchRegistry();
    assert.deepStrictEqual(registry[0].entries.map((entry) => entry.batchNumber), ['ΠΥΡ-001', 'ΠΥΡ-002']);
    assert.deepStrictEqual(registry[0].entries.map((entry) => entry.quantity), [120, 80]);
    assert.deepStrictEqual(registry[0].entries.map((entry) => entry.department), ['Α Πυρχία', 'Α Πυρχία']);

    assert.throws(
      () => shares.saveAmmunitionBatches(first.id, [
        { batchNumber: 'ΠΥΡ-003', quantity: 199, department: 'Α Πυρχία' }
      ]),
      /συνολική ποσότητα 200/
    );

    assert.throws(
      () => shares.saveAmmunitionBatches(first.id, [{ batchNumber: '', quantity: 1 }]),
      /Μερίδα Πυρκού/
    );
    assert.throws(
      () => shares.saveAmmunitionBatches(second.id, [{ batchNumber: 'Χ', quantity: 1 }]),
      /δεν έχει ενεργοποιημένο/
    );

    console.log('ammunitionBatchBook.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function makeShare(shareNumber, description) {
  return {
    shareNumber,
    nominalNumber: `AO-${shareNumber}`,
    description,
    materialType: 'Πυρομαχικά',
    projectedQuantity: 0,
    accountingBalance: 0,
    chargedQuantity: shareNumber === '10' ? 200 : 0
  };
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
