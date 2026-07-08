import { escapeHtml } from '../../../ui/components/forms.js';

export function renderDocHeader({ monada = '', addyAxp = '', formCode = '', formNumber = '' } = {}) {
  return `
    <header class="exhp-form-header">
      <div class="exhp-form-code-block">
        ${formCode ? `<span>${escapeHtml(formCode)}</span>` : ''}
        ${formNumber ? `<span>${escapeHtml(formNumber)}</span>` : ''}
      </div>
      <div class="exhp-form-fields-row exhp-form-field-narrow">
        <span class="exhp-form-field-line exhp-form-field-line-unit">
          <strong>1. ΜΟΝΑΔΑ</strong><span class="exhp-form-fill">${escapeHtml(monada)}</span>
        </span>
        <span class="exhp-form-field-line exhp-form-field-line-index">
          <strong>(2) Α/Α ΕΧΠ</strong><span class="exhp-form-fill">${escapeHtml(addyAxp)}</span>
        </span>
      </div>
    </header>
  `;
}
