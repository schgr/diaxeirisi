import { escapeHtml } from '../../../ui/components/forms.js';

export const MATERIAL_FIELD_NAMES = ['seq', 'nomenclature', 'description', 'unit', 'quantity', 'notes'];

const MATERIAL_COLUMNS = [
  { key: 'seq', label: 'Α/Α' },
  { key: 'nomenclature', label: 'Αριθμός Ονομαστικού' },
  { key: 'description', label: 'Περιγραφή' },
  { key: 'unit', label: 'Μονάδα Μέτρησης' },
  { key: 'quantity', label: 'Ποσότητα' },
  { key: 'notes', label: 'Παρατηρήσεις' }
];

export function renderMaterialsTableInput(rows = [], onChange = null) {
  const tableRows = normalizeRows(rows);
  const changeAttribute = typeof onChange === 'string' ? ` data-change-handler="${escapeHtml(onChange)}"` : '';

  return `
    <div class="exhp-materials-editor" data-materials-table${changeAttribute}>
      <table class="exhp-materials-table exhp-materials-table-input">
        ${renderColgroup()}
        <thead>${renderHeaderRow('<th class="exhp-materials-actions-cell">Ενέργειες</th>')}</thead>
        <tbody data-materials-table-body>
          ${tableRows.map((row, index) => renderInputRow(row, index)).join('')}
        </tbody>
      </table>
      <button class="secondary-button" data-materials-add-row type="button">Προσθήκη γραμμής</button>
    </div>
  `;
}

export function renderMaterialsTablePrint(rows = [], options = {}) {
  const tableRows = normalizeRows(rows);
  const columns = getMaterialColumns(options);

  return `
    <table class="exhp-materials-table exhp-materials-table-print">
      ${renderColgroup()}
      <thead>
        ${renderHeaderRow('', columns)}
        ${renderColumnNumberRow(options.columnNumbers, columns)}
      </thead>
      <tbody>
        ${tableRows.map((row, index) => `
          <tr>
            ${columns.map(({ key }) => `<td>${escapeHtml(key === 'seq' ? row.seq || index + 1 : row[key])}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

export function bindMaterialsTableInput(root, onChange) {
  const tableRoot = root?.matches?.('[data-materials-table]')
    ? root
    : root?.querySelector?.('[data-materials-table]');
  if (!tableRoot) return null;

  const emitChange = () => {
    if (typeof onChange === 'function') onChange(collectMaterialsTableRows(tableRoot));
  };

  tableRoot.addEventListener('input', (event) => {
    if (!event.target.closest('[data-materials-field]')) return;
    emitChange();
  });

  tableRoot.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-materials-add-row]');
    if (addButton) {
      const body = tableRoot.querySelector('[data-materials-table-body]');
      body?.insertAdjacentHTML('beforeend', renderInputRow({}, body.querySelectorAll('[data-materials-row]').length));
      renumberInputRows(tableRoot);
      emitChange();
      return;
    }

    const removeButton = event.target.closest('[data-materials-remove-row]');
    if (!removeButton) return;
    removeButton.closest('[data-materials-row]')?.remove();
    ensureOneInputRow(tableRoot);
    renumberInputRows(tableRoot);
    emitChange();
  });

  return {
    collect: () => collectMaterialsTableRows(tableRoot),
    addRow: (row = {}) => {
      const body = tableRoot.querySelector('[data-materials-table-body]');
      body?.insertAdjacentHTML('beforeend', renderInputRow(row, body.querySelectorAll('[data-materials-row]').length));
      renumberInputRows(tableRoot);
      emitChange();
    }
  };
}

export function collectMaterialsTableRows(root) {
  return Array.from(root.querySelectorAll('[data-materials-row]')).map((row, index) => {
    const item = Object.fromEntries(MATERIAL_FIELD_NAMES.map((field) => [
      field,
      row.querySelector(`[data-materials-field="${field}"]`)?.value?.trim() || ''
    ]));
    return { ...item, seq: item.seq || String(index + 1) };
  });
}

function normalizeRows(rows) {
  const source = Array.isArray(rows) && rows.length ? rows : [{}];
  return source.map((row, index) => ({
    seq: row?.seq ?? index + 1,
    nomenclature: row?.nomenclature ?? row?.nomenclatureNumber ?? row?.nominalNumber ?? '',
    description: row?.description ?? '',
    unit: row?.unit ?? row?.measurementUnit ?? '',
    quantity: row?.quantity ?? '',
    notes: row?.notes ?? row?.remarks ?? ''
  }));
}

function renderColgroup() {
  return `
    <colgroup>
      <col class="exhp-materials-col-seq" />
      <col class="exhp-materials-col-nomenclature" />
      <col class="exhp-materials-col-description" />
      <col class="exhp-materials-col-unit" />
      <col class="exhp-materials-col-quantity" />
      <col class="exhp-materials-col-notes" />
    </colgroup>
  `;
}

function renderHeaderRow(extraCell = '', columns = MATERIAL_COLUMNS) {
  return `<tr>${columns.map(({ label }) => `<th>${escapeHtml(label)}</th>`).join('')}${extraCell}</tr>`;
}

function renderColumnNumberRow(columnNumbers = [], columns = MATERIAL_COLUMNS) {
  if (!Array.isArray(columnNumbers) || !columnNumbers.length) return '';
  return `
    <tr class="exhp-materials-column-number-row">
      ${columns.map((_column, index) => `<th>${escapeHtml(columnNumbers[index] ?? '')}</th>`).join('')}
    </tr>
  `;
}

function getMaterialColumns(options = {}) {
  return MATERIAL_COLUMNS.map((column) => ({
    ...column,
    label: column.key === 'notes' && options.notesLabel ? options.notesLabel : column.label
  }));
}

function renderInputRow(row, index) {
  const item = normalizeRows([row])[0];
  const seq = row?.seq ?? index + 1;
  return `
    <tr data-materials-row>
      ${MATERIAL_COLUMNS.map(({ key }) => `
        <td>
          <input
            data-materials-field="${escapeHtml(key)}"
            value="${escapeHtml(key === 'seq' ? seq : item[key])}"
            ${key === 'quantity' ? 'inputmode="decimal"' : ''}
          />
        </td>
      `).join('')}
      <td class="exhp-materials-actions-cell">
        <button class="secondary-button" data-materials-remove-row type="button">Διαγραφή</button>
      </td>
    </tr>
  `;
}

function ensureOneInputRow(tableRoot) {
  const body = tableRoot.querySelector('[data-materials-table-body]');
  if (body && !body.querySelector('[data-materials-row]')) {
    body.insertAdjacentHTML('beforeend', renderInputRow({}, 0));
  }
}

function renumberInputRows(tableRoot) {
  tableRoot.querySelectorAll('[data-materials-row]').forEach((row, index) => {
    const seqInput = row.querySelector('[data-materials-field="seq"]');
    if (seqInput) seqInput.value = String(index + 1);
  });
}
