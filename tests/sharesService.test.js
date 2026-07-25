const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AppError } = require('../src/core/errorHandler');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { createSharesRepository } = require('../src/db/sharesRepository');

const baseShare = {
  shareNumber: '100',
  nominalNumber: '1005-TEST',
  description: 'Υλικό δοκιμής',
  materialType: 'Αναλώσιμα',
  projectedQuantity: 20,
  accountingBalance: 10,
  chargedQuantity: 4
};

async function run() {
  const tests = [
    {
      label: 'addShare() creates a share with repository defaults',
      run: testAddShareDefaults
    },
    {
      label: 'updateShareDetails() keeps requiresComposition and requiresChangeSheet independent',
      run: testRequiresFlagsAreIndependent
    },
    {
      label: 'getShareCard() calculates balance, availability, difference and status',
      run: testShareCardBalances
    },
    {
      label: 'listMovedShareCards() returns only cards with movements in the selected year',
      run: testMovedShareCardsByYear
    },
    {
      label: 'saveComposition() rejects invalid rows with VALIDATION_ERROR',
      run: testSaveCompositionValidation
    },
    {
      label: 'serial registry follows final department charges and preserves entered values',
      run: testSerialNumberRegistry
    }
  ];

  let passed = 0;
  for (const test of tests) {
    try {
      await withSharesService(test.run);
      passed += 1;
      console.log(`✓ ${test.label}`);
    } catch (error) {
      console.error(`✗ ${test.label}`);
      console.error(error);
    }
  }

  console.log(`${passed}/${tests.length} shares service tests passed`);
  if (passed !== tests.length) {
    process.exitCode = 1;
  }
}

