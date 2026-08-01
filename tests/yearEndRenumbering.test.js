const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSharesService } = require('../src/services/sharesService');
const { createInventoryService } = require('../src/services/inventoryService');
const { createYearEndService } = require('../src/services/yearEndService');
const { createAdministrationService } = require('../src/services/administrationService');
const { createTransactionsService } = require('../src/services/transactionsService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-year-end-'));
  try {
    const db = await initializeDatabase(directory);
    const shares = createSharesService(db);
    const inventory = createInventoryService(db);
    const yearEnd = createYearEndService(db);
    const administration = createAdministrationService(db);
    const transactions = createTransactionsService(db);

    shares.addShare(makeShare('10', 'Ενεργό υλικό', 12));
    shares.addShare(makeShare('20', 'Υλικό μηδενικού υπολοίπου', 0));
    shares.addShare(makeShare('30', 'Δεύτερο ενεργό υλικό', 5));
    const inactiveShare = shares.listShares().find((share) => share.shareNumber === '20');
    administration.archiveShare({
      shareId: inactiveShare.id,
      actionDate: '2026-12-30',
      reason: 'Κατάργηση είδους'
    });
    const data = yearEnd.getRenumberingData();
    assert.strictEqual(data.shares.length, 2);
    assert.throws(() => yearEnd.validateRenumbering({
      fiscalYear: 2026,
      items: data.shares.map((share) => ({ shareId: share.id, newShareNumber: '' }))
    }), /Δεν έχει δοθεί νέος αριθμός/);
    assert.throws(() => yearEnd.validateRenumbering({
      fiscalYear: 2026,
      items: data.shares.map((share) => ({ shareId: share.id, newShareNumber: '100' }))
    }), /περισσότερες από μία μερίδες/);

    const payload = {
      fiscalYear: 2026,
      items: data.shares.map((share) => ({
        shareId: share.id,
        newShareNumber: share.shareNumber === '10' ? '101' : '103'
      }))
    };
    assert.strictEqual(yearEnd.validateRenumbering(payload).valid, true);
    const result = yearEnd.applyRenumbering(payload);
    assert.ok(result.inventorySessionId);
    assert.deepStrictEqual(shares.listShares().map((share) => share.shareNumber), ['101', '103']);

    const snapshot = inventory.getSession(result.inventorySessionId);
    assert.strictEqual(snapshot.inventoryReason, 'Ετήσια απογραφή Διαχείρισης');
    assert.strictEqual(snapshot.status, 'Ολοκληρωμένη');
    assert.strictEqual(snapshot.periodStart, '2026-01-01');
    assert.strictEqual(snapshot.periodEnd, '2026-12-31');
    assert.strictEqual(snapshot.items.length, 3);
    assert.strictEqual(snapshot.items.find((item) => item.shareNumber === '10').accountingBalance, 12);
    assert.strictEqual(snapshot.items.find((item) => item.shareNumber === '10').finalCount, 12);
    assert.strictEqual(snapshot.items.find((item) => item.shareNumber === '10').settlementReference, '');
    assert.strictEqual(snapshot.items.find((item) => item.shareNumber === '20').settlementReference, 'Αρχείο');
    administration.restoreShare(inactiveShare.id, '2026-12-31');
    assert.strictEqual(
      inventory.getSession(result.inventorySessionId).items.find((item) => item.shareNumber === '20').settlementReference,
      ''
    );
    administration.archiveShare({
      shareId: inactiveShare.id,
      actionDate: '2026-12-31',
      reason: 'Οριστική αρχειοθέτηση'
    });
    assert.strictEqual(
      inventory.getSession(result.inventorySessionId).items.find((item) => item.shareNumber === '20').settlementReference,
      'Αρχείο'
    );
    assert.throws(() => yearEnd.applyRenumbering({
      fiscalYear: 2026,
      items: [{ shareId: data.shares[0].id, newShareNumber: '102' }]
    }), /έχει ήδη πραγματοποιηθεί|ενεργές μερίδες/);

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

    transactions.saveAddy({
      documentDate: '2028-01-15',
      transactionUnit: 'ΜΟΝΑΔΑ',
      items: [{
        shareNumber: '101', nominalNumber: 'N-10', description: 'ΥΛΙΚΟ 10',
        quantity: 5, transactionType: 'Χρέωση', measurementUnit: 'Τεμάχια', materialType: 'Υλικό'
      }]
    });
    const datedAnnual = inventory.createSession({
      inventoryDate: '2028-12-31',
      periodStart: '2027-07-01',
      periodEnd: '2027-12-31',
      inventoryReason: 'Ετήσια απογραφή Διαχείρισης',
      committeePresidentRank: 'Τχης',
      committeePresidentName: 'Πρόεδρος'
    });
    const datedSession = inventory.getSession(datedAnnual.id);
    const datedItem = datedSession.items.find((item) => item.shareNumber === '101');
    assert.strictEqual(datedSession.inventoryDate, '2027-12-31');
    assert.strictEqual(datedSession.periodStart, '2027-07-01');
    assert.strictEqual(datedSession.periodEnd, '2027-12-31');
    assert.strictEqual(datedSession.committeePresidentName, 'Πρόεδρος');
    assert.strictEqual(datedItem.accountingBalance, 12);
    assert.strictEqual(datedItem.finalCount, 12);
    assert.strictEqual(datedItem.difference, 0);
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
