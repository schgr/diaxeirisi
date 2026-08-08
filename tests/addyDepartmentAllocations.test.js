'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeDatabase } = require('../src/db/database');
const { createInternalService } = require('../src/services/internalService');
const { createSettingsService } = require('../src/services/settingsService');
const { createSharesService } = require('../src/services/sharesService');
const { createTransactionsService } = require('../src/services/transactionsService');

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-addy-departments-'));
  try {
    const db = await initializeDatabase(directory);
    const settings = createSettingsService(db);
    settings.addDepartmentManager({ departmentName: 'Τμήμα Α', departmentHead: 'Διαχειριστής Α' });
    settings.addDepartmentManager({ departmentName: 'Τμήμα Β', departmentHead: 'Διαχειριστής Β' });
    const shares = createSharesService(db);
    shares.addShare({
      shareNumber: '500', nominalNumber: 'TEST-500', description: 'Σύνθετο υλικό',
      materialType: 'Υλικό', measurementUnit: 'Τεμάχια', projectedQuantity: 0,
      accountingBalance: 0, chargedQuantity: 0
    });
    const share = shares.listShares()[0];
    shares.updateShareDetails(share.id, { requiresComposition: true });
    shares.saveComposition(share.id, [{
      componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
      measurementUnit: 'Τεμάχια', projectedQuantity: 2, notIssuedQuantity: 0
    }]);

    const internal = createInternalService(db);
    const departments = internal.getReferenceData().departmentManagers;
    const transactions = createTransactionsService(db, settings);
    const chargedAddy = transactions.saveAddy({
      documentDate: '2026-08-08', transactionUnit: 'Εμπόριο', notes: '', items: [{
        shareNumber: '500', nominalNumber: 'TEST-500', description: 'Σύνθετο υλικό',
        materialType: 'Υλικό', measurementUnit: 'Τεμάχια', quantity: 6,
        unitPrice: 1, transactionType: 'Χρέωση', composition: []
      }]
    });
    assert.equal(internal.listDepartmentBalances(departments[0].id).length, 0);
    transactions.saveAddyDepartmentAllocations(chargedAddy.documentId, { entries: [{
      addyItemId: chargedAddy.document.items[0].addyItemId,
      allocations: [
        { departmentManagerId: departments[0].id, quantity: 4 },
        { departmentManagerId: departments[1].id, quantity: 2 }
      ]
    }] });
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].finalQuantity, 4);
    assert.equal(internal.listDepartmentBalances(departments[1].id)[0].finalQuantity, 2);
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].composition[0].finalQuantity, 8);

    const creditedAddy = transactions.saveAddy({
      documentDate: '2026-08-08', transactionUnit: 'Εμπόριο', notes: '', items: [{
        shareNumber: '500', nominalNumber: 'TEST-500', description: 'Σύνθετο υλικό',
        materialType: 'Υλικό', measurementUnit: 'Τεμάχια', quantity: 3,
        unitPrice: 1, transactionType: 'Πίστωση',
        composition: [{
          componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
          measurementUnit: 'Τεμάχια', projectedQuantity: 6, notIssuedQuantity: 0
        }]
      }]
    });
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].finalQuantity, 4);
    transactions.saveAddyDepartmentAllocations(creditedAddy.documentId, { entries: [{
      addyItemId: creditedAddy.document.items[0].addyItemId,
      allocations: [{ departmentManagerId: departments[0].id, quantity: 3 }]
    }] });
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].finalQuantity, 1);
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].composition[0].finalQuantity, 2);
    assert.equal(shares.listShares()[0].chargedQuantity, 3);
    console.log('ADDY department allocation and composition tests passed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
