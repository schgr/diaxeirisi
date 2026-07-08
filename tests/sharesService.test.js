const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AppError } = require('../src/core/errorHandler');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');

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
      label: 'saveComposition() rejects invalid rows with VALIDATION_ERROR',
      run: testSaveCompositionValidation
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
  assert.strictEqual(created.requiresChangeSheet, false);
  assert.strictEqual(created.photoPath, '');
  assert.strictEqual(created.status, 'Έλλειμμα');
  assert.strictEqual(created.statusTone, 'deficit');
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
    requiresChangeSheet: false
  });
  assert.strictEqual(updated.requiresComposition, true);
  assert.strictEqual(updated.requiresChangeSheet, false);

  updated = service.updateShareDetails(share.id, {
    requiresComposition: false
  });
  assert.strictEqual(updated.requiresComposition, false);
  assert.strictEqual(updated.requiresChangeSheet, false);
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
