import { escapeHtml } from '../../ui/components/forms.js';
import { splitOfficerSignature } from '../../ui/officerSignature.js';
import { renderMaterialPickerTableInput } from './shared/materialPicker.js';
import { requireAtLeastOneRow, requireDateOrder, requireNonEmpty } from '../validation.js';

export const DOC_Z_ANALOSIMO_DEFINITION = {
  aitiologiaCode: 'z',
  formCode: 'ΕΦΕΔ 505',
  formReference: 'Κ 2334/ΔΥΠ',
  title: 'ΠΡΩΤΟΚΟΛΛΟ ΔΙΑΘΕΣΕΩΣ ΑΝΑΛΩΣΙΜΟΥ ΥΛΙΚΟΥ'
};

const EMPTY_DATA = {
  aitiologiaCode: DOC_Z_ANALOSIMO_DEFINITION.aitiologiaCode,
  formCode: DOC_Z_ANALOSIMO_DEFINITION.formCode,
  commonFields: { monada: '', addyAxp: '', date: '' },
  financialOfficers: { commander: '', manager: '' },
  specificFields: {
    topos: '',
    imera: '',
    minas: '',
    etos: '',
    imerominia: '',
    hdmArithmos: '',
    proedros: '',
    melosA: '',
    melosB: '',
    apoDate: '',
    eosDate: ''
  },
  materials: []
};

const EFED_505_TABLE_COLUMNS = [
  { key: 'seq', left: 9.41, width: 3.19, value: (item, index) => item.seq || index + 1 },
  { key: 'nomenclature', left: 12.60, width: 26.20, value: (item) => item.nomenclature || '', className: 'efed505-item-nomenclature' },
  { key: 'description', left: 38.80, width: 16.63, value: (item) => item.description || '', className: 'efed505-item-description' },
  { key: 'unit', left: 55.43, width: 9.91, value: (item) => item.unit || '', className: 'efed505-item-unit' },
  { key: 'quantity', left: 65.34, width: 9.41, value: (item) => formatQuantity(item.quantity), className: 'efed505-item-quantity' },
  { key: 'notes', left: 74.75, width: 8.57, value: (item) => item.notes || '', className: 'material-description-overlay' }
];

const EFED_505_ROWS_PER_PAGE = 10;
const EFED_505_FIRST_ROW_TOP = 51.20;
const EFED_505_ROW_STEP = 2.48;

export function createDocZAnalosimo({ monada = '', addyAxp = '', onSave = null, data = {}, materialCatalog = [] } = {}) {
  let state = normalizeDocZData({
    ...EMPTY_DATA,
    ...data,
    commonFields: {
      ...EMPTY_DATA.commonFields,
      ...(data.commonFields || {}),
      monada: data.commonFields?.monada ?? monada,
      addyAxp: data.commonFields?.addyAxp ?? addyAxp
    },
    specificFields: {
      ...EMPTY_DATA.specificFields,
      ...(data.specificFields || {})
    },
    financialOfficers: {
      ...EMPTY_DATA.financialOfficers,
      ...(data.financialOfficers || {})
    },
    materials: data.materials || []
  });

  return {
    renderEdit() {
      return renderDocZEdit(state, { materialCatalog });
    },
    renderPrint() {
      return renderDocZPrint(state);
    },
    getData() {
      return structuredCloneFallback(state);
    },
    setData(nextData = {}) {
      state = normalizeDocZData({ ...state, ...nextData });
      return structuredCloneFallback(state);
    },
    save(nextData = null) {
      if (nextData) state = normalizeDocZData({ ...state, ...nextData });
      const result = validateDocZAnalosimo(state);
      if (result.valid && typeof onSave === 'function') onSave(structuredCloneFallback(state));
      return result;
    },
    validate() {
      return validateDocZAnalosimo(state);
    }
  };
}

