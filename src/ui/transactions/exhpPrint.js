import { escapeHtml } from '../components/forms.js';
import { splitOfficerSignature } from '../officerSignature.js';
import { formatDate, formatQuantity } from './shared.js';
import { printLandscapeDocument } from './addyPrint.js';
import { shouldFillExhpSecondOpinion } from './exhpFormModuleBridge.js';
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
      window.alert('Η εκτύπωση δεν ξεκίνησε. Δοκιμάστε ξανά ή ελέγξτε τον εκτυπωτή.');
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
  const frontField23Officer = fillSecondOpinion
    ? documentData.financialOfficers?.manager
    : documentData.financialOfficers?.commander;
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
          ${exhpStaticOverlay(documentData.unit, 14.2, 16.4, 10.8, 2.2)}
          ${exhpStaticOverlay(documentData.registryNumber, 83.2, 14.2, 9.2, 2.2)}
          ${exhpStaticOverlay(formatDate(documentData.date), 81.6, 17.0, 10.5, 2.2)}
          ${chargeItems.length ? exhpStaticOverlay(documentData.managementType || '', 20.0, 22.0, 27.5, 2.4, 'exhp-management-type') : ''}
          ${creditItems.length ? exhpStaticOverlay(documentData.managementType || '', 69.0, 22.0, 27.5, 2.4, 'exhp-management-type') : ''}
          ${renderFaithfulExhpRows(chargePage, false)}
          ${renderFaithfulExhpRows(creditPage, true)}
          ${renderExhpFrontSignature(documentData.financialOfficers?.manager, 1.8, 76.1, 10.8, 2.7)}
          ${renderExhpFrontSignature(documentData.financialOfficers?.ped, 47.2, 76.1, 11.5, 2.7)}
          ${renderExhpFrontSignature(frontField23Officer, 79.5, 76.1, 8.0, 2.7)}
          ${exhpStaticOverlay(documentData.reason, 2.7, 81.0, 45.8, 5.1, 'material-description-overlay')}
          ${exhpStaticOverlay(supportingDocuments.join(' · '), 50.8, 81.0, 46.0, 5.1, 'material-description-overlay')}
          ${exhpStaticOverlay(documentData.notes || '', 2.7, 89.0, 45.8, 4.3, 'material-description-overlay')}
          ${exhpStaticOverlay(documentData.approvalReference || '', 51.0, 89.0, 23.0, 4.3)}
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



export function renderExhpFrontSignature(value, left, top, width, height) {
  return exhpStaticOverlay(
    renderExhpOfficerSignature(value),
    left,
    top,
    width,
    height,
    'exhp-front-signature',
    true
  );
}



export function renderExhpPageNumber(page, totalPages) {
  return `<div class="exhp-page-number">Σελίδα ${page} από ${totalPages}</div>`;
}



export function exhpStaticOverlay(value, left, top, width, height, className = '', isHtml = false) {
  const content = isHtml ? value : escapeHtml(value ?? '');
  return `<div class="exhp-static-overlay ${className}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${content}</div>`;
}
