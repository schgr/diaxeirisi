import { escapeHtml } from '../components/forms.js';
import { formatQuantity } from './shared.js';
import { splitOfficerSignature } from '../officerSignature.js';

function renderCompositionRows(items, locked = false, measurementUnits = []) {
  if (!items.length) return '<tr class="empty-record-row"><td colspan="8" class="empty-table">Δεν έχει καταχωρηθεί σύνθεση.</td></tr>';
  const lockedAttribute = locked ? ' readonly' : '';
  const disabledAttribute = locked ? ' disabled' : '';
  return items.map((item) => `
    <tr data-composition-row>
      <td><input data-field="componentNominalNumber" value="${escapeHtml(item.componentNominalNumber || '')}"${lockedAttribute} /></td>
      <td><input data-field="componentDescription" value="${escapeHtml(item.componentDescription || '')}"${lockedAttribute} /></td>
      <td>
        <select data-field="measurementUnit"${disabledAttribute}>
          ${renderMeasurementUnitOptions(measurementUnits, item.measurementUnit)}
        </select>
      </td>
      <td><input data-field="projectedQuantity" type="number" min="0.001" step="0.001" value="${escapeHtml(item.quantityPerMaterial ?? item.quantity ?? item.projectedQuantity ?? '')}"${lockedAttribute} /></td>
      <td><span class="record-derived-value">${formatQuantity(item.projectedQuantity ?? '')}</span></td>
      <td><input data-field="notIssuedQuantity" type="number" min="0" step="0.001" value="${escapeHtml(item.notIssuedQuantity ?? '')}"${lockedAttribute} /></td>
      <td><input data-field="notes" value="${escapeHtml(item.notes || '')}"${lockedAttribute} /></td>
      <td><button class="danger-button" data-remove-record-row type="button"${disabledAttribute}>Διαγραφή</button></td>
    </tr>
  `).join('');
}

function setCompositionLocked(modal, locked) {
  modal.querySelectorAll('[data-composition-row] input').forEach((input) => {
    input.readOnly = locked;
  });
  modal.querySelectorAll('[data-composition-row] select').forEach((select) => {
    select.disabled = locked;
  });
  modal.querySelectorAll('[data-composition-row] [data-remove-record-row]').forEach((button) => {
    button.disabled = locked;
  });
  modal.querySelector('[data-add-composition-row]').disabled = locked;
  modal.querySelector('[data-save-composition]').disabled = locked;
  modal.querySelector('[data-edit-composition]').hidden = !locked;
  modal.querySelector('[data-composition-lock-state]').textContent = locked
    ? 'Η σύνθεση είναι κλειδωμένη.'
    : 'Η σύνθεση είναι σε επεξεργασία.';
}

function renderMeasurementUnitOptions(measurementUnits, selectedValue = '') {
  const selected = String(selectedValue || '').trim();
  const values = (measurementUnits || [])
    .map((unit) => String(unit?.name || unit || '').trim())
    .filter(Boolean);
  if (selected && !values.includes(selected)) values.unshift(selected);
  return [
    '<option value="">Επιλογή Μ/Μ</option>',
    ...values.map((value) =>
      `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(value)}</option>`
    )
  ].join('');
}

