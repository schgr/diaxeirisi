import { escapeHtml } from '../components/forms.js';
import { splitOfficerSignature } from '../officerSignature.js';
import { numberToGreekWords } from '../pages/sharesPage.js';
import { formatDate, formatQuantity, isCommerceUnit } from './shared.js';
export function shouldOpenAddyDocument(documentData) {
  return hasCredit(documentData.items) || hasCommerceCharge(documentData.items);
}



export function openAddyDocument(documentData) {
  const existing = window.document.querySelector('.addy-document-backdrop');
  if (existing) existing.remove();

  const backdrop = window.document.createElement('div');
  backdrop.className = 'modal-backdrop addy-document-backdrop';
  backdrop.innerHTML = `
    <div class="request-document-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">ΑΔΔΥ</p>
          <h2>Αίτηση - Δικαιολογητικό Δοσοληψιών Υλικού</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-close-addy-document type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-addy-document="addy" type="button">Εκτύπωση ΑΔΔΥ</button>
          ${documentData.items.some((item) => item.composition?.length)
            ? '<button class="primary-button" data-print-addy-document="composition" type="button">Εκτύπωση Σύνθεσης</button>'
            : ''}
        </div>
      </header>
      <div class="request-document-preview">
        ${renderAddyDocument(documentData)}
      </div>
    </div>
  `;

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-addy-document]')) {
      backdrop.remove();
      return;
    }

    const printButton = event.target.closest('[data-print-addy-document]');
    if (printButton) {
      printAddyDocument(printButton.dataset.printAddyDocument).catch((error) => {
        console.error('ADDY print failed:', error);
        window.alert('Η εκτύπωση δεν ξεκίνησε. Δοκιμάστε ξανά ή ελέγξτε τον εκτυπωτή.');
      });
    }
  });

  window.document.body.appendChild(backdrop);
}



export function renderAddyCompositionDocument(documentData, items) {
  const compositionRows = items.flatMap((item) =>
    item.composition.map((component) => ({ item, component }))
  );
  const compositionNumbers = items.map((item) => item.column24).filter(Boolean).join(', ');
  const compositionTitles = items
    .map((item) => `Α/Ο ${item.column12} - ${item.column13}`)
    .join(' · ');

  return `
    <article class="composition-document-page print-document-area addy-composition-document">
      <div class="material-form-code">ΔΥΠ/190</div>
      <h1>ΚΑΤΑΣΤΑΣΗ ΣΥΝΘΕΣΕΩΣ</h1>
      <div class="composition-document-details">
        <p><span>1.</span> ΑΡΙΘΜΟΣ ΣΥΝΘΕΣΕΩΣ: <strong>${escapeHtml(compositionNumbers)}</strong></p>
        <p><span>2.</span> ΑΡΙΘΜ. ΗΜΕΡΟΜ. ΔΙΚΑΙΟΛ. ΧΟΡΗΓΗΣΕΩΣ:
          <strong>ΑΔΔΥ ${escapeHtml(documentData.id)} / ${formatDate(documentData.documentDate)}</strong></p>
        <p><span>3.</span> ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ:
          <strong>${escapeHtml(documentData.transactionUnit)}</strong></p>
        <p class="composition-title"><span>4.</span>
          ΣΥΝΘΕΣΗ (<strong>${escapeHtml(compositionTitles)}</strong>)</p>
      </div>
      <table class="composition-document-table">
        <thead>
          <tr>
            <th rowspan="3">Α/Α</th><th rowspan="3">ΑΡΙΘΜΟΣ<br />ΟΝΟΜΑΣΤΙΚΟΥ</th>
            <th rowspan="3">ΠΕΡΙΓΡΑΦΗ</th><th rowspan="3">ΜΟΝΑΔΑ<br />ΜΕΤΡΗΣΗΣ</th>
            <th colspan="4">ΠΟΣΟΤΗΤΑ</th>
          </tr>
          <tr><th colspan="2">ΠΡΟΒΛΕΠΟΜ.</th><th colspan="2">ΜΗ ΧΟΡΗΓΗΘΕΙΣΑ</th></tr>
          <tr><th>ΑΡΙΘ.</th><th>ΟΛΟΓΡΑΦ.</th><th>ΑΡΙΘ.</th><th>ΟΛΟΓΡΑΦ.</th></tr>
        </thead>
        <tbody>
          ${compositionRows.map(({ component }, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${escapeHtml(component.componentNominalNumber)}</td>
              <td class="material-description-cell">${escapeHtml(component.componentDescription)}</td>
              <td>${escapeHtml(component.measurementUnit)}</td>
              <td>${formatQuantity(component.projectedQuantity)}</td>
              <td>${escapeHtml(numberToGreekWords(component.projectedQuantity))}</td>
              <td>${formatQuantity(component.notIssuedQuantity)}</td>
              <td>${escapeHtml(numberToGreekWords(component.notIssuedQuantity))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="composition-document-footer">
        <span>13. ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ</span>
        <span>14. ΠΑΡΑΛΑΜΒΑΝΟΥΣΑ ΜΟΝΑΔΑ</span>
      </div>
    </article>
  `;
}



