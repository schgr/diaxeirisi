import { escapeHtml } from '../../ui/components/forms.js';
import { renderMaterialPickerTableInput } from './shared/materialPicker.js';
import { renderMaterialsTablePrint } from './shared/materialsTable.js';
import {
  formatPrintValue,
  getGreekDateParts,
  renderPrintLayout
} from './shared/printLayout.js';
import { renderDocHeader } from './shared/docHeader.js';
import { renderSignatureBlock } from './shared/signatureBlock.js';
import { requireAtLeastOneRow, requireNonEmpty } from '../validation.js';

export const DOC_D_METASXIMATISMOS_DEFINITION = {
  aitiologiaCode: 'd',
  formCode: 'ΕΦΕΔ 506',
  formReference: 'Κ 2335/ΔΥΠ',
  title: 'Π Ρ Ω Τ Ο Κ Ο Λ Λ Ο\nΜΕΤΑΣΧΗΜΑΤΙΣΜΟΥ ΥΛΙΚΩΝ'
};

const EMPTY_DATA = {
  aitiologiaCode: DOC_D_METASXIMATISMOS_DEFINITION.aitiologiaCode,
  formCode: DOC_D_METASXIMATISMOS_DEFINITION.formCode,
  commonFields: { monada: '', addyAxp: '', date: '' },
  financialOfficers: { commander: '', manager: '' },
  specificFields: {
    topos: '',
    dgiArithmos: '',
    proedros: '',
    melosA: '',
    melosB: ''
  },
  materialsUsed: [],
  materialsProduced: []
};

const TRANSFORMATION_SIGNATURE_ROLES = [
  { key: 'commander', label: 'Ο ΔΙΟΙΚΗΤΗΣ' },
  { key: 'manager', label: 'Ο ΔΙΑΧΕΙΡΙΣΤΗΣ' },
  { key: 'committeeTitle', label: 'Η ΕΠΙΤΡΟΠΗ' },
  { key: 'committeePresident', label: 'Ο ΠΡΟΕΔΡΟΣ' },
  { key: 'committeeMembers', label: 'ΤΑ ΜΕΛΗ' }
];

export function createDocDMetasximatismos({ monada = '', addyAxp = '', onSave = null, data = {}, materialCatalog = [] } = {}) {
  let state = normalizeDocDData({
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
    materialsUsed: data.materialsUsed || [],
    materialsProduced: data.materialsProduced || []
  });

  return {
    renderEdit() {
      return renderDocDEdit(state, { materialCatalog });
    },
    renderPrint() {
      return renderDocDPrint(state);
    },
    getData() {
      return structuredCloneFallback(state);
    },
    setData(nextData = {}) {
      state = normalizeDocDData({ ...state, ...nextData });
      return structuredCloneFallback(state);
    },
    save(nextData = null) {
      if (nextData) state = normalizeDocDData({ ...state, ...nextData });
      const result = validateDocDMetasximatismos(state);
      if (result.valid && typeof onSave === 'function') onSave(structuredCloneFallback(state));
      return result;
    },
    validate() {
      return validateDocDMetasximatismos(state);
    }
  };
}

export function renderDocDEdit(data = {}, options = {}) {
  const normalized = normalizeDocDData(data);
  const fields = normalized.specificFields;

  return `
    <section class="doc-d-metasximatismos-editor" data-exhp-doc-d-editor>
      ${renderDocHeader({
        monada: normalized.commonFields.monada,
        addyAxp: normalized.commonFields.addyAxp,
        formCode: DOC_D_METASXIMATISMOS_DEFINITION.formReference,
        formNumber: DOC_D_METASXIMATISMOS_DEFINITION.formCode
      })}
      <div class="doc-d-edit-grid exhp-form-edit-fields">
        ${renderInputField('Μονάδα', 'commonFields.monada', normalized.commonFields.monada)}
        ${renderInputField('Α/Α ΕΧΠ', 'commonFields.addyAxp', normalized.commonFields.addyAxp)}
        ${renderInputField('Τόπος', 'specificFields.topos', fields.topos)}
        ${renderInputField('Ημερομηνία πρωτοκόλλου', 'commonFields.date', normalized.commonFields.date, 'date', '', 'date')}
        ${renderInputField('Δγή συγκρότησης', 'specificFields.dgiArithmos', fields.dgiArithmos)}
      </div>
      <div class="exhp-committee-suggestion">
        <button class="secondary-button compact-print-button" data-use-previous-exhp-committee type="button">Χρήση προηγούμενης επιτροπής</button>
      </div>
      <div class="doc-d-edit-grid exhp-form-edit-fields">
        ${renderInputField('Πρόεδρος', 'specificFields.proedros', fields.proedros, 'text', '', 'person', 'proedros')}
        ${renderInputField('Μέλος α', 'specificFields.melosA', fields.melosA, 'text', '', 'person', 'melosA')}
        ${renderInputField('Μέλος β', 'specificFields.melosB', fields.melosB, 'text', '', 'person', 'melosB')}
      </div>
      <section data-doc-d-materials="used">
        <h3>Α' ΧΡΗΣΙΜΟΠΟΙΗΘΕΝΤΑ ΕΙΔΗ</h3>
        ${renderMaterialPickerTableInput(normalized.materialsUsed, options.materialCatalog || [], 'docDUsedMaterialsChanged')}
      </section>
      <section data-doc-d-materials="produced">
        <h3>Β' ΠΑΡΑΧΘΕΝΤΑ ΕΙΔΗ</h3>
        ${renderMaterialPickerTableInput(normalized.materialsProduced, options.materialCatalog || [], 'docDProducedMaterialsChanged')}
      </section>
    </section>
  `;
}