function renderChangeSheetRows(entries, compositionItems, locked = false) {
  if (!entries.length) return '<tr class="empty-record-row"><td colspan="7" class="empty-table">Δεν έχουν καταχωρηθεί μεταβολές.</td></tr>';
  const lockedAttribute = locked ? ' disabled' : '';
  return entries.map((entry) => {
    const lineNumber = Number(entry.componentLineNumber || 1);
    const component = compositionItems[lineNumber - 1] || {};
    return `
      <tr data-change-row>
        <td>
          <select data-field="componentLineNumber"${lockedAttribute}>
            ${compositionItems
              .map(
                (item, index) =>
                  `<option value="${index + 1}" ${index + 1 === lineNumber ? 'selected' : ''}>${escapeHtml(item.componentNominalNumber || `ΓΡΑΜΜΗ ${index + 1}`)}</option>`
              )
              .join('')}
          </select>
        </td>
        <td><span class="record-derived-value" data-component-description>${escapeHtml(component.componentDescription || '')}</span></td>
        <td><input data-field="changeDate" type="date" value="${escapeHtml(entry.changeDate || '')}"${lockedAttribute} /></td>
        <td>
          <select data-field="movementType"${lockedAttribute}>
            <option value="ΧΡΕΩΣΗ" ${entry.movementType !== 'ΠΙΣΤΩΣΗ' ? 'selected' : ''}>ΧΡΕΩΣΗ</option>
            <option value="ΠΙΣΤΩΣΗ" ${entry.movementType === 'ΠΙΣΤΩΣΗ' ? 'selected' : ''}>ΠΙΣΤΩΣΗ</option>
          </select>
        </td>
        <td><input data-field="quantity" type="number" min="0.001" step="0.001" value="${escapeHtml(entry.quantity || '')}"${lockedAttribute} /></td>
        <td><input data-field="notes" value="${escapeHtml(entry.notes || '')}"${lockedAttribute} /></td>
        <td><button class="danger-button" data-remove-record-row type="button"${lockedAttribute}>Διαγραφή</button></td>
      </tr>
    `;
  }).join('');
}

function setChangeSheetLocked(modal, locked) {
  modal.querySelectorAll('[data-change-row] input, [data-change-row] select').forEach((control) => {
    control.disabled = locked;
  });
  modal.querySelectorAll('[data-change-row] [data-remove-record-row]').forEach((button) => {
    button.disabled = locked;
  });
  modal.querySelector('[data-add-change-row]').disabled = locked;
  modal.querySelector('[data-save-change-sheet]').disabled = locked;
  modal.querySelector('[data-edit-change-sheet]').hidden = !locked;
  modal.querySelector('[data-change-sheet-lock-state]').textContent = locked
    ? 'Το φύλλο μεταβολών είναι κλειδωμένο.'
    : 'Το φύλλο μεταβολών είναι σε επεξεργασία.';
}

function collectCompositionRows(modal) {
  return [...modal.querySelectorAll('[data-composition-row]')].map((row) => collectRecordRow(row));
}

function collectChangeSheetRows(modal) {
  return [...modal.querySelectorAll('[data-change-row]')].map((row) => collectRecordRow(row));
}

function collectRecordRow(row) {
  return Object.fromEntries([...row.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.value]));
}

function renderCompositionDocument(card, settings) {
  const rowsPerPage = 16;
  const items = card.compositionItems || [];
  const pageCount = Math.max(1, Math.ceil(items.length / rowsPerPage));

  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const pageItems = items.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === pageCount - 1;
    return `
      <article class="composition-document-page print-document-area">
        ${isFirstPage ? renderCompositionDocumentHeader(card, settings) : ''}
        ${renderCompositionDocumentTable(pageItems, pageIndex * rowsPerPage)}
        ${isLastPage ? renderCompositionDocumentFooter(settings) : ''}
        <div class="material-form-page-number">Σελίδα ${pageIndex + 1} από ${pageCount}</div>
      </article>
    `;
  }).join('');
}

