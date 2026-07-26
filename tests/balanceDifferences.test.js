const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { createAdministrationService } = require('../src/services/administrationService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-balance-differences-'));
  try {
    const db = await initializeDatabase(directory);
    const shares = createSharesService(db);
    const ordinaryDeficit = addShare(shares, '1', 'AO-1', 10, 8);
    addShare(shares, '2', 'AO-2', 4, 6);
    const compositionShare = addShare(shares, '3', 'AO-3', 1, 1);
    shares.updateShareDetails(compositionShare.id, { requiresComposition: true });
    shares.saveComposition(compositionShare.id, [
      {
        componentNominalNumber: 'COMP-A',
        componentDescription: 'ΥΛΙΚΟ ΣΥΝΘΕΣΗΣ Α',
        measurementUnit: 'Τεμάχια',
        projectedQuantity: 10,
        notIssuedQuantity: 0
      },
      {
        componentNominalNumber: 'COMP-B',
        componentDescription: 'ΥΛΙΚΟ ΣΥΝΘΕΣΗΣ Β',
        measurementUnit: 'Τεμάχια',
        projectedQuantity: 10,
        notIssuedQuantity: 0
      }
    ]);

    db.prepare(`
      INSERT INTO department_managers (department_name, department_head, sort_order)
      VALUES ('1ο Γραφείο', 'ΔΙΑΧΕΙΡΙΣΤΗΣ', 1)
    `).run();
    const department = db.prepare('SELECT id, department_name, department_head FROM department_managers ORDER BY id LIMIT 1').get();
    db.prepare(`
      INSERT INTO internal_documents (
        fiscal_year, serial_number, document_date, department_manager_id,
        department_name, department_head, movement_type, notes
      ) VALUES (2026, 1, '2026-03-01', ?, ?, ?, 'Χορήγηση', '')
    `).run(department.id, department.department_name, department.department_head);
    const documentId = db.prepare('SELECT id FROM internal_documents WHERE fiscal_year = 2026 AND serial_number = 1').get().id;
    db.prepare(`
      INSERT INTO internal_items (
        internal_document_id, share_id, share_number, nominal_number,
        description, measurement_unit, quantity, composition_snapshot
      ) VALUES (?, ?, '3', 'AO-3', 'ΣΥΝΘΕΣΗ', 'Τεμάχια', 1, ?)
    `).run(documentId, compositionShare.id, JSON.stringify([
      {
        componentNominalNumber: 'COMP-A',
        componentDescription: 'ΥΛΙΚΟ ΣΥΝΘΕΣΗΣ Α',
        measurementUnit: 'Τεμάχια',
        quantity: 9
      },
      {
        componentNominalNumber: 'COMP-B',
        componentDescription: 'ΥΛΙΚΟ ΣΥΝΘΕΣΗΣ Β',
        measurementUnit: 'Τεμάχια',
        quantity: 10
      }
    ]));
    const report = createAdministrationService(db).getBalanceDifferences();
    const deficit = report.find((row) => row.shareId === ordinaryDeficit.id && row.sourceType === 'Μερίδα');
    const compositionDeficit = report.find((row) => row.nominalNumber === 'COMP-A');
    const balancedComposition = report.find((row) => row.nominalNumber === 'COMP-B');
    const surplus = report.find((row) => row.shareNumber === '2');

    assert.strictEqual(deficit.status, 'Έλλειμμα');
    assert.strictEqual(deficit.differenceQuantity, 2);
    assert.strictEqual(compositionDeficit.sourceType, 'Σύνθεση');
    assert.strictEqual(compositionDeficit.existingQuantity, 10);
    assert.strictEqual(compositionDeficit.chargedQuantity, 9);
    assert.strictEqual(compositionDeficit.differenceQuantity, 1);
    assert.strictEqual(compositionDeficit.status, 'Έλλειμμα');
    assert.strictEqual(balancedComposition, undefined);
    assert.strictEqual(surplus.status, 'Πλεόνασμα');
    assert.strictEqual(surplus.differenceQuantity, 2);
    console.log('balanceDifferences.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function addShare(shares, shareNumber, nominalNumber, accountingBalance, chargedQuantity) {
  const created = shares.addShare({
    shareNumber,
    nominalNumber,
    description: `ΥΛΙΚΟ ${shareNumber}`,
    materialType: 'Υλικό',
    projectedQuantity: 0,
    accountingBalance,
    chargedQuantity
  });
  return created.find((share) => share.shareNumber === shareNumber);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