async function withSharesService(testBody) {
  const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-shares-'));
  try {
    const db = await initializeDatabase(tempDirectory);
    const service = createSharesService(db);
    await testBody({ db, service });
  } finally {
    fs.rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function testAddShareDefaults({ service }) {
  const [created] = service.addShare(baseShare);

  assert.strictEqual(created.shareNumber, baseShare.shareNumber);
  assert.strictEqual(created.nominalNumber, baseShare.nominalNumber);
  assert.strictEqual(created.description, baseShare.description);
  assert.strictEqual(created.materialType, baseShare.materialType);
  assert.strictEqual(created.materialCode, '');
  assert.strictEqual(created.mainMaterialNumber, '');
  assert.strictEqual(created.measurementUnit, '');
  assert.strictEqual(created.projectedQuantity, baseShare.projectedQuantity);
  assert.strictEqual(created.accountingBalance, baseShare.accountingBalance);
  assert.strictEqual(created.chargedQuantity, baseShare.chargedQuantity);
  assert.strictEqual(created.availableQuantity, 6);
  assert.strictEqual(created.differenceQuantity, -6);
  assert.strictEqual(created.requiresComposition, false);
  assert.strictEqual(created.requiresSerialNumber, false);
  assert.strictEqual(created.requiresWeaponRegistry, false);
  assert.strictEqual(created.requiresChangeSheet, false);
  assert.strictEqual(created.photoPath, '');
  assert.strictEqual(created.status, 'Έλλειμμα');
  assert.strictEqual(created.statusTone, 'deficit');
}

function testMovedShareCardsByYear({ db, service }) {
  const moved = createShare(service, '310', { chargedQuantity: 0 });
  const otherYear = createShare(service, '311', { chargedQuantity: 0 });
  const inventoryOnly = createShare(service, '312', { chargedQuantity: 0 });
  insertShareTransaction(db, moved.id, {
    date: '2026-04-10', type: 'Χρέωση', quantity: 3, reference: 'ΑΔΔΥ-1'
  });
  insertShareTransaction(db, otherYear.id, {
    date: '2025-04-10', type: 'Χρέωση', quantity: 2, reference: 'ΑΔΔΥ-2'
  });
  insertShareTransaction(db, inventoryOnly.id, {
    date: '2026-01-01', type: 'Χρέωση', quantity: 5, reference: 'ΑΠΟΓΡΑΦΗ',
    notes: 'INITIAL_ANNUAL_INVENTORY'
  });

  const cards = service.listMovedShareCards(2026);
  assert.deepStrictEqual(cards.map((card) => card.share.shareNumber), ['310']);
  assert.strictEqual(cards[0].transactions.length, 1);
  assert.throws(() => service.listMovedShareCards(1999), (error) => error.code === 'VALIDATION_ERROR');
}

function testRequiresFlagsAreIndependent({ service }) {
  const share = createShare(service, '200', { chargedQuantity: 0 });

  let updated = service.updateShareDetails(share.id, {
    requiresComposition: false,
    requiresChangeSheet: true
  });
  assert.strictEqual(updated.requiresComposition, false);
  assert.strictEqual(updated.requiresChangeSheet, true);

  updated = service.updateShareDetails(share.id, {
    requiresComposition: true,
    requiresChangeSheet: false,
    requiresWeaponRegistry: true
  });
  assert.strictEqual(updated.requiresComposition, true);
  assert.strictEqual(updated.requiresChangeSheet, false);
  assert.strictEqual(updated.requiresWeaponRegistry, true);

  updated = service.updateShareDetails(share.id, {
    requiresComposition: false
  });
  assert.strictEqual(updated.requiresComposition, false);
  assert.strictEqual(updated.requiresChangeSheet, false);
  assert.strictEqual(updated.requiresWeaponRegistry, true);
}

function testShareCardBalances({ db, service }) {
  const scenarios = [
    {
      shareNumber: '301',
      openingQuantity: 10,
      chargedQuantity: 10,
      expected: {
        accountingBalance: 10,
        availableQuantity: 0,
        differenceQuantity: 0,
        status: 'Ισοσκελισμένο',
        statusTone: 'balanced'
      }
    },
    {
      shareNumber: '302',
      openingQuantity: 8,
      chargedQuantity: 3,
      expected: {
        accountingBalance: 8,
        availableQuantity: 5,
        differenceQuantity: -5,
        status: 'Έλλειμμα',
        statusTone: 'deficit'
      }
    },
    {
      shareNumber: '303',
      openingQuantity: 4,
      chargedQuantity: 10,
      expected: {
        accountingBalance: 4,
        availableQuantity: -6,
        differenceQuantity: 6,
        status: 'Πλεόνασμα',
        statusTone: 'surplus'
      }
    }
  ];

  for (const scenario of scenarios) {
    const share = createShare(service, scenario.shareNumber, {
      accountingBalance: 0,
      chargedQuantity: scenario.chargedQuantity
    });
    insertShareTransaction(db, share.id, {
      date: '2026-01-01',
      type: 'Χρέωση',
      quantity: scenario.openingQuantity,
      reference: `ΑΠΟΓΡΑΦΗ ${scenario.shareNumber}`,
      notes: 'INITIAL_ANNUAL_INVENTORY'
    });

    const card = service.getShareCard(share.id, 2026);
    assert.strictEqual(card.share.accountingBalance, scenario.expected.accountingBalance);
    assert.strictEqual(card.share.availableQuantity, scenario.expected.availableQuantity);
    assert.strictEqual(card.share.differenceQuantity, scenario.expected.differenceQuantity);
    assert.strictEqual(card.share.status, scenario.expected.status);
    assert.strictEqual(card.share.statusTone, scenario.expected.statusTone);
  }
}

function testSaveCompositionValidation({ service }) {
  const share = createShare(service, '400');

  assertValidationError(() => service.saveComposition(share.id, [
    {
      componentNominalNumber: 'A-1',
      componentDescription: 'Έγκυρο υποείδος',
      measurementUnit: 'Τεμάχια',
      projectedQuantity: -1
    }
  ]));

  assertValidationError(() => service.saveComposition(share.id, [
    {
      componentNominalNumber: 'A-2',
      componentDescription: '',
      measurementUnit: 'Τεμάχια',
      projectedQuantity: 1
    }
  ]));
}

function testSerialNumberRegistry({ db, service }) {
  const share = createShare(service, '500', { chargedQuantity: 3 });
  service.updateShareDetails(share.id, { requiresSerialNumber: true });

  const firstManager = db.prepare(`
    INSERT INTO department_managers (department_name, department_head, sort_order)
    VALUES (?, ?, ?)
  `).run('Α Πυρχία', 'Αξκός Α', 1).lastInsertRowid;
  const secondManager = db.prepare(`
    INSERT INTO department_managers (department_name, department_head, sort_order)
    VALUES (?, ?, ?)
  `).run('Β Πυρχία', 'Αξκός Β', 2).lastInsertRowid;

  insertInternalMovement(db, share, firstManager, 'Α Πυρχία', 'Αξκός Α', 'Χορήγηση', 2, 1);
  insertInternalMovement(db, share, secondManager, 'Β Πυρχία', 'Αξκός Β', 'Χορήγηση', 1, 2);

  assert.deepStrictEqual(createSharesRepository(db).listShareAssignments(share.id).map((item) => item.department), ['Α Πυρχία', 'Β Πυρχία']);

  let [registry] = service.listSerialNumberRegistry();
  assert.strictEqual(registry.quantity, 3);
  assert.deepStrictEqual(registry.entries.map((entry) => entry.department), ['Α Πυρχία', 'Α Πυρχία', 'Β Πυρχία']);

  service.saveSerialNumbers(share.id, registry.entries.map((entry) => ({
    position: entry.position,
    serialNumber: `SN-${entry.position}`,
    notes: `Σημείωση ${entry.position}`
  })));
  [registry] = service.listSerialNumberRegistry();
  assert.deepStrictEqual(registry.entries.map((entry) => entry.serialNumber), ['SN-1', 'SN-2', 'SN-3']);
}

function insertInternalMovement(db, share, managerId, department, head, movementType, quantity, serialNumber) {
  db.prepare(`
    INSERT INTO internal_documents (
      fiscal_year, serial_number, document_date, department_manager_id,
      department_name, department_head, movement_type, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, '')
  `).run(2026, serialNumber, '2026-01-01', managerId, department, head, movementType);
  const documentId = db.prepare(
    'SELECT id FROM internal_documents WHERE fiscal_year = ? AND serial_number = ?'
  ).get(2026, serialNumber).id;
  db.prepare(`
    INSERT INTO internal_items (
      internal_document_id, share_id, share_number, nominal_number,
      description, measurement_unit, quantity
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(documentId, share.id, share.shareNumber, share.nominalNumber, share.description, 'Τεμάχια', quantity);
}

function createShare(service, shareNumber, overrides = {}) {
  service.addShare({
    ...baseShare,
    shareNumber,
    nominalNumber: `NOM-${shareNumber}`,
    description: `Υλικό ${shareNumber}`,
    ...overrides
  });
  return service.getShareByNumber(shareNumber);
}

function insertShareTransaction(db, shareId, payload) {
  db.prepare(`
    INSERT INTO share_transactions (
      share_id, transaction_date, transaction_unit, transaction_type,
      document_reference, quantity, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    shareId,
    payload.date,
    payload.unit || 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ',
    payload.type,
    payload.reference || '',
    payload.quantity,
    payload.notes || ''
  );
}

function assertValidationError(action) {
  assert.throws(
    action,
    (error) => error instanceof AppError && error.code === 'VALIDATION_ERROR'
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