function renderCompositionDocumentHeader(card, settings) {
  return `
    <div class="material-form-code">ΔΥΠ/190</div>
    <h1>ΚΑΤΑΣΤΑΣΗ ΣΥΝΘΕΣΕΩΣ</h1>
    <div class="composition-document-details">
      <p class="composition-field-one"><span>1.</span> ΑΡΙΘΜΟΣ ΣΥΝΘΕΣΕΩΣ:
        <strong>${escapeHtml(card.share.shareNumber)}</strong></p>
      <div class="composition-details-row">
        <p><span>2.</span> ΑΡΙΘΜ. ΗΜΕΡΟΜ. ΔΙΚΑΙΟΛ. ΧΟΡΗΓΗΣΕΩΣ: ................................</p>
        <p><span>3.</span> ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ:
          <strong>${escapeHtml(settings?.serviceInfo?.serviceName || '')}</strong></p>
      </div>
      <p class="composition-title"><span>4.</span>
        ΣΥΝΘΕΣΗ (Α/Ο <strong>${escapeHtml(card.share.nominalNumber)}</strong>
        - ΠΕΡΙΓΡΑΦΗ <strong>${escapeHtml(card.share.description)}</strong>
        - ΤΙΤΛΟΣ ΣΥΛΛΟΓΗΣ)</p>
    </div>
  `;
}

function renderCompositionDocumentTable(items, startIndex) {
  return `
    <table class="composition-document-table">
      <thead>
        <tr>
          <th rowspan="3">Α/Α</th>
          <th rowspan="3">ΑΡΙΘΜΟΣ<br />ΟΝΟΜΑΣΤΙΚΟΥ</th>
          <th rowspan="3">ΠΕΡΙΓΡΑΦΗ</th>
          <th rowspan="3">ΜΟΝΑΔΑ<br />ΜΕΤΡΗΣΗΣ</th>
          <th colspan="4">ΠΟΣΟΤΗΤΑ</th>
        </tr>
        <tr>
          <th colspan="2">ΠΡΟΒΛΕΠΟΜ.</th>
          <th colspan="2">ΜΗ ΧΟΡΗΓΗΘΕΙΣΑ</th>
        </tr>
        <tr>
          <th>ΑΡΙΘ.</th><th>ΟΛΟΓΡΑΦ.</th><th>ΑΡΙΘ.</th><th>ΟΛΟΓΡΑΦ.</th>
        </tr>
        <tr class="composition-column-numbers">
          <th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => renderCompositionDocumentRow(item, startIndex + index + 1)).join('')}
      </tbody>
    </table>
  `;
}

function renderCompositionDocumentRow(item, rowNumber) {
  return `
    <tr>
      <td>${rowNumber}</td>
      <td>${escapeHtml(item.componentNominalNumber)}</td>
      <td class="material-description-cell">${escapeHtml(item.componentDescription)}</td>
      <td>${escapeHtml(item.measurementUnit)}</td>
      <td>${formatQuantity(item.projectedQuantity)}</td>
      <td>${escapeHtml(numberToGreekWords(item.projectedQuantity))}</td>
      <td>${formatQuantity(item.notIssuedQuantity)}</td>
      <td>${escapeHtml(numberToGreekWords(item.notIssuedQuantity))}</td>
    </tr>
  `;
}

function renderCompositionDocumentFooter(settings = {}) {
  const ped = splitOfficerSignature(settings?.financialOfficers?.ped || '');
  const manager = splitOfficerSignature(settings?.financialOfficers?.manager || '');
  return `
    <div class="composition-document-footer">
      <div class="composition-footer-field composition-footer-field-13">
        <span><b>13.</b> ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ</span>
        <div class="composition-footer-signatures">
          ${renderCompositionSignature('Ο Π.Ε.Δ', ped, true)}
          ${renderCompositionSignature('Ο ΔΧΣΤΗΣ', manager)}
        </div>
      </div>
      <div class="composition-footer-field composition-footer-field-14">
        <span><b>14.</b> ΠΑΡΑΛΑΜΒΑΝΟΥΣΑ ΜΟΝΑΔΑ</span>
        <small>Αριθμ. Ημερ. Ευρετ. Δικ. Εξωτ. Δοσ.</small>
        <small class="composition-footer-reference">......../........................ 20....</small>
        <div class="composition-footer-signatures composition-footer-signatures-blank">
          ${renderCompositionSignature('Ο Π.Ε.Δ', {}, true)}
          ${renderCompositionSignature('Ο ΔΧΣΤΗΣ')}
        </div>
      </div>
    </div>
  `;
}