export function renderDocZEdit(data = {}, options = {}) {
  const normalized = normalizeDocZData(data);
  const fields = normalized.specificFields;

  return `
    <section class="doc-z-analosimo-editor" data-exhp-doc-z-editor>
      <div class="doc-z-edit-grid">
        ${renderInputField('Μονάδα', 'commonFields.monada', normalized.commonFields.monada)}
        ${renderInputField('Α/Α ΕΧΠ', 'commonFields.addyAxp', normalized.commonFields.addyAxp)}
        ${renderInputField('Τόπος', 'specificFields.topos', fields.topos)}
        ${renderInputField('Ημερομηνία πρωτοκόλλου', 'specificFields.imerominia', fields.imerominia, 'date')}
        ${renderInputField('Η.Δ.Μ. συγκρότησης', 'specificFields.hdmArithmos', fields.hdmArithmos)}
        ${renderInputField('Πρόεδρος', 'specificFields.proedros', fields.proedros)}
        ${renderInputField('Μέλος α', 'specificFields.melosA', fields.melosA)}
        ${renderInputField('Μέλος β', 'specificFields.melosB', fields.melosB)}
        ${renderInputField('Από', 'specificFields.apoDate', fields.apoDate, 'date')}
        ${renderInputField('Έως', 'specificFields.eosDate', fields.eosDate, 'date')}
      </div>
      ${renderMaterialPickerTableInput(normalized.materials, options.materialCatalog || [], 'docZMaterialsChanged')}
    </section>
  `;
}

export function renderDocZPrint(data = {}) {
  const normalized = normalizeDocZData(data);
  const fields = normalized.specificFields;
  const materials = normalized.materials.length ? normalized.materials : [{}];
  const pageCount = Math.max(1, Math.ceil(materials.length / EFED_505_ROWS_PER_PAGE));

  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const pageRows = materials.slice(
      pageIndex * EFED_505_ROWS_PER_PAGE,
      pageIndex * EFED_505_ROWS_PER_PAGE + EFED_505_ROWS_PER_PAGE
    );
    return `
      <article class="efed505-page print-document-area" data-exhp-doc-z-print data-efed505-page="${pageIndex + 1}">
        <img src="./assets/official-forms/efed-505-clean.png" alt="ΕΦΕΔ 505 - Πρωτόκολλο Διαθέσεως Αναλωσίμου Υλικού" />
        ${renderEfed505HeaderOverlays(normalized)}
        ${efed505StaticOverlay(fields.topos, 19.07, 16.07, 23.72, 1.57)}
        ${efed505StaticOverlay(fields.imera, 60.37, 16.07, 9.44, 1.57)}
        ${efed505StaticOverlay(fields.minas, 9.51, 18.79, 14.80, 1.57)}
        ${efed505StaticOverlay(fields.etos, 35.95, 18.79, 3.29, 1.57)}
        ${efed505StaticOverlay(fields.hdmArithmos, 9.51, 21.50, 40.67, 1.59)}
        ${efed505StaticOverlay(fields.proedros, 19.03, 24.21, 40.65, 1.57)}
        ${efed505StaticOverlay(fields.melosA, 19.03, 26.93, 41.15, 1.57)}
        ${efed505StaticOverlay(fields.melosB, 19.03, 29.64, 41.15, 1.59)}
        ${efed505StaticOverlay(formatDisplayDate(fields.apoDate), 22.75, 40.51, 18.18, 1.57)}
        ${efed505StaticOverlay(formatDisplayDate(fields.eosDate), 45.20, 40.51, 20.83, 1.57)}
        ${renderEfed505MaterialRows(pageRows, pageIndex * EFED_505_ROWS_PER_PAGE)}
        ${renderEfed505SignatureNameOverlays(normalized)}
      </article>
    `;
  }).join('');
}

export function validateDocZAnalosimo(data = {}) {
  const normalized = normalizeDocZData(data);
  const fields = normalized.specificFields;
  const checks = [
    requireNonEmpty(normalized.commonFields.monada, 'Μονάδα'),
    requireNonEmpty(normalized.commonFields.addyAxp, 'Α/Α ΕΧΠ'),
    requireNonEmpty(fields.proedros, 'Πρόεδρος Επιτροπής'),
    requireNonEmpty(fields.apoDate, 'Χρονικό διάστημα από'),
    requireNonEmpty(fields.eosDate, 'Χρονικό διάστημα έως'),
    requireDateOrder(fields.apoDate, fields.eosDate, 'Χρονικό διάστημα'),
    requireAtLeastOneRow(normalized.materials, 'Υλικά')
  ];
  const errors = checks.filter((check) => !check.valid);
  return { valid: errors.length === 0, errors };
}

