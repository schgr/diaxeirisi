import { escapeHtml } from '../../ui/components/forms.js';
import { renderMaterialPickerTableInput } from './shared/materialPicker.js';
import { formatPrintValue, renderPrintLayout } from './shared/printLayout.js';
import { parseRankAndName } from './shared/signatureBlock.js';
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
  return `<section data-exhp-doc-a-editor>
    ${renderCommitteeTier('primary', 'Πρωτοβάθμια Επιτροπή', data, catalog, true)}
    ${renderCommitteeTier('secondary', 'Δευτεροβάθμια Επιτροπή', data, catalog, false)}
  </section>`;
}

function renderCommitteeTier(tier, title, data, catalog, allowPreviousCommittee) {
  const selectedKey = data.committeeTier === tier ? data.formKey : '';
  const committeeDraft = findTierDraft(data, tier);
  const fields = committeeDraft?.specificFields || EMPTY_FIELDS;
  return `<section class="doc-a-committee-tier" data-doc-a-tier="${tier}">
    <h4 class="doc-a-committee-heading">${title}</h4>
    ${allowPreviousCommittee ? '<div class="exhp-committee-suggestion"><button class="secondary-button compact-print-button" data-use-previous-exhp-committee type="button">Χρήση προηγούμενης επιτροπής</button></div>' : ''}
    <div class="exhp-form-edit-fields doc-a-committee-fields">
      ${field('Πρόεδρος', 'specificFields.proedros', fields.proedros, tier === 'primary' ? 'proedros' : '')}
      ${field('Μέλος α', 'specificFields.melosA', fields.melosA, tier === 'primary' ? 'melosA' : '')}
      ${field('Μέλος β', 'specificFields.melosB', fields.melosB, tier === 'primary' ? 'melosB' : '')}
    </div>
    <label class="field doc-a-form-menu-field"><span>Επιλογή Κατάστασης</span>
      <select data-doc-a-menu="${tier}">
        <option value="">— Επίλεξε Κατάσταση —</option>
        ${AXRISTO_FORMS.map((form) => `<option value="${form.key}"${selectedKey === form.key ? ' selected' : ''}>ΚΑΤΑΣΤΑΣΗ «${form.code}» — ${form.title}</option>`).join('')}
      </select>
    </label>
    <div class="doc-a-menu-panels">${AXRISTO_FORMS.map((form) => {
      const draft = getFormDraft(data, tier, form.key);
      const rows = draft?.materials || [];
      return `<div class="new-exhp-support-module doc-a-form-panel" data-doc-a-form="${form.key}" data-committee-tier="${tier}"${selectedKey === form.key ? '' : ' hidden'}>
        <div class="requests-status-header"><div><h3>ΚΑΤΑΣΤΑΣΗ «${form.code}»</h3><p>${form.title}</p></div></div>
        <div data-doc-a-materials>${renderMaterialPickerTableInput(rows, catalog, null, { variant: 'axristo' })}</div>
        <div class="support-template-form-actions">
          <button class="secondary-button" data-preview-new-exhp-support="a" data-exhp-form-key="${form.key}" data-committee-tier="${tier}" type="button">Προεπισκόπηση Κατάστασης «${form.code}»</button>
          <button class="primary-button" data-save-new-exhp-support="a" data-exhp-form-key="${form.key}" data-committee-tier="${tier}" type="button">Αποθήκευση Κατάστασης «${form.code}»</button>
        </div>
      </div>`;
    }).join('')}</div>
  </section>`;
}

function getFormDraft(data, tier, formKey) {
  return data.formDrafts?.[`${tier}_${formKey}`]
    || (tier === 'primary' ? data.formDrafts?.[formKey] : null)
    || (data.committeeTier === tier && data.formKey === formKey ? data : null);
}

function findTierDraft(data, tier) {
  return AXRISTO_FORMS.map((form) => getFormDraft(data, tier, form.key)).find(Boolean) || null;
}

