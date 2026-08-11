import { escapeHtml } from '../components/forms.js';
import { showAlertDialog } from '../components/dialogs.js';
import { splitOfficerSignature } from '../officerSignature.js';
import { formatDate, formatQuantity } from './shared.js';
import { printLandscapeDocument } from './addyPrint.js';
import {
  getAitiologiaCodeForIssueReason,
  shouldFillExhpSecondOpinion
} from './exhpFormModuleBridge.js';

const EXHP_FIELD_23_COMMANDER_EXCLUDED_REASON_CODES = new Set(['a', 'd', 'th', 'i', 'ib']);
export function openExhpDocument(documentData) {
  const existing = window.document.querySelector('.exhp-document-backdrop');
  if (existing) existing.remove();

  const backdrop = window.document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop exhp-document-backdrop';
  backdrop.innerHTML = `
    <div class="request-document-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">ΕΧΠ</p>
          <h2>Εντολή Χρεωπιστώσεως</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button active" data-exhp-preview-side="front" type="button">Εμπρός</button>
          <button class="secondary-button" data-exhp-preview-side="back" type="button">Πίσω</button>
          <button class="secondary-button" data-close-exhp-document type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-exhp-document type="button">Εκτύπωση</button>
        </div>
      </header>
      <div class="request-document-preview">
        ${renderExhpDocument(documentData)}
      </div>
    </div>
  `;
  backdrop.dataset.exhpPreviewSide = 'front';

  backdrop.querySelector('[data-close-exhp-document]').addEventListener('click', (event) => {
    event.stopPropagation();
    backdrop.remove();
  });

  backdrop.querySelector('[data-print-exhp-document]').addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      await printLandscapeDocument();
    } catch (error) {
      console.error('EXHP print failed:', error);
      await showAlertDialog(
        'Η εκτύπωση δεν ξεκίνησε. Δοκιμάστε ξανά ή ελέγξτε τον εκτυπωτή.',
        { title: 'Αποτυχία εκτύπωσης' }
      );
    }
  });

  backdrop.addEventListener('click', (event) => {
    const sideButton = event.target.closest('[data-exhp-preview-side]');
    if (sideButton) {
      backdrop.dataset.exhpPreviewSide = sideButton.dataset.exhpPreviewSide;
      backdrop.querySelectorAll('[data-exhp-preview-side]').forEach((button) => {
        button.classList.toggle('active', button === sideButton);
      });
      return;
    }

    if (event.target === backdrop) {
      backdrop.remove();
    }
  });

  window.document.body.appendChild(backdrop);
}



