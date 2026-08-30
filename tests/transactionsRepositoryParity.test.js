'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeDatabase } = require('../src/db/database');
const { createTransactionsRepository } = require('../src/db/transactionsRepository');

const expectedOperations = [
  'listShares', 'getFiscalYearArchive', 'isFiscalYearClosed', 'findShareByNumber',
  'listCompositionItems', 'listInternalCompositionMovements', 'listDepartmentManagers',
  'getDepartmentShareBalance', 'deleteInternalMovementsByReference', 'getNextInternalSerial', 'createInternalDocument',
  'createInternalItem', 'adjustChargedQuantity', 'listCompositionChangeSheetEntries',
  'getNextShareNumber', 'getServiceName', 'listMeasurementUnits', 'listTransactionUnits',
  'listCommerceCompanies', 'createCommerceCompany', 'updateCommerceCompany',
  'deleteCommerceCompany', 'listMaterialCategories', 'createShare', 'replaceCompositionItems',
  'createTransferredShare', 'moveCurrentShareState', 'keepTransferredShareActive',
  'adjustAccountingBalance', 'getNextExhpRegistryNumber', 'createExhpDocument',
  'createExhpItem', 'listExhpDocuments', 'listExhpSupportTemplates',
  'createExhpDocumentSupports', 'listExhpDocumentSupports', 'listExhpOfficialSupportDocuments',
  'updateExhpDocumentSupport', 'updateExhpOtherSupportDocument', 'updateExhpIndexFields',
  'updateAddyIndexFields', 'saveExhpDocumentSupportForm', 'refreshExhpSupportStatus',
  'getExhpDocument', 'getShareById', 'countShareTransactionsExcluding', 'findSubsequentShareTransaction', 'deleteExhpDocument',
  'deleteShareTransactions', 'rollbackTransferredShare', 'updateExhpMetadata',
  'updateExhpItemQuantity', 'listExhpDocumentItems', 'listExhpMaterialAttachments',
  'listExhpIndexRows', 'listExhpFinancialYearMovementRows', 'ensureTransactionUnit',
  'createAddyDocument', 'createAddyItem', 'createShareTransaction',
  'getShareTransactionSerialForYear', 'findAddyShareTransaction', 'findExhpShareTransaction',
  'createShareAssignment', 'listExternalTransactionIndexRows',
  'listAddyFinancialYearMovementRows', 'listAddyDocuments', 'getAddyDocument',
  'listAddyDocumentItems', 'updateAddyDocumentNotes', 'updateAddyDocumentIdAndDate',
  'updateAddyItemQuantity', 'deleteAddyItem', 'deleteAddyDocument', 'transaction'
];

async function run() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-transactions-repository-'));
  try {
    const db = await initializeDatabase(directory);
    const repository = createTransactionsRepository(db);
    assert.deepEqual(Object.keys(repository), expectedOperations);

    assert.throws(() => repository.transaction(() => {
      repository.createCommerceCompany({ name: 'rolled back' });
      throw new Error('characterization rollback');
    }), /characterization rollback/);
    assert.deepEqual(repository.listCommerceCompanies(), []);

    repository.transaction(() => {
      repository.createCommerceCompany({ name: 'outer transaction' });
      assert.throws(() => repository.transaction(() => {
        repository.createCommerceCompany({ name: 'nested transaction' });
        throw new Error('characterization nested rollback');
      }), /characterization nested rollback/);
    });
    assert.deepEqual(repository.listCommerceCompanies().map(({ name }) => name), ['outer transaction']);

    const share = repository.createShare({
      shareNumber: 'ΔΟΚ-1',
      nominalNumber: 'TEST-001',
      description: 'Δοκιμαστική μερίδα',
      materialType: 'Υλικό',
      measurementUnit: 'Τεμάχια',
      accountingBalance: 0,
      chargedQuantity: 0
    });
    const sourceTransactionId = repository.createShareTransaction({
      shareId: share.id,
      transactionDate: '2026-08-01',
      transactionUnit: 'Δοκιμή',
      transactionType: 'Χρέωση',
      documentReference: 'ΑΔΔΥ 1',
      quantity: 1,
      notes: ''
    });
    assert.equal(repository.findSubsequentShareTransaction([sourceTransactionId]), null);
    const laterTransactionId = repository.createShareTransaction({
      shareId: share.id,
      transactionDate: '2026-08-02',
      transactionUnit: 'Δοκιμή',
      transactionType: 'Πίστωση',
      documentReference: 'ΕΧΠ 1/2026',
      quantity: 1,
      notes: ''
    });
    assert.equal(
      Number(repository.findSubsequentShareTransaction([sourceTransactionId]).later_transaction_id),
      Number(laterTransactionId)
    );
    assert.equal(repository.findSubsequentShareTransaction([laterTransactionId]), null);
    console.log('transactionsRepository parity and rollback characterization passed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
