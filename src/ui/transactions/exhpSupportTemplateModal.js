import { escapeHtml } from '../components/forms.js';
import { formatDate, officialDateParts, readOptionalNumber } from './shared.js';
import { bindShareRows, validateSharedMaterialPayload } from './exhpOfficialDocuments.js';
import {
  getFaithfulFormDefinition,
  renderFaithfulOfficialForm,
  renderGenericSupportPreview,
  renderOfficialSupportForm,
  renderSupportApplicationFields
} from '../../exhpForm/supportingDocs/officialSupportRenderer.js';
export function openExhpSupportTemplate(documentData, support, api, showToast, options = {}) {
  const formData = support.formData || {};
  const code = String(support.documentCode || '').replace(/\s+/g, ' ').trim().toUpperCase();
  const faithfulDefinition = getFaithfulFormDefinition(code, support.title);
  const isDraft = Boolean(options.draft);
  const settings = options.settings || {};
  documentData.serviceLocation ||= settings?.serviceInfo?.serviceLocation || '';
  documentData.financialOfficers ||= settings?.financialOfficers || {};
  const initialItems = readSupportMaterialItems(formData, documentData.items);
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal support-form-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">${escapeHtml(support.documentCode || 'ΔΙΚΑΙΟΛΟΓΗΤΙΚΟ')}</p><h2>${escapeHtml(support.title)}</h2></div>
        <div class="row-actions">
          <button class="secondary-button" data-close-template type="button">Κλείσιμο</button>
          <button class="secondary-button" data-edit-template type="button" hidden>← Επεξεργασία</button>
          <button class="secondary-button" data-save-template type="button">${isDraft ? 'Ολοκλήρωση Προετοιμασίας' : 'Αποθήκευση'}</button>
          <button class="primary-button" data-preview-template type="button">Προεπισκόπηση Εντύπου →</button>
          <button class="primary-button" data-print-template type="button" hidden>Εκτύπωση</button>
        </div>
      </header>
      ${renderExhpModalMetadata(documentData)}
      <div class="support-template-form-state no-print" data-support-template-form>
        ${faithfulDefinition ? renderSupportApplicationFields(faithfulDefinition, formData, documentData, support) : `
        <section class="support-application-fields">
          <h3>Πεδία Συμπλήρωσης Εντύπου</h3>
          <div class="support-form-fields">
          ${supportFormField('Αριθμός και ημερομηνία', 'documentReference', formData.documentReference || support.documentReference)}
          ${supportFormField('Εκδούσα αρχή / Επιτροπή', 'issuingAuthority', formData.issuingAuthority)}
          ${supportFormField('Σχετική διαταγή ή έγκριση', 'orderReference', formData.orderReference || documentData.approvalReference)}
          ${supportFormField('Τόπος συντάξεως', 'place', formData.place || documentData.serviceLocation)}
          ${supportFormField('Μέλη επιτροπής / Υπογράφοντες', 'signatories', formData.signatories, true)}
          ${supportFormField('Διαπιστώσεις / Περιγραφή ενεργειών', 'findings', formData.findings, true)}
          ${supportFormField('Απόφαση / Πρόταση', 'decision', formData.decision, true)}
          ${supportFormField('Παρατηρήσεις', 'notes', formData.notes, true)}
          ${renderSupportSpecificFields(support, formData)}
          </div>
        </section>`}
        ${supportHasMaterialTable(faithfulDefinition, code, support) ? renderSupportEditableMaterials(initialItems, documentData.availableShares || []) : ''}
        <div class="support-template-form-actions"><button class="primary-button" data-preview-template type="button">Προεπισκόπηση Εντύπου →</button></div>
      </div>
      <div class="support-template-preview-state" data-support-template-preview hidden></div>
    </section>
  `;
  const formPanel = modal.querySelector('[data-support-template-form]');
  const previewPanel = modal.querySelector('[data-support-template-preview]');
  bindSupportEditableMaterials(formPanel, showToast);
  const setMode = (mode) => {
    const isPreview = mode === 'preview';
    formPanel.hidden = isPreview;
    previewPanel.hidden = !isPreview;
    modal.querySelector('[data-edit-template]').hidden = !isPreview;
    modal.querySelector('[data-print-template]').hidden = !isPreview;
    modal.querySelectorAll('[data-preview-template]').forEach((button) => { button.hidden = isPreview; });
  };
  modal.addEventListener('click', async (event) => {
    if (event.target === modal || event.target.closest('[data-close-template]')) modal.remove();
    if (event.target.closest('[data-edit-template]')) {
      setMode('form');
      return;
    }
    if (event.target.closest('[data-preview-template]')) {
      const currentFormData = collectSupportTemplateFormData(formPanel);
      const currentItems = collectSupportMaterialRows(formPanel, initialItems);
      if (supportHasMaterialTable(faithfulDefinition, code, support)
        && !validateSharedMaterialPayload({ items: currentItems }, showToast)) return;
      const previewDocument = {
        ...documentData,
        items: currentItems.filter((item) => item.shareNumber)
      };
      previewPanel.innerHTML = faithfulDefinition
        ? renderFaithfulOfficialForm(previewDocument, support, prepareSupportPreviewData(currentFormData), faithfulDefinition)
        : renderOfficialSupportForm(previewDocument, support, prepareSupportPreviewData(currentFormData), code)
          || renderGenericSupportPreview(previewDocument, support, currentFormData);
      setMode('preview');
      return;
    }
    if (event.target.closest('[data-print-template]')) {
      window.print();
      return;
    }
    if (event.target.closest('[data-save-template]')) {
      const savedFormData = collectSupportTemplateFormData(formPanel);
      const savedItems = collectSupportMaterialRows(formPanel, initialItems);
      if (supportHasMaterialTable(faithfulDefinition, code, support)
        && !validateSharedMaterialPayload({ items: savedItems }, showToast)) return;
      savedFormData.materialItems = JSON.stringify(savedItems.filter((item) => item.shareNumber));
      if (isDraft && typeof options.onSave === 'function') {
        options.onSave({
          templateId: support.id,
          formData: savedFormData,
          documentReference: savedFormData.documentReference || '',
          completed: true,
          notes: ''
        });
        modal.remove();
        return;
      }
      try {
        const result = await api.saveExhpSupportForm(documentData.id, support.id, {
          formData: savedFormData,
          documentReference: savedFormData.documentReference,
          completed: true
        });
        Object.assign(support, result.support || {}, { formData: savedFormData, completed: true });
        const folderRow = document.querySelector(`[data-saved-support="${support.id}"]`);
        if (folderRow) {
          folderRow.querySelector('[data-support-completed]').checked = true;
          folderRow.querySelector('[data-support-reference]').value = savedFormData.documentReference || '';
          const statusPill = folderRow.closest('.exhp-support-modal')?.querySelector('footer .status-pill');
          if (statusPill) {
            statusPill.textContent = displaySupportStatus(result.supportStatus);
            statusPill.className = `status-pill ${result.supportStatus === 'Πλήρης για ΕΥΣ' ? 'balanced' : 'pending'}`;
          }
        }
        showToast(result.message);
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του εντύπου.', 'error');
      }
    }
  });
  document.body.appendChild(modal);
}

function renderExhpModalMetadata(documentData = {}) {
  return `
    <aside class="exhp-modal-metadata no-print" aria-label="Στοιχεία ΕΧΠ">
      <span><strong>Σχετική ΕΧΠ</strong>${escapeHtml(documentData.registryNumber || '')}</span>
      <span><strong>Ημερομηνία</strong>${formatDate(documentData.date)}</span>
      <span><strong>Μονάδα</strong>${escapeHtml(documentData.unit || '')}</span>
      <span><strong>Αιτιολογία</strong>${escapeHtml(documentData.reason || '')}</span>
    </aside>
  `;
}

function supportHasMaterialTable(definition, code, support) {
  if (definition?.pages.some((page) => page.table && !page.table.source)) return true;
  return ['ΕΦΕΔ 505', 'ΕΦΕΔ 506', 'ΔΥΠ/192', 'ΕΦΕΔ 410', 'ΔΥΠ/8'].some((value) => code.includes(value))
    || String(support.title || '').toLocaleLowerCase('el-GR').includes('επιτροπής επιθεώρησης');
}

function readSupportMaterialItems(formData, fallbackItems = []) {
  if (Array.isArray(formData.materialItems)) return formData.materialItems;
  if (typeof formData.materialItems === 'string' && formData.materialItems.trim()) {
    try {
      const items = JSON.parse(formData.materialItems);
      if (Array.isArray(items)) return items;
    } catch (_error) {
      // Keep compatibility with previously saved support forms.
    }
  }
  return Array.isArray(fallbackItems) && fallbackItems.length ? fallbackItems : [{}];
}

function renderSupportEditableMaterials(items, availableShares = []) {
  return `
    <section class="official-editable-materials">
      <h3>Υλικά</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>Α/Α</th><th>Μερίδα</th><th>Αρ. Ονομαστικού</th><th>Περιγραφή</th><th>ΜΜ</th><th>Ποσότητα</th><th>Παρ/σεις</th><th></th></tr></thead>
        <tbody data-support-material-items>${items.map((item, index) => renderSupportMaterialRow(item, index, availableShares)).join('')}</tbody>
      </table></div>
      <button class="secondary-button" data-add-support-material type="button">+ Προσθήκη Υλικού</button>
    </section>
  `;
}

function renderSupportMaterialRow(item = {}, index = 0, availableShares = []) {
  const rowId = item.rowId || createSupportMaterialRowId();
  const selectedShareNumber = item.shareNumber || '';
  return `<tr data-support-material-row-id="${escapeHtml(rowId)}">
    <td data-support-row-number>${index + 1}</td>
    <td>
      <input data-support-item-field="rowId" type="hidden" value="${escapeHtml(rowId)}" />
      <input data-support-item-field="shareId" type="hidden" value="${escapeHtml(item.shareId || '')}" />
      ${renderShareSelect('support', selectedShareNumber, availableShares)}
    </td>
    <td><input data-support-item-field="nominalNumber" value="${escapeHtml(item.nominalNumber || item.nomenclatureNumber || '')}" ${item.shareNumber ? 'disabled data-share-derived="true" title="Προέρχεται από την καρτέλα υλικού"' : ''} /></td>
    <td><input data-support-item-field="description" value="${escapeHtml(item.description || '')}" ${item.shareNumber ? 'disabled data-share-derived="true" title="Προέρχεται από την καρτέλα υλικού"' : ''} /></td>
    <td><input data-support-item-field="measurementUnit" value="${escapeHtml(item.measurementUnit || item.unit || '')}" ${item.shareNumber ? 'disabled data-share-derived="true" title="Προέρχεται από την καρτέλα υλικού"' : ''} /></td>
    <td><input data-support-item-field="quantity" type="number" step="0.001" value="${escapeHtml(item.quantity ?? '')}" /></td>
    <td><input data-support-item-field="supportingDocuments" value="${escapeHtml(item.supportingDocuments || item.remarks || '')}" /></td>
    <td><button class="danger-button" data-remove-support-material type="button">Διαγραφή</button></td>
  </tr>`;
}

function renderShareSelect(prefix, selectedShareNumber = '', availableShares = []) {
  return `
    <select data-${escapeHtml(prefix)}-item-field="shareNumber" data-share-picker>
      <option value="">Επιλογή Μερίδας</option>
      ${(availableShares || []).map((share) => {
        const shareNumber = share.shareNumber || share.share_number || '';
        const nominalNumber = share.nominalNumber || share.nominal_number || '';
        const description = share.description || '';
        const measurementUnit = share.measurementUnit || share.measurement_unit || '';
        return `
          <option
            value="${escapeHtml(shareNumber)}"
            data-share-id="${escapeHtml(share.id || '')}"
            data-nominal-number="${escapeHtml(nominalNumber)}"
            data-description="${escapeHtml(description)}"
            data-measurement-unit="${escapeHtml(measurementUnit)}"
            data-available-quantity="${escapeHtml(share.availableQuantity ?? share.accountingBalance ?? share.accounting_balance ?? '')}"
            ${String(shareNumber) === String(selectedShareNumber) ? 'selected' : ''}
          >${escapeHtml(shareNumber)}</option>
        `;
      }).join('')}
    </select>
  `;
}

function createSupportMaterialRowId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `support-row-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function collectSupportShareOptions(formPanel) {
  const select = formPanel.querySelector('[data-support-item-field="shareNumber"][data-share-picker]');
  if (!select) return [];
  return [...select.options]
    .filter((option) => option.value)
    .map((option) => ({
      id: option.dataset.shareId || '',
      shareNumber: option.value,
      nominalNumber: option.dataset.nominalNumber || '',
      description: option.dataset.description || option.textContent.split(' — ')[0] || '',
      measurementUnit: option.dataset.measurementUnit || '',
      availableQuantity: option.dataset.availableQuantity || ''
    }));
}

function bindSupportEditableMaterials(formPanel, showToast) {
  formPanel.addEventListener('click', (event) => {
    if (event.target.closest('[data-add-support-material]')) {
      const body = formPanel.querySelector('[data-support-material-items]');
      const shares = collectSupportShareOptions(formPanel);
      body.insertAdjacentHTML('beforeend', renderSupportMaterialRow({}, body.querySelectorAll('tr').length, shares));
      return;
    }
    const remove = event.target.closest('[data-remove-support-material]');
    if (remove) {
      remove.closest('tr')?.remove();
      formPanel.querySelectorAll('[data-support-row-number]').forEach((cell, index) => { cell.textContent = index + 1; });
    }
  });
  bindShareRows(formPanel, 'support', showToast);
}

function collectSupportMaterialRows(formPanel, fallbackItems = []) {
  const rows = [...formPanel.querySelectorAll('[data-support-material-items] tr')];
  if (!rows.length) return fallbackItems;
  return rows.map((row) => Object.fromEntries([...row.querySelectorAll('[data-support-item-field]')].map((input) => [
    input.dataset.supportItemField,
    input.type === 'number' ? readOptionalNumber(input.value) : input.value.trim()
  ]))).filter((item) => Object.values(item).some((value) => value !== '' && value !== null));
}

function collectSupportTemplateFormData(formPanel) {
  return Object.fromEntries([...formPanel.querySelectorAll('[data-support-form-field]')].map((input) => [
    input.dataset.supportFormField,
    input.value
  ]));
}

function prepareSupportPreviewData(formData) {
  const result = { ...formData };
  if (result.documentDate) {
    const parts = officialDateParts(result.documentDate);
    result.day = parts.day;
    result.month = parts.monthName;
    result.year = parts.year;
  }
  ['periodFrom', 'periodTo', 'exerciseDate', 'documentDate', 'changeDate'].forEach((name) => {
    if (result[name]) result[name] = formatDate(result[name]);
  });
  return result;
}

