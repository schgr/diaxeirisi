import { escapeHtml } from '../../ui/components/forms.js';
import { renderMaterialPickerTableInput } from './shared/materialPicker.js';
import { formatPrintValue, renderPrintLayout } from './shared/printLayout.js';
import { requireAtLeastOneRow, requireNonEmpty } from '../validation.js';

export const DOC_A_AXRISTO_DEFINITION = { aitiologiaCode: 'a', formCode: 'ΚΑΤΑΣΤΑΣΕΙΣ Α, Β, Δ2, Δ3' };
export const AXRISTO_FORMS = [
  { key: 'a', code: 'Α', title: 'ΥΛΙΚΑ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΜΕΤΑΦΕΡΘΟΥΝ ΣΕ ΧΩΡΟΥΣ ΥΓΕΙΟΝΟΜΙΚΗΣ ΤΑΦΗΣ' },
  { key: 'b', code: 'Β', title: 'ΥΛΙΚΑ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΜΕΤΑΤΡΑΠΟΥΝ ΣΕ ΠΡΩΤΕΣ ΥΛΕΣ ΓΙΑ ΑΞΙΟΠΟΙΗΣΗ ΤΟΥΣ ΑΠΟ ΤΟ ΓΕΕΘΑ' },
  { key: 'd2', code: 'Δ2', title: 'ΑΧΡΗΣΤΕΣ ΗΛΕΚΤΡΙΚΕΣ ΣΤΗΛΕΣ ΚΑΙ ΣΥΣΣΩΡΕΥΤΕΣ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΑΞΙΟΠΟΙΗΘΟΥΝ ΑΠΟ ΤΟ ΓΕΕΘΑ ΩΣ ΑΥΤΟΥΣΙΑ Ή (ΔΙΑΣ) ΝΑ ΠΑΡΑΔΟΘΟΥΝ ΣΕ ΕΞΟΥΣΙΟΔΟΤΗΜΕΝΟΥΣ ΦΟΡΕΙΣ ΕΝΑΛΛΑΚΤΙΚΗΣ ΔΙΑΧΕΙΡΙΣΗΣ' },
  { key: 'd3', code: 'Δ3', title: 'ΕΛΑΣΤΙΚΑ ΕΠΙΣΩΤΡΑ ΟΧΗΜΑΤΩΝ - ΜΕΣΩΝ ΠΟΥ ΠΡΟΤΕΙΝΕΤΑΙ ΝΑ ΑΞΙΟΠΟΙΗΘΟΥΝ ΑΠΟ ΤΟ ΓΕΕΘΑ ΩΣ ΑΥΤΟΥΣΙΑ Ή (ΔΙΑΣ) ΝΑ ΠΑΡΑΔΟΘΟΥΝ ΣΕ ΕΞΟΥΣΙΟΔΟΤΗΜΕΝΟΥΣ ΦΟΡΕΙΣ ΕΝΑΛΛΑΚΤΙΚΗΣ ΔΙΑΧΕΙΡΙΣΗΣ' }
];
const EMPTY_FIELDS = { proedros: '', melosA: '', melosB: '', logistirio: '' };

export function createDocAAxristo({ monada = '', addyAxp = '', onSave = null, data = {}, materialCatalog = [] } = {}) {
  let state = normalize({ ...data, commonFields: { ...(data.commonFields || {}), monada: data.commonFields?.monada ?? monada, addyAxp: data.commonFields?.addyAxp ?? addyAxp } });
  return {
    renderEdit: () => renderEdit(state, materialCatalog), renderPrint: () => renderPrint(state), getData: () => clone(state),
    setData(next = {}) { state = normalize({ ...state, ...next }); return clone(state); },
    save(next = null) { if (next) state = normalize({ ...state, ...next }); const result = validateDocAAxristo(state); if (result.valid && typeof onSave === 'function') onSave(clone(state)); return result; },
    validate: () => validateDocAAxristo(state)
  };
}

function renderEdit(data, catalog) {
  const selectedKey = data.formKey || 'a';
  return `<section data-exhp-doc-a-editor>
    <div class="doc-a-form-choice-grid" role="list" aria-label="Δικαιολογητικά αχρήστου υλικού">
      ${AXRISTO_FORMS.map((form) => `<button class="doc-a-form-choice${form.key === selectedKey ? ' is-selected' : ''}" data-select-doc-a-form="${form.key}" type="button" role="listitem"><strong>ΚΑΤΑΣΤΑΣΗ «${form.code}»</strong><span>${form.title}</span></button>`).join('')}
    </div>
    <div class="doc-a-selected-form">${AXRISTO_FORMS.map((form) => {
    const draft = data.formDrafts?.[form.key] || (form.key === data.formKey ? data : null);
    const fields = draft?.specificFields || EMPTY_FIELDS;
    const rows = draft?.materials || [];
    return `<section class="new-exhp-support-module doc-a-form-panel" data-doc-a-form="${form.key}"${form.key === selectedKey ? '' : ' hidden'}>
      <div class="requests-status-header"><div><h3>ΚΑΤΑΣΤΑΣΗ «${form.code}»</h3><p>${form.title}</p></div></div>
      <h4 class="doc-a-committee-heading">Πρωτοβάθμια Επιτροπή</h4>
      <div class="exhp-committee-suggestion"><button class="secondary-button compact-print-button" data-use-previous-exhp-committee type="button">Χρήση προηγούμενης επιτροπής</button></div>
      <div class="exhp-form-edit-fields doc-a-committee-fields">
        ${field('Πρόεδρος', 'specificFields.proedros', fields.proedros, 'proedros')}${field('Μέλος α', 'specificFields.melosA', fields.melosA, 'melosA')}${field('Μέλος β', 'specificFields.melosB', fields.melosB, 'melosB')}${field('Προϊστάμενος Λογιστηρίου', 'specificFields.logistirio', fields.logistirio)}
      </div>
      <div data-doc-a-materials>${renderMaterialPickerTableInput(rows, catalog, null, { variant: 'axristo' })}</div>
      <div class="support-template-form-actions">
        <button class="secondary-button" data-preview-new-exhp-support="a" data-exhp-form-key="${form.key}" type="button">Προεπισκόπηση Κατάστασης «${form.code}»</button>
        <button class="primary-button" data-save-new-exhp-support="a" data-exhp-form-key="${form.key}" type="button">Αποθήκευση Κατάστασης «${form.code}»</button>
      </div>
    </section>`;
  }).join('')}</div></section>`;
}

