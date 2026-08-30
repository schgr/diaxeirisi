import { escapeHtml } from '../../../components/forms.js';
import { numberToGreekWords } from '../../../pages/sharesPage.js';
import {
  renderClothingDisposalStatement,
  renderOfficialUselessDifferencesProtocol,
  renderOfficialUselessProtocol
} from '../../../../exhpDocuments.mjs';
import { formatDate } from '../../shared.js';
import {
  USELESS_MATERIAL_FORMS,
  officialExhpDocumentTitle,
  prepareUselessProtocolData
} from './officialDocumentRules.js';

export function renderUselessMaterialTabs() {
  return [...new Set(USELESS_MATERIAL_FORMS.map((item) => item.group))].map((group) => `
    <section class="exhp-document-tab-group">
      <h4>${escapeHtml(group)}</h4>
      <div class="exhp-document-subtabs">
        ${USELESS_MATERIAL_FORMS.filter((item) => item.group === group).map((item) => `<button class="secondary-button" data-open-useless-material-form="${item.key}" type="button">${escapeHtml(item.label)}</button>`).join('')}
      </div>
    </section>
  `).join('');
}

export function renderUselessBForm(data) {
  const value = data || {};
  return `
    <section class="exhp-entry-section">
      <h4>Πρωτόκολλο Δευτεροβάθμιας Επιτροπής</h4>
      <div class="exhp-controls">
        ${supportInput('Πρόεδρος', 'useless-b', 'president', value.president)}
        ${supportInput('Α΄Μέλος', 'useless-b', 'memberA', value.memberA)}
        ${supportInput('Β΄Μέλος', 'useless-b', 'memberB', value.memberB)}
        ${supportInput('Δκτής', 'useless-b', 'commander', value.commander)}
        ${supportInput('Γεν. Διαχειριστής', 'useless-b', 'generalManager', value.generalManager)}
        ${supportInput('Διαχειριστής Αχρήστου Υλικού', 'useless-b', 'uselessManager', value.uselessManager)}
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αρ. Μερίδας</th>
              <th>Αρ. Ονομαστικού</th>
              <th>Περιγραφή</th>
              <th>ΜΜ</th>
              <th>Ποσότητα Πρωτοβάθμιας</th>
              <th>Ποσότητα Δευτεροβάθμιας</th>
              <th>Διαφορά (+)</th>
              <th>Διαφορά (-)</th>
              <th></th>
            </tr>
          </thead>
          <tbody data-useless-b-items>
            ${renderExhpDocumentRows('useless-b', value.items || [])}
          </tbody>
        </table>
      </div>
      <div class="addy-save-row">
        <button class="secondary-button" data-add-exhp-doc-row="useless-b" type="button">+ Προσθήκη Υλικού</button>
        <div class="row-actions">
          <button class="secondary-button" data-preview-exhp-doc="useless_material_b" type="button">Προβολή</button>
          <button class="primary-button" data-save-exhp-doc="useless_material_b" type="button">Αποθήκευση</button>
        </div>
      </div>
    </section>
  `;
}

export function renderAmmoTable(title, kind, items) {
  return `
    <section class="exhp-entry-section">
      <h4>${escapeHtml(title)}</h4>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Περιγραφή</th>
              <th>Ποσότητα</th>
              <th></th>
            </tr>
          </thead>
          <tbody data-${kind}-items>
            ${renderExhpDocumentRows(kind, items)}
          </tbody>
        </table>
      </div>
      <div class="addy-save-row">
        <button class="secondary-button" data-add-exhp-doc-row="${kind}" type="button">+ Προσθήκη Γραμμής</button>
      </div>
    </section>
  `;
}

function supportInput(label, group, name, value = '', type = 'text') {
  const inputValue = type === 'date' && !value ? '' : value ?? '';
  return `
    <label class="field support-field">
      <span>${escapeHtml(label)}</span>
      <input data-${group}-field="${name}" type="${type}" value="${escapeHtml(inputValue)}" autocomplete="off" />
    </label>
  `;
}

function renderExhpDocumentRows(kind, items) {
  if (!items.length) {
    return renderExhpDocumentItemRow(kind, {}, 0);
  }
  return items.map((item, index) => renderExhpDocumentItemRow(kind, item, index)).join('');
}

