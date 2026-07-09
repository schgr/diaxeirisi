import { escapeHtml } from '../../ui/components/forms.js';
import { renderMaterialPickerTableInput } from './shared/materialPicker.js';
import { parseRankAndName } from './shared/signatureBlock.js';
import { requireAtLeastOneRow, requireNonEmpty } from '../validation.js';

export const DOC_IA_PYROMAXIKA_DEFINITION = {
  aitiologiaCode: 'ia',
  formCode: 'ΔΥΠ/192',
  title: 'ΠΙΣΤΟΠΟΙΗΤΙΚΟ ΚΑΤΑΝΑΛΩΣΕΩΣ ΠΥΡΟΜΑΧΙΚΩΝ'
};

const LIST_LENGTH = 5;

const EMPTY_DATA = {
  aitiologiaCode: DOC_IA_PYROMAXIKA_DEFINITION.aitiologiaCode,
  formCode: DOC_IA_PYROMAXIKA_DEFINITION.formCode,
  commonFields: { monada: '', addyAxp: '', date: '' },
  financialOfficers: { commander: '', ped: '', manager: '' },
  specificFields: {
    vathmosOnomatepwnymo: '',
    monadaTmima: '',
    imerominia: '',
    imeraEvdomadas: '',
    consumedAmmo: ['', '', '', '', ''],
    returnedPackaging: ['', '', '', '', ''],
    consumedMaterials: [],
    returnedPackagingMaterials: [],
    antigrafa: ''
  },
  materials: []
};

const SIGNATURE_ROLES = [
  { key: 'ped', label: 'Ο ΠΕΔ' },
  { key: 'partialManager', label: 'Ο Μερικός Διαχειριστής' },
  { key: 'firingOfficer', label: 'Ο Αξκός Βολής ή εκπτής' }
];

export function createDocIAPyromaxika({ monada = '', addyAxp = '', onSave = null, data = {}, materialCatalog = [] } = {}) {
  let state = normalizeDocIAData({
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
    materials: []
  });

  return {
    renderEdit() {
      return renderDocIAEdit(state, { materialCatalog });
    },
    renderPrint() {
      return renderDocIAPrint(state);
    },
    getData() {
      return structuredCloneFallback(state);
    },
    setData(nextData = {}) {
      state = normalizeDocIAData({ ...state, ...nextData });
      return structuredCloneFallback(state);
    },
    save(nextData = null) {
      if (nextData) state = normalizeDocIAData({ ...state, ...nextData });
      const result = validateDocIAPyromaxika(state);
      if (result.valid && typeof onSave === 'function') onSave(structuredCloneFallback(state));
      return result;
    },
    validate() {
      return validateDocIAPyromaxika(state);
    }
  };
}

export function renderDocIAEdit(data = {}, { materialCatalog = [] } = {}) {
  const normalized = normalizeDocIAData(data);
  const fields = normalized.specificFields;

  return `
    <section class="doc-ia-pyromaxika-editor" data-exhp-doc-ia-editor>
      <div class="doc-ia-edit-grid">
        ${renderInputField('Μονάδα', 'commonFields.monada', normalized.commonFields.monada)}
        ${renderInputField('Α/Α ΕΧΠ', 'commonFields.addyAxp', normalized.commonFields.addyAxp)}
        ${renderInputField('Βαθμός - Ονοματεπώνυμο', 'specificFields.vathmosOnomatepwnymo', fields.vathmosOnomatepwnymo)}
        ${renderInputField('Μονάδα ή Τμήμα Μονάδας', 'specificFields.monadaTmima', fields.monadaTmima)}
        ${renderInputField('Ημερομηνία', 'specificFields.imerominia', fields.imerominia, 'date')}
        ${renderInputField('Ημέρα εβδομάδας', 'specificFields.imeraEvdomadas', fields.imeraEvdomadas)}
        ${renderInputField('Αντίγραφα', 'specificFields.antigrafa', fields.antigrafa, 'number')}
      </div>
      <section class="doc-ia-materials-section" data-doc-ia-materials="consumed">
        <h3>Καταναλωθέντα πυρομαχικά εκπαιδεύσεως</h3>
        ${renderMaterialPickerTableInput(fields.consumedMaterials, materialCatalog, 'docIAConsumedMaterialsChanged', { variant: 'dyp192' })}
      </section>
      <section class="doc-ia-materials-section" data-doc-ia-materials="returned">
        <h3>Περισυλλεχθέντα κενά συσκευασίας</h3>
        ${renderMaterialPickerTableInput(fields.returnedPackagingMaterials, materialCatalog, 'docIAReturnedPackagingMaterialsChanged', { variant: 'dyp192' })}
      </section>
    </section>
  `;
}

