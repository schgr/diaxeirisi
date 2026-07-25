export function field(label, name, value = '', placeholder = '', attributes = '') {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input name="${escapeHtml(name)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" ${attributes} />
    </label>
  `;
}

export function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function renderFiscalYearOptions(selectedYear, earliestYear = 2000) {
  const selected = Number(selectedYear) || new Date().getFullYear();
  const latest = Math.max(new Date().getFullYear() + 1, selected);
  const earliest = Math.min(Number(earliestYear) || 2000, selected);
  return Array.from({ length: latest - earliest + 1 }, (_unused, index) => latest - index)
    .map((year) => `<option value="${year}" ${year === selected ? 'selected' : ''}>${year}</option>`)
    .join('');
}