export function renderExhpDocumentItemRow(kind, item, index = 0) {
  if (kind === 'useless-a') {
    return `
      <tr>
        <td class="official-admin-column">${rowInputControl('shareNumber', item.shareNumber)}</td>
        <td>${escapeHtml(item.aa || index + 1)}</td>
        ${rowInput('nomenclatureNumber', item.nomenclatureNumber, 'text', Boolean(item.shareNumber))}
        ${rowInput('description', item.description, 'text', Boolean(item.shareNumber))}
        ${rowInput('unit', item.unit, 'text', Boolean(item.shareNumber))}
        ${rowInput('quantity', item.quantity, 'number')}
        ${rowInput('remarks', item.remarks)}
        <td class="official-admin-column"><button class="danger-button" data-remove-exhp-doc-row type="button">Διαγραφή</button></td>
      </tr>
    `;
  }

  if (kind === 'useless-b') {
    return `
      <tr>
        ${rowInput('shareNumber', item.shareNumber)}
        ${rowInput('nomenclatureNumber', item.nomenclatureNumber, 'text', Boolean(item.shareNumber))}
        ${rowInput('description', item.description, 'text', Boolean(item.shareNumber))}
        ${rowInput('unit', item.unit, 'text', Boolean(item.shareNumber))}
        ${rowInput('qtyPrimary', item.qtyPrimary, 'number')}
        ${rowInput('qtySecondary', item.qtySecondary, 'number')}
        ${rowInput('diffPlus', item.diffPlus, 'number')}
        ${rowInput('diffMinus', item.diffMinus, 'number')}
        <td><button class="danger-button" data-remove-exhp-doc-row type="button">Διαγραφή</button></td>
      </tr>
    `;
  }

  return `
    <tr>
      ${rowInput('description', item.description)}
      ${rowInput('quantity', item.quantity, 'number')}
      <td><button class="danger-button" data-remove-exhp-doc-row type="button">Διαγραφή</button></td>
    </tr>
  `;
}

function rowInput(name, value = '', type = 'text', readonly = false) {
  const inputValue = type === 'date' && !value ? '' : value ?? '';
  return `<td><input data-row-field="${name}" type="${type}" value="${escapeHtml(inputValue)}" autocomplete="off" ${readonly ? 'readonly' : ''} /></td>`;
}

function rowInputControl(name, value = '', type = 'text', readonly = false) {
  const inputValue = type === 'date' && !value ? '' : value ?? '';
  return `<input data-row-field="${name}" type="${type}" value="${escapeHtml(inputValue)}" autocomplete="off" ${readonly ? 'readonly' : ''} />`;
}

export function renderExhpModalMetadata(documentData = {}) {
  return `
    <section class="exhp-modal-metadata no-print">
      <span><strong>Αρ. Ευρετηρίου:</strong> ${escapeHtml(documentData.registryNumber || '')}</span>
      <span><strong>Ημερομηνία:</strong> ${escapeHtml(formatDate(documentData.date) || '')}</span>
      <span><strong>Μονάδα:</strong> ${escapeHtml(documentData.unit || '')}</span>
      <span><strong>Αιτιολογία:</strong> ${escapeHtml(documentData.reason || '')}</span>
    </section>
  `;
}

export function renderOfficialExhpDataForm(type, data, settings, exhp) {
  if (type === 'useless_material_a') {
    const items = Array.isArray(data.items) && data.items.length ? data.items : [{}];
    return `
      <section class="official-document-data-form">
        <div class="support-form-fields">
          ${officialDataField('Τόπος', 'location', data.location || settings?.serviceInfo?.serviceLocation || '')}
          ${officialDataField('Ημερομηνία', 'date', data.date || '', 'date')}
          ${officialDataField('Αρ. ΗΔΜ', 'hdmNumber', data.hdmNumber)}
          ${officialDataField('Πρόεδρος', 'president', data.president)}
          ${officialDataField("Α' Μέλος", 'memberA', data.memberA)}
          ${officialDataField("Β' Μέλος", 'memberB', data.memberB)}
          ${officialDataField('Περίοδος Από', 'periodFrom', data.periodFrom, 'date')}
          ${officialDataField('Περίοδος Έως', 'periodTo', data.periodTo, 'date')}
        </div>
        ${renderOfficialEditableMaterials(items)}
      </section>
    `;
  }
  const consumed = normalizeOfficialAmmoItems(data, 'consumed');
  const empty = normalizeOfficialAmmoItems(data, 'empty');
  return `
    <section class="official-document-data-form">
      <div class="support-form-fields">
        ${officialDataField('Βαθμός Αξκού Επόπτη', 'officerRank', data.officerRank)}
        ${officialDataField('Ονοματεπώνυμο Αξκού Επόπτη', 'officerName', data.officerName)}
        ${officialDataField('Μονάδα / Τμήμα', 'unit', data.unit || exhp?.serviceUnit || settings?.serviceInfo?.serviceName || '')}
        ${officialDataField('Ημερομηνία Βολής', 'firingDate', data.firingDate || data.date || '', 'date')}
        ${officialDataField('Ημέρα Εβδομάδας', 'dayOfWeek', data.dayOfWeek)}
        ${officialDataField('Αριθμός Αντιγράφων', 'copiesCount', data.copiesCount, 'number')}
      </div>
      ${renderOfficialAmmoEditableTable('Καταναλωθέντα', 'consumed', consumed)}
      ${renderOfficialAmmoEditableTable('Κενά Συσκευασίας', 'empty', empty)}
    </section>
  `;
}