export function renderExhpDocument(documentData) {
  const numberedItems = documentData.items.map((item, index) => ({ ...item, exhpSerial: index + 1 }));
  const chargeItems = numberedItems.filter((item) => item.transactionType === 'Χρέωση');
  const creditItems = numberedItems.filter((item) => item.transactionType === 'Πίστωση');
  const pageCount = Math.max(1, Math.ceil(chargeItems.length / 14), Math.ceil(creditItems.length / 14));
  const fillSecondOpinion = shouldFillExhpSecondOpinion(
    documentData.reason,
    documentData.reasonCode || '',
    documentData.reasonTexts?.secondOpinion
  );
  const showCommanderInField23 = shouldShowCommanderInExhpField23(
    documentData.reason,
    documentData.reasonCode || ''
  );
  const supportingDocuments = [
    ...documentData.items.map((item) => item.supportingDocuments).filter(Boolean),
    ...(documentData.supports || [])
      .filter((support) => support.completed)
      .map((support) => [support.documentCode, support.documentReference || support.title].filter(Boolean).join(' ')),
    documentData.otherSupportDocument
  ].filter(Boolean);
  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const chargePage = chargeItems.slice(pageIndex * 14, pageIndex * 14 + 14);
    const creditPage = creditItems.slice(pageIndex * 14, pageIndex * 14 + 14);
    const frontPageNumber = pageIndex + 1;
    return `
      <article class="exhp-faithful-page exhp-paged-document exhp-faithful-front-side print-document-area">
        <div class="exhp-page-content">
          <img src="./assets/official-forms/exhp-front-clean.png" alt="Εντολή Χρεωπιστώσεως - εμπρός πλευρά" />
          ${exhpStaticOverlay(documentData.unit, 14.2, 16.4, 10.8, 2.2, 'exhp-unit-overlay')}
          ${exhpStaticOverlay(documentData.registryNumber, 83.2, 14.2, 9.2, 2.2)}
          ${exhpStaticOverlay(formatDate(documentData.date), 81.6, 17.0, 10.5, 2.2, 'exhp-date-overlay')}
          ${chargeItems.length ? exhpStaticOverlay(documentData.managementType || '', 20.0, 22.0, 27.5, 2.4, 'exhp-management-type') : ''}
          ${creditItems.length ? exhpStaticOverlay(documentData.managementType || '', 69.0, 22.0, 27.5, 2.4, 'exhp-management-type') : ''}
          ${renderFaithfulExhpRows(chargePage, false)}
          ${renderFaithfulExhpRows(creditPage, true)}
          ${renderExhpFrontFooterLabels()}
          ${renderExhpFrontSignature(documentData.financialOfficers?.manager, 1.8, 76.1, 10.8, 2.7, 'exhp-field-15-signature')}
          ${renderExhpFrontSignature(documentData.financialOfficers?.ped, 47.2, 75.35, 11.5, 2.7, 'exhp-field-18-signature exhp-top-line-signature')}
          ${renderExhpFrontSignature(documentData.financialOfficers?.manager, 79.5, 76.1, 8.0, 2.7, 'exhp-field-15-signature exhp-credit-field-15-signature')}
          ${exhpStaticOverlay(documentData.reason, 2.7, 81.0, 45.8, 5.1, 'material-description-overlay')}
          ${renderExhpSupportingDocuments(supportingDocuments)}
          ${exhpStaticOverlay(documentData.notes || '', 2.7, 89.0, 45.8, 4.3, 'material-description-overlay')}
          ${exhpStaticOverlay(documentData.approvalReference || '', 51.0, 89.0, 23.0, 4.3)}
          ${showCommanderInField23
            ? renderExhpFrontSignature(documentData.financialOfficers?.commander, 76.0, 89.0, 20.5, 4.3, 'exhp-field-23-signature')
            : ''}
        </div>
        ${renderExhpPageNumber(frontPageNumber, pageCount)}
      </article>
      <article class="exhp-faithful-page exhp-paged-document exhp-faithful-back-side print-document-area">
        <div class="exhp-page-content">
          <img src="./assets/official-forms/exhp-back-clean.png" alt="Εντολή Χρεωπιστώσεως - πίσω πλευρά" />
          ${renderExhpBackOverlay(documentData.reasonTexts?.recommendation, documentData.date, documentData.financialOfficers?.manager, 'ΔΧΣΤΗΣ', 0)}
          ${renderExhpBackOverlay(documentData.reasonTexts?.firstOpinion, documentData.date, documentData.financialOfficers?.ped, 'Π.Ε.Δ', 1)}
          ${fillSecondOpinion ? renderExhpBackOverlay(documentData.reasonTexts?.secondOpinion, documentData.date, documentData.financialOfficers?.commander, 'ΔΚΤΗΣ', 2) : ''}
        </div>
      </article>
    `;
  }).join('');
}



export function renderFaithfulExhpRows(items, isCredit) {
  const columns = isCredit
    ? [
        { left: 49.95, width: 3.2, value: (item) => item.exhpSerial },
        { left: 53.25, width: 13.1, value: (item) => item.nominalNumber },
        { left: 66.4, width: 14.1, value: (item) => item.description, className: 'material-description-overlay' },
        { left: 80.65, width: 2.45, value: (item) => item.ledgerSerial },
        { left: 83.25, width: 2.4, value: (item) => item.measurementUnit },
        { left: 85.8, width: 2.45, value: (item) => formatQuantity(item.quantity) }
      ]
    : [
        { left: 1.65, width: 3.7, value: (item) => item.exhpSerial },
        { left: 5.45, width: 12.25, value: (item) => item.nominalNumber },
        { left: 17.85, width: 13.0, value: (item) => item.description, className: 'material-description-overlay' },
        { left: 30.95, width: 2.35, value: (item) => item.ledgerSerial },
        { left: 33.42, width: 3.25, value: (item) => item.measurementUnit },
        { left: 36.85, width: 2.45, value: (item) => formatQuantity(item.quantity) }
      ];

  return items.map((item, rowIndex) => columns.map((column) => exhpStaticOverlay(
    column.value(item),
    column.left,
    38.55 + rowIndex * 2.45,
    column.width,
    2.45,
    `exhp-row-overlay ${column.className || ''}`.trim()
  )).join('')).join('');
}