function normalizeDocZData(data = {}) {
  const commonFields = {
    monada: data.commonFields?.monada ?? '',
    addyAxp: data.commonFields?.addyAxp ?? '',
    date: data.commonFields?.date ?? ''
  };
  const specificFields = {
    ...EMPTY_DATA.specificFields,
    ...(data.specificFields || {})
  };
  const protocolDate = specificFields.imerominia || commonFields.date;
  const protocolDateParts = getProtocolDateParts(protocolDate);
  if (protocolDateParts.day) specificFields.imera = protocolDateParts.day;
  if (protocolDateParts.monthName) specificFields.minas = protocolDateParts.monthName;
  if (protocolDateParts.shortYear) specificFields.etos = protocolDateParts.shortYear;

  return {
    aitiologiaCode: DOC_Z_ANALOSIMO_DEFINITION.aitiologiaCode,
    formCode: DOC_Z_ANALOSIMO_DEFINITION.formCode,
    commonFields,
    financialOfficers: {
      commander: data.financialOfficers?.commander ?? '',
      manager: data.financialOfficers?.manager ?? ''
    },
    specificFields,
    materials: Array.isArray(data.materials) ? data.materials : []
  };
}

function renderInputField(label, name, value = '', type = 'text', placeholder = '') {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input data-doc-z-field="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
    </label>
  `;
}

function renderEfed505HeaderOverlays(data) {
  return `
    ${efed505StaticOverlay(data.commonFields.monada, 20.50, 5.45, 17.80, 1.59, 'efed505-header-monada')}
    ${efed505StaticOverlay(data.commonFields.addyAxp, 77.00, 5.45, 6.06, 1.59)}
  `;
}

function renderEfed505SignatureNameOverlays(data) {
  const officers = data.financialOfficers || {};
  const fields = data.specificFields || {};
  return `
    ${efed505SignatureOverlay(officers.commander, 10.90, 90.95, 18.00, 'efed505-signature-commander')}
    ${efed505SignatureOverlay(officers.manager, 31.90, 90.95, 19.50, 'efed505-signature-manager')}
    ${efed505SignatureOverlay(fields.proedros, 52.80, 95.05, 15.00, 'efed505-signature-committee-president')}
    ${efed505SignatureOverlay(fields.melosA, 72.60, 94.85, 15.50, 'efed505-signature-committee-member')}
    ${efed505SignatureOverlay(fields.melosB, 72.60, 97.15, 15.50, 'efed505-signature-committee-member')}
  `;
}

function efed505SignatureOverlay(value, left, top, width, className = '') {
  const signature = splitOfficerSignature(value);
  const content = `
    <span>${escapeHtml(signature.name || value || '')}</span>
    ${signature.rank ? `<span>${escapeHtml(signature.rank)}</span>` : ''}
  `;
  return efed505StaticOverlay(content, left, top, width, 2.70, `efed505-signature-name ${className}`.trim(), true);
}

function renderEfed505MaterialRows(rows, offset = 0) {
  return rows.map((item, rowIndex) => EFED_505_TABLE_COLUMNS.map((column) => efed505StaticOverlay(
    column.value(item, offset + rowIndex),
    column.left,
    EFED_505_FIRST_ROW_TOP + rowIndex * EFED_505_ROW_STEP,
    column.width,
    EFED_505_ROW_STEP,
    `efed505-row-overlay ${column.className || ''}`.trim()
  )).join('')).join('');
}

function efed505StaticOverlay(value, left, top, width, height, className = '', isHtml = false) {
  const content = isHtml ? value : escapeHtml(value ?? '');
  return `<div class="efed505-static-overlay ${escapeHtml(className)}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${content}</div>`;
}

function structuredCloneFallback(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function getProtocolDateParts(value) {
  const isoDate = String(value || '').slice(0, 10);
  const [year, month] = isoDate.split('-');
  const date = new Date(`${isoDate}T00:00:00`);
  if (!year || !month || Number.isNaN(date.getTime())) {
    return { day: '', monthName: '', shortYear: '' };
  }
  const monthNames = ['', 'Ιανουαρίου', 'Φεβρουαρίου', 'Μαρτίου', 'Απριλίου', 'Μαΐου', 'Ιουνίου', 'Ιουλίου', 'Αυγούστου', 'Σεπτεμβρίου', 'Οκτωβρίου', 'Νοεμβρίου', 'Δεκεμβρίου'];
  return {
    day: isoDate.split('-')[2] || '',
    monthName: monthNames[Number(month)] || '',
    shortYear: year.slice(-2)
  };
}

function formatDisplayDate(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  if (!year || !month || !day) return value || '';
  return `${day}/${month}/${year}`;
}

function formatQuantity(value) {
  if (value === null || value === undefined || String(value).trim() === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  return number.toLocaleString('el-GR', { maximumFractionDigits: 3, useGrouping: false });
}
