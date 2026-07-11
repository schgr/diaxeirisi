const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function run() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'ui', 'transactions', 'exhpFormModuleBridge.js')).href;
  const {
    getAitiologiaCodeForIssueReason,
    hasAitiologiaModule,
    renderNewSupportDocumentEditor,
    renderNewSupportDocumentPrint,
    saveNewSupportDocumentDraft,
    shouldFillExhpSecondOpinion,
    shouldShowOfficialExhpForms,
    syncDocZMaterialsToExhpCreditItems,
    syncSupportDocumentMaterialsToExhpItems,
    toLegacyPreviewPayload
  } = await import(moduleUrl);

  assert.strictEqual(
    getAitiologiaCodeForIssueReason('Διαγραφή Αναλώσιμου Υλικού και Ειδών Σταθερών Χορηγιών.'),
    'z'
  );
  assert.strictEqual(
    getAitiologiaCodeForIssueReason('Διαγραφή Πυρομαχικών Εκπαιδεύσεως.'),
    'ia'
  );
  assert.strictEqual(hasAitiologiaModule('', 'z'), true);
  assert.strictEqual(hasAitiologiaModule('', 'd'), true);
  assert.strictEqual(hasAitiologiaModule('Τακτοποίηση Διαφορών.', ''), false);

  assert.strictEqual(shouldShowOfficialExhpForms('', 'b'), true);
  assert.strictEqual(shouldShowOfficialExhpForms('', 'd'), true);
  assert.strictEqual(shouldShowOfficialExhpForms('', 'ia'), true);
  assert.strictEqual(shouldShowOfficialExhpForms('', 'z'), true);
  assert.strictEqual(shouldShowOfficialExhpForms('', 'a'), true);
  assert.strictEqual(shouldFillExhpSecondOpinion('', 'a', ''), true);
  assert.strictEqual(shouldFillExhpSecondOpinion('', 'd', ''), true);
  assert.strictEqual(shouldFillExhpSecondOpinion('', 'th', ''), true);
  assert.strictEqual(shouldFillExhpSecondOpinion('', 'i', ''), true);
  assert.strictEqual(shouldFillExhpSecondOpinion('', 'b', ''), false);
  assert.strictEqual(shouldFillExhpSecondOpinion('', 'ib', ''), false);
  assert.strictEqual(shouldFillExhpSecondOpinion('', 'ib', 'manual text'), true);

  const docAHtml = renderNewSupportDocumentEditor('', {
    reasonCode: 'a',
    serviceUnit: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ',
    documentsState: {},
    items: []
  });
  assert.match(docAHtml, /data-exhp-doc-a-editor/);
  assert.strictEqual((docAHtml.match(/data-doc-a-menu=/g) || []).length, 2);
  assert.strictEqual((docAHtml.match(/data-doc-a-form=/g) || []).length, 8);
  assert.strictEqual((docAHtml.match(/data-use-previous-exhp-committee/g) || []).length, 1);
  assert.match(docAHtml, /Πρωτοβάθμια Επιτροπή/);
  assert.match(docAHtml, /Δευτεροβάθμια Επιτροπή/);
  assert.match(docAHtml, /data-doc-a-form="b" data-committee-tier="secondary" hidden/);

  const docAPrint = renderNewSupportDocumentPrint({
    aitiologiaCode: 'a', formKey: 'a', committeeTier: 'secondary',
    commonFields: { monada: 'ΜΟΝΑΔΑ' },
    financialOfficers: { manager: 'Λγός (ΠΒ) Αζίζογλου Πρόδρομος', ped: 'Τχης Παπαδόπουλος Νικόλαος' },
    specificFields: { proedros: 'Λγός (ΠΖ) Πρόεδρος Δοκιμής', melosA: 'Υπλγός Μέλος Άλφα', melosB: 'Ανθλγός Μέλος Βήτα' },
    materials: [{ shareNumber: '1', description: 'Υλικό', quantity: 1 }]
  });
  assert.ok(docAPrint.indexOf('Αζίζογλου Πρόδρομος') < docAPrint.indexOf('Λγός (ΠΒ)'));
  assert.ok(docAPrint.indexOf('Παπαδόπουλος Νικόλαος') < docAPrint.indexOf('Τχης'));
  assert.match(docAPrint, /exhp-axristo-signature-label">Α/);
  assert.match(docAPrint, /exhp-axristo-signature-label">Β/);
  assert.match(docAPrint, /ΔΕΥΤΕΡΟΒΑΘΜΙΑ ΕΠΙΤΡΟΠΗ/);

  const context = {
    reasonCode: 'ia',
    serviceUnit: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ',
    documentsState: {},
    items: []
  };
  const html = renderNewSupportDocumentEditor('Διαγραφή Πυρομαχικών Εκπαιδεύσεως.', context);
  assert.match(html, /data-new-exhp-support-module="ia"/);
  assert.match(html, /data-exhp-doc-ia-editor/);
  assert.match(html, /data-preview-new-exhp-support="ia"/);

  const docDHtml = renderNewSupportDocumentEditor('', {
    reasonCode: 'd',
    serviceUnit: 'ΞΞΞΞ‘Ξ”Ξ‘ Ξ”ΞΞΞ™ΞΞ—Ξ£',
    documentsState: {},
    items: []
  });
  assert.match(docDHtml, /data-new-exhp-support-module="d"/);
  assert.match(docDHtml, /data-exhp-doc-d-editor/);
  assert.match(docDHtml, /data-doc-d-materials="used"/);
  assert.match(docDHtml, /data-doc-d-materials="produced"/);

  const data = {
    aitiologiaCode: 'ia',
    formCode: 'ΔΥΠ/192',
    commonFields: { monada: 'ΜΟΝΑΔΑ', addyAxp: '1/2026', date: '2026-07-03' },
    specificFields: {
      vathmosOnomatepwnymo: 'Λγός ΔΟΚΙΜΑΣΤΗΣ',
      monadaTmima: 'ΤΜΗΜΑ',
      imerominia: '2026-07-03',
      imeraEvdomadas: 'Παρασκευή',
      consumedAmmo: ['Φυσίγγια', '', '', '', ''],
      returnedPackaging: ['Κάλυκες', '', '', '', ''],
      antigrafa: '2'
    },
    materials: []
  };
  const documentsState = {};
  saveNewSupportDocumentDraft(documentsState, data);
  assert.strictEqual(documentsState.newModuleDrafts.ia, data);
  assert.strictEqual(documentsState.draftAmmo.officerName, 'Λγός ΔΟΚΙΜΑΣΤΗΣ');
  assert.strictEqual(documentsState.draftAmmo.items.length, 2);
  assert.deepStrictEqual(toLegacyPreviewPayload(data).type, 'ammo_consumption');

  const zData = {
    aitiologiaCode: 'z',
    formCode: 'ΕΦΕΔ 505',
    commonFields: { monada: 'ΜΟΝΑΔΑ', addyAxp: '2/2026', date: '2026-07-03' },
    specificFields: {
      topos: 'Αθήνα',
      imerominia: '2026-07-03',
      hdmArithmos: 'Φ.600/1',
      proedros: 'Λγός ΔΟΚΙΜΑΣΤΗΣ',
      melosA: '',
      melosB: '',
      apoDate: '2026-01-01',
      eosDate: '2026-01-31'
    },
    materials: [{
      seq: 1,
      shareNumber: '365',
      nomenclature: '900-0358-1292',
      description: 'ΚΛΕΙΔΙΑ ΓΕΡΜΑΝΙΚΑ',
      unit: 'τεμάχια',
      quantity: '2',
      notes: 'δοκιμή'
    }]
  };
  const synced = syncDocZMaterialsToExhpCreditItems([{
    shareNumber: '1',
    nominalNumber: 'OLD',
    description: 'Χειροκίνητη γραμμή',
    measurementUnit: 'ΤΕΜ',
    quantity: 1,
    transactionType: 'Χρέωση'
  }, {
    shareNumber: '999',
    nominalNumber: 'OLD-Z',
    description: 'Παλιό docZ',
    measurementUnit: 'ΤΕΜ',
    quantity: 1,
    transactionType: 'Πίστωση',
    supportModuleSource: 'docZ_analosimo'
  }], zData);
  assert.strictEqual(synced.length, 2);
  assert.ok(synced.some((item) => item.description === 'Χειροκίνητη γραμμή'));
  const credit = synced.find((item) => item.supportModuleSource === 'docZ_analosimo');
  assert.strictEqual(credit.shareNumber, '365');
  assert.strictEqual(credit.transactionType, 'Πίστωση');
  assert.strictEqual(credit.quantity, 2);

  const dData = {
    aitiologiaCode: 'd',
    formCode: 'EFED 506',
    commonFields: { monada: 'MONADA', addyAxp: '3/2026', date: '2026-07-03' },
    specificFields: {
      topos: 'Athina',
      dgiArithmos: 'F.800/1',
      proedros: 'President',
      melosA: '',
      melosB: ''
    },
    materialsUsed: [{
      seq: 1,
      shareNumber: '20',
      nomenclature: 'USED-NOM',
      description: 'used material',
      unit: 'TEM',
      quantity: '4',
      notes: 'used-note'
    }],
    materialsProduced: [{
      seq: 1,
      shareNumber: '30',
      nomenclature: 'PROD-NOM',
      description: 'produced material',
      unit: 'TEM',
      quantity: '2',
      notes: 'produced-note'
    }]
  };
  const syncedD = syncSupportDocumentMaterialsToExhpItems([{
    shareNumber: '10',
    nominalNumber: 'MANUAL',
    description: 'manual',
    measurementUnit: 'TEM',
    quantity: 1,
    transactionType: 'manual'
  }, {
    shareNumber: '20',
    nominalNumber: 'STALE',
    description: 'stale used',
    measurementUnit: 'TEM',
    quantity: 99,
    transactionType: 'old-credit',
    supportModuleSource: 'docD_metasximatismos_used'
  }, {
    shareNumber: '30',
    nominalNumber: 'STALE',
    description: 'stale produced',
    measurementUnit: 'TEM',
    quantity: 99,
    transactionType: 'old-debit',
    supportModuleSource: 'docD_metasximatismos_produced'
  }], dData);
  assert.strictEqual(syncedD.length, 3);
  assert.ok(syncedD.some((item) => item.description === 'manual'));
  const usedCredit = syncedD.find((item) => item.supportModuleSource === 'docD_metasximatismos_used');
  const producedDebit = syncedD.find((item) => item.supportModuleSource === 'docD_metasximatismos_produced');
  assert.strictEqual(usedCredit.shareNumber, '20');
  assert.strictEqual(usedCredit.transactionType, 'Πίστωση');
  assert.strictEqual(usedCredit.quantity, 4);
  assert.strictEqual(producedDebit.shareNumber, '30');
  assert.strictEqual(producedDebit.transactionType, 'Χρέωση');
  assert.strictEqual(producedDebit.quantity, 2);
  assert.ok(!syncedD.some((item) => item.description === 'stale used'));
  assert.ok(!syncedD.some((item) => item.description === 'stale produced'));

  const unchangedWithoutDocument = syncSupportDocumentMaterialsToExhpItems(syncedD, null);
  assert.strictEqual(unchangedWithoutDocument, syncedD);
  assert.strictEqual(unchangedWithoutDocument.length, 3);

  console.log('EXHP form module bridge test passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