function officialDataField(label, name, value = '', type = 'text') {
  return `<label class="field"><span>${escapeHtml(label)}</span><input data-official-form-field="${name}" type="${type}" value="${escapeHtml(value ?? '')}" autocomplete="off" /></label>`;
}

function renderOfficialEditableMaterials(items) {
  return `
    <section class="official-editable-materials">
      <h3>Υλικά</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Α/Α</th><th>Αρ. Μερίδας</th><th>Αρ. Ονομαστικού</th><th>Περιγραφή</th><th>ΜΜ</th><th>Ποσότητα</th><th>Τιμή Κτήσης</th><th>Ημ. Κτήσης</th><th>Παρ/σεις</th><th></th></tr></thead>
        <tbody data-official-material-items>${items.map((item, index) => renderOfficialEditableMaterialRow(item, index)).join('')}</tbody>
      </table></div>
      <button class="secondary-button" data-add-official-material type="button">+ Προσθήκη Υλικού</button>
    </section>
  `;
}

export function renderOfficialEditableMaterialRow(item = {}, index = 0) {
  return `<tr>
    <td data-official-row-number>${index + 1}</td>
    <td><input data-official-item-field="shareNumber" value="${escapeHtml(item.shareNumber || '')}" /></td>
    <td><input data-official-item-field="nomenclatureNumber" value="${escapeHtml(item.nomenclatureNumber || item.nominalNumber || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="description" value="${escapeHtml(item.description || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="unit" value="${escapeHtml(item.unit || item.measurementUnit || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="quantity" type="number" step="0.001" value="${escapeHtml(item.quantity ?? '')}" /></td>
    <td><input data-official-item-field="acquisitionPrice" value="${escapeHtml(item.acquisitionPrice || '')}" /></td>
    <td><input data-official-item-field="acquisitionDate" type="date" value="${escapeHtml(item.acquisitionDate || '')}" /></td>
    <td><input data-official-item-field="remarks" value="${escapeHtml(item.remarks || item.notes || '')}" /></td>
    <td><button class="danger-button" data-remove-official-material type="button">Διαγραφή</button></td>
  </tr>`;
}

function renderOfficialAmmoEditableTable(title, kind, items) {
  return `
    <section class="official-editable-materials">
      <h3>${escapeHtml(title)}</h3>
      <div class="table-wrap"><table><thead><tr><th>Αρ. Μερίδας</th><th>Περιγραφή</th><th>Ποσότητα</th><th></th></tr></thead>
      <tbody data-official-ammo-items="${kind}">${items.map((item) => renderOfficialAmmoEditableRow(item)).join('')}</tbody></table></div>
      <button class="secondary-button" data-add-official-ammo="${kind}" type="button">+ Προσθήκη Υλικού</button>
    </section>
  `;
}

export function renderOfficialAmmoEditableRow(item = {}) {
  return `<tr><td><input data-official-item-field="shareNumber" value="${escapeHtml(item.shareNumber || '')}" /></td><td><input data-official-item-field="description" value="${escapeHtml(item.description || '')}" ${item.shareNumber ? 'readonly' : ''} /><input data-official-item-field="nomenclatureNumber" type="hidden" value="${escapeHtml(item.nomenclatureNumber || '')}" /><input data-official-item-field="unit" type="hidden" value="${escapeHtml(item.unit || '')}" /></td><td><input data-official-item-field="quantity" type="number" step="0.001" value="${escapeHtml(item.quantity ?? '')}" /></td><td><button class="danger-button" data-remove-official-material type="button">Διαγραφή</button></td></tr>`;
}