export function renderDocDPrint(data = {}) {
  const normalized = normalizeDocDData(data);
  const fields = normalized.specificFields;
  const dateParts = getGreekDateParts(normalized.commonFields.date);
  const content = `
    ${renderDocHeader({
      monada: normalized.commonFields.monada,
      addyAxp: normalized.commonFields.addyAxp,
      formCode: DOC_D_METASXIMATISMOS_DEFINITION.formReference,
      formNumber: DOC_D_METASXIMATISMOS_DEFINITION.formCode
    })}
    <h1 class="exhp-form-title">
      <span>Π Ρ Ω Τ Ο Κ Ο Λ Λ Ο</span>
      <span>ΜΕΤΑΣΧΗΜΑΤΙΣΜΟΥ ΥΛΙΚΩΝ</span>
    </h1>
    <p>
      Στ ${fill(fields.topos)} σήμερα την ${fill(dateParts.day)} του μηνός ${fill(dateParts.month)} του έτους 20${fill(dateParts.year.slice(-2))}
      η υπογεγραμμένη Επιτροπή που συγκροτήθηκε με την (3) ${fill(fields.dgiArithmos)} Δγή και αποτελείται από τους:
    </p>
    <p>α. ${fill(fields.proedros)} ως Πρόεδρο και</p>
    <p>β. ${fill(fields.melosA)}</p>
    <p>γ. ${fill(fields.melosB)} ως μέλη,</p>
    <p>αφού συνήλθε,</p>
    <h2 class="exhp-centered-action">Π ρ ο έ β η</h2>
    <p>στη διαπίστωση του μετασχηματισμού (κατασκευή ή ανασκευή) των παρακάτω υλικών:</p>
    <section>
      <h2 class="exhp-section-heading">Α' ΧΡΗΣΙΜΟΠΟΙΗΘΕΝΤΑ ΕΙΔΗ</h2>
      ${renderMaterialsTablePrint(normalized.materialsUsed, { columnNumbers: ['4', '5', '6', '7', '8', '9'], notesLabel: 'Παρ/σεις' })}
    </section>
    <section>
      <h2 class="exhp-section-heading">Β' ΠΑΡΑΧΘΕΝΤΑ ΕΙΔΗ</h2>
      ${renderMaterialsTablePrint(normalized.materialsProduced, { columnNumbers: ['4', '5', '6', '7', '8', '9'], notesLabel: 'Παρ/σεις' })}
    </section>
    <p>Ο μετασχηματισμός των παραπάνω υλικών έγινε καλώς και σύμφωνα με τις ισχύουσες Δγές.</p>
    <p>Αφού συντάχθηκε το παρόν, υπογράφεται όπως παρακάτω:</p>
    ${renderSignatureBlock(TRANSFORMATION_SIGNATURE_ROLES, {
      commander: normalized.financialOfficers.commander,
      manager: normalized.financialOfficers.manager,
      committeeTitle: '',
      committeePresident: fields.proedros,
      committeeMembers: [fields.melosA, fields.melosB].filter(Boolean)
    })}
  `;

  return renderPrintLayout(content);
}

export function validateDocDMetasximatismos(data = {}) {
  const normalized = normalizeDocDData(data);
  const fields = normalized.specificFields;
  const checks = [
    requireNonEmpty(normalized.commonFields.monada, 'Μονάδα'),
    requireNonEmpty(normalized.commonFields.addyAxp, 'Α/Α ΕΧΠ'),
    requireNonEmpty(fields.topos, 'Τόπος'),
    requireNonEmpty(fields.dgiArithmos, 'Δγή συγκρότησης'),
    requireNonEmpty(fields.proedros, 'Πρόεδρος Επιτροπής'),
    requireAtLeastOneRow(normalized.materialsUsed, 'Χρησιμοποιηθέντα είδη')
  ];
  const errors = checks.filter((check) => !check.valid);
  return { valid: errors.length === 0, errors };
}

function normalizeDocDData(data = {}) {
  return {
    aitiologiaCode: DOC_D_METASXIMATISMOS_DEFINITION.aitiologiaCode,
    formCode: DOC_D_METASXIMATISMOS_DEFINITION.formCode,
    commonFields: {
      monada: data.commonFields?.monada ?? '',
      addyAxp: data.commonFields?.addyAxp ?? '',
      date: data.commonFields?.date ?? ''
    },
    financialOfficers: {
      commander: data.financialOfficers?.commander ?? '',
      manager: data.financialOfficers?.manager ?? ''
    },
    specificFields: {
      ...EMPTY_DATA.specificFields,
      ...(data.specificFields || {})
    },
    materialsUsed: normalizeMaterials(data.materialsUsed),
    materialsProduced: normalizeMaterials(data.materialsProduced)
  };
}

function normalizeMaterials(rows) {
  return Array.isArray(rows) ? rows : [];
}

function renderInputField(label, name, value = '', type = 'text', placeholder = '', width = 'narrow', committeeField = '') {
  const classes = ['field', `exhp-form-field-${width}`].filter(Boolean).join(' ');
  const committeeAttribute = committeeField ? ` data-committee-field="${escapeHtml(committeeField)}"` : '';
  return `
    <label class="${escapeHtml(classes)}">
      <span>${escapeHtml(label)}</span>
      <input data-doc-d-field="${escapeHtml(name)}"${committeeAttribute} type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
    </label>
  `;
}

function fill(value = '') {
  return `<span class="exhp-form-fill">${formatPrintValue(value)}</span>`;
}

function structuredCloneFallback(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}
