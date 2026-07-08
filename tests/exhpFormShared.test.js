const assert = require('assert');
const path = require('path');
const { pathToFileURL } = require('url');

async function run() {
  const materialsUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'exhpForm', 'supportingDocs', 'shared', 'materialsTable.js')).href;
  const materialPickerUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'exhpForm', 'supportingDocs', 'shared', 'materialPicker.js')).href;
  const docHeaderUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'exhpForm', 'supportingDocs', 'shared', 'docHeader.js')).href;
  const signatureUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'exhpForm', 'supportingDocs', 'shared', 'signatureBlock.js')).href;
  const validationUrl = pathToFileURL(path.join(__dirname, '..', 'src', 'exhpForm', 'validation.js')).href;
  const {
    renderMaterialsTableInput,
    renderMaterialsTablePrint
  } = await import(materialsUrl);
  const {
    getShareForMaterialPickerValue,
    renderMaterialPickerRow,
    renderMaterialPickerTableInput
  } = await import(materialPickerUrl);
  const { renderDocHeader } = await import(docHeaderUrl);
  const { parseRankAndName, renderSignatureBlock } = await import(signatureUrl);
  const {
    requireAtLeastOneRow,
    requireDateOrder,
    requireNonEmpty
  } = await import(validationUrl);

  const dangerousRow = {
    seq: 1,
    nomenclature: 'ΑΟ-1',
    description: '<script>alert("x")</script>',
    unit: 'ΤΕΜ',
    quantity: '2',
    notes: 'Χρήση & έλεγχος'
  };

  const inputHtml = renderMaterialsTableInput([dangerousRow], 'materialsChanged');
  assert.match(inputHtml, /data-materials-table/);
  assert.match(inputHtml, /data-materials-add-row/);
  assert.match(inputHtml, /data-materials-remove-row/);
  assert.match(inputHtml, /data-change-handler="materialsChanged"/);
  assert.ok(!inputHtml.includes('<script>'));
  assert.match(inputHtml, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);
  assert.match(inputHtml, /Χρήση &amp; έλεγχος/);

  const printHtml = renderMaterialsTablePrint([dangerousRow]);
  assert.match(printHtml, /exhp-materials-table-print/);
  assert.match(printHtml, /Αριθμός Ονομαστικού/);
  assert.match(printHtml, /Παρατηρήσεις/);
  assert.doesNotMatch(printHtml, /<input/);
  assert.ok(!printHtml.includes('<script>'));
  assert.match(printHtml, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/);

  const numberedPrintHtml = renderMaterialsTablePrint([dangerousRow], {
    columnNumbers: ['3', '4', '5', '6', '7', '8'],
    notesLabel: 'Παρ/σεις'
  });
  assert.match(numberedPrintHtml, /exhp-materials-column-number-row/);
  assert.match(numberedPrintHtml, /<th>3<\/th>/);
  assert.match(numberedPrintHtml, /<th>8<\/th>/);
  assert.match(numberedPrintHtml, /Παρ\/σεις/);
  assert.ok(numberedPrintHtml.indexOf('Αριθμός Ονομαστικού') < numberedPrintHtml.indexOf('exhp-materials-column-number-row'));

  const headerHtml = renderDocHeader({
    monada: 'ΜΟΝΑΔΑ ΔΟΚΙΜΗΣ',
    addyAxp: '12/2026',
    formCode: 'Κ 2334/ΔΥΠ',
    formNumber: 'ΕΦΕΔ 505'
  });
  assert.match(headerHtml, /exhp-form-code-block/);
  assert.match(headerHtml, /exhp-form-fields-row/);
  assert.match(headerHtml, /exhp-form-field-line-unit/);
  assert.match(headerHtml, /exhp-form-field-line-index/);
  assert.ok(headerHtml.indexOf('Κ 2334/ΔΥΠ') < headerHtml.indexOf('1. ΜΟΝΑΔΑ'));

  const parsedSignatureName = parseRankAndName('Λγός (ΠΒ) Αλεξανδρής Ιωάννης');
  assert.strictEqual(parsedSignatureName.rank, 'Λγός (ΠΒ)');
  assert.strictEqual(parsedSignatureName.name, 'Αλεξανδρής Ιωάννης');
  assert.strictEqual(parseRankAndName('Αλεξανδρής Ιωάννης').name, 'Αλεξανδρής Ιωάννης');
  const signatureHtml = renderSignatureBlock([
    { key: 'commander', label: 'Ο ΔΙΟΙΚΗΤΗΣ' },
    { key: 'manager', label: 'Ο ΔΙΑΧΕΙΡΙΣΤΗΣ' },
    { key: 'committeeTitle', label: 'Η ΕΠΙΤΡΟΠΗ' },
    { key: 'committeePresident', label: 'Ο ΠΡΟΕΔΡΟΣ' },
    { key: 'committeeMembers', label: 'ΤΑ ΜΕΛΗ' }
  ], {
    commander: 'Σχης Παπαδόπουλος Νικόλαος',
    manager: 'Λγός Διαχειριστής',
    committeePresident: 'Λγός (ΠΒ) Αλεξανδρής Ιωάννης',
    committeeMembers: ['Ανθλγός Μέλος Α', 'Ανθστής Μέλος Β']
  });
  assert.match(signatureHtml, /exhp-signature-theorisi/);
  assert.match(signatureHtml, /ΘΕΩΡΗΘΗΚΕ/);
  assert.match(signatureHtml, /exhp-signature-committee-grid/);
  assert.match(signatureHtml, /exhp-signature-member-stack/);
  assert.ok(signatureHtml.indexOf('Αλεξανδρής Ιωάννης') < signatureHtml.indexOf('Λγός (ΠΒ)'));

  const shares = [{
    shareNumber: '365',
    nominalNumber: '900-0358-1292',
    description: '<ΚΛΕΙΔΙΑ>',
    measurementUnit: 'τεμάχια'
  }];
  const pickerHtml = renderMaterialPickerTableInput([{ ...dangerousRow, shareNumber: '365' }], shares, 'pickerChanged');
  assert.match(pickerHtml, /data-material-picker-table/);
  assert.match(pickerHtml, /data-material-picker-select/);
  assert.match(pickerHtml, /data-material-picker-add-row/);
  assert.match(pickerHtml, /data-material-picker-remove-row/);
  assert.match(pickerHtml, /data-change-handler="pickerChanged"/);
  assert.ok(!pickerHtml.includes('<ΚΛΕΙΔΙΑ>'));
  assert.match(pickerHtml, /&lt;ΚΛΕΙΔΙΑ&gt;/);
  assert.strictEqual(getShareForMaterialPickerValue(shares, '365'), shares[0]);
  assert.strictEqual(getShareForMaterialPickerValue(shares, '900-0358-1292'), null);
  assert.match(renderMaterialPickerRow({}, 1), /data-materials-field="seq" value="2"/);
  assert.match(renderMaterialPickerRow({}, 2, { variant: 'dyp192' }), /data-materials-field="seq" value="3"/);

  assert.deepStrictEqual(requireNonEmpty('  Μονάδα  ', 'Μονάδα'), {
    valid: true,
    value: 'Μονάδα'
  });
  assert.strictEqual(requireNonEmpty('', 'Μονάδα').valid, false);

  assert.strictEqual(requireAtLeastOneRow([{ description: 'Υλικό' }]).valid, true);
  assert.strictEqual(requireAtLeastOneRow([{ description: '   ' }]).valid, false);
  assert.strictEqual(requireAtLeastOneRow([]).valid, false);

  assert.strictEqual(requireDateOrder('2026-01-01', '2026-01-02').valid, true);
  assert.strictEqual(requireDateOrder('2026-01-02', '2026-01-02').valid, true);
  assert.strictEqual(requireDateOrder('2026-01-03', '2026-01-02').valid, false);
  assert.strictEqual(requireDateOrder('not-a-date', '2026-01-02').valid, false);

  console.log('EXHP form shared components test passed.');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
