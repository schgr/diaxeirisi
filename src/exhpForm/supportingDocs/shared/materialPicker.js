import { escapeHtml } from '../../../ui/components/forms.js';

export function renderMaterialPickerTableInput(rows = [], shares = [], onChange = null, options = {}) {
  const tableRows = normalizeRows(rows);
  const catalog = Array.isArray(shares) ? shares : [];
  const changeAttribute = typeof onChange === 'string' ? ` data-change-handler="${escapeHtml(onChange)}"` : '';
  const variant = options.variant || 'default';

  return `
    <div class="exhp-materials-editor" data-material-picker-table data-material-picker-variant="${escapeHtml(variant)}"${changeAttribute}>
      ${renderCatalogDatalist(catalog)}
      <table class="exhp-materials-table exhp-materials-table-input">
        ${renderColgroup(variant)}
        ${renderTableHead(variant)}
        <tbody data-material-picker-body>
          ${tableRows.map((row, index) => renderMaterialPickerRow(row, index, { variant })).join('')}
        </tbody>
      </table>
      <button class="secondary-button" data-material-picker-add-row type="button">Προσθήκη γραμμής</button>
    </div>
  `;
}

export function renderMaterialPickerRow(row = {}, index = 0, options = {}) {
  const item = normalizeRows([row])[0];
  const seq = row?.seq ?? index + 1;
  const variant = options.variant || 'default';
  if (variant === 'dyp192') return renderDyp192MaterialPickerRow(item, seq);
  if (variant === 'axristo') return renderAxristoMaterialPickerRow(item, seq);

  return `
    <tr data-materials-row data-material-picker-row>
      <td>
        <input data-materials-field="seq" value="${escapeHtml(seq)}" />
        <input data-materials-field="shareNumber" type="hidden" value="${escapeHtml(item.shareNumber)}" />
      </td>
      <td>
        <input
          data-material-picker-select
          list="exhp-material-picker-catalog"
          value="${escapeHtml(item.shareNumber)}"
          placeholder="Αριθμός μερίδας"
          autocomplete="off"
        />
      </td>
      <td><input data-materials-field="nomenclature" value="${escapeHtml(item.nomenclature)}" readonly /></td>
      <td><input data-materials-field="description" value="${escapeHtml(item.description)}" readonly /></td>
      <td><input data-materials-field="unit" value="${escapeHtml(item.unit)}" readonly /></td>
      <td><input data-materials-field="quantity" value="${escapeHtml(item.quantity)}" inputmode="decimal" /></td>
      <td><input data-materials-field="notes" value="${escapeHtml(item.notes)}" /></td>
      <td class="exhp-materials-actions-cell">
        <button class="secondary-button" data-material-picker-remove-row type="button">Διαγραφή</button>
      </td>
    </tr>
  `;
}

export function getShareForMaterialPickerValue(shares = [], value = '') {
  const normalized = normalize(value);
  return (Array.isArray(shares) ? shares : []).find((share) =>
    normalize(share.shareNumber) === normalized
  ) || null;
}

export function applyShareToMaterialPickerRow(row, share) {
  if (!row || !share) return;
  setRowField(row, 'shareNumber', share.shareNumber || '');
  setRowField(row, 'nomenclature', share.nominalNumber || '');
  setRowField(row, 'description', share.description || '');
  setRowField(row, 'unit', share.measurementUnit || '');
  const picker = row.querySelector('[data-material-picker-select]');
  if (picker) picker.value = share.shareNumber || '';
}

function renderCatalogDatalist(shares) {
  return `
    <datalist id="exhp-material-picker-catalog">
      ${shares.map((share) => `
        <option value="${escapeHtml(share.shareNumber || '')}">
          ${escapeHtml(share.description || '')}
        </option>
      `).join('')}
    </datalist>
  `;
}

function renderDyp192MaterialPickerRow(item, seq) {
  return `
    <tr data-materials-row data-material-picker-row>
      <td>
        <input data-materials-field="seq" value="${escapeHtml(seq)}" />
        <input data-materials-field="nomenclature" type="hidden" value="${escapeHtml(item.nomenclature)}" />
      </td>
      <td>
        <input
          data-material-picker-select
          data-materials-field="shareNumber"
          list="exhp-material-picker-catalog"
          value="${escapeHtml(item.shareNumber)}"
          placeholder="Αριθμός μερίδας"
          autocomplete="off"
        />
      </td>
      <td><input data-materials-field="description" value="${escapeHtml(item.description)}" readonly /></td>
      <td><input data-materials-field="unit" value="${escapeHtml(item.unit)}" readonly /></td>
      <td><input data-materials-field="quantity" value="${escapeHtml(item.quantity)}" inputmode="decimal" /></td>
      <td class="exhp-materials-actions-cell">
        <button class="secondary-button" data-material-picker-remove-row type="button">Διαγραφή</button>
      </td>
    </tr>
  `;
}