export function renderDocIAPrint(data = {}) {
  const normalized = normalizeDocIAData(data);
  const fields = normalized.specificFields;
  const officers = normalized.financialOfficers;
  const consumedPages = chunkList(normalizeMaterialRowsForPrint(fields.consumedMaterials), LIST_LENGTH * 2);
  const returnedPages = chunkList(normalizeMaterialRowsForPrint(fields.returnedPackagingMaterials), LIST_LENGTH * 2);
  const pageCount = Math.max(consumedPages.length, returnedPages.length, 1);

  return Array.from({ length: pageCount }, (_unused, pageIndex) => `
    <article class="official-overlay-page dyp192-page print-document-area" data-exhp-doc-ia-print data-dyp192-page="${pageIndex + 1}">
      <img src="./assets/official-forms/dyp192-clean.png" alt="ΔΥΠ/192 - Πιστοποιητικό Καταναλώσεως Πυρομαχικών" />
      ${dyp192Overlay(fields.vathmosOnomatepwnymo, 9.51, 9.85, 71.34, 3.69, 'dyp192-officer-overlay')}
      ${dyp192Overlay(fields.monadaTmima || normalized.commonFields.monada, 9.51, 14.05, 36.28, 1.72)}
      ${dyp192Overlay(formatDisplayDate(fields.imerominia), 9.51, 19.98, 26.20, 1.72)}
      ${dyp192Overlay(fields.imeraEvdomadas, 56.24, 19.98, 26.74, 1.72)}
      ${renderDyp192ListOverlays(consumedPages[pageIndex] || [], 33.03)}
      ${renderDyp192ListOverlays(returnedPages[pageIndex] || [], 59.15)}
      ${dyp192Overlay(fields.antigrafa, 35.28, 81.27, 4.72, 1.57)}
      ${dyp192SignatureOverlay(officers.ped, 9.90, 96.35, 23.40, 2.95)}
      ${dyp192SignatureOverlay(fields.vathmosOnomatepwnymo, 52.80, 96.35, 29.40, 2.95)}
    </article>
  `).join('');
}

export function validateDocIAPyromaxika(data = {}) {
  const normalized = normalizeDocIAData(data);
  const fields = normalized.specificFields;
  const checks = [
    requireNonEmpty(fields.vathmosOnomatepwnymo, 'Βαθμός - Ονοματεπώνυμο'),
    requireNonEmpty(fields.monadaTmima, 'Μονάδα ή Τμήμα Μονάδας'),
    requireNonEmpty(fields.imerominia, 'Ημερομηνία'),
    requireAtLeastOneRow(
      fields.consumedMaterials.filter((item) => item.description || item.shareNumber || item.quantity),
      'Καταναλωθέντα πυρομαχικά'
    )
  ];
  const errors = checks.filter((check) => !check.valid);
  return { valid: errors.length === 0, errors };
}

function normalizeDocIAData(data = {}) {
  const specificFields = {
    ...EMPTY_DATA.specificFields,
    ...(data.specificFields || {})
  };
  specificFields.imeraEvdomadas = getGreekWeekday(specificFields.imerominia)
    || specificFields.imeraEvdomadas;
  const consumedMaterials = normalizeAmmoRows(
    specificFields.consumedMaterials,
    specificFields.consumedAmmo
  );
  const returnedPackagingMaterials = normalizeAmmoRows(
    specificFields.returnedPackagingMaterials,
    specificFields.returnedPackaging
  );

  return {
    aitiologiaCode: DOC_IA_PYROMAXIKA_DEFINITION.aitiologiaCode,
    formCode: DOC_IA_PYROMAXIKA_DEFINITION.formCode,
    commonFields: {
      monada: data.commonFields?.monada ?? '',
      addyAxp: data.commonFields?.addyAxp ?? '',
      date: data.commonFields?.date ?? ''
    },
    financialOfficers: {
      ...EMPTY_DATA.financialOfficers,
      ...(data.financialOfficers || {})
    },
    specificFields: {
      ...specificFields,
      consumedMaterials,
      returnedPackagingMaterials,
      consumedAmmo: rowsToFixedList(consumedMaterials, specificFields.consumedAmmo),
      returnedPackaging: rowsToFixedList(returnedPackagingMaterials, specificFields.returnedPackaging)
    },
    materials: []
  };
}

function normalizeFixedList(items) {
  const source = Array.isArray(items) ? items : [];
  return Array.from({ length: Math.max(LIST_LENGTH, source.length) }, (_, index) => source[index] ?? '');
}

function normalizeAmmoRows(rows, fallbackList = []) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const normalizedRows = sourceRows.map((row, index) => normalizeAmmoRow(row, index));
  if (normalizedRows.some(hasAmmoRowValue)) return normalizedRows;
  const legacyRows = normalizeFixedList(fallbackList)
    .filter((value) => String(value || '').trim())
    .map((description, index) => normalizeAmmoRow({ description }, index));
  return legacyRows.length ? legacyRows : [normalizeAmmoRow({}, 0)];
}

