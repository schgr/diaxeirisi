const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { initializeDatabase } = require('../src/db/database');
const { createSettingsService } = require('../src/services/settingsService');
const { createSharesService } = require('../src/services/sharesService');
const { createTransactionsService } = require('../src/services/transactionsService');
const { createInternalService } = require('../src/services/internalService');
const { createInventoryService } = require('../src/services/inventoryService');
const { createMovementDifferencesService } = require('../src/services/movementDifferencesService');
const { createAdministrationService } = require('../src/services/administrationService');
const { createAnnualAccountsService } = require('../src/services/annualAccountsService');
const { createInitialInventoryService } = require('../src/services/initialInventoryService');
const ExcelJS = require('exceljs');
const { validateExhp } = require('../src/transactions/exhpValidation');
const { calculateShareBalance } = require('../src/core/shareBalance');

async function run() {
  const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'dchsi-ledger-'));

  try {
    const { formatOfficerName, formatOfficerRank } = await import('../src/ui/officerSignature.js');
    const {
      renderChargeCreditOrdersIndex,
      renderExternalTransactionsIndex,
      renderMaterialRegistryPages
    } = await import('../src/ui/pages/printsPage.js');
    const { renderShareBackTemplate, renderSharePrintDocument } = await import('../src/ui/pages/sharesPage.js');
    const { renderProtocolDocument } = await import('../src/ui/pages/movementDifferencesPage.js');
    const { renderOfficialHandoverProtocol } = await import('../src/ui/handoverProtocol.js');
    assert.strictEqual(formatOfficerName('δΕΛΗΣ γΕΩΡΓΙΟΣ'), 'Δελης Γεωργιος');
    assert.strictEqual(formatOfficerRank('ΣΧΗΣ (ΠΒ)'), 'Σχης (ΠΒ)');

    const printSettings = { serviceInfo: { serviceName: '108 Α/Κ ΠΒ' } };
    const externalIndexHtml = renderExternalTransactionsIndex(
      printSettings,
      Array.from({ length: 23 }, (_unused, index) => ({
        id: index + 1,
        serial: index + 1,
        date: '2026-06-13',
        unit: 'ΜΟΝΑΔΑ',
        documentType: index === 0 ? 'Χ' : 'Π',
        nominalNumber: '1005007265655',
        documentReference: index === 0
          ? 'ΔΙΚ-42/06-06-2026'
          : `Π-${index + 1} / 13/06/2026`,
        movementDate: '2026-06-13',
        returnDate: '',
        indexField7: index === 0 ? 'ΕΙΔΙΚΟ ΠΕΔΙΟ 7' : '',
        indexField8: index === 0 ? 'ΕΙΔΙΚΟ ΠΕΔΙΟ 8' : '',
        indexField9: index === 0 ? 'ΕΙΔΙΚΟ ΠΕΔΙΟ 9' : '',
        notes: 'ΠΑΡΑΤΗΡΗΣΗ'
      }))
    );
    assert.strictEqual((externalIndexHtml.match(/<article class="official-index-page/g) || []).length, 2);
    assert.match(externalIndexHtml, /te34-254-page-227\.png/);
    assert.match(externalIndexHtml, /ΕΙΔΙΚΟ ΠΕΔΙΟ 7/);
    assert.match(externalIndexHtml, /ΕΙΔΙΚΟ ΠΕΔΙΟ 8/);
    assert.match(externalIndexHtml, /ΕΙΔΙΚΟ ΠΕΔΙΟ 9/);
    assert.match(externalIndexHtml, /official-index-cell official-index-left-cell/);
    const emptyExternalFieldsHtml = renderExternalTransactionsIndex(printSettings, [{
      serial: 1,
      date: '2026-06-13',
      unit: 'ΜΟΝΑΔΑ',
      documentType: 'Χ',
      nominalNumber: '1005007265655',
      documentReference: 'ΔΙΚ-42/06-06-2026',
      movementDate: '2026-06-13',
      returnDate: '2026-06-14',
      indexField7: '',
      indexField8: '',
      indexField9: '',
      notes: ''
    }]);
    assert.doesNotMatch(emptyExternalFieldsHtml, /ΔΙΚ-42/);
    assert.doesNotMatch(emptyExternalFieldsHtml, /06\/06\/2026/);
    assert.doesNotMatch(emptyExternalFieldsHtml, /14\/06\/2026/);

    const ordersIndexHtml = renderChargeCreditOrdersIndex(
      printSettings,
      Array.from({ length: 28 }, (_unused, index) => ({
        id: index + 1,
        fiscalYear: 2026,
        serial: index + 1,
        date: '2026-06-13',
        reason: 'Χρέωση υλικού',
        indexField6: `ΕΓΚΡΙΣΗ ${index + 1}/2026`,
        indexField7: 'ΠΑΡΑΤΗΡΗΣΗ ΕΧΠ'
      }))
    );
    assert.strictEqual((ordersIndexHtml.match(/<article class="official-index-page/g) || []).length, 2);
    assert.match(ordersIndexHtml, /te34-254-page-228\.png/);
    assert.match(ordersIndexHtml, /ΕΓΚΡΙΣΗ 1\/2026/);
    assert.match(ordersIndexHtml, /ΠΑΡΑΤΗΡΗΣΗ ΕΧΠ/);

    const sharePrintHtml = renderSharePrintDocument({
      share: {
        nominalNumber: 'TEST-001',
        shareNumber: '1',
        description: 'Δοκιμαστικό υλικό',
        materialCode: '',
        measurementUnit: 'Τεμάχια',
        unitPrice: 1
      },
      openingTransfer: { balance: 4, inventoryDate: '2025-12-31' },
      transactions: [{
        serialNumber: 1,
        date: '2026-06-13',
        transactionUnit: 'ΜΟΝΑΔΑ',
        registryNumber: 'Χ-1',
        imports: 1,
        exports: 0,
        balance: 1
      }]
    }, {
      exactCopy: 'Ακριβές Αντίγραφο',
      issuerName: 'ΔΟΚΙΜΑΣΤΙΚΟΣ ΔΙΑΧΕΙΡΙΣΤΗΣ',
      issuerRank: 'ΛΓΟΣ'
    });
    assert.match(sharePrintHtml, /share-card-expanded-23-24\.png/);
    assert.doesNotMatch(sharePrintHtml, /official-share-column-adjustment/);
    assert.match(sharePrintHtml, /ΑΠΟ ΜΕΤΑΦΟΡΑ - ΑΠΟΓΡΑΦΗ 31-12-2025/);
    assert.doesNotMatch(sharePrintHtml, /ΥΠΟΛΟΙΠΟ/);
    assert.match(sharePrintHtml, /left:68\.1%;top:64\.45%;width:11\.6%;height:1\.75%;">4<\/div>/);
    assert.match(sharePrintHtml, /left:4%;top:30\.6%;width:28\.4%;/);
    assert.match(sharePrintHtml, /left:9\.5%;top:66\.15%;width:8\.1%;/);
    assert.match(sharePrintHtml, /left:17\.8%;top:66\.15%;width:12\.9%;/);
    assert.match(sharePrintHtml, /share-exact-copy-overlay/);
    assert.match(sharePrintHtml, /left:4\.1%;top:21\.8%;width:28\.2%;height:1\.5%/);
    assert.match(sharePrintHtml, /left:4\.1%;top:23\.3%;width:28\.2%;height:1\.5%/);

    const selectedYearOpeningHtml = renderSharePrintDocument({
      share: {
        nominalNumber: 'TEST-OPENING',
        shareNumber: '3',
        description: 'Υλικό χωρίς ημερομηνία αρχικής απογραφής',
        materialCode: '',
        measurementUnit: 'Τεμάχια',
        unitPrice: 1
      },
      openingTransfer: { balance: 7, inventoryDate: '' },
      transactions: []
    }, { fiscalYear: 2026 });
    assert.match(selectedYearOpeningHtml, /ΑΠΟ ΜΕΤΑΦΟΡΑ - ΑΠΟΓΡΑΦΗ 31-12-2025/);

    const overflowingShareHtml = renderSharePrintDocument({
      share: {
        nominalNumber: 'TEST-002',
        shareNumber: '2',
        description: 'Μερίδα με πολλές κινήσεις',
        materialCode: '',
        measurementUnit: 'Τεμάχια',
        unitPrice: 1
      },
      openingTransfer: { balance: 20, inventoryDate: '2025-12-31' },
      transactions: Array.from({ length: 13 }, (_unused, index) => ({
        serialNumber: index + 1,
        date: '2026-06-13',
        transactionUnit: 'ΜΟΝΑΔΑ',
        registryNumber: `Χ-${index + 1}`,
        imports: 0,
        exports: 1,
        balance: 19 - index
      }))
    });
    assert.strictEqual((overflowingShareHtml.match(/class="official-share-page/g) || []).length, 2);
    assert.match(overflowingShareHtml, /official-share-back-page/);
    assert.match(overflowingShareHtml, /ΓΙΑ ΜΕΤΑΦΟΡΑ/);
    assert.match(overflowingShareHtml, /ΑΠΟ ΜΕΤΑΦΟΡΑ/);
assert.match(overflowingShareHtml, />8<\/td>\s*<td><\/td>/u);
    assert.doesNotMatch(overflowingShareHtml, /Πίσω πλευρά|ΣΥΔΑ/);
    const blankShareBackHtml = renderShareBackTemplate();
    assert.strictEqual((blankShareBackHtml.match(/official-share-back-page/g) || []).length, 1);
    assert.doesNotMatch(blankShareBackHtml, /Πίσω πλευρά|ΣΥΔΑ/);
    assert.doesNotMatch(blankShareBackHtml, /<td>0<\/td>/);

    const k2310Html = (await import('../src/ui/pages/chargesPage.js')).renderK2310Pages(
      '108 Α/Κ ΜΜΠ/ΔΥ',
      { departmentName: '1ος ΛΟΧΟΣ' },
      Array.from({ length: 18 }, (_unused, index) => ({
        shareNumber: String(index + 1),
        nominalNumber: `TEST-${index + 1}`,
        description: `Υλικό ${index + 1}`,
        measurementUnit: 'Τεμ.',
        projectedQuantity: 1,
        issuedQuantity: 1,
        returnedQuantity: 0,
        finalQuantity: 1,
        composition: index === 0 ? [{
          componentNominalNumber: 'COMP-1',
          componentDescription: 'Εξάρτημα',
          measurementUnit: 'Τεμ.',
          issuedQuantity: 1,
          returnedQuantity: 0,
          finalQuantity: 1
        }] : []
      }))
    );
    assert.strictEqual((k2310Html.match(/class="index-page print-document-area k2310-page"/g) || []).length, 2);
    assert.match(k2310Html, /k2310-composition-row/);
    assert.doesNotMatch(k2310Html, /<td>1<\/td><\/tr>\s*<\/tbody>/);

    const movementProtocolHtml = renderProtocolDocument({
      registryNumber: 1,
      fiscalYear: 2026,
      protocolDate: '2026-06-13',
      movementDirection: 'Αποστολή',
      serviceName: '108 Α/Κ ΜΜΠ/ΔΥ',
      counterpartyUnit: '104 Α/Κ ΠΜΠ/ΔΥ',
      addyDocumentId: 5,
      nominalNumber: '1005007265655',
      description: 'Αυτόματο πιστόλι 0.45',
      measurementUnit: 'Τεμάχια',
      documentQuantity: 4,
      actualQuantity: 3,
      differenceType: 'Έλλειμμα',
      differenceQuantity: 1,
      notes: 'Δοκιμή'
    });
    assert.strictEqual((movementProtocolHtml.match(/official-movement-protocol-page/g) || []).length, 2);
    assert.match(movementProtocolHtml, /-214-/);
    assert.match(movementProtocolHtml, /-215-/);
    assert.match(movementProtocolHtml, /Κ 2303\/ΔΥΠ/);
    assert.match(movementProtocolHtml, /ΓΝΩΜΑΤΕΥΣΗ ΠΑΡΑΛΗΠΤΗ/);

    const handoverProtocolHtml = renderOfficialHandoverProtocol(
      {
        serviceInfo: { serviceName: '108 Α/Κ ΜΜΠ/ΔΥ', serviceLocation: 'Αθήνα' },
        financialOfficers: {
          commander: 'Σχης Διοικητής',
          ped: 'Τχης ΠΕΔ',
          manager: 'Λγός Ρυθμίσεων'
        }
      },
      {
        startDate: '2026-06-15',
        orderReference: 'Φ.000/15/1234/Σ.567',
        outgoingOfficer: 'Λγός Παραδίδων',
        incomingOfficer: 'Λγός Παραλαμβάνων',
        pendingDocuments: '',
        protocolData: {
          place: 'Αθήνα',
          shareRangeFrom: '1',
          shareRangeTo: '250',
          samplePercentageWords: 'είκοσι τοις εκατό',
          samplePercentageNumber: '20%',
          separateStorage: 'yes',
          assistants: [{ rank: 'Υπλγός', name: 'Βοηθός', categories: 'Υλικό' }]
        }
      }
    );
    assert.strictEqual((handoverProtocolHtml.match(/official-handover-page print-document-area/g) || []).length, 3);
    assert.match(handoverProtocolHtml, /ΕΦΕΔ 500/);
    assert.match(handoverProtocolHtml, /official-box checked/);
    assert.match(handoverProtocolHtml, /Αθήνα/);
    assert.match(handoverProtocolHtml, /Λγός Ρυθμίσεων/);
    assert.match(handoverProtocolHtml, />1<\/span> έως/);
    assert.match(handoverProtocolHtml, />250<\/span>/);
    assert.match(handoverProtocolHtml, /είκοσι τοις εκατό/);
    assert.match(handoverProtocolHtml, /20%/);

    const registryHtml = renderMaterialRegistryPages(
      Array.from({ length: 100 }, (_unused, index) => ({
        shareNumber: String(index + 1),
        nominalNumber: String(1005000000000 + index),
        description: `Υλικό ${index + 1}`
      })),
      printSettings,
      { displayCount: 100 }
    );
    assert.strictEqual((registryHtml.match(/material-registry-page/g) || []).length, 5);
    assert.match(registryHtml, /Σελίδα 5 από 5/);
    assert.match(registryHtml, /Το Παρόν αφού σελιδομετρήθηκε βρέθηκε να έχει 5 σελίδες/);

    const singleRegistryPageHtml = renderMaterialRegistryPages(
      [],
      printSettings,
      { displayCount: 28 }
    );
    assert.strictEqual((singleRegistryPageHtml.match(/material-registry-page/g) || []).length, 2);
    assert.match(singleRegistryPageHtml, /<td>28<\/td>/);
    assert.doesNotMatch(singleRegistryPageHtml, /<td>29<\/td>/);

    const surplusBalance = calculateShareBalance(3, 2);
    assert.strictEqual(surplusBalance.differenceQuantity, -1);
    assert.strictEqual(surplusBalance.status, 'Έλλειμμα');
    const deficitBalance = calculateShareBalance(1, 2);
    assert.strictEqual(deficitBalance.differenceQuantity, 1);
    assert.strictEqual(deficitBalance.status, 'Πλεόνασμα');

    const db = await initializeDatabase(testDirectory);
    const settings = createSettingsService(db);
    const shares = createSharesService(db);
    const transactions = createTransactionsService(db, settings);
    const internal = createInternalService(db);
    const inventory = createInventoryService(db);
    const movementDifferences = createMovementDifferencesService(db);
    const administration = createAdministrationService(db);
    const annualAccounts = createAnnualAccountsService(db);
    const initialInventory = createInitialInventoryService(db);

    const inventoryFile = path.join(testDirectory, 'initial-inventory.xlsx');
    await initialInventory.writeTemplate(inventoryFile);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(inventoryFile);
    workbook.worksheets[0].getRow(2).values = [
      1,
      '99',
      'INITIAL-099',
      'Υλικό αρχικής απογραφής',
      'Τεμάχια',
      10,
      'MAIN-001',
      'Αναλώσιμα'
    ];
    await workbook.xlsx.writeFile(inventoryFile);
    const importResult = await initialInventory.importWorkbook(inventoryFile, '2025-12-31');
    assert.strictEqual(importResult.importedRows, 1);
    const importedShare = shares.listShares().find((item) => item.shareNumber === '99');
    assert.strictEqual(importedShare.nominalNumber, 'INITIAL-099');
    assert.strictEqual(importedShare.mainMaterialNumber, 'MAIN-001');
    assert.strictEqual(importedShare.measurementUnit, 'Τεμάχια');
    assert.strictEqual(importedShare.accountingBalance, 10);
    const importedCard = shares.getShareCard(importedShare.id, 2025);
    assert.strictEqual(importedCard.transactions.length, 0);
    assert.strictEqual(importedCard.share.accountingBalance, 10);

    await settings.saveServiceInfo({
      serviceName: 'ΔΟΚΙΜΑΣΤΙΚΗ ΜΟΝΑΔΑ',
      serviceLocation: '',
      managementType: 'Γενική Διαχείριση Υλικού'
    });
    assert.strictEqual(settings.getSettings().serviceInfo.managementType, 'Γενική Διαχείριση Υλικού');
    await settings.saveFinancialOfficers({
      commander: 'Σχης Διοικητής Δοκιμής',
      ped: 'Τχης ΠΕΔ Δοκιμής',
      manager: 'Λγός (ΦΠΒ) Διαχειριστής Δοκιμής'
    });
    const differenceReason = settings.getSettings().exhpIssueReasons
      .find((item) => item.name === 'Τακτοποίηση Διαφορών.');
    await settings.updateExhpIssueReasonTexts(differenceReason.id, {
      recommendationText: 'Εισήγηση δοκιμής',
      firstOpinionText: 'Πρώτη γνωμάτευση δοκιμής',
      secondOpinionText: 'Δεύτερη γνωμάτευση δοκιμής'
    });
    await settings.addDepartmentManager({
      departmentName: '1η Μερική Διαχείριση',
      departmentHead: 'Λγός (ΦΠΒ) Δοκιμαστικός Χρήστης'
    });
    const exhpReferenceData = transactions.getAddyReferenceData();
    assert.strictEqual(
      exhpReferenceData.exhpIssueReasons.some(
        (reason) => reason.name === 'Λογιστική Τακτοποίηση Πάσης Φύσεως Άχρηστου Υλικού.'
      ),
      true
    );
    assert.strictEqual(
      exhpReferenceData.exhpSupportTemplates.some(
        (template) =>
          template.documentCode === 'ΔΥΠ/9-10-11-189' &&
          template.issueReason.startsWith('Διαγραφή Ειδών Ιματισμού')
      ),
      true
    );
    assert.strictEqual(
      exhpReferenceData.exhpSupportTemplates.some(
        (template) =>
          template.documentCode === 'ΑΧΡΗΣΤΟ/1-23' &&
          template.issueReason === 'Λογιστική Τακτοποίηση Πάσης Φύσεως Άχρηστου Υλικού.'
      ),
      true
    );

    const addy = transactions.saveAddy({
      documentDate: '2026-06-06',
      transactionUnit: '104 Α/Κ ΠΜΠ/ΓΔΥ',
      justificationReference: '',
      notes: '',
      items: [{
        shareNumber: '1',
        nominalNumber: 'TEST-001',
        description: 'Δοκιμαστικό υλικό',
        quantity: 10,
        unitPrice: 1,
        measurementUnit: 'Τεμάχια',
        transactionType: 'Χρέωση',
        materialType: 'Κύριο Υλικό',
        justificationReference: 'ΔΙΚ-42/06-06-2026'
      }]
    });

    assert.strictEqual(addy.documentId, 1);
    const externalIndexRows = transactions.listExternalTransactionIndexRows(2026);
    assert.strictEqual(externalIndexRows[0].documentReference, 'ΔΙΚ-42/06-06-2026');
    assert.strictEqual(externalIndexRows[0].movementDate, '2026-06-06');
    assert.strictEqual(externalIndexRows[0].returnDate, '');
    transactions.updateAddyIndexFields(externalIndexRows[0].id, {
      field7: 'ΔΙΟΡΘΩΜΕΝΟ 7',
      field8: '07/06/2026',
      field9: '08/06/2026'
    });
    const updatedExternalIndexRow = transactions.listExternalTransactionIndexRows(2026)[0];
    assert.strictEqual(updatedExternalIndexRow.indexField7, 'ΔΙΟΡΘΩΜΕΝΟ 7');
    assert.strictEqual(updatedExternalIndexRow.indexField8, '07/06/2026');
    assert.strictEqual(updatedExternalIndexRow.indexField9, '08/06/2026');
    let share = shares.listShares()[0];
    assert.strictEqual(share.accountingBalance, 10);
    assert.strictEqual(share.chargedQuantity, 0);
    assert.strictEqual(share.availableQuantity, 10);
    shares.updateShareDetails(share.id, {
      requiresComposition: true,
      requiresChangeSheet: true
    });
    shares.saveComposition(share.id, [{
      componentNominalNumber: 'COMP-001',
      componentDescription: 'Εξάρτημα δοκιμής',
      measurementUnit: 'Τεμάχια',
      projectedQuantity: 5,
      notIssuedQuantity: 2,
      notes: ''
    }]);
    shares.saveChangeSheet(share.id, [{
      changeDate: '2026-06-05',
      componentLineNumber: 1,
      movementType: 'ΧΡΕΩΣΗ',
      quantity: 2,
      notes: ''
    }]);
    const exhpReferenceAfterChangeSheet = transactions.getAddyReferenceData();
    const collectionShareAfterChangeSheet = exhpReferenceAfterChangeSheet.shares
      .find((item) => Number(item.id) === Number(share.id));
    assert.strictEqual(collectionShareAfterChangeSheet.composition[0].chargedQuantity, 2);
    const materialCard = shares.getShareCard(share.id, 2026);
    assert.strictEqual(materialCard.transactions[0].transactionUnit, '104 Α/Κ ΠΜΠ/ΓΔΥ');
    assert.strictEqual(materialCard.transactions[0].registryNumber, 'Χ-1');
    assert.strictEqual(materialCard.compositionItems.length, 1);
    assert.strictEqual(materialCard.compositionItems[0].quantityPerMaterial, 5);
    assert.strictEqual(materialCard.compositionItems[0].projectedQuantity, 50);
    assert.strictEqual(materialCard.compositionItems[0].notIssuedQuantity, 2);
    assert.strictEqual(materialCard.changeSheetEntries.length, 2);
    const savedChange = materialCard.changeSheetEntries.find((entry) => !entry.orderReference);
    const addyChange = materialCard.changeSheetEntries.find((entry) => entry.orderReference === 'Χ-1');
    assert.strictEqual(savedChange.componentLineNumber, 1);
    assert.strictEqual(savedChange.movementType, 'ΧΡΕΩΣΗ');
    assert.strictEqual(savedChange.quantity, 2);
    assert.strictEqual(addyChange.componentLineNumber, 1);
    assert.strictEqual(addyChange.movementType, 'ΧΡΕΩΣΗ');

    const consumableDeletionReason = 'Διαγραφή Αναλώσιμου Υλικού Και Ειδών Σταθερών Χορηγήσεων.';
    const referenceData = transactions.getAddyReferenceData();
    assert.strictEqual(
      referenceData.exhpIssueReasons.filter((item) => item.name === consumableDeletionReason).length,
      1
    );
    const consumableDeletionTemplates = referenceData.exhpSupportTemplates
      .filter((item) => item.issueReason === consumableDeletionReason && item.documentCode === 'ΕΦΕΔ 505');
    assert.strictEqual(consumableDeletionTemplates.length, 1);
    assert.strictEqual(consumableDeletionTemplates[0].title, 'Πρωτόκολλο Διαθέσεως Αναλωσίμου Υλικού');
    assert.strictEqual(consumableDeletionTemplates[0].required, true);
    assert.strictEqual(consumableDeletionTemplates[0].printable, true);

    const exhpTemplates = transactions.getAddyReferenceData().exhpSupportTemplates
      .filter((item) => item.issueReason === 'Τακτοποίηση Διαφορών.');
    const exhp = transactions.saveExhp({
      documentDate: '2026-06-06',
      serviceUnit: 'ΔΟΚΙΜΑΣΤΙΚΗ ΜΟΝΑΔΑ',
      issueReason: 'Τακτοποίηση Διαφορών.',
      approvalReference: '1/06-06-2026',
      otherSupportDocument: 'Αρχικό πρόσθετο δικαιολογητικό',
      supports: exhpTemplates.map((template) => ({
        templateId: template.id,
        completed: true,
        documentReference: 'ΑΠΟΓΡΑΦΗ 1/2026',
        formData: { place: 'Αθήνα', documentReference: 'ΑΠΟΓΡΑΦΗ 1/2026' }
      })),
      items: [{
        shareNumber: '1',
        nominalNumber: 'TEST-001',
        description: 'Δοκιμαστικό υλικό',
        measurementUnit: 'Τεμάχια',
        materialType: 'Αναλώσιμα',
        materialCode: '',
        transactionType: 'Πίστωση',
        quantity: 4,
        supportingDocuments: 'Δοκιμή'
      }]
    });
    assert.strictEqual(exhp.document.managementType, 'Γενική Διαχείριση Υλικού');

    assert.strictEqual(exhp.registryNumber, 1);
    const cardAfterExhp = shares.getShareCard(share.id, 2026);
    assert.strictEqual(cardAfterExhp.transactions[1].registryNumber, 'ΕΧΠ-1');
    share = shares.listShares()[0];
    assert.strictEqual(share.accountingBalance, 6);
    assert.strictEqual(share.chargedQuantity, 0);
    assert.strictEqual(share.availableQuantity, 6);
    assert.strictEqual(transactions.listExhpIndexRows(2026).length, 1);
    const exhpIndexRow = transactions.listExhpIndexRows(2026)[0];
    transactions.updateExhpIndexFields(exhpIndexRow.id, {
      field6: 'ΕΓΚΡΙΣΗ 15/2026',
      field7: 'ΕΝΗΜΕΡΩΘΗΚΕ'
    });
    const updatedExhpIndexRow = transactions.listExhpIndexRows(2026)[0];
    assert.strictEqual(updatedExhpIndexRow.indexField6, 'ΕΓΚΡΙΣΗ 15/2026');
    assert.strictEqual(updatedExhpIndexRow.indexField7, 'ΕΝΗΜΕΡΩΘΗΚΕ');
    const metadataUpdate = transactions.updateExhpMetadata(exhp.documentId, {
      registryNumber: 3,
      documentDate: '2026-06-07'
    });
    assert.strictEqual(metadataUpdate.document.registryNumber, 3);
    assert.strictEqual(metadataUpdate.document.date, '2026-06-07');
    const renamedExhpIndexRow = transactions.listExhpIndexRows(2026)[0];
    assert.strictEqual(renamedExhpIndexRow.serial, 3);
    assert.strictEqual(renamedExhpIndexRow.date, '2026-06-07');
    const cardAfterExhpRename = shares.getShareCard(share.id, 2026);
    assert.strictEqual(cardAfterExhpRename.transactions[1].registryNumber, 'ΕΧΠ-3');
    assert.strictEqual(cardAfterExhpRename.transactions[1].date, '2026-06-07');
    assert.strictEqual(cardAfterExhpRename.share.accountingBalance, 6);
    const exhpDocument = transactions.getExhpDocument(exhp.documentId);
    assert.strictEqual(exhpDocument.supportStatus, 'Πλήρης για ΕΥΣ');
    assert.strictEqual(exhpDocument.materialAttachments.composition.length, 0);
    assert.strictEqual(exhpDocument.materialAttachments.changes.length, 0);
    assert.strictEqual(
      exhpDocument.supports.some((item) => ['ΔΥΠ/190', 'ΔΥΠ/191'].includes(item.documentCode)),
      false
    );
    assert.strictEqual(exhpDocument.otherSupportDocument, 'Αρχικό πρόσθετο δικαιολογητικό');
    assert.strictEqual(exhpDocument.supports[0].formData.place, 'Αθήνα');
    assert.strictEqual(exhpDocument.reasonTexts.recommendation, 'Εισήγηση δοκιμής');
    assert.strictEqual(exhpDocument.reasonTexts.firstOpinion, 'Πρώτη γνωμάτευση δοκιμής');
    assert.strictEqual(exhpDocument.reasonTexts.secondOpinion, 'Δεύτερη γνωμάτευση δοκιμής');
    assert.strictEqual(exhpDocument.financialOfficers.manager, 'Λγός (ΦΠΒ) Διαχειριστής Δοκιμής');
    assert.strictEqual(exhp.document.items[0].ledgerSerial, 2);
    assert.strictEqual(exhpDocument.items[0].ledgerSerial, exhp.document.items[0].ledgerSerial);
    transactions.updateExhpOtherSupportDocument(exhp.documentId, 'Πρόσθετο δικαιολογητικό 1/2026');
    assert.strictEqual(
      transactions.getExhpDocument(exhp.documentId).otherSupportDocument,
      'Πρόσθετο δικαιολογητικό 1/2026'
    );

    const toolCollectionReason = 'Συλλογές Εργαλείων - Παρακολουθήματα Κυρίων Υλικών.';
    const toolCollectionTemplates = transactions.getAddyReferenceData().exhpSupportTemplates
      .filter((item) => item.issueReason === toolCollectionReason);
    const toolCollectionExhp = transactions.saveExhp({
      documentDate: '2026-06-07',
      serviceUnit: 'ΔΟΚΙΜΑΣΤΙΚΗ ΜΟΝΑΔΑ',
      issueReason: toolCollectionReason,
      approvalReference: '2/07-06-2026',
      supports: toolCollectionTemplates.map((template) => ({
        templateId: template.id,
        completed: true,
        documentReference: `${template.documentCode || 'ΔΙΚ'}-1/2026`
      })),
      items: [{
        shareNumber: '1',
        nominalNumber: 'TEST-001',
        description: 'Δοκιμαστικό υλικό',
        measurementUnit: 'Τεμάχια',
        materialType: 'Αναλώσιμα',
        materialCode: '',
        transactionType: 'Χρέωση',
        quantity: 1,
        supportingDocuments: ''
      }, {
        shareNumber: '1',
        nominalNumber: 'TEST-001',
        description: 'Δοκιμαστικό υλικό',
        measurementUnit: 'Τεμάχια',
        materialType: 'Αναλώσιμα',
        materialCode: '',
        transactionType: 'Πίστωση',
        quantity: 1,
        supportingDocuments: ''
      }]
    });
    const toolCollectionDocument = transactions.getExhpDocument(toolCollectionExhp.documentId);
    assert.deepStrictEqual(
      toolCollectionDocument.items.map((item) => item.ledgerSerial),
      [3, 4]
    );
    assert.strictEqual(toolCollectionDocument.materialAttachments.composition.length, 2);
    assert.strictEqual(toolCollectionDocument.materialAttachments.changes.length, 2);
    const compositionSupport = toolCollectionDocument.supports
      .find((item) => item.documentCode === 'ΔΥΠ/190');
    assert.strictEqual(compositionSupport.required, true);
    const savedSupport = transactions.saveExhpSupportForm(toolCollectionExhp.documentId, compositionSupport.id, {
      documentReference: 'ΔΥΠ/190-1/2026',
      completed: true,
      formData: { findings: 'Δοκιμαστική διαπίστωση' }
    });
    assert.strictEqual(savedSupport.support.formData.findings, 'Δοκιμαστική διαπίστωση');

    const internalReferences = internal.getReferenceData();
    const internalComposition = internalReferences.shares[0].composition.map((item) => ({
      ...item,
      quantity: 2
    }));
    internal.saveMovement({
      documentDate: '2026-06-06',
      departmentManagerId: internalReferences.departmentManagers[0].id,
      shareId: internalReferences.shares[0].id,
      movementType: 'Χορήγηση',
      quantity: 3,
      notes: '',
      composition: internalComposition
    });
    internal.saveMovement({
      documentDate: '2026-06-06',
      departmentManagerId: internalReferences.departmentManagers[0].id,
      shareId: internalReferences.shares[0].id,
      movementType: 'Επιστροφή',
      quantity: 1,
      notes: '',
      composition: internalReferences.shares[0].composition.map((item) => ({
        ...item,
        quantity: 0.5
      }))
    });

    share = shares.listShares()[0];
    assert.strictEqual(share.accountingBalance, 6);
    assert.strictEqual(share.chargedQuantity, 2);

    const protocol = movementDifferences.createProtocol({
      protocolDate: '2026-06-07',
      addyDocumentId: addy.documentId,
      counterpartyUnit: '104 Α/Κ ΠΜΠ/ΓΔΥ',
      movementDirection: 'Παραλαβή',
      shareId: internalReferences.shares[0].id,
      documentQuantity: 10,
      actualQuantity: 9,
      dispatchDate: '2026-06-07'
    });
    assert.strictEqual(protocol.registryNumber, 1);
    let movementProtocol = movementDifferences.getProtocol(protocol.id);
    assert.strictEqual(movementProtocol.differenceType, 'Έλλειμμα');
    assert.strictEqual(movementProtocol.responseDueDate, '2026-06-22');

    movementDifferences.recordResponse(protocol.id, {
      responseDate: '2026-06-10',
      responseStatus: 'Έγινε δεκτή',
      responseNotes: ''
    });
    movementDifferences.settleProtocol(protocol.id, {
      settlementDate: '2026-06-11',
      settlementReference: 'ΕΧΠ 3/2026'
    });
    movementProtocol = movementDifferences.getProtocol(protocol.id);
    assert.strictEqual(movementProtocol.settlementStatus, 'Τακτοποιήθηκε');
    assert.strictEqual(movementDifferences.listProtocols(2026).length, 1);
    assert.strictEqual(share.availableQuantity, 4);
    assert.strictEqual(internal.listMovements(2026).length, 2);
    assert.strictEqual(internal.listMovements(2026)[0].runningBalance >= 0, true);
    const departmentBalances = internal.listDepartmentBalances(internalReferences.departmentManagers[0].id);
    assert.strictEqual(departmentBalances.length, 1);
    assert.strictEqual(departmentBalances[0].serialNumber, 1);
    assert.strictEqual(departmentBalances[0].shareNumber, '1');
    assert.strictEqual(departmentBalances[0].issuedQuantity, 3);
    assert.strictEqual(departmentBalances[0].returnedQuantity, 1);
    assert.strictEqual(departmentBalances[0].finalQuantity, 2);
    assert.strictEqual(departmentBalances[0].composition.length, internalComposition.length);
    assert.strictEqual(departmentBalances[0].composition[0].issuedQuantity, 2);
    assert.strictEqual(departmentBalances[0].composition[0].returnedQuantity, 0.5);
    assert.strictEqual(departmentBalances[0].composition[0].finalQuantity, 1.5);

    const collectionReference = transactions.getAddyReferenceData().shares
      .find((item) => item.shareNumber === '1');
    assert.strictEqual(collectionReference.composition[0].chargedQuantity, 3.5);
    const collectionExtraction = transactions.saveExhp({
      documentDate: '2026-06-08',
      serviceUnit: 'ΔΟΚΙΜΑΣΤΙΚΗ ΜΟΝΑΔΑ',
      issueReason: toolCollectionReason,
      approvalReference: '',
      supports: toolCollectionTemplates.map((template) => ({
        templateId: template.id,
        completed: true,
        documentReference: `${template.documentCode || 'ΔΙΚ'}-2/2026`
      })),
      items: [{
        shareNumber: 'Φ.Μ.',
        nominalNumber: 'COMP-001',
        description: 'Εξάρτημα δοκιμής',
        measurementUnit: 'Τεμάχια',
        transactionType: 'Πίστωση',
        quantity: 1,
        collectionTransfer: true,
        collectionVirtualCredit: true,
        collectionParentShareNumber: '1',
        transferGroup: 'collection-test-1'
      }, {
        shareNumber: '77',
        sourceShareNumber: 'Φ.Μ.',
        nominalNumber: 'COMP-001',
        description: 'Εξάρτημα δοκιμής',
        measurementUnit: 'Τεμάχια',
        transactionType: 'Χρέωση',
        quantity: 1,
        collectionTransfer: true,
        collectionVirtualCredit: true,
        collectionParentShareNumber: '1',
        transferGroup: 'collection-test-1'
      }]
    });
    const collectionExtractionDocument = transactions.getExhpDocument(collectionExtraction.documentId);
    assert.strictEqual(
      collectionExtractionDocument.items.find((item) => item.transactionType === 'Πίστωση').ledgerSerial,
      'Φ.Μ.'
    );
    assert.strictEqual(
      shares.listShares().find((item) => item.shareNumber === '77').accountingBalance,
      1
    );
    assert.strictEqual(
      shares.getShareCard(shares.listShares().find((item) => item.shareNumber === '1').id, 2026)
        .transactions.some((item) => item.registryNumber === `ΕΧΠ-${collectionExtraction.registryNumber}`),
      false
    );

    const multiPageItems = Array.from({ length: 15 }, () => ({
      shareNumber: '1',
      nominalNumber: 'TEST-001',
      description: 'Δοκιμαστικό υλικό',
      measurementUnit: 'Τεμάχια',
      transactionType: 'Χρέωση',
      quantity: 1
    }));
    assert.strictEqual(validateExhp({
      documentDate: '2026-06-06',
      serviceUnit: 'ΔΟΚΙΜΑΣΤΙΚΗ ΜΟΝΑΔΑ',
      issueReason: 'Τακτοποίηση Διαφορών.',
      items: multiPageItems
    }).items.length, 15);

    const balanceBeforeMovements = inventory.getReferenceData('2026-06-05').shares
      .find((item) => item.shareNumber === '1');
    assert.strictEqual(balanceBeforeMovements.accountingBalance, 0);

    const balanceAtInventory = inventory.getReferenceData('2026-06-07').shares
      .find((item) => item.shareNumber === '1');
    assert.strictEqual(balanceAtInventory.accountingBalance, 6);

    const inventorySession = inventory.createSession({
      inventoryDate: '2026-06-07',
      title: 'Δοκιμαστική Απογραφή',
      committeePresidentRank: 'Τχης (ΠΒ)',
      committeePresidentName: 'Πρόεδρος Δοκιμής',
      committeeMemberARank: 'Λγός (ΠΒ)',
      committeeMemberAName: 'Πρώτο Μέλος',
      committeeMemberBRank: 'Υπλγός (ΠΒ)',
      committeeMemberBName: 'Δεύτερο Μέλος'
    });
    const savedInventorySession = inventory.getSession(inventorySession.id);
    assert.strictEqual(savedInventorySession.committeePresidentName, 'Πρόεδρος Δοκιμής');
    assert.strictEqual(savedInventorySession.committeeMemberARank, 'Λγός (ΠΒ)');
    assert.strictEqual(savedInventorySession.committeeMemberBName, 'Δεύτερο Μέλος');
    inventory.saveCommittee(inventorySession.id, {
      committeePresidentRank: 'Σχης (ΠΒ)',
      committeePresidentName: 'Νέος Πρόεδρος',
      committeeMemberARank: 'Λγός (ΠΒ)',
      committeeMemberAName: 'Πρώτο Μέλος',
      committeeMemberBRank: 'Υπλγός (ΠΒ)',
      committeeMemberBName: 'Δεύτερο Μέλος'
    });
    assert.strictEqual(inventory.getSession(inventorySession.id).committeePresidentName, 'Νέος Πρόεδρος');

    assert.throws(
      () => inventory.saveCount({
        sessionId: inventorySession.id,
        shareId: internalReferences.shares[0].id,
        firstCount: 5
      }),
      /δεύτερη καταμέτρηση/
    );

    const inventoryDeficit = inventory.saveCount({
      sessionId: inventorySession.id,
      shareId: internalReferences.shares[0].id,
      firstCount: 0,
      secondCount: 0
    });
    assert.strictEqual(inventoryDeficit.difference, -4);
    assert.strictEqual(inventoryDeficit.differenceStatus, 'Έλλειμμα');

    const inventoryResult = inventory.saveCount({
      sessionId: inventorySession.id,
      shareId: internalReferences.shares[0].id,
      firstCount: 5,
      secondCount: 5
    });
    assert.strictEqual(inventoryResult.difference, 1);
    assert.strictEqual(inventoryResult.differenceStatus, 'Πλεόνασμα');
    inventory.completeSession(inventorySession.id);
    const differences = inventory.listDifferences();
    assert.strictEqual(differences.length, 1);
    inventory.settleDifference(differences[0].id, 'ΕΧΠ 2/2026');
    assert.strictEqual(inventory.listDifferences()[0].settlementStatus, 'Τακτοποιήθηκε');

    assert.throws(
      () => inventory.saveCount({
        sessionId: inventorySession.id,
        shareId: internalReferences.shares[0].id,
        firstCount: 4
      }),
      /δεν μπορεί να τροποποιηθεί/
    );

    share = shares.listShares()[0];
    assert.strictEqual(share.accountingBalance, 6);
    assert.strictEqual(share.chargedQuantity, 2);

    assert.throws(
      () => transactions.saveExhp({
        documentDate: '2026-06-06',
        serviceUnit: 'ΔΟΚΙΜΑΣΤΙΚΗ ΜΟΝΑΔΑ',
        issueReason: 'Τακτοποίηση διαφορών.',
        items: [{
          shareNumber: '1',
          nominalNumber: 'TEST-001',
          description: 'Δοκιμαστικό υλικό',
          measurementUnit: 'Τεμάχια',
          transactionType: 'Πίστωση',
          quantity: 7
        }]
      }),
      /δεν επαρκεί/
    );

    administration.addOfficerTerm({
      roleType: 'Γενικός Διαχειριστής',
      fullIdentity: 'Λγός (ΦΠΒ) Δοκιμαστικός Διαχειριστής',
      startDate: '2026-01-01',
      orderReference: 'Φ.000/1'
    });
    const registeredOfficers = administration.getReferenceData().officers;
    assert.strictEqual(registeredOfficers.some((officer) => officer.roleType === 'Γενικός Διαχειριστής'), true);
    assert.strictEqual(registeredOfficers.some((officer) => officer.roleType.startsWith('Μερικός Διαχειριστής')), true);

    const handover = administration.createHandover({
      startDate: '2026-06-07',
      orderReference: 'Φ.000/2',
      outgoingOfficer: 'Λγός (ΦΠΒ) Παραδίδων',
      incomingOfficer: 'Λγός (ΦΠΒ) Παραλαμβάνων',
      inventorySessionId: inventorySession.id,
      pendingDocuments: 'Κανένα'
    });
    let handoverDetails = administration.getHandover(handover.id);
    assert.strictEqual(handoverDetails.checks.length, 7);
    administration.updateHandoverProtocol(handover.id, {
      place: 'Αθήνα',
      shareRangeFrom: '1',
      shareRangeTo: '120',
      samplePercentageWords: 'δέκα τοις εκατό',
      samplePercentageNumber: '10%',
      fullCountCompleted: false,
      assistants: [
        {
          rank: 'Λγός',
          name: 'Βοηθός Διαχειριστή',
          categories: 'Υλικά Γραφείου',
          shareRangeFrom: '1',
          shareRangeTo: '40'
        }
      ]
    });
    handoverDetails = administration.getHandover(handover.id);
    assert.strictEqual(handoverDetails.protocolData.place, 'Αθήνα');
    assert.strictEqual(handoverDetails.protocolData.assistants[0].shareRangeTo, '40');
    assert.throws(
      () => administration.completeHandover(handover.id, { completionDate: '2026-06-07' }),
      /όλοι οι έλεγχοι/
    );
    handoverDetails.checks.forEach((check) => {
      administration.updateHandoverCheck(check.id, { completed: true, notes: '' });
    });
    administration.completeHandover(handover.id, {
      completionDate: '2026-06-08',
      outgoingObservations: '',
      incomingObservations: ''
    });
    assert.strictEqual(administration.getHandover(handover.id).status, 'Ολοκληρωμένη');

    shares.addShare({
      shareNumber: '2',
      nominalNumber: 'TEST-ARCHIVE',
      description: 'Ανενεργό δοκιμαστικό υλικό',
      materialType: 'Αναλώσιμα',
      projectedQuantity: 0,
      accountingBalance: 0,
      chargedQuantity: 0
    });
    const archiveShare = shares.listShares().find((item) => item.shareNumber === '2');
    administration.archiveShare({
      shareId: archiveShare.id,
      actionDate: '2026-06-08',
      reason: 'Δοκιμαστική κατάργηση είδους'
    });
    assert.strictEqual(shares.listShares().some((item) => item.id === archiveShare.id), false);
    assert.strictEqual(administration.getReferenceData().archivedShares.length, 1);
    administration.restoreShare(archiveShare.id, '2026-06-09');
    assert.strictEqual(shares.listShares().some((item) => item.id === archiveShare.id), true);

    const annualPackage = annualAccounts.getPackage(2026);
    assert.strictEqual(annualPackage.fiscalYear, 2026);
    assert.strictEqual(annualPackage.metrics.exhpDocuments, 3);
    assert.strictEqual(annualPackage.metrics.incompleteExhp, 0);
    assert.strictEqual(annualPackage.checks.some((check) => check.key === 'exhp-folder' && check.completed), true);

    const sortedAddy = transactions.saveAddy({
      documentDate: '2026-06-12',
      transactionUnit: '104 Α/Κ ΠΜΠ/ΓΔΥ',
      notes: '',
      items: [
        { shareNumber: '15', nominalNumber: 'SORT-015', description: 'Υλικό 15', quantity: 1, unitPrice: 1, measurementUnit: 'Τεμάχια', transactionType: 'Χρέωση', materialType: 'Κύριο Υλικό' },
        { shareNumber: '5', nominalNumber: 'SORT-005', description: 'Υλικό 5', quantity: 2, unitPrice: 1, measurementUnit: 'Τεμάχια', transactionType: 'Χρέωση', materialType: 'Κύριο Υλικό' },
        { shareNumber: '20', nominalNumber: 'SORT-020', description: 'Υλικό 20', quantity: 3, unitPrice: 1, measurementUnit: 'Τεμάχια', transactionType: 'Χρέωση', materialType: 'Κύριο Υλικό' }
      ]
    });
    assert.deepStrictEqual(
      transactions.getAddyDocument(sortedAddy.documentId).items.map((item) => item.column12),
      ['SORT-005', 'SORT-015', 'SORT-020']
    );
    const sharesBeforeExternalConsumable = shares.listShares().length;
    const externalConsumableAddy = transactions.saveAddy({
      documentDate: '2026-06-12',
      transactionUnit: '104 Α/Κ ΠΜΠ/ΓΔΥ',
      justificationReference: 'ΔΙΚ-ΑΝΑΛ/2026',
      notes: '',
      items: [{
        shareNumber: '777',
        nominalNumber: 'CONSUMABLE-777',
        description: 'Αναλώσιμο χωρίς καρτέλα',
        quantity: 5,
        unitPrice: 2,
        measurementUnit: 'Τεμάχια',
        transactionType: 'Χρέωση',
        materialType: 'ΑΝΑΛΩΣΙΜΑ'
      }]
    });
    assert.strictEqual(shares.listShares().length, sharesBeforeExternalConsumable + 1);
    assert.strictEqual(
      shares.listShares().some((share) => share.shareNumber === '777'),
      true
    );
    assert.strictEqual(
      inventory.getReferenceData('2026-06-12').shares.some((share) => share.shareNumber === '777'),
      false
    );
    assert.strictEqual(
      transactions.listExternalTransactionIndexRows(2026)
        .some((row) => row.id === externalConsumableAddy.documentId),
      true
    );
    assert.strictEqual(
      transactions.getAddyDocument(externalConsumableAddy.documentId).items[0].column12,
      'CONSUMABLE-777'
    );
    const savedAddyDocuments = transactions.listAddyDocuments();
    assert.deepStrictEqual(
      savedAddyDocuments.map((item) => item.id),
      [1, sortedAddy.documentId, externalConsumableAddy.documentId]
    );
    assert.strictEqual(savedAddyDocuments[1].quantity, 6);

    const sortedExhp = transactions.saveExhp({
      documentDate: '2026-06-12',
      serviceUnit: 'ΔΟΚΙΜΑΣΤΙΚΗ ΜΟΝΑΔΑ',
      issueReason: 'Τακτοποίηση Διαφορών.',
      approvalReference: '',
      supports: [],
      items: [
        { shareNumber: '20', nominalNumber: 'SORT-020', description: 'Υλικό 20', measurementUnit: 'Τεμάχια', materialType: 'Αναλώσιμα', transactionType: 'Χρέωση', quantity: 1 },
        { shareNumber: '5', nominalNumber: 'SORT-005', description: 'Υλικό 5', measurementUnit: 'Τεμάχια', materialType: 'Αναλώσιμα', transactionType: 'Χρέωση', quantity: 1 },
        { shareNumber: '15', nominalNumber: 'SORT-015', description: 'Υλικό 15', measurementUnit: 'Τεμάχια', materialType: 'Αναλώσιμα', transactionType: 'Χρέωση', quantity: 1 }
      ]
    });
    assert.deepStrictEqual(
      transactions.getExhpDocument(sortedExhp.documentId).items.map((item) => item.shareNumber),
      ['5', '15', '20']
    );
    const deletedExhpReference = `ΕΧΠ-${sortedExhp.registryNumber}`;
    const deletionResult = transactions.deleteExhpDocument(sortedExhp.documentId);
    assert.match(deletionResult.message, /διαγράφηκε/);
    assert.strictEqual(
      transactions.listExhpDocuments().some((item) => item.id === sortedExhp.documentId),
      false
    );
    for (const shareNumber of ['5', '15', '20']) {
      const share = shares.listShares().find((item) => item.shareNumber === shareNumber);
      assert.strictEqual(
        shares.getShareCard(share.id, 2026).transactions
          .some((item) => String(item.registryNumber).includes(deletedExhpReference)),
        false
      );
    }

    shares.updateShareDetails(importedShare.id, { requiresComposition: true });
    shares.saveComposition(importedShare.id, [{
      componentNominalNumber: 'INITIAL-COMP-1',
      componentDescription: 'Εξάρτημα αρχικής απογραφής',
      measurementUnit: 'Τεμάχια',
      projectedQuantity: 15,
      notIssuedQuantity: 0,
      notes: ''
    }]);
    assert.strictEqual(
      shares.getShareCard(importedShare.id, 2026).compositionItems[0].projectedQuantity,
      150
    );

    const creditedAddy = transactions.saveAddy({
      documentDate: '2026-06-13',
      transactionUnit: '104 Α/Κ ΠΜΠ/ΓΔΥ',
      notes: '',
      items: [{
        shareNumber: '99',
        nominalNumber: 'INITIAL-099',
        description: 'Υλικό αρχικής απογραφής',
        quantity: 3,
        unitPrice: 1,
        measurementUnit: 'Τεμάχια',
        transactionType: 'Πίστωση',
        materialType: 'Αναλώσιμα',
        composition: [{
          componentNominalNumber: 'INITIAL-COMP-1',
          componentDescription: 'Εξάρτημα αρχικής απογραφής',
          measurementUnit: 'Τεμάχια',
          projectedQuantity: 45,
          notIssuedQuantity: 4,
          notes: ''
        }]
      }]
    });
    const creditedCard = shares.getShareCard(importedShare.id, 2026);
    assert.strictEqual(creditedCard.openingTransfer.inventoryDate, '2025-12-31');
    assert.strictEqual(creditedCard.openingTransfer.balance, 10);
    assert.strictEqual(creditedCard.transactions.length, 1);
    assert.strictEqual(creditedCard.transactions[0].serialNumber, 1);
    assert.strictEqual(creditedCard.transactions[0].registryNumber, `Π-${creditedAddy.documentId}`);
    assert.strictEqual(creditedCard.transactions[0].exports, 3);
    assert.strictEqual(creditedCard.transactions[0].balance, 7);
    assert.strictEqual(creditedCard.share.accountingBalance, 7);
    assert.strictEqual(creditedCard.compositionItems[0].projectedQuantity, 105);
    const creditedAddyDocument = transactions.getAddyDocument(creditedAddy.documentId);
    assert.strictEqual(creditedAddyDocument.items[0].column25, 1);
    assert.strictEqual(creditedAddyDocument.items[0].composition[0].projectedQuantity, 45);
    assert.strictEqual(creditedAddyDocument.items[0].composition[0].notIssuedQuantity, 4);
    const updatedAddy = transactions.updateAddyDocument(creditedAddy.documentId, {
      notes: 'Ενημερωμένες πληροφορίες ΑΔΔΥ',
      items: [{ id: creditedAddyDocument.items[0].id, quantity: 2 }]
    });
    assert.strictEqual(updatedAddy.document.notes, 'Ενημερωμένες πληροφορίες ΑΔΔΥ');
    assert.strictEqual(updatedAddy.document.items[0].quantity, 2);
    assert.strictEqual(shares.getShareCard(importedShare.id, 2026).share.accountingBalance, 8);
    const deletedAddy = transactions.deleteAddyDocument(creditedAddy.documentId);
    assert.deepStrictEqual(deletedAddy.affectedShares, [{
      id: importedShare.id,
      accountingBalance: 10,
      chargedQuantity: 0
    }]);
    assert.strictEqual(
      transactions.listAddyDocuments().some((item) => item.id === creditedAddy.documentId),
      false
    );
    assert.strictEqual(shares.getShareCard(importedShare.id, 2026).share.accountingBalance, 10);
    assert.strictEqual(shares.getShareCard(importedShare.id, 2026).transactions.length, 0);

    const orphanedAddy = transactions.saveAddy({
      documentDate: '2026-06-14',
      transactionUnit: 'TEST UNIT',
      notes: '',
      items: [{
        shareNumber: '99',
        nominalNumber: 'INITIAL-099',
        description: 'TEST MATERIAL',
        quantity: 1,
        unitPrice: 1,
        measurementUnit: 'Τεμάχια',
        transactionType: 'Πίστωση',
        materialType: 'Αναλώσιμα'
      }]
    });
    const orphanedItem = db.prepare(
      'SELECT share_id, share_transaction_id FROM addy_items WHERE addy_document_id = ?'
    ).get(orphanedAddy.documentId);
    db.pragma('foreign_keys = OFF');
    db.prepare('DELETE FROM share_transactions WHERE id = ?').run(orphanedItem.share_transaction_id);
    db.prepare('UPDATE shares SET accounting_balance = accounting_balance + 1 WHERE id = ?')
      .run(orphanedItem.share_id);
    db.pragma('foreign_keys = ON');
    transactions.deleteAddyDocument(orphanedAddy.documentId);
    assert.strictEqual(
      transactions.listAddyDocuments().some((item) => item.id === orphanedAddy.documentId),
      false,
      'An ADDY with an already-removed share transaction must still be deletable.'
    );
    assert.strictEqual(shares.getShareCard(importedShare.id, 2026).share.accountingBalance, 10);

    console.log('Ledger smoke test passed.');
  } finally {
    fs.rmSync(testDirectory, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
