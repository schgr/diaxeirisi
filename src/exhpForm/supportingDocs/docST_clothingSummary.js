import { escapeHtml } from '../../ui/components/forms.js';
import { requireAtLeastOneRow, requireNonEmpty } from '../validation.js';

export const DOC_ST_CLOTHING_SUMMARY_DEFINITION = {
  aitiologiaCode: 'st',
  formCode: 'ΔΥΠ/189',
  title: 'Συγκεντρωτική των χορηγήσεων, αντικαταστάσεων και αναλήψεων ειδών ιματισμού και υποδήσεως κατά το μήνα'
};

const MOVEMENTS = [
  ['initial', 'Αρχική χορήγηση'],
  ['replacement', 'Αντικατάσταση'],
  ['return', 'Ανάληψη']
];

export function createDocSTClothingSummary({ monada = '', data = {}, onSave = null } = {}) {
  let state = normalize({ ...data, commonFields: { ...(data.commonFields || {}), monada: data.commonFields?.monada ?? monada } });
  return {
    renderEdit: () => renderDocSTEdit(state),
    renderPrint: () => renderDocSTPrint(state),
    getData: () => clone(state),
    setData(next = {}) { state = normalize({ ...state, ...next }); return clone(state); },
    save(next = null) { if (next) state = normalize(next); const result = validateDocSTClothingSummary(state); if (result.valid && onSave) onSave(clone(state)); return result; },
    validate: () => validateDocSTClothingSummary(state)
  };
}

export function renderDocSTEdit(data = {}) {
  const state = normalize(data);
  return `<section class="doc-st-clothing-editor" data-doc-st-editor>
    <div class="doc-z-edit-grid">
      ${field('Μονάδα', 'commonFields.monada', state.commonFields.monada)}
      ${field('Μήνας', 'specificFields.month', state.specificFields.month, 'month')}
      ${field('ΣΠ', 'specificFields.sp', state.specificFields.sp)}
      ${field('Δκτής Μονάδας', 'specificFields.commander', state.specificFields.commander)}
      ${field('Διαχειριστής Υλικού', 'specificFields.manager', state.specificFields.manager)}
    </div>
    <div class="table-wrapper" data-doc-st-table>
      <table class="data-table exhp-materials-table-input"><thead><tr><th>Α/Α</th><th>Είδος</th><th>Υπομονάδα</th><th>Ποσότητα</th><th>Κίνηση</th><th>Ενέργειες</th></tr></thead>
      <tbody data-doc-st-body>${state.entries.map(renderRow).join('')}</tbody></table>
      <button class="secondary-button" data-doc-st-add-row type="button">Προσθήκη γραμμής</button>
    </div>
    <div class="doc-st-totals">${MOVEMENTS.map(([key, label]) => `<strong>${label}: <span data-doc-st-total="${key}">${movementTotal(state.entries, key)}</span></strong>`).join('')}</div>
  </section>`;
}

export function renderDocSTRow(entry = {}, index = 0) { return renderRow(entry, index); }

export function renderDocSTPrint(data = {}) {
  const state = normalize(data);
  const units = [...new Set(state.entries.map((entry) => entry.subunit).filter(Boolean))].slice(0, 4);
  while (units.length < 4) units.push('');
  const itemNames = [...new Set(state.entries.map((entry) => entry.item).filter(Boolean))];
  const rows = itemNames.map((item) => `<tr><td>${escapeHtml(item)}</td>${MOVEMENTS.map(([movement]) => {
    const values = units.map((unit) => quantityFor(state.entries, item, unit, movement));
    return `${values.map((value) => `<td>${format(value)}</td>`).join('')}<td>${format(values.reduce((sum, value) => sum + value, 0))}</td>`;
  }).join('')}</tr>`).join('');
  return `<article class="print-document-area doc-st-print-page">
    <div class="doc-st-page-number">-257-</div><h1>ΚΑΤΑΣΤΑΣΗ</h1>
    <div class="doc-st-meta"><strong>ΔΥΠ/189</strong><span>Μονάδα ${escapeHtml(state.commonFields.monada)}</span><span>Μήνας ${escapeHtml(displayMonth(state.specificFields.month))}</span></div>
    <h2>${DOC_ST_CLOTHING_SUMMARY_DEFINITION.title}</h2>
    <table class="doc-st-summary-table"><thead><tr><th rowspan="3">ΕΙΔΟΣ</th>${MOVEMENTS.map(([, label]) => `<th colspan="5">${label.toUpperCase()}</th>`).join('')}</tr><tr>${MOVEMENTS.map(() => '<th colspan="4">ΥΠΟΜΟΝΑΔΕΣ</th><th rowspan="2">ΣΥΝΟΛΟ</th>').join('')}</tr><tr>${MOVEMENTS.map(() => units.map((unit) => `<th>${escapeHtml(unit)}</th>`).join('')).join('')}</tr></thead><tbody>${rows || '<tr><td>&nbsp;</td>'.concat('<td></td>'.repeat(15), '</tr>')}<tr class="doc-st-grand-total"><th>ΣΥΝΟΛΑ</th>${MOVEMENTS.map(([movement]) => { const values = units.map((unit) => state.entries.filter((e) => e.movement === movement && e.subunit === unit).reduce((s, e) => s + number(e.quantity), 0)); return `${values.map((v) => `<th>${format(v)}</th>`).join('')}<th>${format(movementTotal(state.entries, movement))}</th>`; }).join('')}</tr></tbody></table>
    <div class="doc-st-signatures"><div><span>ΘΕΩΡΗΘΗΚΕ</span><span>Ο</span><strong>Δκτής της Μονάδας</strong><span>${escapeHtml(state.specificFields.commander)}</span></div><div><span>ΣΠ ${escapeHtml(state.specificFields.sp)}</span><span>Ο</span><strong>ΔΧΣΤΗΣ ΥΛΙΚΟΥ</strong><span>${escapeHtml(state.specificFields.manager)}</span></div></div>
  </article>`;
}