export function renderAddyDocument(documentData) {
  const rows = Array.from({ length: 10 }, (_unused, index) => documentData.items[index] || null);
  const rawDocumentReference = `${String(documentData.id || '')} / ${formatDate(documentData.documentDate)}`;
  const hasOnlyCredit = hasCredit(documentData.items) && !hasCharge(documentData.items);
  const hasCommerceChargeDocument = hasCommerceCharge(documentData.items);
  const leftDocumentReference = hasCommerceChargeDocument ? '' : rawDocumentReference;
  const field17Reference = hasCommerceChargeDocument ? `Χ-${rawDocumentReference}` : '';
  const field19Reference = hasOnlyCredit ? `Π-${rawDocumentReference}` : '';
  const leftNotes = hasCharge(documentData.items) && !hasCommerceChargeDocument ? documentData.notes || '' : '';
  const rightNotes = hasCredit(documentData.items) || hasCommerceChargeDocument ? documentData.notes || '' : '';
  const leftPed = hasCharge(documentData.items) ? documentData.financialOfficers?.ped : '';
  const leftManager = hasCharge(documentData.items) ? documentData.financialOfficers?.manager : '';
  const rightPed = hasOnlyCredit ? documentData.financialOfficers?.ped : '';
  const rightManager = hasOnlyCredit ? documentData.financialOfficers?.manager : '';

  const compositionItems = documentData.items
    .filter((item) => item.transactionType === 'Πίστωση' && item.composition?.length);
  const compositionDocument = compositionItems.length
    ? renderAddyCompositionDocument(documentData, compositionItems)
    : '';

  return `
    <article class="addy-document-page print-document-area">
      <div class="addy-document-code">Κ 2300/ΔΥΠ</div>
      <h1>ΑΙΤΗΣΗ - ΔΙΚΑΙΟΛΟΓΗΤΙΚΟ ΔΟΣΟΛΗΨΙΩΝ ΥΛΙΚΟΥ</h1>
      <table class="addy-document-table">
        <colgroup>
          <col class="addy-doc-narrow" />
          <col class="addy-doc-narrow" />
          <col class="addy-doc-narrow" />
          <col class="addy-doc-narrow" />
          <col class="addy-doc-reason" />
          <col class="addy-doc-priority" />
          <col class="addy-doc-description" />
          <col class="addy-doc-small" />
          <col class="addy-doc-narrow" />
          <col class="addy-doc-narrow" />
          <col class="addy-doc-small" />
          <col class="addy-doc-narrow" />
          <col class="addy-doc-small" />
          <col class="addy-doc-small" />
          <col class="addy-doc-narrow" />
          <col class="addy-doc-small" />
          <col class="addy-doc-narrow" />
          <col class="addy-doc-small" />
          <col class="addy-doc-small" />
        </colgroup>
        <tbody>
          <tr>
            <td colspan="8" class="addy-doc-section-title">ΣΥΜΠΛΗΡΩΝΕΤΑΙ ΑΠΟ ΤΗ ΜΟΝΑΔΑ</td>
            <td colspan="11" class="addy-doc-section-title addy-doc-right-block">ΣΥΜΠΛΗΡΩΝΕΤΑΙ ΑΠΟ ΤΗ ΜΟΝΑΔΑ ΕΦΟΔ.</td>
          </tr>
          <tr>
            <td colspan="2">${addyTopCell('ΜΟΝΑΔΑ', firstValue(rows, 'column1'), '1')}</td>
            <td colspan="2">${addyTopCell('ΑΡΙΘΜΟΣ -<br />ΗΜΕΡΟΜΗΝΙΑ', hasOnlyCredit || hasCommerceCharge ? '' : leftDocumentReference, '2')}</td>
            <td colspan="1" class="addy-doc-reason-cell">${addyTopCell('ΔΙΚΑΙΟΛΟΓΙΑ', '', '3')}</td>
            <td colspan="1">${addyTopCell('ΠΡΟΤΕΡΑΙΟΤΗΤΑ', '', '4')}</td>
            <td colspan="2" rowspan="2">${addyTopCell('ΥΠΟΓΡΑΦΗ<br />ΑΙΤΟΥΝΤΟΣ', '', '5')}</td>
            <td colspan="3" class="addy-doc-right-block">${addyTopCell('ΜΟΝΑΔΑ<br />ΕΦΟΔ.', firstValue(rows, 'column18'), '18')}</td>
            <td colspan="4">${addyTopCell('ΑΡΙΘ. - ΗΜΕΡΟΜΗΝΙΑ<br />ΔΙΚ/ΚΟΥ', field19Reference, '19')}</td>
            <td colspan="4">${addyTopCell('ΕΙΔΟΣ<br />ΧΟΡΗΓΗΣΗΣ', '', '20')}</td>
          </tr>
          <tr>
            <td colspan="6" class="addy-doc-info">ΠΛΗΡΟΦΟΡΙΕΣ<br />${escapeHtml(leftNotes)}${addyCellNumber('6')}</td>
            <td colspan="11" class="addy-doc-info addy-doc-right-block">ΠΛΗΡΟΦΟΡΙΕΣ<br />${escapeHtml(rightNotes)}${addyCellNumber('21')}</td>
          </tr>
          <tr class="addy-doc-vertical-row">
            <td>${addyVerticalHeader('Προβλ.', '7')}</td>
            <td>${addyVerticalHeader('Υπαρχ.', '8')}</td>
            <td>${addyVerticalHeader('Αιτ.', '9')}</td>
            <td>${addyVerticalHeader('Επιστρ.', '10')}</td>
            <td>${addyVerticalHeader('Στοιχεία<br />Καταχώρισης', '11')}</td>
            <td class="addy-doc-horizontal">${addyHorizontalHeader('Αριθμός<br />Ονομαστικού', '12')}</td>
            <td class="addy-doc-horizontal">${addyHorizontalHeader('Περιγραφή', '13')}</td>
            <td>${addyVerticalHeader('Μονάδα<br />Μέτρησης', '14')}</td>
            <td class="addy-doc-right-block">${addyVerticalHeader('Χορηγ.', '22')}</td>
            <td>${addyVerticalHeader('Οφειλ.', '23')}</td>
            <td>${addyVerticalHeader('Στοιχεία<br />Καταχώρησης', '24')}</td>
            <td>${addyVerticalHeader('Θέση', '25')}</td>
            <td>${addyVerticalHeader('Τιμή Μονάδος', '26')}</td>
            <td>${addyVerticalHeader('Μονάδα<br />Γεν. Δχσης', '27')}</td>
            <td>${addyVerticalHeader('Προβλ.<br />Ποσότητα', '28')}</td>
            <td>${addyVerticalHeader('Στοιχεία<br />Καταχώρησης', '29')}</td>
            <td>${addyVerticalHeader('Θέση', '30')}</td>
            <td>${addyVerticalHeader('Μονάδα Β&apos; Γεν.<br />Διαχ.', '31')}</td>
            <td>${addyVerticalHeader('Μονάδα<br />Προμηθέα', '32')}</td>
          </tr>
          ${rows.map(renderAddyDocumentRow).join('')}
          <tr>
            <td colspan="3" class="addy-doc-signature">${addySignatureCell('Υπογραφή ΠΕΔ<br />Σφραγίδα Μονάδας', '15', leftPed)}</td>
            <td colspan="3" class="addy-doc-signature">${addySignatureCell('Υπογραφή Διαχειριστή', '16', leftManager)}</td>
            <td colspan="2" class="addy-doc-signature">${addySignatureCell('Αύξ. Αριθ. Δοσοληψίας - Ημερομηνία', '17', field17Reference)}</td>
            <td colspan="4" class="addy-doc-signature addy-doc-right-block">${addySignatureCell('Ο Εγκρίνων', '33', rightPed)}</td>
            <td colspan="4" class="addy-doc-signature">${addySignatureCell('Ο Χορηγών', '34', rightManager)}</td>
            <td colspan="3" class="addy-doc-signature">${addySignatureCell('Ο Παραλαμβάνων', '35')}</td>
          </tr>
        </tbody>
      </table>
      <div class="addy-document-footer">
        <span>ΕΦΕΔ 101</span>
        <strong>ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ ΚΑΙ ΓΙΑ ΠΡΟΜΗΘΕΙΑ ΥΛΙΚΩΝ ΑΠΟ ΤΟ ΕΜΠΟΡΙΟ</strong>
        <span></span>
      </div>
    </article>
    ${compositionDocument}
  `;
}



