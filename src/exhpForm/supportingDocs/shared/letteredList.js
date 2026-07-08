import { escapeHtml } from '../../../ui/components/forms.js';

const GREEK_LETTERS = ['α', 'β', 'γ', 'δ', 'ε', 'στ', 'ζ', 'η', 'θ', 'ι', 'ια', 'ιβ'];

export function renderLetteredListInput(items = [], onChange = null, options = {}) {
  const rows = normalizeItems(items, options);
  const changeAttribute = typeof onChange === 'string' ? ` data-change-handler="${escapeHtml(onChange)}"` : '';
  const nameAttribute = options.name ? ` data-lettered-list-name="${escapeHtml(options.name)}"` : '';

  return `
    <div class="exhp-lettered-list exhp-form-field-narrow" data-lettered-list${changeAttribute}${nameAttribute}>
      ${rows.map((value, index) => renderInputItem(value, index, options)).join('')}
    </div>
  `;
}

export function renderLetteredListPrint(items = [], options = {}) {
  const rows = normalizeItems(items, options);

  return `
    <ol class="exhp-lettered-list-print">
      ${rows.map((value, index) => `
        <li>
          <span class="exhp-lettered-list-letter">${escapeHtml(letterForIndex(index))}.</span>
          <span class="exhp-lettered-list-value">${escapeHtml(value)}</span>
        </li>
      `).join('')}
    </ol>
  `;
}

export function collectLetteredListItems(root) {
  return Array.from(root.querySelectorAll('[data-lettered-list-field]')).map((input) =>
    String(input.value || '').trim()
  );
}

function renderInputItem(value, index, options) {
  const fieldName = options.name ? `${options.name}.${index}` : String(index);
  return `
    <label class="exhp-lettered-list-row exhp-form-field-narrow">
      <span>${escapeHtml(letterForIndex(index))}.</span>
      <input data-lettered-list-field="${escapeHtml(fieldName)}" value="${escapeHtml(value)}" />
    </label>
  `;
}

function normalizeItems(items, options) {
  const minItems = Number.isInteger(options.minItems) ? options.minItems : 0;
  const maxItems = Number.isInteger(options.maxItems) ? options.maxItems : null;
  const source = Array.isArray(items) ? items : [];
  const length = Math.max(minItems, source.length);
  const limitedLength = maxItems === null ? length : Math.min(length, maxItems);
  return Array.from({ length: limitedLength }, (_, index) => source[index] ?? '');
}

function letterForIndex(index) {
  return GREEK_LETTERS[index] || String(index + 1);
}