function normalizeOfficialAmmoItems(data, kind) {
  const source = data[`${kind}Items`] || data.items?.filter((item) => item.itemType === kind) || [];
  return source.length ? source : [{}];
}

export function renderUselessMaterialDataForm(definition, data, settings) {
  const items = Array.isArray(data.items) && data.items.length ? data.items : [{}];
  if (definition.kind === 'differences') {
    return `
      <section class="official-document-data-form">
        <div class="support-form-fields">
          ${officialDataField('Πρόεδρος', 'president', data.president)}
          ${officialDataField("Α' Μέλος", 'memberA', data.memberA)}
          ${officialDataField("Β' Μέλος", 'memberB', data.memberB)}
          ${officialDataField('Δκτής', 'commander', data.commander)}
          ${officialDataField('Γεν. Διαχειριστής', 'generalManager', data.generalManager)}
          ${officialDataField('Διαχειριστής Αχρήστου Υλικού', 'uselessManager', data.uselessManager)}
        </div>
        <section class="official-editable-materials"><div class="table-wrap"><table>
          <thead><tr><th>Α/Α</th><th>Αρ. Μερίδας</th><th>Αρ. Ονομαστικού</th><th>Περιγραφή</th><th>ΜΜ</th><th>Ποσ. Πρωτοβάθμιας</th><th>Ποσ. Δευτεροβάθμιας</th><th>Διαφορά (+)</th><th>Διαφορά (-)</th><th></th></tr></thead>
          <tbody data-official-material-items>${items.map((item, index) => renderUselessDifferenceRow(item, index)).join('')}</tbody>
        </table></div><button class="secondary-button" data-add-useless-difference type="button">+ Προσθήκη Υλικού</button></section>
      </section>`;
  }
  return `
    <section class="official-document-data-form">
      <div class="support-form-fields">
        ${officialDataField('Τόπος', 'location', data.location || settings?.serviceInfo?.serviceLocation || '')}
        ${officialDataField('Ημερομηνία', 'date', data.date || '', 'date')}
        ${officialDataField('Αρ. ΗΔΜ', 'hdmNumber', data.hdmNumber)}
        ${officialDataField('Πρόεδρος', 'president', data.president)}
        ${officialDataField("Α' Μέλος", 'memberA', data.memberA)}
        ${officialDataField("Β' Μέλος", 'memberB', data.memberB)}
        ${officialDataField('Διαχειριστής Αχρήστου Υλικού', 'uselessManager', data.uselessManager)}
        ${officialDataField('Προϊστάμενος Λογιστηρίου', 'accountingHead', data.accountingHead)}
      </div>
      ${renderOfficialEditableMaterials(items)}
    </section>`;
}

export function renderUselessDifferenceRow(item = {}, index = 0) {
  return `<tr><td data-official-row-number>${index + 1}</td>
    <td><input data-official-item-field="shareNumber" value="${escapeHtml(item.shareNumber || '')}" /></td>
    <td><input data-official-item-field="nomenclatureNumber" value="${escapeHtml(item.nomenclatureNumber || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="description" value="${escapeHtml(item.description || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    <td><input data-official-item-field="unit" value="${escapeHtml(item.unit || '')}" ${item.shareNumber ? 'readonly' : ''} /></td>
    ${['qtyPrimary', 'qtySecondary', 'diffPlus', 'diffMinus'].map((name) => `<td><input data-official-item-field="${name}" type="number" step="0.001" value="${escapeHtml(item[name] ?? '')}" /></td>`).join('')}
    <td><button class="danger-button" data-remove-official-material type="button">Διαγραφή</button></td></tr>`;
}

export function renderUselessMaterialPreview(definition, exhp, payload, settings) {
  if (definition.kind === 'differences') {
    return renderOfficialUselessDifferencesProtocol(settings, exhp, payload);
  }
  if (definition.kind === 'inspection') {
    return renderOfficialUselessProtocol(settings, exhp, prepareUselessProtocolData(payload));
  }
  return renderClothingDisposalStatement(settings, exhp, {
    ...payload,
    items: payload.items.map((item) => ({
      ...item,
      quantityWords: item.quantity === null || item.quantity === '' ? '' : numberToGreekWords(Number(item.quantity))
    }))
  }, definition.code, definition.title);
}
