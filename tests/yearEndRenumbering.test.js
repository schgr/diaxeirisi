const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { createInventoryService } = require('../src/services/inventoryService');
const { createYearEndService } = require('../src/services/yearEndService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-year-end-'));
  try {
    const db = await initializeDatabase(directory);
    const shares = createSharesService(db);
    const inventory = createInventoryService(db);
    const yearEnd = createYearEndService(db);

    shares.addShare(makeShare('10', 'Ενεργό υλικό', 12));
    shares.addShare(makeShare('20', 'Υλικό μηδενικού υπολοίπου', 0));
    const data = yearEnd.getRenumberingData();
    assert.strictEqual(data.shares.length, 2);
    assert.throws(() => yearEnd.validateRenumbering({
      fiscalYear: 2026,
      items: data.shares.map((share) => ({ shareId: share.id, newShareNumber: '', archive: false }))
    }), /Δεν έχει δοθεί νέος αριθμός/);
    assert.throws(() => yearEnd.validateRenumbering({
      fiscalYear: 2026,
      items: data.shares.map((share) => ({ shareId: share.id, newShareNumber: '100', archive: false }))
    }), /περισσότερες από μία μερίδες/);
    assert.throws(() => yearEnd.validateRenumbering({
      fiscalYear: 2026,
      items: data.shares.map((share) => ({
        shareId: share.id,
        newShareNumber: share.shareNumber,
        archive: share.shareNumber === '10'
      }))
    }), /δεν μπορεί να αρχειοθετηθεί/);

    const payload = {
      fiscalYear: 2026,
      items: data.shares.map((share) => ({
        shareId: share.id,
        newShareNumber: share.shareNumber === '10' ? '101' : '',
        archive: share.shareNumber === '20'
      }))
    };
    assert.strictEqual(yearEnd.validateRenumbering(payload).valid, true);
    const result = yearEnd.applyRenumbering(payload);
    assert.ok(result.inventorySessionId);
    assert.deepStrictEqual(shares.listShares().map((share) => share.shareNumber), ['101']);

    const snapshot = inventory.getSession(result.inventorySessionId);
    assert.strictEqual(snapshot.inventoryReason, 'Ετήσια απογραφή Διαχείρισης');
    assert.strictEqual(snapshot.status, 'Ολοκληρωμένη');
    assert.strictEqual(snapshot.periodStart, '2026-01-01');
    assert.strictEqual(snapshot.periodEnd, '2026-12-31');
    assert.strictEqual(snapshot.items.length, 2);
    assert.strictEqual(snapshot.items.find((item) => item.shareNumber === '10').accountingBalance, 12);
    assert.strictEqual(snapshot.items.find((item) => item.shareNumber === '10').finalCount, 12);
    assert.strictEqual(snapshot.items.find((item) => item.shareNumber === '10').settlementReference, '10');
    assert.throws(() => yearEnd.applyRenumbering({
      fiscalYear: 2026,
      items: [{ shareId: data.shares[0].id, newShareNumber: '102', archive: false }]
    }), /έχει ήδη πραγματοποιηθεί|όλες τις ενεργές μερίδες/);

    inventory.completeSession(result.inventorySessionId);
    inventory.saveCommittee(result.inventorySessionId, {
      committeePresidentRank: 'Τχης', committeePresidentName: 'Δοκιμή',
      committeeMemberARank: '', committeeMemberAName: '',
      committeeMemberBRank: '', committeeMemberBName: ''
    });
    assert.strictEqual(inventory.getSession(result.inventorySessionId).committeePresidentName, 'Δοκιμή');

    const annual = inventory.createSession({
      inventoryDate: '2027-07-20', inventoryReason: 'Ετήσια απογραφή Διαχείρισης'
    });
    const annualSession = inventory.getSession(annual.id);
    assert.strictEqual(annualSession.inventoryDate, '2027-12-31');
    assert.strictEqual(annualSession.status, 'Ολοκληρωμένη');
    assert.strictEqual(annualSession.periodStart, '2027-01-01');
    assert.strictEqual(annualSession.items[0].accountingBalance, 12);
    assert.strictEqual(annualSession.items[0].finalCount, 12);
    assert.strictEqual(annualSession.items[0].partialManagementQuantity, 0);
    assert.strictEqual(annualSession.items[0].expectedWarehouseQuantity, 0);
    console.log('yearEndRenumbering.test.js: OK');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function makeShare(shareNumber, description, accountingBalance) {
  return {
    shareNumber,
    nominalNumber: `N-${shareNumber}`,
    description,
    materialType: 'Αναλώσιμα',
    measurementUnit: 'Τεμάχια',
    projectedQuantity: accountingBalance,
    accountingBalance,
    chargedQuantity: 0
  };
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