export function addyTopCell(label, value, number) {
  return `
    <div class="addy-doc-cell-content">
      <div>${label}</div>
      <strong>${escapeHtml(value || '')}</strong>
      ${addyCellNumber(number)}
    </div>
  `;
}



export function addyCellNumber(number) {
  return `<span class="addy-doc-number">${number}</span>`;
}



export function addyVerticalHeader(label, number) {
  return `
    <div class="addy-doc-header-stack">
      <div class="addy-doc-vertical-label">${label}</div>
      ${addyCellNumber(number)}
    </div>
  `;
}



export function addyHorizontalHeader(label, number) {
  return `
    <div class="addy-doc-header-stack addy-doc-header-horizontal">
      <div>${label}</div>
      ${addyCellNumber(number)}
    </div>
  `;
}



export function addySignatureCell(label, number, value = '') {
  const signature = splitOfficerSignature(value);
  return `
    <div class="addy-doc-cell-content addy-doc-signature-content">
      <div>${label}</div>
      <span class="addy-doc-signature-person">
        ${signature.name || signature.rank ? `<strong>${escapeHtml(signature.name)}</strong><em>${escapeHtml(signature.rank)}</em>` : `<strong>${escapeHtml(value || '')}</strong>`}
      </span>
      ${addyCellNumber(number)}
    </div>
  `;
}



