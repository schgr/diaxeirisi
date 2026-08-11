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
        { departmentManagerId: departments[0].id, quantity: 4, composition: [{
          componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
          measurementUnit: 'Τεμάχια', quantity: 7
        }] },
        { departmentManagerId: departments[1].id, quantity: 2, composition: [{
          componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
          measurementUnit: 'Τεμάχια', quantity: 5
        }] }
      ]
    }] });
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].finalQuantity, 4);
    assert.equal(internal.listDepartmentBalances(departments[1].id)[0].finalQuantity, 2);
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].composition[0].finalQuantity, 7);

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
    assert.throws(() => transactions.saveAddyDepartmentAllocations(creditedAddy.documentId, { entries: [{
      addyItemId: creditedAddy.document.items[0].addyItemId,
      allocations: [
        { departmentManagerId: departments[0].id, quantity: 2, composition: [{
          componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
          measurementUnit: 'Τεμάχια', quantity: 0
        }] },
        { departmentManagerId: departments[1].id, quantity: 1, composition: [{
          componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
          measurementUnit: 'Τεμάχια', quantity: 6
        }] }
      ]
    }] }), /δεν έχει επαρκή ποσότητα για το υλικό σύνθεσης/u);
    transactions.saveAddyDepartmentAllocations(creditedAddy.documentId, { entries: [{
      addyItemId: creditedAddy.document.items[0].addyItemId,
      allocations: [{ departmentManagerId: departments[0].id, quantity: 3, composition: [{
        componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
        measurementUnit: 'Τεμάχια', quantity: 6
      }] }]
    }] });
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].finalQuantity, 1);
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].composition[0].finalQuantity, 1);
    assert.equal(shares.listShares()[0].chargedQuantity, 3);

    const chargedExhp = transactions.saveExhp({
      documentDate: '2026-08-08', serviceUnit: 'Μονάδα Δοκιμής',
      issueReason: 'Διάφορες Χρεώσεις', approvalReference: '', supports: [], items: [{
        shareNumber: '500', nominalNumber: 'TEST-500', description: 'Σύνθετο υλικό',
        materialType: 'Υλικό', measurementUnit: 'Τεμάχια', quantity: 2,
        transactionType: 'Χρέωση'
      }]
    });
    assert.ok(chargedExhp.document.items[0].exhpItemId);
    transactions.saveExhpDepartmentAllocations(chargedExhp.documentId, { entries: [{
      exhpItemId: chargedExhp.document.items[0].exhpItemId,
      allocations: [
        { departmentManagerId: departments[0].id, quantity: 1, composition: [{
          componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
          measurementUnit: 'Τεμάχια', quantity: 3
        }] },
        { departmentManagerId: departments[1].id, quantity: 1, composition: [{
          componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
          measurementUnit: 'Τεμάχια', quantity: 1
        }] }
      ]
    }] });
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].finalQuantity, 2);
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].composition[0].finalQuantity, 4);

    const partialAddy = transactions.saveAddy({
      documentDate: '2026-08-08', transactionUnit: 'Εμπόριο', notes: '', items: [{
        shareNumber: '500', nominalNumber: 'TEST-500', description: 'Σύνθετο υλικό',
        materialType: 'Υλικό', measurementUnit: 'Τεμάχια', quantity: 4,
        unitPrice: 1, transactionType: 'Χρέωση', composition: []
      }]
    });
    transactions.saveAddyDepartmentAllocations(partialAddy.documentId, { entries: [{
      addyItemId: partialAddy.document.items[0].addyItemId,
      allocations: [{ departmentManagerId: departments[0].id, quantity: 2, composition: [{
        componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
        measurementUnit: 'Τεμάχια', quantity: 4
      }] }]
    }] });
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].finalQuantity, 4);

    const partialExhp = transactions.saveExhp({
      documentDate: '2026-08-08', serviceUnit: 'Μονάδα Δοκιμής',
      issueReason: 'Διάφορες Χρεώσεις', approvalReference: '', supports: [], items: [{
        shareNumber: '500', nominalNumber: 'TEST-500', description: 'Σύνθετο υλικό',
        materialType: 'Υλικό', measurementUnit: 'Τεμάχια', quantity: 2,
        transactionType: 'Χρέωση'
      }]
    });
    transactions.saveExhpDepartmentAllocations(partialExhp.documentId, { entries: [{
      exhpItemId: partialExhp.document.items[0].exhpItemId,
      allocations: [{ departmentManagerId: departments[1].id, quantity: 1, composition: [{
        componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
        measurementUnit: 'Τεμάχια', quantity: 2
      }] }]
    }] });
    assert.equal(internal.listDepartmentBalances(departments[1].id)[0].finalQuantity, 4);

    const partialCredit = transactions.saveAddy({
      documentDate: '2026-08-08', transactionUnit: 'Εμπόριο', notes: '', items: [{
        shareNumber: '500', nominalNumber: 'TEST-500', description: 'Σύνθετο υλικό',
        materialType: 'Υλικό', measurementUnit: 'Τεμάχια', quantity: 2,
        unitPrice: 1, transactionType: 'Πίστωση', composition: []
      }]
    });
    transactions.saveAddyDepartmentAllocations(partialCredit.documentId, { entries: [{
      addyItemId: partialCredit.document.items[0].addyItemId,
      allocations: [{ departmentManagerId: departments[0].id, quantity: 1, composition: [{
        componentNominalNumber: 'COMP-1', componentDescription: 'Συστατικό',
        measurementUnit: 'Τεμάχια', quantity: 2
      }] }]
    }] });
    assert.equal(internal.listDepartmentBalances(departments[0].id)[0].finalQuantity, 3);

    const compositionBeforeMerge = internal
      .listDepartmentBalances(departments[0].id)[0].composition[0].finalQuantity;
    shares.addShare({
      shareNumber: '501', nominalNumber: 'COMP-1', description: 'Ξ£Ο…ΟƒΟ„Ξ±Ο„ΞΉΞΊΟ',
      materialType: 'Ξ¥Ξ»ΞΉΞΊΟ', measurementUnit: 'Ξ¤ΞµΞΌΞ¬Ο‡ΞΉΞ±', projectedQuantity: 0,
      accountingBalance: 20, chargedQuantity: 0
    });
    const componentShare = shares.listShares().find((item) => item.shareNumber === '501');
    internal.saveMovement({
      documentDate: '2026-08-09', departmentManagerId: departments[0].id,
      shareId: componentShare.id,
      movementType: '\u03A7\u03BF\u03C1\u03AE\u03B3\u03B7\u03C3\u03B7', quantity: 10,
      notes: '', composition: []
    });
    const mergedBalances = internal.listDepartmentBalances(departments[0].id);
    const parentBalance = mergedBalances.find((item) => item.shareNumber === '500');
    const componentBalance = mergedBalances.find((item) => item.shareNumber === '501');
    assert.equal(parentBalance.composition.length, 0);
    assert.equal(componentBalance.finalQuantity, 10 + compositionBeforeMerge);
    assert.equal(componentBalance.issuedQuantity, 10 + compositionBeforeMerge + 8);
    assert.equal(componentBalance.returnedQuantity, 8);
    internal.saveMovement({
      documentDate: '2026-08-10', departmentManagerId: departments[0].id,
      shareId: share.id,
      movementType: '\u03A7\u03BF\u03C1\u03AE\u03B3\u03B7\u03C3\u03B7', quantity: 0,
      notes: '', composition: [{ quantity: 2 }]
    });
    assert.equal(
      internal.listDepartmentBalances(departments[0].id)
        .find((item) => item.shareNumber === '501').finalQuantity,
      componentBalance.finalQuantity + 2
    );
    internal.saveMovement({
      documentDate: '2026-08-10', departmentManagerId: departments[0].id,
      shareId: share.id,
      movementType: '\u0395\u03C0\u03B9\u03C3\u03C4\u03C1\u03BF\u03C6\u03AE', quantity: 0,
      notes: '', composition: [{ quantity: 1 }]
    });
    assert.equal(
      internal.listDepartmentBalances(departments[0].id)
        .find((item) => item.shareNumber === '501').finalQuantity,
      componentBalance.finalQuantity + 1
    );
    assert.throws(() => internal.saveMovement({
      documentDate: '2026-08-10', departmentManagerId: departments[0].id,
      shareId: share.id,
      movementType: '\u03A7\u03BF\u03C1\u03AE\u03B3\u03B7\u03C3\u03B7', quantity: 0,
      notes: '', composition: [{ quantity: 0 }]
    }), /τουλάχιστον ένα υλικό της σύνθεσης/u);
    assert.throws(() => internal.saveMovement({
      documentDate: '2026-08-10', departmentManagerId: departments[0].id,
      shareId: componentShare.id,
      movementType: '\u03A7\u03BF\u03C1\u03AE\u03B3\u03B7\u03C3\u03B7', quantity: 0,
      notes: '', composition: []
    }), /μόνο για κίνηση υλικών σύνθεσης/u);
    assert.throws(() => internal.saveMovement({
      documentDate: '2026-08-10', departmentManagerId: departments[0].id,
      shareId: share.id,
      movementType: '\u0395\u03C0\u03B9\u03C3\u03C4\u03C1\u03BF\u03C6\u03AE', quantity: 1,
      notes: '', composition: [{ quantity: componentBalance.finalQuantity + 2 }]
    }), /δεν έχει επαρκή ποσότητα για το υλικό σύνθεσης/u);
    console.log('ADDY department allocation and composition tests passed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