export function renderExhpBackOverlay(text, date, officer, role, sectionIndex) {
  const sectionTop = [17.0, 33.45, 52.0][sectionIndex];
  const signature = splitOfficerSignature(officer);
  return `
    ${exhpStaticOverlay(text || '', 2.8, sectionTop + 5.3, 61.5, 9.5, 'exhp-back-copy material-description-overlay')}
    ${exhpStaticOverlay(formatDate(date), 78.2, sectionTop + 2.1, 13.0, 2.2, 'exhp-back-value')}
    ${exhpStaticOverlay(renderExhpOfficerSignature(officer), 67.0, sectionTop + 6.0, 28.0, 5.5, 'exhp-back-signature', true)}
    ${exhpStaticOverlay(signature.name || signature.rank ? role : '', 78.2, sectionTop + 12.0, 13.0, 2.2, 'exhp-back-value')}
  `;
}



export function renderExhpOfficerSignature(value) {
  const signature = splitOfficerSignature(value);
  if (!signature.name && !signature.rank) return '';
  return `
    <span class="exhp-officer-signature">
      <strong>${escapeHtml(signature.name)}</strong>
      <em>${escapeHtml(signature.rank)}</em>
    </span>
  `;
}



export function renderExhpFrontSignature(value, left, top, width, height, className = '') {
  return exhpStaticOverlay(
    renderExhpOfficerSignature(value),
    left,
    top,
    width,
    height,
    `exhp-front-signature ${className}`.trim(),
    true
  );
}



export function renderExhpFrontFooterLabels() {
  const masks = [
    [1.75, 24.65],
    [47.45, 9.65],
    [78.15, 20.1]
  ].map(([left, width]) => exhpStaticOverlay(
    '',
    left,
    73.05,
    width,
    5.55,
    'exhp-front-footer-label-mask'
  )).join('');
  const labels = [
    ['(15) Ο ΔΙΑΧΕΙΡ.', 1.75, 8.5, 'exhp-footer-label-left'],
    ['(16) Ο ΒΟΗΘΟΣ ΓΕΝ ΔΙΑΧ', 12.55, 13.4, 'exhp-footer-label-left'],
    ['(18) ΤΟ ΛΟΓΙΣΤΗΡΙΟ', 47.35, 9.8, 'exhp-footer-label-left'],
    ['(15) Ο ΔΙΑΧΕΙΡ.', 79.15, 8.4, 'exhp-footer-label-right'],
    ['(16) Ο ΒΟΗΘΟΣ ΓΕΝ ΔΙΑΧ', 87.65, 10.65, 'exhp-footer-label-right']
  ];
  return masks + labels.map(([label, left, width, className]) => exhpStaticOverlay(
    label,
    left,
    73.25,
    width,
    1.65,
    `exhp-front-footer-label ${className}`
  )).join('');
}



export function renderExhpSupportingDocuments(documents = []) {
  const normalizedDocuments = documents.flatMap((document) => String(document || '')
    .split(/\r?\n|\s*[;|·•]\s*/gu)
    .map((entry) => entry.trim())
    .filter(Boolean));
  const visibleDocuments = normalizedDocuments.slice(0, 8);
  if (normalizedDocuments.length > 8) {
    visibleDocuments[7] = normalizedDocuments.slice(7).join(' · ');
  }
  const positions = [
    [50.8, 81.0],
    [50.8, 82.25],
    [50.8, 83.5],
    [50.8, 84.75],
    [73.8, 81.0],
    [73.8, 82.25],
    [73.8, 83.5],
    [73.8, 84.75]
  ];
  return visibleDocuments.map((document, index) => exhpStaticOverlay(
    document,
    positions[index][0],
    positions[index][1],
    22.5,
    1.15,
    `material-description-overlay exhp-supporting-document exhp-supporting-document-${index + 1}`
  )).join('');
}



export function shouldShowCommanderInExhpField23(issueReason, explicitCode = '') {
  const code = getAitiologiaCodeForIssueReason(issueReason, explicitCode);
  return !EXHP_FIELD_23_COMMANDER_EXCLUDED_REASON_CODES.has(code);
}



export function renderExhpPageNumber(page, totalPages) {
  return `<div class="exhp-page-number">Σελίδα ${page} από ${totalPages}</div>`;
}



export function exhpStaticOverlay(value, left, top, width, height, className = '', isHtml = false) {
  const content = isHtml ? value : escapeHtml(value ?? '');
  return `<div class="exhp-static-overlay ${className}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${content}</div>`;
}