function renderCompositionSignature(role, officer = {}, considered = false) {
  return `
    <div class="composition-signature">
      ${considered ? '<small class="composition-signature-considered">ΘΕΩΡΗΘΗΚΕ</small>' : ''}
      <span>${role}</span>
      <strong>${escapeHtml(officer.name || '')}</strong>
      <em>${escapeHtml(officer.rank || '')}</em>
    </div>
  `;
}

function numberToGreekWords(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  if (!Number.isInteger(number)) {
    const [integerPart, decimalPart] = String(number).split('.');
    return `${integerToGreekWords(Number(integerPart))} ΚΟΜΜΑ ${decimalPart
      .split('')
      .map((digit) => integerToGreekWords(Number(digit)))
      .join(' ')}`;
  }
  return integerToGreekWords(number);
}

function integerToGreekWords(value) {
  const number = Math.max(0, Math.trunc(value));
  const units = ['', 'ΕΝΑ', 'ΔΥΟ', 'ΤΡΙΑ', 'ΤΕΣΣΕΡΑ', 'ΠΕΝΤΕ', 'ΕΞΙ', 'ΕΠΤΑ', 'ΟΚΤΩ', 'ΕΝΝΕΑ'];
  const teens = ['ΔΕΚΑ', 'ΕΝΤΕΚΑ', 'ΔΩΔΕΚΑ', 'ΔΕΚΑΤΡΙΑ', 'ΔΕΚΑΤΕΣΣΕΡΑ', 'ΔΕΚΑΠΕΝΤΕ', 'ΔΕΚΑΕΞΙ', 'ΔΕΚΑΕΠΤΑ', 'ΔΕΚΑΟΚΤΩ', 'ΔΕΚΑΕΝΝΕΑ'];
  const tens = ['', '', 'ΕΙΚΟΣΙ', 'ΤΡΙΑΝΤΑ', 'ΣΑΡΑΝΤΑ', 'ΠΕΝΗΝΤΑ', 'ΕΞΗΝΤΑ', 'ΕΒΔΟΜΗΝΤΑ', 'ΟΓΔΟΝΤΑ', 'ΕΝΕΝΗΝΤΑ'];
  const hundreds = ['', 'ΕΚΑΤΟΝ', 'ΔΙΑΚΟΣΙΑ', 'ΤΡΙΑΚΟΣΙΑ', 'ΤΕΤΡΑΚΟΣΙΑ', 'ΠΕΝΤΑΚΟΣΙΑ', 'ΕΞΑΚΟΣΙΑ', 'ΕΠΤΑΚΟΣΙΑ', 'ΟΚΤΑΚΟΣΙΑ', 'ΕΝΝΙΑΚΟΣΙΑ'];

  if (number === 0) return 'ΜΗΔΕΝ';
  if (number >= 1000000) return String(number);

  const parts = [];
  const thousandsValue = Math.floor(number / 1000);
  let remainder = number % 1000;
  if (thousandsValue) {
    parts.push(thousandsValue === 1 ? 'ΧΙΛΙΑ' : `${integerToGreekWords(thousandsValue)} ΧΙΛΙΑΔΕΣ`);
  }
  if (remainder >= 100) {
    parts.push(hundreds[Math.floor(remainder / 100)]);
    remainder %= 100;
  }
  if (remainder >= 20) {
    parts.push(tens[Math.floor(remainder / 10)]);
    remainder %= 10;
  } else if (remainder >= 10) {
    parts.push(teens[remainder - 10]);
    remainder = 0;
  }
  if (remainder > 0) parts.push(units[remainder]);
  return parts.join(' ');
}

export { renderCompositionRows, setCompositionLocked, renderChangeSheetRows, setChangeSheetLocked, collectCompositionRows, collectChangeSheetRows, collectRecordRow, renderCompositionDocument, renderCompositionDocumentFooter, numberToGreekWords };
