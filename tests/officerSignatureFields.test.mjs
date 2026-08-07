import assert from 'node:assert/strict';
import {
  formatOfficerName,
  formatOfficerRank,
  splitOfficerSignature
} from '../src/ui/officerSignature.js';
import {
  escapeHtml,
  field,
  renderFiscalYearOptions
} from '../src/ui/components/forms.js';
import {
  listRequestPriorityOptionGroups,
  requestPriorityColumns,
  requestPriorityRows
} from '../src/ui/requestPriorities.js';

assert.deepEqual(splitOfficerSignature(''), { name: '', rank: '' });
assert.deepEqual(splitOfficerSignature('   '), { name: '', rank: '' });
assert.deepEqual(splitOfficerSignature('Λγός (ΦΠΒ) ΑΛΕΞΑΝΔΡΗΣ ΙΩΑΝΝΗΣ'), {
  name: 'Αλεξανδρης Ιωαννης',
  rank: 'Λγός (ΦΠΒ)'
});
assert.deepEqual(splitOfficerSignature('ΠΑΠΑΔΟΠΟΥΛΟΣ ΓΕΩΡΓΙΟΣ Τχης'), {
  name: 'Παπαδοπουλος Γεωργιος',
  rank: 'Τχης'
});
assert.deepEqual(splitOfficerSignature('ΝΙΚΟΛΑΟΥ ΜΑΡΙΑ\nΥΠΕΥΘΥΝΗ ΥΛΙΚΟΥ'), {
  name: 'Νικολαου Μαρια',
  rank: 'Υπευθυνη ΥΛΙΚΟΥ'
}, 'unknown ranks are split on the line separator and only their first word is normalised');
assert.deepEqual(splitOfficerSignature('ΔΗΜΗΤΡΙΟΥ ΠΕΤΡΟΣ'), {
  name: 'Δημητριου Πετρος',
  rank: ''
});

assert.equal(formatOfficerName('ΑΝΝΑ-ΜΑΡΙΑ ΚΩΝΣΤΑΝΤΙΝΟΥ'), 'Αννα-Μαρια Κωνσταντινου');
assert.equal(formatOfficerName(null), '');
assert.equal(formatOfficerRank('ΣΧΗΣ (ΠΖ)'), 'Σχης (ΠΖ)');
assert.equal(formatOfficerRank(''), '');

assert.equal(escapeHtml('<b>"Α" & \'Β\'</b>'), '&lt;b&gt;&quot;Α&quot; &amp; &#039;Β&#039;&lt;/b&gt;');
assert.equal(escapeHtml(null), '');
assert.equal(escapeHtml(12), '12');

const markup = field('Ποσότητα', 'quantity', '<5>', 'π.χ. 10', 'required');
assert.match(markup, /<span>Ποσότητα<\/span>/u);
assert.match(markup, /name="quantity"/u);
assert.match(markup, /value="&lt;5&gt;"/u, 'values are escaped before they reach the markup');
assert.match(markup, /placeholder="π\.χ\. 10"/u);
assert.match(markup, /required/u);
assert.match(field('Ετικέτα', 'name'), /value="" placeholder=""/u);

const currentYear = new Date().getFullYear();
const options = renderFiscalYearOptions(currentYear);
assert.match(options, new RegExp(`<option value="${currentYear}" selected>${currentYear}</option>`, 'u'));
assert.match(options, new RegExp(`<option value="${currentYear + 1}" >`, 'u'), 'the next fiscal year is always offered');
assert.equal(options.split('<option').length - 1, currentYear + 1 - 2000 + 1);

const pastOptions = renderFiscalYearOptions(1998, 1998);
assert.match(pastOptions, /<option value="1998" selected>/u, 'years before the default earliest year stay selectable');
assert.match(renderFiscalYearOptions(null), new RegExp(`value="${currentYear}" selected`, 'u'));
assert.equal(renderFiscalYearOptions(2024, 2020).split('<option').length - 1, currentYear + 1 - 2020 + 1);

const groups = listRequestPriorityOptionGroups();
assert.equal(groups.length, requestPriorityColumns.length);
assert.deepEqual(groups.map((group) => group.key), ['i', 'ii', 'iii', 'iv']);
assert.equal(groups[0].label, 'Προτεραιότητα Σχηματισμού I');
assert.equal(groups[0].formation, requestPriorityColumns[0].formation);
for (const [columnIndex, group] of groups.entries()) {
  assert.equal(group.options.length, requestPriorityRows.length);
  for (const [rowIndex, option] of group.options.entries()) {
    const row = requestPriorityRows[rowIndex];
    assert.equal(option.code, row.codes[columnIndex]);
    assert.equal(option.label, `${row.codes[columnIndex]} - ${row.urgency} - ${row.description}`);
  }
}

console.log('officerSignatureFields.test.mjs: OK');