export function validateDocSTClothingSummary(data = {}) {
  const state = normalize(data);
  const checks = [requireNonEmpty(state.commonFields.monada, 'Μονάδα'), requireNonEmpty(state.specificFields.month, 'Μήνας'), requireAtLeastOneRow(state.entries, 'Εγγραφές Κατάστασης')];
  const invalidRow = state.entries.find((entry) => !entry.item || !entry.subunit || !(number(entry.quantity) > 0) || !MOVEMENTS.some(([key]) => key === entry.movement));
  if (invalidRow) checks.push({ valid: false, message: 'Συμπλήρωσε είδος, υπομονάδα, θετική ποσότητα και κίνηση σε κάθε γραμμή.' });
  const errors = checks.filter((check) => !check.valid); return { valid: !errors.length, errors };
}

function renderRow(entry = {}, index = 0) { return `<tr data-doc-st-row><td data-doc-st-seq>${index + 1}</td><td><input data-doc-st-entry="item" value="${escapeHtml(entry.item || '')}" /></td><td><input data-doc-st-entry="subunit" value="${escapeHtml(entry.subunit || '')}" /></td><td><input data-doc-st-entry="quantity" type="number" min="0" step="0.001" value="${escapeHtml(entry.quantity ?? '')}" /></td><td><select data-doc-st-entry="movement">${MOVEMENTS.map(([key, label]) => `<option value="${key}"${entry.movement === key ? ' selected' : ''}>${label}</option>`).join('')}</select></td><td><button class="danger-button" data-doc-st-remove-row type="button">Διαγραφή</button></td></tr>`; }
function field(label, path, value = '', type = 'text') { return `<label class="field"><span>${label}</span><input data-doc-st-field="${path}" type="${type}" value="${escapeHtml(value || '')}" /></label>`; }
function normalize(data = {}) { return { aitiologiaCode: 'st', formCode: DOC_ST_CLOTHING_SUMMARY_DEFINITION.formCode, commonFields: { monada: data.commonFields?.monada || '', addyAxp: data.commonFields?.addyAxp || '', date: data.commonFields?.date || '' }, specificFields: { month: data.specificFields?.month || '', sp: data.specificFields?.sp || '', commander: data.specificFields?.commander || '', manager: data.specificFields?.manager || '' }, entries: Array.isArray(data.entries) && data.entries.length ? data.entries.map((e) => ({ item: e.item || '', subunit: e.subunit || '', quantity: e.quantity ?? '', movement: e.movement || 'initial' })) : [{ item: '', subunit: '', quantity: '', movement: 'initial' }] }; }
function quantityFor(entries, item, unit, movement) { return entries.filter((e) => e.item === item && e.subunit === unit && e.movement === movement).reduce((sum, e) => sum + number(e.quantity), 0); }
function movementTotal(entries, movement) { return entries.filter((e) => e.movement === movement).reduce((sum, e) => sum + number(e.quantity), 0); }
function number(value) { const result = Number(value); return Number.isFinite(result) ? result : 0; }
function format(value) { return value ? value.toLocaleString('el-GR', { maximumFractionDigits: 3 }) : ''; }
function displayMonth(value) { const [year, month] = String(value || '').split('-'); return year && month ? `${month}/${year}` : value || ''; }
function clone(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