function normalizeAmmoRow(row = {}, index = 0) {
  return {
    seq: row?.seq ?? index + 1,
    shareNumber: row?.shareNumber ?? row?.share_number ?? '',
    nomenclature: row?.nomenclature ?? row?.nomenclatureNumber ?? row?.nominalNumber ?? '',
    description: row?.description ?? '',
    unit: row?.unit ?? row?.measurementUnit ?? '',
    quantity: row?.quantity ?? ''
  };
}

function rowsToFixedList(rows, fallbackList = []) {
  const printable = (Array.isArray(rows) ? rows : [])
    .filter(hasAmmoRowValue)
    .map(formatDyp192MaterialLine);
  const source = printable.length ? printable : normalizeFixedList(fallbackList);
  return normalizeFixedList(source);
}

function normalizeMaterialRowsForPrint(rows) {
  const source = Array.isArray(rows) ? rows.filter(hasAmmoRowValue) : [];
  return source.length ? source : [normalizeAmmoRow({}, 0)];
}

function hasAmmoRowValue(row = {}) {
  return Boolean(
    String(row.shareNumber || '').trim() ||
    String(row.description || '').trim() ||
    String(row.unit || '').trim() ||
    String(row.quantity || '').trim()
  );
}

function renderInputField(label, name, value = '', type = 'text', placeholder = '') {
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <input data-doc-ia-field="${escapeHtml(name)}" type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
    </label>
  `;
}

function blank(value, className = '') {
  const classes = ['doc-ia-fill', className].filter(Boolean).join(' ');
  return `<span class="${escapeHtml(classes)}">${escapeHtml(value ?? '')}</span>`;
}

function renderDyp192ListOverlays(items, firstTop) {
  return Array.from({ length: LIST_LENGTH }, (_unused, rowIndex) => {
    const firstColumn = items[rowIndex]
      ? renderDyp192MaterialOverlays(items[rowIndex], 23.80, firstTop + rowIndex * 3.695, 28.90)
      : '';
    const secondColumnIndex = rowIndex + LIST_LENGTH;
    const secondColumn = items[secondColumnIndex]
      ? renderDyp192MaterialOverlays(items[secondColumnIndex], 53.15, firstTop + rowIndex * 3.695, 29.68, true)
      : '';
    return `${firstColumn}${secondColumn}`;
  }).join('');
}

function renderDyp192MaterialOverlays(item, left, top, width, secondary = false) {
  const quantityWidth = 5.4;
  const gap = 0.3;
  const detailsWidth = width - quantityWidth - gap;
  const details = [item.description || '', item.unit || '']
    .filter((value) => String(value).trim())
    .join(' / ');
  const quantity = item.quantity === null || item.quantity === undefined ? '' : item.quantity;
  const secondaryClass = secondary ? ' dyp192-list-overlay-secondary' : '';
  return [
    dyp192Overlay(
      details,
      left,
      top,
      detailsWidth,
      1.72,
      `dyp192-list-overlay dyp192-list-description${secondaryClass}`
    ),
    dyp192Overlay(
      quantity,
      left + detailsWidth + gap,
      top,
      quantityWidth,
      1.72,
      `dyp192-list-overlay dyp192-list-quantity${secondaryClass}`
    )
  ].join('');
}

function formatDyp192MaterialLine(item = {}) {
  if (typeof item === 'string') return item;
  return [
    item.description || '',
    item.unit || '',
    item.quantity === null || item.quantity === undefined ? '' : item.quantity
  ].filter((value) => String(value).trim()).join(' / ');
}

function dyp192Overlay(value, left, top, width, height, className = '') {
  return `<div class="official-overlay-field dyp192-overlay ${escapeHtml(className)}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${escapeHtml(value ?? '')}</div>`;
}

function dyp192SignatureOverlay(value, left, top, width, height) {
  const parsed = parseRankAndName(value);
  const name = parsed.name || (!parsed.rank ? String(value || '').trim() : '');
  const rank = parsed.rank || '';
  return `
    <div class="official-overlay-field dyp192-overlay dyp192-signature-overlay" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">
      <span>${escapeHtml(name)}</span>
      <span>${escapeHtml(rank)}</span>
    </div>
  `;
}

function chunkList(items, size) {
  const source = Array.isArray(items) && items.length ? items : [''];
  const chunks = [];
  for (let index = 0; index < source.length; index += size) {
    chunks.push(source.slice(index, index + size));
  }
  return chunks.length ? chunks : [[]];
}

function formatDisplayDate(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  if (!year || !month || !day) return value || '';
  return `${day}/${month}/${year}`;
}

export function getGreekWeekday(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return '';
  }
  return ['Κυριακή', 'Δευτέρα', 'Τρίτη', 'Τετάρτη', 'Πέμπτη', 'Παρασκευή', 'Σάββατο'][date.getUTCDay()];
}

function structuredCloneFallback(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
