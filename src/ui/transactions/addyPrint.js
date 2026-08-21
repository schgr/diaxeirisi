import { escapeHtml } from '../components/forms.js';
import { splitOfficerSignature } from '../officerSignature.js';
import { numberToGreekWords, renderCompositionDocumentFooter } from '../pages/sharesPage.js';
import { formatAddyDate, formatQuantity, isCommerceUnit } from './shared.js';
export function shouldOpenAddyDocument(documentData) {
  return hasCredit(documentData.items) || (hasCharge(documentData.items) && isCommerceUnit(documentData.transactionUnit));
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
          <strong>ΑΔΔΥ ${escapeHtml(documentData.id)} / ${formatAddyDate(documentData.documentDate)}</strong></p>
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
          <tr class="composition-column-numbers">
            <th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th>
          </tr>
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
      ${renderCompositionDocumentFooter({ financialOfficers: documentData.financialOfficers })}
      <div class="material-form-page-number">Σελίδα 1 από 1</div>
    </article>
  `;
}



export function renderAddyDocument(documentData) {
  const rows = Array.from({ length: 10 }, (_unused, index) => documentData.items[index] || null);
  const rawDocumentReference = `${String(documentData.id || '')} / ${formatAddyDate(documentData.documentDate)}`;
  const hasOnlyCredit = hasCredit(documentData.items) && !hasCharge(documentData.items);
  const isCommerceDocument = isCommerceUnit(documentData.transactionUnit);
  const hasCommerceChargeDocument = hasCharge(documentData.items) && isCommerceUnit(documentData.transactionUnit);
  const leftDocumentReference = hasCommerceChargeDocument ? '' : rawDocumentReference;
  const field17Reference = hasCommerceChargeDocument ? `Χ-${rawDocumentReference}` : '';
  const field19Reference = isCommerceDocument
    ? `Αρ. Τιμολογίου ${documentData.invoiceNumber || ''} / ${formatAddyDate(documentData.invoiceDate)}`
    : hasOnlyCredit ? `Π-${rawDocumentReference}` : '';
  const leftNotes = hasCharge(documentData.items) && !hasCommerceChargeDocument ? documentData.notes || '' : '';
  const rightNotes = hasCredit(documentData.items) || hasCommerceChargeDocument ? documentData.notes || '' : '';
  const field21Information = isCommerceDocument ? '' : rightNotes;
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
    <article class="addy-document-page print-document-area" style="position:relative;padding:0;overflow:hidden;">
      <img src="./assets/official-forms/addy-k2300-clean.png" alt="Αίτηση - Δικαιολογητικό Δοσοληψιών Υλικού" style="display:block;width:100%;height:100%;object-fit:fill;" />
      ${addyDocumentOverlay(firstValue(rows, 'column1'), 4.2, 21.4, 7.5, 10.1, 'addy-field-1')}
      ${addyDocumentOverlay(hasOnlyCredit || hasCommerceChargeDocument ? '' : leftDocumentReference, 11.7, 21.4, 11.1, 10.1, 'addy-field-2')}
      ${addyDocumentOverlay(leftNotes, 4.2, 31.5, 42.0, 10.3, 'addy-field-6')}
      ${addyDocumentOverlay(firstValue(rows, 'column18'), 56.7, 21.4, 10.8, 10.1, 'addy-field-18')}
      ${addyDocumentOverlay(field19Reference, 67.5, 21.4, 14.3, 10.1, 'addy-field-19')}
      ${isCommerceDocument
        ? addyCommerceInformationOverlay(documentData.commerceCompany)
        : addyDocumentOverlay(field21Information, 56.7, 31.5, 39.1, 10.3, 'addy-field-21')}
      ${renderAddyDocumentRowsOverlay(rows)}
      ${renderAddySignatureOverlay(leftPed, 4.2, 83.2, 12.6, 5.7, 'addy-field-15')}
      ${renderAddySignatureOverlay(leftManager, 16.8, 83.2, 13.6, 5.7, 'addy-field-16')}
      ${addyDocumentOverlay(field17Reference, 30.4, 79.7, 26.0, 9.2, 'addy-field-17')}
      ${renderAddySignatureOverlay(rightPed, 56.7, 83.2, 13.1, 5.7, 'addy-field-33')}
      ${renderAddySignatureOverlay(rightManager, 69.8, 83.2, 13.1, 5.7, 'addy-field-34')}
      ${renderAddyLineReinforcements()}
    </article>
    ${compositionDocument}
  `;
}



