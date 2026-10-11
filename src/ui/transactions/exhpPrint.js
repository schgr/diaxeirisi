import { escapeHtml } from '../components/forms.js';
import { splitOfficerSignature } from '../officerSignature.js';
import { formatDate, formatQuantity } from './shared.js';
import { printLandscapeDocument } from './addyPrint.js';
import {
  getAitiologiaCodeForIssueReason,
  shouldFillExhpSecondOpinion
} from './exhpFormModuleBridge.js';

const EXHP_FIELD_23_COMMANDER_EXCLUDED_REASON_CODES = new Set(['a', 'd', 'th', 'i', 'ib']);
const EXHP_OFFICIAL_SUPPORT_TITLES = {
  useless_material_a: 'Πρωτόκολλο Πρωτοβάθμιας Επιτροπής',
  useless_material_b: 'Πρωτόκολλο Δευτεροβάθμιας Επιτροπής',
  ammo_consumption: 'ΔΥΠ/192 Πιστοποιητικό Καταναλώσεως Πυρομαχικών',
  transformation_materials: 'ΕΦΕΔ 506 Πρωτόκολλο Μετασχηματισμού Υλικών',
  clothing_monthly_summary: 'Μηνιαία Κατάσταση Ιματισμού'
};
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
  const isToolCollection = getAitiologiaCodeForIssueReason(
    documentData.reason, documentData.reasonCode || ''
  ) === 'e';
  const materialPosition = (item) => isToolCollection && Number(item.quantity) === 0
    && item.ledgerSerial === 'Φ.Μ.' ? 'Φ.Μ' : documentData.registryNumber;
  const chargeItems = documentData.items
    .filter((item) => item.transactionType === 'Χρέωση')
    .map((item, index) => ({
      ...item,
      exhpSerial: index + 1,
      transactionYearSerial: materialPosition(item)
    }));
  const creditItems = documentData.items
    .filter((item) => item.transactionType === 'Πίστωση')
    .map((item, index) => ({
      ...item,
      exhpSerial: index + 1,
      transactionYearSerial: materialPosition(item)
    }));
  const pageCount = Math.max(1, Math.ceil(chargeItems.length / 18), Math.ceil(creditItems.length / 18));
  const fillSecondOpinion = shouldFillExhpSecondOpinion(
    documentData.reason,
    documentData.reasonCode || '',
    documentData.reasonTexts?.secondOpinion
  );
  const showCommanderInField23 = shouldShowCommanderInExhpField23(
    documentData.reason,
    documentData.reasonCode || ''
  );
  const supportingDocuments = [...new Set([
    ...documentData.items.flatMap((item) => splitExhpSupportingDocumentLines(item.supportingDocuments)),
    ...(documentData.supports || [])
      .filter((support) => support.completed)
      .map((support) => [support.documentCode, support.documentReference || support.title].filter(Boolean).join(' ')),
    ...(documentData.officialSupportDocuments || [])
      .map((document) => EXHP_OFFICIAL_SUPPORT_TITLES[document.documentType])
      .filter(Boolean),
    ...splitExhpSupportingDocumentLines(documentData.otherSupportDocument)
  ].filter(Boolean))].slice(0, 9);
  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const chargePage = chargeItems.slice(pageIndex * 18, pageIndex * 18 + 18);
    const creditPage = creditItems.slice(pageIndex * 18, pageIndex * 18 + 18);
    const frontPageNumber = pageIndex + 1;
    return `
      <article class="exhp-faithful-page exhp-paged-document exhp-faithful-front-side print-document-area">
        <div class="exhp-page-content">
          <img src="./assets/official-forms/exhp-front-clean.png" alt="Εντολή Χρεωπιστώσεως - εμπρός πλευρά" />
          ${exhpReferenceField(documentData.unit, 10.4, 11.7, 37.6, 2.2, 'exhp-reference-header-field exhp-reference-unit')}
          ${exhpReferenceField(documentData.registryNumber, 75.4, 9.7, 20.0, 2.2, 'exhp-reference-header-field')}
          ${exhpReferenceField(formatDate(documentData.date), 75.4, 11.7, 20.0, 2.2, 'exhp-reference-header-field')}
          ${chargeItems.length ? exhpReferenceField(documentData.managementType || '', 5.4, 13.45, 42.8, 1.8, 'exhp-reference-management') : ''}
          ${creditItems.length ? exhpReferenceField(documentData.managementType || '', 49.5, 13.45, 44.0, 1.8, 'exhp-reference-management') : ''}
          ${renderExhpReferenceRows(chargePage, 'charge')}
          ${renderExhpReferenceRows(creditPage, 'credit')}
          ${renderExhpReferenceSignature(documentData.financialOfficers?.manager, 2.9, 72.4, 9.4, 4.9, 'exhp-reference-signature-field-16')}
          ${renderExhpReferenceSignature(documentData.financialOfficers?.manager, 67.7, 72.4, 9.4, 4.9, 'exhp-reference-signature-field-16')}
          ${renderExhpReferenceSignature(documentData.financialOfficers?.ped, 37.45, 69.5, 18.0, 8.5, 'exhp-field-19-signature')}
          ${exhpReferenceField(documentData.reason, 2.9, 79.1, 45.8, 8.95, 'exhp-reference-text-field')}
          ${exhpReferenceField(renderExhpSupportingDocuments(supportingDocuments), 48.7, 77.75, 45.5, 10.3, 'exhp-reference-support-field', true)}
          ${exhpReferenceField(documentData.notes || '', 2.9, 88.1, 45.8, 5.8, 'exhp-reference-text-field')}
          ${exhpReferenceField(documentData.approvalReference || '', 48.7, 88.1, 18.3, 5.8, 'exhp-reference-approval-field')}
          ${showCommanderInField23
            ? renderExhpReferenceSignature(documentData.financialOfficers?.commander, 67.0, 88.1, 27.2, 5.8)
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

function splitExhpSupportingDocumentLines(value) {
  return String(value || '')
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function renderExhpSupportingDocuments(documents) {
  const cells = Array.from({ length: 9 }, (_unused, index) => documents[index] || '');
  return `<div class="exhp-supporting-documents-grid"><i class="exhp-supporting-documents-gap" aria-hidden="true"></i>${cells.map((document) => `<span>${escapeHtml(document)}</span>`).join('')}</div>`;
}

function formatExhpShareNumber(item) {
  return String(item.shareNumber || '').trim();
}

function formatExhpPrintedQuantity(quantity) {
  return Number(quantity) === 0 ? '' : formatQuantity(quantity);
}



export function renderExhpReferenceRows(items, side) {
  const left = side === 'credit' ? 48.7 : 2.9;
  const columns = [
    { offset: 0, width: 2.45, value: (item) => item.exhpSerial },
    { offset: 2.45, width: 7.07, value: (item) => item.nominalNumber },
    { offset: 9.52, width: 16.82, value: (item) => item.description, className: 'exhp-reference-description' },
    { offset: 26.34, width: 3.25, value: formatExhpShareNumber },
    { offset: 29.59, width: 2.85, value: (item) => item.transactionYearSerial || item.materialPosition || item.position || '' },
    { offset: 32.44, width: 3.31, value: (item) => item.measurementUnit },
    { offset: 35.75, width: 2.45, value: (item) => formatExhpPrintedQuantity(item.quantity) }
  ];
  return items.map((item, rowIndex) => columns.map((column) => exhpReferenceField(
    column.value(item),
    left + column.offset,
    24.2 + rowIndex * 2.45,
    column.width,
    2.45,
    `exhp-reference-row-cell ${column.className || ''}`.trim()
  )).join('')).join('');
}

export function renderFaithfulExhpRows(items, isCredit) {
  return renderExhpReferenceRows(items, isCredit ? 'credit' : 'charge');
}



export function renderExhpBackOverlay(text, date, officer, role, sectionIndex) {
  const sectionTop = [17.0, 33.45, 52.0][sectionIndex];
  const signature = splitOfficerSignature(officer);
  return `
    ${exhpStaticOverlay(text || '', 2.8, sectionTop + 5.3, 61.5, 9.5, 'exhp-back-copy material-description-overlay')}
    ${exhpStaticOverlay(formatDate(date), 78.2, sectionTop + 2.1, 13.0, 2.2, 'exhp-back-value')}
    ${exhpStaticOverlay(renderExhpOfficerSignature(officer), 66.4, sectionTop + 6.0, 28.0, 5.5, 'exhp-back-signature', true)}
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



function renderExhpReferenceSignature(value, left, top, width, height, modifierClass = '') {
  return exhpReferenceField(
    renderExhpOfficerSignature(value),
    left,
    top,
    width,
    height,
    `exhp-reference-signature ${modifierClass}`.trim(),
    true
  );
}

function exhpReferenceField(value, left, top, width, height, className = '', isHtml = false) {
  const content = isHtml ? value : escapeHtml(value ?? '');
  return `<div class="exhp-reference-field ${className}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%">${content}</div>`;
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
