import { escapeHtml } from '../../../ui/components/forms.js';

export const EXHP_PRINT_LAYOUT_CSS = `
  @page {
    size: A4;
    margin: 10mm 10mm;
  }

  .exhp-print-page {
    width: 210mm;
    min-height: 297mm;
    box-sizing: border-box;
    background: #fff;
    color: #111;
    font-family: "Times New Roman", "Noto Serif", serif;
    font-size: 9.4pt;
    line-height: 1.16;
  }

  .exhp-print-page h1,
  .exhp-print-page h2,
  .exhp-print-page h3,
  .exhp-print-page h4 {
    color: #111 !important;
  }

  .exhp-print-page * {
    color: #111 !important;
  }

  .exhp-form-header {
    display: grid;
    gap: 2.5mm;
    margin-bottom: 5mm;
  }

  .exhp-form-code-block {
    display: grid;
    justify-content: end;
    justify-items: end;
    gap: 1mm;
    text-align: right;
  }

  .exhp-form-code-block span {
    display: block;
    text-decoration: underline;
  }

  .exhp-form-fields-row {
    display: grid;
    grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
    gap: 8mm;
    align-items: end;
  }

  .exhp-form-field-line {
    display: grid;
    grid-template-columns: max-content minmax(18mm, 1fr);
    gap: 2mm;
    align-items: end;
    min-width: 0;
  }

  .exhp-form-fill {
    min-height: 1.2em;
    border-bottom: 1px dotted #111;
    padding: 0 2mm;
  }

  .exhp-form-edit-fields {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, max-content));
    gap: 12px 16px;
    align-items: end;
  }

  .exhp-form-field-narrow input,
  .exhp-form-field-narrow select,
  .exhp-form-field-narrow textarea {
    width: min(100%, 520px);
    max-width: 520px;
  }

  .exhp-form-field-person input,
  .exhp-form-field-person select,
  .exhp-form-field-person textarea {
    width: min(100%, 360px);
    max-width: 360px;
  }

  .exhp-form-field-date input {
    width: min(100%, 180px);
    max-width: 180px;
  }

  .exhp-signature-slot span {
    display: block;
  }

  .exhp-form-title {
    margin: 5mm 0 4mm;
    text-align: center;
    font-size: 12.5pt;
    line-height: 1.2;
    font-weight: 700;
  }

  .exhp-form-title span {
    display: block;
  }

  .exhp-section-heading {
    margin: 2.5mm 0 1mm;
    font-family: "Times New Roman", "Noto Serif", serif;
    font-size: 12.5pt;
    line-height: 1.2;
    font-weight: 700;
  }

  .exhp-centered-action {
    text-align: center;
    color: #111 !important;
    font-size: 12pt;
    margin: 4mm 0;
  }

  .exhp-materials-table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }

  .exhp-materials-table thead {
    display: table-header-group;
  }

  .exhp-materials-table tfoot {
    display: table-footer-group;
  }

  .exhp-materials-table tr {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .exhp-materials-table th,
  .exhp-materials-table td {
    border: 1px solid #111;
    padding: 1.2mm;
    vertical-align: top;
    word-break: break-word;
  }

  .exhp-materials-table th {
    text-align: center;
    vertical-align: middle;
  }

  .exhp-materials-column-number-row th {
    text-align: center;
    font-size: inherit;
    font-weight: 400;
  }

  .exhp-materials-table input {
    width: 100%;
    box-sizing: border-box;
    border: 0;
    font: inherit;
    background: transparent;
  }

  .exhp-materials-col-seq {
    width: 10mm;
  }

  .exhp-materials-col-nomenclature {
    width: 32mm;
  }

  .exhp-materials-col-unit,
  .exhp-materials-col-quantity {
    width: 22mm;
  }

  .exhp-signature-block {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(38mm, 1fr));
    gap: 6mm;
    margin-top: 8mm;
    text-align: center;
    align-items: start;
  }

  .exhp-signature-slot > span {
    font-weight: 700;
    text-transform: uppercase;
  }

  .exhp-signature-theorisi {
    margin-bottom: 1mm;
  }

  .exhp-signature-name {
    display: block;
    min-height: 10mm;
    margin-top: 5mm;
    font-weight: 700;
    font-size: 8.8pt;
  }

  .exhp-signature-name span {
    display: block;
    text-align: center;
    white-space: nowrap;
  }

  .exhp-signature-committee-slot {
    min-width: 62mm;
  }

  .exhp-signature-committee-grid {
    display: flex;
    justify-content: flex-end;
    gap: 8mm;
    margin-top: 5mm;
    margin-left: 4mm;
    text-align: center;
  }

  .exhp-signature-committee-president,
  .exhp-signature-committee-members {
    min-width: 29mm;
  }

  .exhp-signature-committee-president > span,
  .exhp-signature-committee-members > span {
    display: block;
    font-weight: 700;
    text-transform: uppercase;
  }

  .exhp-signature-member-stack {
    display: grid;
    gap: 4mm;
  }

  .exhp-signature-member-stack .exhp-signature-name,
  .exhp-signature-committee-president .exhp-signature-name {
    min-height: 0;
    margin-top: 4mm;
  }

  @media print {
    .exhp-print-page {
      width: auto;
      min-height: auto;
    }

    .secondary-button,
    .exhp-materials-actions-cell {
      display: none !important;
    }
  }
`;

export function renderPrintStyles() {
  return `<style>${EXHP_PRINT_LAYOUT_CSS}</style>`;
}

export function renderPrintLayout(content, { title = '', footer = '' } = {}) {
  return `
    ${renderPrintStyles()}
    <article class="exhp-print-page print-document-area">
      ${title ? `<h1>${escapeHtml(title)}</h1>` : ''}
      ${content || ''}
      ${footer ? `<footer class="exhp-print-footer">${escapeHtml(footer)}</footer>` : ''}
    </article>
  `;
}

export function formatPrintValue(value = '') {
  return escapeHtml(value ?? '');
}

export function getMonthGenitive(month) {
  const monthNames = [
    '',
    'Ιανουαρίου',
    'Φεβρουαρίου',
    'Μαρτίου',
    'Απριλίου',
    'Μαΐου',
    'Ιουνίου',
    'Ιουλίου',
    'Αυγούστου',
    'Σεπτεμβρίου',
    'Οκτωβρίου',
    'Νοεμβρίου',
    'Δεκεμβρίου'
  ];
  return monthNames[Number(month)] || '';
}

export function getGreekDateParts(value = '') {
  const [year = '', month = '', day = ''] = String(value || '').slice(0, 10).split('-');
  if (!year || !month || !day) return { day: '', month: '', year: '' };
  return {
    day,
    month: getMonthGenitive(month),
    year
  };
}