function renderAddyDocumentRowsOverlay(rows) {
  const columns = [
    { left: 13.5, width: 3.3, value: (item) => item?.column11 || '' },
    { left: 16.8, width: 13.6, value: (item) => item?.column12 || '' },
    { left: 30.4, width: 22.7, value: (item) => item?.column13 || '', className: 'addy-document-description-overlay' },
    { left: 53.1, width: 3.3, value: (item) => item?.column14 || '' },
    { left: 56.7, width: 3.9, value: (item) => item?.column22 ? formatQuantity(item.column22) : '' },
    { left: 60.6, width: 3.5, value: (item) => item?.column23 ? formatQuantity(item.column23) : '' },
    { left: 64.1, width: 3.4, value: (item) => item?.column24 || '' },
    { left: 67.5, width: 2.5, value: (item) => String(item?.column25 || '') },
    { left: 70.0, width: 3.4, value: (item) => item?.column26 ? formatQuantity(item.column26) : '' }
  ];
  return rows.map((item, rowIndex) => columns.map((column) => addyDocumentOverlay(
    column.value(item),
    column.left,
    55.3 + rowIndex * 2.44,
    column.width,
    2.44,
    column.className || ''
  )).join('')).join('');
}



function addyDocumentOverlay(value, left, top, width, height, className = '') {
  const isDescription = className.includes('addy-document-description-overlay');
  return `<div class="addy-document-overlay ${className}" style="position:absolute;display:flex;align-items:center;justify-content:${isDescription ? 'flex-start' : 'center'};left:${left}%;top:${top}%;width:${width}%;height:${height}%;padding:1px ${isDescription ? '4px' : '2px'};color:#000;font-family:Arial,sans-serif;font-size:clamp(10px,calc(0.8vw + 2px),14px);line-height:1.05;text-align:${isDescription ? 'left' : 'center'};box-sizing:border-box;overflow:hidden;">${escapeHtml(value ?? '')}</div>`;
}



function renderAddySignatureOverlay(value, left, top, width, height, className) {
  const signature = splitOfficerSignature(value);
  if (!signature.name && !signature.rank) {
    return addyDocumentOverlay('', left, top, width, height, className);
  }
  return `
    <div class="addy-document-overlay addy-document-signature-overlay ${className}"
      style="position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:center;left:${left}%;top:${top}%;width:${width}%;height:${height}%;padding:1px 2px;color:#000;font-family:Arial,sans-serif;font-size:${className.includes('addy-field-15') ? '9px' : 'clamp(10px,calc(0.8vw + 2px),14px)'};line-height:1.1;text-align:center;box-sizing:border-box;overflow:hidden;">
      <strong class="addy-document-signature-name">${escapeHtml(signature.name)}</strong>
      <span class="addy-document-signature-rank">${escapeHtml(signature.rank)}</span>
    </div>
  `;
}



function addyCommerceInformationOverlay(company = {}) {
  const lines = [
    company?.name || '',
    company?.taxNumber ? `ΑΦΜ: ${company.taxNumber}` : '',
    company?.address || ''
  ];
  return `
    <div class="addy-document-overlay addy-field-21 addy-commerce-information-overlay"
      style="position:absolute;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;left:56.7%;top:34.0%;width:39.1%;height:7.8%;padding:2px 5px;color:#000;font-family:Arial,sans-serif;font-size:clamp(10px,calc(0.8vw + 2px),14px);line-height:1.15;text-align:left;box-sizing:border-box;overflow:hidden;">
      ${lines.map((line) => `<span>${escapeHtml(line)}</span>`).join('')}
    </div>
  `;
}



function renderAddyLineReinforcements() {
  return `
    <span class="addy-k2300-line addy-field-13-border" aria-hidden="true" style="position:absolute;left:30.4%;top:41.7%;width:22.7%;height:38%;box-sizing:border-box;border:2px solid #000;pointer-events:none;"></span>
    <span class="addy-k2300-line addy-description-top-line" aria-hidden="true" style="position:absolute;left:30.4%;top:55.3%;width:22.7%;height:1px;background:#000;"></span>
    <span class="addy-k2300-line addy-description-bottom-line" aria-hidden="true" style="position:absolute;left:30.4%;top:79.7%;width:22.7%;height:1px;background:#000;"></span>
    <span class="addy-k2300-line addy-field-5-right-line" aria-hidden="true" style="position:absolute;left:56.68%;top:21.4%;width:1px;height:20.4%;background:#000;"></span>
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
  const selector = target === 'addy' ? '.addy-document-page' : '.addy-composition-document';
  const source = window.document.querySelector(`.addy-document-backdrop ${selector}`);
  if (!source) return;
  const printRoot = window.document.createElement('div');
  printRoot.className = 'isolated-print-root addy-isolated-print-root';
  printRoot.innerHTML = source.outerHTML;
  body.dataset.addyPrintTarget = target;
  body.dataset.isolatedDocumentPrint = 'true';
  body.appendChild(printRoot);
  try {
    await window.appApi.print.currentDocument({
      landscape: target === 'addy',
      title: target === 'addy'
        ? 'Αίτηση - Δικαιολογητικό Δοσοληψιών Υλικού'
        : 'Κατάσταση Συνθέσεως'
    });
  } finally {
    printRoot.remove();
    delete body.dataset.isolatedDocumentPrint;
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

export function hasCredit(items) {
  return items.some((item) => item.transactionType === 'Πίστωση');
}
