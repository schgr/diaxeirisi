const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');

async function run() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'exhpForm', 'supportingDocs', 'docIA_pyromaxika.js')).href;
  const letteredListUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'exhpForm', 'supportingDocs', 'shared', 'letteredList.js')).href;
  const aitiologiesUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'exhpForm', 'aitiologies.js')).href;
  const assetPath = path.join(__dirname, '..', 'src', 'ui', 'assets', 'official-forms', 'dyp192-clean.png');
  const {
    createDocIAPyromaxika,
    getGreekWeekday,
    renderDocIAPrint,
    validateDocIAPyromaxika
  } = await import(moduleUrl);
  const {
    renderLetteredListInput,
    renderLetteredListPrint
  } = await import(letteredListUrl);
  const { getAitiologiaByCode } = await import(aitiologiesUrl);
  assert.ok(fs.existsSync(assetPath), 'Expected DYP/192 clean background asset');

  const validData = {
    aitiologiaCode: 'ia',
    formCode: 'ΔΥΠ/192',
    commonFields: {
      monada: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ',
      addyAxp: '15/2026',
      date: '2026-07-03'
    },
    financialOfficers: {
      commander: '',
      ped: 'Σχης ΠΕΔΟΠΟΥΛΟΣ ΠΕΤΡΟΣ',
      manager: ''
    },
    specificFields: {
      vathmosOnomatepwnymo: 'Λγός ΔΟΚΙΜΑΣΤΗΣ',
      monadaTmima: 'ΤΜΗΜΑ ΒΟΛΩΝ',
      imerominia: '2026-07-03',
      imeraEvdomadas: 'Παρασκευή',
      consumedMaterials: [{
        seq: 1,
        shareNumber: '1201',
        nomenclature: 'NOM-1',
        description: 'Φυσίγγια <7,62>',
        unit: 'Τεμάχια',
        quantity: '2'
      }],
      returnedPackagingMaterials: [{
        seq: 1,
        shareNumber: '1202',
        nomenclature: 'NOM-2',
        description: 'Κάλυκες & φορείς',
        unit: 'Τεμάχια',
        quantity: '2'
      }],
      consumedAmmo: ['Φυσίγγια <7,62> / Τεμάχια / 2', '', '', '', ''],
      returnedPackaging: ['Κάλυκες & φορείς / Τεμάχια / 2', '', '', '', ''],
      antigrafa: '2'
    },
    materials: []
  };

  const doc = createDocIAPyromaxika({ data: validData });
  assert.strictEqual(doc.validate().valid, true);
  assert.deepStrictEqual(doc.getData(), validData);

  const printHtml = renderDocIAPrint(validData);
  assert.match(printHtml, /official-overlay-page dyp192-page print-document-area/);
  assert.match(printHtml, /dyp192-clean\.png/);
  assert.match(printHtml, /data-dyp192-page="1"/);
  assert.match(printHtml, /left:9\.51%;top:9\.85%;width:71\.34%;height:3\.69%/);
  assert.match(printHtml, /dyp192-list-description/);
  assert.match(printHtml, /dyp192-list-quantity/);
  assert.match(printHtml, /left:35\.28%;top:81\.27%;width:4\.72%;height:1\.57%/);
  assert.match(printHtml, /dyp192-signature-overlay/);
  assert.match(printHtml, /left:9\.9%;top:96\.35%;width:23\.4%;height:2\.95%/);
  assert.match(printHtml, /left:52\.8%;top:96\.35%;width:29\.4%;height:2\.95%/);
  assert.ok(!printHtml.includes('<7,62>'));
  assert.match(printHtml, /Φυσίγγια &lt;7,62&gt; \/ Τεμάχια/);
  assert.match(printHtml, /Κάλυκες &amp; φορείς \/ Τεμάχια/);
  assert.match(printHtml, /dyp192-list-quantity[^>]*style="[^"]*">2<\/div>/);
  assert.doesNotMatch(printHtml, /data-materials-table/);
  assert.doesNotMatch(printHtml, /exhp-materials-table-print/);

  const editHtml = doc.renderEdit();
  assert.match(editHtml, /data-exhp-doc-ia-editor/);
  assert.match(editHtml, /data-doc-ia-materials="consumed"/);
  assert.match(editHtml, /data-doc-ia-materials="returned"/);
  assert.match(editHtml, /data-material-picker-variant="dyp192"/);
  assert.match(editHtml, /data-doc-ia-field="specificFields\.vathmosOnomatepwnymo"/);
  assert.doesNotMatch(editHtml, /data-lettered-list/);
  assert.strictEqual(getGreekWeekday('2026-07-09'), 'Πέμπτη');
  assert.strictEqual(getGreekWeekday('2026-02-30'), '');

  const autoWeekdayData = {
    ...validData,
    specificFields: {
      ...validData.specificFields,
      imerominia: '2026-07-09',
      imeraEvdomadas: ''
    }
  };
  assert.strictEqual(
    createDocIAPyromaxika({ data: autoWeekdayData }).getData().specificFields.imeraEvdomadas,
    'Πέμπτη'
  );

  assert.strictEqual(typeof getAitiologiaByCode('ia').module, 'function');
  assert.strictEqual(getAitiologiaByCode('ia').module, createDocIAPyromaxika);

  const standaloneInput = renderLetteredListInput(['<ένα>', 'δύο'], 'changed', {
    minItems: 3,
    maxItems: 3,
    name: 'standalone'
  });
  assert.match(standaloneInput, /data-lettered-list/);
  assert.match(standaloneInput, /data-change-handler="changed"/);
  assert.match(standaloneInput, /data-lettered-list-field="standalone\.0"/);
  assert.match(standaloneInput, /&lt;ένα&gt;/);
  assert.strictEqual((standaloneInput.match(/data-lettered-list-field=/g) || []).length, 3);

  const standalonePrint = renderLetteredListPrint(['<ένα>', 'δύο'], { minItems: 3, maxItems: 3 });
  assert.match(standalonePrint, /α\./);
  assert.match(standalonePrint, /β\./);
  assert.match(standalonePrint, /γ\./);
  assert.match(standalonePrint, /&lt;ένα&gt;/);
  assert.ok(!standalonePrint.includes('<ένα>'));

  assertValidationFailure(validateDocIAPyromaxika, {
    ...validData,
    specificFields: { ...validData.specificFields, vathmosOnomatepwnymo: '' }
  }, 'Βαθμός - Ονοματεπώνυμο');

  assertValidationFailure(validateDocIAPyromaxika, {
    ...validData,
    specificFields: { ...validData.specificFields, imerominia: '' }
  }, 'Ημερομηνία');

  assertValidationFailure(validateDocIAPyromaxika, {
    ...validData,
    specificFields: {
      ...validData.specificFields,
      consumedMaterials: [],
      consumedAmmo: ['', '', '', '', '']
    }
  }, 'Καταναλωθέντα πυρομαχικά');

  console.log('Doc IA pyromaxika rendering and validation test passed.');
}

function assertValidationFailure(validateDocIAPyromaxika, data, field) {
  const result = validateDocIAPyromaxika(data);
  assert.strictEqual(result.valid, false);
  assert.ok(result.errors.some((error) => error.field === field), `Expected validation error for ${field}`);
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