function renderPrint(data) {
  const form = AXRISTO_FORMS.find((item) => item.key === data.formKey) || AXRISTO_FORMS[0];
  const f = data.specificFields;
  const officers = data.financialOfficers || {};
  return renderPrintLayout(`<section class="exhp-axristo-form">
    <h1 class="exhp-form-title"><span>${data.committeeTier === 'secondary' ? 'ΔΕΥΤΕΡΟΒΑΘΜΙΑ ΕΠΙΤΡΟΠΗ' : 'ΠΡΩΤΟΒΑΘΜΙΑ ΕΠΙΤΡΟΠΗ'}</span><span>ΚΑΤΑΣΤΑΣΗ «${form.code}»</span><span>${form.title}</span><small>(Υπόδειγμα)</small></h1>
    ${printTable(data.materials)}
    <div class="exhp-axristo-signatures">
      <div class="exhp-axristo-manager"><span>Ο</span><strong>ΔΙΑΧΕΙΡΙΣΤΗΣ ΑΧΡΗΣΤΟΥ ΥΛΙΚΟΥ</strong>${signatureName(officers.manager)}</div>
      <div class="exhp-axristo-committee"><span>Η</span><strong>ΕΠΙΤΡΟΠΗ</strong><div class="exhp-axristo-committee-grid"><div><strong>Ο ΠΡΟΕΔΡΟΣ</strong>${signatureName(f.proedros)}</div><div class="exhp-axristo-members"><strong>ΤΑ ΜΕΛΗ</strong>${signatureName(f.melosA, 'Α')}${signatureName(f.melosB, 'Β')}</div></div></div>
    </div>
    <div class="exhp-axristo-accounting"><p>Βεβαιώνεται η ορθότητα - πληρότητα<br>των αναγραφομένων στοιχείων</p><p>Ο</p><strong>ΠΡΟΪΣΤΑΜΕΝΟΣ ΛΟΓΙΣΤΗΡΙΟΥ</strong>${signatureName(officers.ped)}</div>
    <style>.exhp-axristo-signatures{display:grid;grid-template-columns:1fr 1.45fr;gap:14mm;margin-top:6mm;text-align:center}.exhp-axristo-signatures span,.exhp-axristo-signatures strong{display:block}.exhp-axristo-committee-grid{display:grid;grid-template-columns:1fr 1fr;gap:12mm;margin-top:4mm}.exhp-axristo-members{margin-left:auto;min-width:42mm}.exhp-axristo-signature{min-height:14mm;margin-top:6mm;text-align:center}.exhp-axristo-signature-label{font-weight:700;margin-bottom:1mm}.exhp-axristo-signature-name,.exhp-axristo-signature-rank{display:block}.exhp-axristo-signature-name{font-weight:700}.exhp-axristo-members .exhp-axristo-signature+ .exhp-axristo-signature{margin-top:8mm}.exhp-axristo-accounting{margin-top:8mm;width:78mm;text-align:center}.exhp-axristo-table{font-size:7.6pt}.exhp-axristo-table td{height:8mm}.exhp-form-title small{display:block}</style>
  </section>`);
}

function printTable(rows) { const source = (rows || []).filter(hasValue); const body = (source.length ? source : [{}]).map((r, i) => `<tr><td>${v(r.seq || i + 1)}</td><td>${v(r.nomenclature)}</td><td>${v(r.description)}</td><td>${v(r.unit)}</td><td>${v(r.quantity)}</td><td>${v(r.quantityWords)}</td><td>${v(r.acquisitionPrice)}</td><td>${v(r.acquisitionDate)}</td><td>${v(r.notes)}</td></tr>`).join(''); return `<table class="exhp-materials-table exhp-axristo-table"><thead><tr><th rowspan="2">Α/Α</th><th rowspan="2">ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th rowspan="2">ΠΕΡΙΓΡΑΦΗ</th><th rowspan="2">ΜΜ</th><th colspan="2">ΠΟΣΟΤΗΤΑ</th><th rowspan="2">ΤΙΜΗ ΚΤΗΣΗΣ</th><th rowspan="2">ΗΜ/ΝΙΑ ΚΤΗΣΗΣ</th><th rowspan="2">ΠΑΡΑΤΗΡΗΣΕΙΣ</th></tr><tr><th>ΑΡΙΘΜ.</th><th>ΟΛΟΓΡΑΦΩΣ</th></tr></thead><tbody>${body}</tbody></table>`; }
export function validateDocAAxristo(data = {}) { const n = normalize(data); const checks = [requireNonEmpty(n.commonFields.monada, 'Μονάδα'), requireAtLeastOneRow(n.materials, `Υλικά Κατάστασης ${n.formKey.toUpperCase()}`)]; const errors = checks.filter((x) => !x.valid); return { valid: !errors.length, errors }; }
function normalize(data = {}) { return { aitiologiaCode: 'a', formCode: DOC_A_AXRISTO_DEFINITION.formCode, formKey: data.formKey || '', committeeTier: data.committeeTier || 'primary', commonFields: { monada: data.commonFields?.monada ?? '', addyAxp: data.commonFields?.addyAxp ?? '', date: data.commonFields?.date ?? '' }, financialOfficers: { manager: data.financialOfficers?.manager ?? '', ped: data.financialOfficers?.ped ?? '' }, specificFields: { ...EMPTY_FIELDS, ...(data.specificFields || {}) }, materials: Array.isArray(data.materials) ? data.materials : [], formDrafts: data.formDrafts || {} }; }
function field(label, path, value, committee = '') { return `<label class="field exhp-form-field-person"><span>${label}</span><input data-doc-a-field="${path}"${committee ? ` data-committee-field="${committee}"` : ''} value="${escapeHtml(value)}" /></label>`; }
function hasValue(r = {}) { return Boolean(String(r.shareNumber || r.description || '').trim()); } function v(value) { return formatPrintValue(value ?? ''); } function clone(value) { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
function signatureName(value = '', label = '') { const parsed = parseRankAndName(value); return `<div class="exhp-axristo-signature">${label ? `<span class="exhp-axristo-signature-label">${escapeHtml(label)}</span>` : ''}<span class="exhp-axristo-signature-name">${escapeHtml(parsed.name || '')}</span><span class="exhp-axristo-signature-rank">${escapeHtml(parsed.rank || '')}</span></div>`; }
