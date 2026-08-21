'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { initializeDatabase } = require('../src/db/database');
const { createTransactionsRepository } = require('../src/db/transactionsRepository');
const { createTransactionsService } = require('../src/services/transactionsService');
const { validateAddy } = require('../src/transactions/addyValidation');

function commercePayload(overrides = {}) {
  return {
    documentDate: '2026-08-15',
    transactionUnit: 'ΕΜΠΟΡΙΟ',
    justificationReference: '',
    notes: 'Δοκιμή τιμολογίου',
    invoiceNumber: '  INV-42  ',
    invoiceDate: '2026-08-14',
    commerceCompanyId: '1',
    items: [{
      shareNumber: '950',
      nominalNumber: 'COMM-950',
      description: 'Υλικό Εμπορίου',
      materialType: 'Υλικό',
      measurementUnit: 'Τεμάχια',
      quantity: 2,
      unitPrice: 12.5,
      transactionType: 'Χρέωση',
      composition: []
    }],
    ...overrides
  };
}

async function run() {
  const validated = validateAddy(commercePayload());
  assert.equal(validated.invoiceNumber, 'INV-42');
  assert.equal(validated.invoiceDate, '2026-08-14');
  assert.equal(validated.commerceCompanyId, 1);

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-addy-commerce-'));
  try {
    const db = await initializeDatabase(directory);
    const repository = createTransactionsRepository(db);
    const transactions = createTransactionsService(db);

    assert.throws(
      () => transactions.createCommerceCompany({ name: '   ' }),
      (error) => error?.code === 'VALIDATION_ERROR'
    );

    const company = transactions.createCommerceCompany({
      name: '  Δοκιμαστική Α.Ε.  ',
      taxNumber: '  123456789  ',
      address: '  Λ. Δοκιμής 10  '
    });
    assert.deepEqual(company, {
      id: 1,
      name: 'Δοκιμαστική Α.Ε.',
      taxNumber: '123456789',
      address: 'Λ. Δοκιμής 10'
    });
    assert.deepEqual(repository.listCommerceCompanies(), [company]);
    assert.deepEqual(transactions.getAddyReferenceData().commerceCompanies, [company]);

    assert.throws(
      () => transactions.saveAddy(commercePayload({
        invoiceNumber: '',
        commerceCompanyId: company.id
      })),
      (error) => error?.code === 'ADDY_COMMERCE_INVOICE_REQUIRED'
    );

    const saved = transactions.saveAddy(commercePayload({ commerceCompanyId: company.id }));
    assert.ok(saved.documentId > 0);
    assert.equal(saved.document.invoiceNumber, 'INV-42');
    assert.equal(saved.document.invoiceDate, '2026-08-14');
    assert.deepEqual(saved.document.commerceCompany, company);

    const fetched = transactions.getAddyDocument(saved.documentId);
    assert.equal(fetched.invoiceNumber, 'INV-42');
    assert.equal(fetched.invoiceDate, '2026-08-14');
    assert.equal(fetched.commerceCompanyId, company.id);
    assert.deepEqual(fetched.commerceCompany, company);

    const listed = transactions.listAddyDocuments()
      .find((document) => document.id === saved.documentId);
    assert.equal(listed.invoiceNumber, 'INV-42');
    assert.deepEqual(listed.commerceCompany, company);
    assert.equal(listed.canPrint, true);
    console.log('ADDY commerce invoice validation, company catalogue and persistence tests passed.');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