function renderAxristoMaterialPickerRow(item, seq) {
  return `
    <tr data-materials-row data-material-picker-row>
      <td><input data-materials-field="seq" value="${escapeHtml(seq)}" /></td>
      <td>
        <input data-material-picker-select list="exhp-material-picker-catalog" value="${escapeHtml(item.shareNumber)}" placeholder="Αριθμός μερίδας" autocomplete="off" />
        <input data-materials-field="shareNumber" type="hidden" value="${escapeHtml(item.shareNumber)}" />
        <input data-materials-field="nomenclature" type="hidden" value="${escapeHtml(item.nomenclature)}" />
      </td>
      <td><input data-materials-field="description" value="${escapeHtml(item.description)}" readonly /></td>
      <td><input data-materials-field="unit" value="${escapeHtml(item.unit)}" readonly /></td>
      <td><input data-materials-field="quantity" value="${escapeHtml(item.quantity)}" inputmode="decimal" /></td>
      <td><input data-materials-field="quantityWords" value="${escapeHtml(item.quantityWords)}" /></td>
      <td><input data-materials-field="acquisitionPrice" value="${escapeHtml(item.acquisitionPrice)}" inputmode="decimal" /></td>
      <td><input data-materials-field="acquisitionDate" value="${escapeHtml(item.acquisitionDate)}" type="date" /></td>
      <td><input data-materials-field="notes" value="${escapeHtml(item.notes)}" /></td>
      <td class="exhp-materials-actions-cell"><button class="secondary-button" data-material-picker-remove-row type="button">Διαγραφή</button></td>
    </tr>
  `;
}

function renderTableHead(variant = 'default') {
  if (variant === 'axristo') {
    return `
      <thead><tr>
        <th>Α/Α</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>ΜΜ</th>
        <th>Ποσότητα (αριθ.)</th><th>Ποσότητα (ολογράφως)</th><th>Τιμή Κτήσης</th>
        <th>Ημ/νία Κτήσης</th><th>Παρατηρήσεις</th><th class="exhp-materials-actions-cell">Ενέργειες</th>
      </tr></thead>
    `;
  }
  if (variant === 'dyp192') {
    return `
      <thead>
        <tr>
          <th>Α/Α</th>
          <th>Αριθμός Μερίδας</th>
          <th>Περιγραφή</th>
          <th>Μονάδα Μέτρησης</th>
          <th>Ποσότητα</th>
          <th class="exhp-materials-actions-cell">Ενέργειες</th>
        </tr>
      </thead>
    `;
  }

  return `
    <thead>
      <tr>
        <th>Α/Α</th>
        <th>Υλικό</th>
        <th>Αριθμός Ονομαστικού</th>
        <th>Περιγραφή</th>
        <th>Μονάδα Μέτρησης</th>
        <th>Ποσότητα</th>
        <th>Παρατηρήσεις</th>
        <th class="exhp-materials-actions-cell">Ενέργειες</th>
      </tr>
    </thead>
  `;
}

function renderColgroup(variant = 'default') {
  if (variant === 'axristo') {
    return `<colgroup>
      <col class="exhp-materials-col-seq" /><col class="exhp-materials-col-nomenclature" />
      <col class="exhp-materials-col-description" /><col class="exhp-materials-col-unit" />
      <col class="exhp-materials-col-quantity" /><col class="exhp-materials-col-quantity" />
      <col class="exhp-materials-col-quantity" /><col class="exhp-materials-col-quantity" />
      <col class="exhp-materials-col-notes" /><col class="exhp-materials-col-actions" />
    </colgroup>`;
  }
  if (variant === 'dyp192') {
    return `
      <colgroup>
        <col class="exhp-materials-col-seq" />
        <col class="exhp-materials-col-picker" />
        <col class="exhp-materials-col-description" />
        <col class="exhp-materials-col-unit" />
        <col class="exhp-materials-col-quantity" />
        <col class="exhp-materials-col-actions" />
      </colgroup>
    `;
  }

  return `
    <colgroup>
      <col class="exhp-materials-col-seq" />
      <col class="exhp-materials-col-picker" />
      <col class="exhp-materials-col-nomenclature" />
      <col class="exhp-materials-col-description" />
      <col class="exhp-materials-col-unit" />
      <col class="exhp-materials-col-quantity" />
      <col class="exhp-materials-col-notes" />
      <col class="exhp-materials-col-actions" />
    </colgroup>
  `;
}

function normalizeRows(rows) {
  const source = Array.isArray(rows) && rows.length ? rows : [{}];
  return source.map((row, index) => ({
    seq: row?.seq ?? index + 1,
    shareNumber: row?.shareNumber ?? '',
    nomenclature: row?.nomenclature ?? row?.nomenclatureNumber ?? row?.nominalNumber ?? '',
    description: row?.description ?? '',
    unit: row?.unit ?? row?.measurementUnit ?? '',
    quantity: row?.quantity ?? '',
    quantityWords: row?.quantityWords ?? '',
    acquisitionPrice: row?.acquisitionPrice ?? '',
    acquisitionDate: row?.acquisitionDate ?? '',
    notes: row?.notes ?? row?.remarks ?? ''
  }));
}

function setRowField(row, name, value) {
  const input = row.querySelector(`[data-materials-field="${name}"]`);
  if (input) input.value = value;
}

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('el-GR');
}