function renderPrint(data) {
  const form = AXRISTO_FORMS.find((item) => item.key === data.formKey) || AXRISTO_FORMS[0];
  const f = data.specificFields;
  return renderPrintLayout(`<section class="exhp-axristo-form">
    <h1 class="exhp-form-title"><span>ΚΑΤΑΣΤΑΣΗ «${form.code}»</span><span>${form.title}</span><small>(Υπόδειγμα)</small></h1>
    ${printTable(data.materials)}
    <div class="exhp-axristo-signatures"><div><span>Ο</span><strong>ΔΙΑΧΕΙΡΙΣΤΗΣ ΑΧΡΗΣΤΟΥ ΥΛΙΚΟΥ</strong></div><div><span>Η</span><strong>ΕΠΙΤΡΟΠΗ</strong><p>Ο ΠΡΟΕΔΡΟΣ &nbsp;&nbsp;&nbsp;&nbsp; ΤΑ ΜΕΛΗ</p><p>${v(f.proedros)} &nbsp; ${v(f.melosA)} &nbsp; ${v(f.melosB)}</p></div></div>
    <div class="exhp-axristo-accounting"><p>Βεβαιώνεται η ορθότητα - πληρότητα<br>των αναγραφομένων στοιχείων</p><p>Ο</p><strong>ΠΡΟΪΣΤΑΜΕΝΟΣ ΛΟΓΙΣΤΗΡΙΟΥ</strong><p>${v(f.logistirio)}</p></div>
    <style>.exhp-axristo-signatures{display:grid;grid-template-columns:1fr 1.35fr;gap:12mm;margin-top:5mm;text-align:center}.exhp-axristo-signatures span,.exhp-axristo-signatures strong{display:block}.exhp-axristo-accounting{margin-top:7mm;width:75mm;text-align:center}.exhp-axristo-table{font-size:7.6pt}.exhp-axristo-table td{height:8mm}.exhp-form-title small{display:block}</style>
  </section>`);
}

function printTable(rows) { const source = (rows || []).filter(hasValue); const body = (source.length ? source : [{}]).map((r, i) => `<tr><td>${v(r.seq || i + 1)}</td><td>${v(r.nomenclature)}</td><td>${v(r.description)}</td><td>${v(r.unit)}</td><td>${v(r.quantity)}</td><td>${v(r.quantityWords)}</td><td>${v(r.acquisitionPrice)}</td><td>${v(r.acquisitionDate)}</td><td>${v(r.notes)}</td></tr>`).join(''); return `<table class="exhp-materials-table exhp-axristo-table"><thead><tr><th rowspan="2">Α/Α</th><th rowspan="2">ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th rowspan="2">ΠΕΡΙΓΡΑΦΗ</th><th rowspan="2">ΜΜ</th><th colspan="2">ΠΟΣΟΤΗΤΑ</th><th rowspan="2">ΤΙΜΗ ΚΤΗΣΗΣ</th><th rowspan="2">ΗΜ/ΝΙΑ ΚΤΗΣΗΣ</th><th rowspan="2">ΠΑΡΑΤΗΡΗΣΕΙΣ</th></tr><tr><th>ΑΡΙΘΜ.</th><th>ΟΛΟΓΡΑΦΩΣ</th></tr></thead><tbody>${body}</tbody></table>`; }
export function validateDocAAxristo(data = {}) { const n = normalize(data); const checks = [requireNonEmpty(n.commonFields.monada, 'Μονάδα'), requireAtLeastOneRow(n.materials, `Υλικά Κατάστασης ${n.formKey.toUpperCase()}`)]; const errors = checks.filter((x) => !x.valid); return { valid: !errors.length, errors }; }
function normalize(data = {}) { return { aitiologiaCode: 'a', formCode: DOC_A_AXRISTO_DEFINITION.formCode, formKey: data.formKey || 'a', commonFields: { monada: data.commonFields?.monada ?? '', addyAxp: data.commonFields?.addyAxp ?? '', date: data.commonFields?.date ?? '' }, financialOfficers: { manager: data.financialOfficers?.manager ?? '' }, specificFields: { ...EMPTY_FIELDS, ...(data.specificFields || {}) }, materials: Array.isArray(data.materials) ? data.materials : [], formDrafts: data.formDrafts || {} }; }
function field(label, path, value, committee = '') { return `<label class="field exhp-form-field-person"><span>${label}</span><input data-doc-a-field="${path}"${committee ? ` data-committee-field="${committee}"` : ''} value="${escapeHtml(value)}" /></label>`; }
function hasValue(r = {}) { return Boolean(String(r.shareNumber || r.description || '').trim()); } function v(value) { return formatPrintValue(value ?? ''); } function clone(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