export async function printAddyDocument(target) {
  const body = window.document.body;
  body.dataset.addyPrintTarget = target;
  try {
    await window.appApi.print.currentDocument({ landscape: target === 'addy' });
  } finally {
    delete body.dataset.addyPrintTarget;
  }
}



export async function printLandscapeDocument() {
  await window.appApi.print.currentDocument({ landscape: true });
}



export function renderAddyDocumentRow(item) {
  return `
    <tr class="addy-doc-item-row">
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td>${item ? escapeHtml(item.column11) : ''}</td>
      <td>${item ? escapeHtml(item.column12) : ''}</td>
      <td class="addy-doc-description-cell">${item ? escapeHtml(item.column13) : ''}</td>
      <td>${item ? escapeHtml(item.column14) : ''}</td>
      <td class="addy-doc-right-block">${item && item.column22 ? formatQuantity(item.column22) : ''}</td>
      <td>${item && item.column23 ? formatQuantity(item.column23) : ''}</td>
      <td>${item ? escapeHtml(item.column24) : ''}</td>
      <td>${item ? escapeHtml(String(item.column25 || '')) : ''}</td>
      <td>${item && item.column26 ? formatQuantity(item.column26) : ''}</td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
      <td></td>
    </tr>
  `;
}



export function firstValue(rows, key) {
  const row = rows.find((item) => item && item[key]);
  return row ? row[key] : '';
}



export function hasCharge(items) {
  return items.some((item) => item.transactionType === 'Χρέωση');
}

export function hasCommerceCharge(items) {
  return items.some((item) => item.transactionType === 'Χρέωση' && isCommerceUnit(item.materialType));
}



export function hasCredit(items) {
  return items.some((item) => item.transactionType === 'Πίστωση');
}
