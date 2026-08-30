import { escapeHtml } from '../../../components/forms.js';
import {
  renderOfficialAmmoConsumptionCertificate,
  renderOfficialUselessProtocol
} from '../../../../exhpDocuments.mjs';
import { readOptionalNumber, setReadonlyRowField } from '../../shared.js';
import {
  renderExhpModalMetadata,
  renderOfficialAmmoEditableRow,
  renderOfficialEditableMaterialRow,
  renderOfficialExhpDataForm,
  renderUselessDifferenceRow,
  renderUselessMaterialDataForm,
  renderUselessMaterialPreview
} from './officialDocumentRenderer.js';
import { printExhpDocument } from './officialDocumentPrint.js';
import { prepareUselessProtocolData } from './officialDocumentRules.js';
import { validateSharedMaterialPayload } from './officialDocumentValidation.js';

export async function autofillShareDocumentRow(input, showToast) {
  const row = input.closest('tr');
  if (!row) return;
  try {
    const share = await window.appApi.shares.getShareByNumber(input.value.trim());
    setReadonlyRowField(row, 'nomenclatureNumber', share.nomenclatureNumber || share.nominalNumber || '');
    setReadonlyRowField(row, 'description', share.description || '');
    setReadonlyRowField(row, 'unit', share.unit || share.measurementUnit || '');
    row.dataset.availableQuantity = String(
      share.quantity ?? share.availableQuantity ?? share.accountingBalance ?? ''
    );
  } catch (_error) {
    row.dataset.availableQuantity = '';
    ['nomenclatureNumber', 'description', 'unit'].forEach((name) => {
      const field = row.querySelector(`[data-row-field="${name}"]`);
      if (!field) return;
      field.value = '';
      field.readOnly = false;
    });
    showToast('Η μερίδα δεν βρέθηκε', 'error');
  }
}

export function openExhpDocumentModal(type, exhp, data, settings, showToast) {
  const existing = document.querySelector('.exhp-official-document-backdrop');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop handover-document-backdrop exhp-official-document-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal handover-document-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">ΔΙΚΑΙΟΛΟΓΗΤΙΚΟ ΕΧΠ</p>
          <h2>${escapeHtml(officialExhpDocumentTitle(type))}</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-close-exhp-official-document type="button">Κλείσιμο</button>
          <button class="secondary-button" data-edit-exhp-official-document type="button" hidden>← Επεξεργασία</button>
          <button class="secondary-button" data-save-exhp-official-document type="button">Αποθήκευση</button>
          <button class="primary-button" data-preview-exhp-official-document type="button">Προεπισκόπηση Εντύπου →</button>
          <button class="primary-button" data-print-exhp-official-document type="button" hidden>Εκτύπωση</button>
        </div>
      </header>
      ${renderExhpModalMetadata({
        registryNumber: exhp?.indexNumber || exhp?.registryNumber || '',
        date: data.date || data.firingDate || '',
        unit: exhp?.serviceUnit || data.unit || settings?.serviceInfo?.serviceName || '',
        reason: officialExhpDocumentTitle(type)
      })}
      <div class="official-document-form-state no-print" data-official-document-form>
        ${renderOfficialExhpDataForm(type, data, settings, exhp)}
      </div>
      <div class="handover-document-preview" data-official-document-preview hidden></div>
    </section>
  `;

  const form = modal.querySelector('[data-official-document-form]');
  const preview = modal.querySelector('.handover-document-preview');
  bindOfficialExhpDataForm(form, type, showToast);
  const setMode = (mode) => {
    const isPreview = mode === 'preview';
    form.hidden = isPreview;
    preview.hidden = !isPreview;
    modal.querySelector('[data-edit-exhp-official-document]').hidden = !isPreview;
    modal.querySelector('[data-print-exhp-official-document]').hidden = !isPreview;
    modal.querySelector('[data-preview-exhp-official-document]').hidden = isPreview;
  };

  modal.querySelector('[data-close-exhp-official-document]').addEventListener('click', (event) => {
    event.stopPropagation();
    modal.remove();
  });
  modal.querySelector('[data-save-exhp-official-document]').addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      const payload = collectOfficialExhpDataForm(form, type);
      if (!validateSharedMaterialPayload(payload, showToast)) return;
      if (!exhp.id) {
        exhp.onDraftSave?.(payload);
        showToast('Το έντυπο προετοιμάστηκε και θα αποθηκευτεί μαζί με την ΕΧΠ.');
        modal.remove();
        return;
      }

      const supportDocument = await ensureOfficialExhpDocument(type, exhp.id);
      const result = type === 'useless_material_a'
        ? await window.appApi.exhpDocs.saveUselessA(supportDocument.id, payload)
        : await window.appApi.exhpDocs.saveAmmo(supportDocument.id, payload);
      exhp.onDraftSave?.(payload);
      showToast(result.message || 'Το δικαιολογητικό αποθηκεύτηκε.');
      modal.remove();
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του δικαιολογητικού.', 'error');
    }
  });
  modal.querySelector('[data-preview-exhp-official-document]').addEventListener('click', (event) => {
    event.stopPropagation();
    const payload = collectOfficialExhpDataForm(form, type);
    if (!validateSharedMaterialPayload(payload, showToast)) return;
    preview.innerHTML = type === 'useless_material_a'
      ? renderOfficialUselessProtocol(settings, exhp, prepareUselessProtocolData(payload))
      : renderOfficialAmmoConsumptionCertificate(settings, exhp, payload);
    setMode('preview');
  });
  modal.querySelector('[data-edit-exhp-official-document]').addEventListener('click', (event) => {
    event.stopPropagation();
    setMode('form');
  });
  modal.querySelector('[data-print-exhp-official-document]').addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      await printExhpDocument(preview);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η εκτύπωση του δικαιολογητικού.', 'error');
    }
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
}

function bindOfficialExhpDataForm(form, type, showToast) {
  form.addEventListener('click', (event) => {
    if (event.target.closest('[data-add-official-material]')) {
      const body = form.querySelector('[data-official-material-items]');
      body.insertAdjacentHTML('beforeend', renderOfficialEditableMaterialRow({}, body.querySelectorAll('tr').length));
      return;
    }
    if (event.target.closest('[data-add-useless-difference]')) {
      const body = form.querySelector('[data-official-material-items]');
      body.insertAdjacentHTML('beforeend', renderUselessDifferenceRow({}, body.querySelectorAll('tr').length));
      return;
    }
    const addAmmo = event.target.closest('[data-add-official-ammo]');
    if (addAmmo) {
      form.querySelector(`[data-official-ammo-items="${addAmmo.dataset.addOfficialAmmo}"]`)
        .insertAdjacentHTML('beforeend', renderOfficialAmmoEditableRow());
      return;
    }
    const remove = event.target.closest('[data-remove-official-material]');
    if (remove) {
      remove.closest('tr')?.remove();
      form.querySelectorAll('[data-official-row-number]').forEach((cell, index) => { cell.textContent = index + 1; });
    }
  });
  bindShareRows(form, 'official', showToast);
}

export function bindShareRows(root, prefix, showToast) {
  const getField = (row, name) => row.querySelector(`[data-${prefix}-item-field="${name}"]`);
  const getShareRows = () => [...root.querySelectorAll(`[data-${prefix}-item-field="shareNumber"]`)];
  const hasDuplicateShare = (shareInput) => {
    const value = shareInput.value.trim();
    if (!value) return false;
    return getShareRows().some((input) => input !== shareInput && input.value.trim() === value);
  };
  const clearDerivedFields = (row) => {
    row.dataset.availableQuantity = '';
    ['shareId', 'nomenclatureNumber', 'nominalNumber', 'description', 'unit', 'measurementUnit'].forEach((name) => {
      const input = getField(row, name);
      if (!input) return;
      input.value = '';
      input.readOnly = false;
      input.disabled = false;
      input.removeAttribute('title');
      input.removeAttribute('data-share-derived');
    });
  };
  const applyShareToRow = (row, share = {}) => {
    const shareId = getField(row, 'shareId');
    const nominal = getField(row, 'nomenclatureNumber') || getField(row, 'nominalNumber');
    const description = getField(row, 'description');
    const unit = getField(row, 'unit') || getField(row, 'measurementUnit');
    if (shareId) shareId.value = share.id || share.shareId || '';
    if (nominal) {
      nominal.value = share.nomenclatureNumber || share.nominalNumber || '';
      nominal.readOnly = true;
      nominal.disabled = true;
      nominal.title = 'Προέρχεται από την καρτέλα υλικού';
      nominal.dataset.shareDerived = 'true';
    }
    if (description) {
      description.value = share.description || '';
      description.readOnly = true;
      description.disabled = true;
      description.title = 'Προέρχεται από την καρτέλα υλικού';
      description.dataset.shareDerived = 'true';
    }
    if (unit) {
      unit.value = share.unit || share.measurementUnit || '';
      unit.readOnly = true;
      unit.disabled = true;
      unit.title = 'Προέρχεται από την καρτέλα υλικού';
      unit.dataset.shareDerived = 'true';
    }
    row.dataset.availableQuantity = String(
      share.quantity ?? share.availableQuantity ?? share.accountingBalance ?? ''
    );
  };
  const applySelectedShareOption = (shareInput) => {
    const option = shareInput.selectedOptions?.[0];
    if (!option || !option.value) return false;
    const row = shareInput.closest('tr');
    applyShareToRow(row, {
      id: option.dataset.shareId || '',
      shareId: option.dataset.shareId || '',
      nominalNumber: option.dataset.nominalNumber || '',
      nomenclatureNumber: option.dataset.nominalNumber || '',
      description: option.dataset.description || '',
      measurementUnit: option.dataset.measurementUnit || '',
      unit: option.dataset.measurementUnit || '',
      availableQuantity: option.dataset.availableQuantity || ''
    });
    return true;
  };
  const handleShareSelection = async (shareInput) => {
    if (!shareInput || !shareInput.value.trim()) {
      const row = shareInput?.closest('tr');
      if (row) clearDerivedFields(row);
      return;
    }
    const row = shareInput.closest('tr');
    if (hasDuplicateShare(shareInput)) {
      const duplicateLabel = shareInput.tagName === 'SELECT'
        ? (shareInput.selectedOptions?.[0]?.textContent || shareInput.value)
        : shareInput.value;
      shareInput.value = '';
      clearDerivedFields(row);
      showToast(`Η Μερίδα ${duplicateLabel} έχει ήδη προστεθεί στο δικαιολογητικό.`, 'error');
      return;
    }
    if (shareInput.tagName === 'SELECT' && applySelectedShareOption(shareInput)) return;
    try {
      const share = await window.appApi.shares.getShareByNumber(shareInput.value.trim());
      applyShareToRow(row, share);
    } catch (_error) {
      clearDerivedFields(row);
      showToast('Η μερίδα δεν βρέθηκε', 'error');
    }
  };
  root.addEventListener('focusout', async (event) => {
    const shareInput = event.target.closest(`[data-${prefix}-item-field="shareNumber"]`);
    if (!shareInput || shareInput.tagName === 'SELECT') return;
    await handleShareSelection(shareInput);
  });
  root.addEventListener('change', (event) => {
    const shareInput = event.target.closest(`[data-${prefix}-item-field="shareNumber"]`);
    if (shareInput) {
      handleShareSelection(shareInput);
      return;
    }
    const quantity = event.target.closest(
      `[data-${prefix}-item-field="quantity"], [data-${prefix}-item-field="qtyPrimary"], [data-${prefix}-item-field="qtySecondary"]`
    );
    if (!quantity) return;
    const available = Number(quantity.closest('tr').dataset.availableQuantity);
    if (!Number.isFinite(available) || !quantity.value) return;
    if (Number(quantity.value) > available) {
      showToast(`Η ποσότητα υπερβαίνει το διαθέσιμο υπόλοιπο της μερίδας (διαθέσιμο: ${available})`, 'error');
      quantity.value = '';
    }
  });
}

function collectOfficialExhpDataForm(form, type) {
  const fields = Object.fromEntries([...form.querySelectorAll('[data-official-form-field]')].map((input) => [input.dataset.officialFormField, input.value]));
  if (type === 'useless_material_a') {
    return {
      location: fields.location || '', date: fields.date || '', hdmNumber: fields.hdmNumber || '',
      president: fields.president || '', memberA: fields.memberA || '', memberB: fields.memberB || '',
      periodFrom: fields.periodFrom || '', periodTo: fields.periodTo || '',
      items: collectOfficialFormRows(form, '[data-official-material-items] tr').map((item, index) => ({ aa: index + 1, ...item }))
    };
  }
  return {
    officerRank: fields.officerRank || '', officerName: fields.officerName || '', unit: fields.unit || '',
    firingDate: fields.firingDate || '', dayOfWeek: fields.dayOfWeek || '', copiesCount: readOptionalNumber(fields.copiesCount),
    items: [
      ...collectOfficialFormRows(form, '[data-official-ammo-items="consumed"] tr').map((item) => ({ ...item, itemType: 'consumed' })),
      ...collectOfficialFormRows(form, '[data-official-ammo-items="empty"] tr').map((item) => ({ ...item, itemType: 'empty' }))
    ]
  };
}

function collectOfficialFormRows(root, selector) {
  return [...root.querySelectorAll(selector)].map((row) => Object.fromEntries(
    [...row.querySelectorAll('[data-official-item-field]')].map((input) => [
      input.dataset.officialItemField,
      input.type === 'number' ? readOptionalNumber(input.value) : input.value.trim()
    ])
  )).filter((item) => Object.values(item).some((value) => value !== '' && value !== null));
}

export function openUselessMaterialFormModal(definition, exhp, data, settings, showToast, onSave) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop handover-document-backdrop exhp-official-document-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal handover-document-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">${escapeHtml(definition.group)}</p><h2>${escapeHtml(definition.label)}</h2></div>
        <div class="row-actions">
          <button class="secondary-button" data-close-useless-form type="button">Κλείσιμο</button>
          <button class="secondary-button" data-edit-useless-form type="button" hidden>← Επεξεργασία</button>
          <button class="secondary-button" data-save-useless-form type="button">Αποθήκευση</button>
          <button class="primary-button" data-preview-useless-form type="button">Προεπισκόπηση Εντύπου →</button>
          <button class="primary-button" data-print-useless-form type="button" hidden>Εκτύπωση</button>
        </div>
      </header>
      <div class="official-document-form-state no-print" data-useless-form>
        ${renderUselessMaterialDataForm(definition, data, settings)}
      </div>
      <div class="handover-document-preview" data-useless-preview hidden></div>
    </section>
  `;
  const form = modal.querySelector('[data-useless-form]');
  const preview = modal.querySelector('[data-useless-preview]');
  bindOfficialExhpDataForm(form, definition.kind === 'differences' ? 'differences' : 'statement', showToast);
  const setMode = (previewMode) => {
    form.hidden = previewMode;
    preview.hidden = !previewMode;
    modal.querySelector('[data-edit-useless-form]').hidden = !previewMode;
    modal.querySelector('[data-print-useless-form]').hidden = !previewMode;
    modal.querySelector('[data-preview-useless-form]').hidden = previewMode;
  };
  modal.addEventListener('click', async (event) => {
    if (event.target === modal || event.target.closest('[data-close-useless-form]')) {
      modal.remove();
      return;
    }
    if (event.target.closest('[data-edit-useless-form]')) {
      setMode(false);
      return;
    }
    const payload = collectUselessMaterialDataForm(form, definition);
    if (event.target.closest('[data-preview-useless-form]')) {
      if (!validateSharedMaterialPayload(payload, showToast)) return;
      preview.innerHTML = renderUselessMaterialPreview(definition, exhp, payload, settings);
      setMode(true);
      return;
    }
    if (event.target.closest('[data-print-useless-form]')) {
      await printExhpDocument(preview);
      return;
    }
    if (event.target.closest('[data-save-useless-form]')) {
      if (!validateSharedMaterialPayload(payload, showToast)) return;
      try {
        const result = await onSave(payload);
        showToast(result?.message || 'Το έντυπο αποθηκεύτηκε.');
        modal.remove();
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του εντύπου.', 'error');
      }
    }
  });
  document.body.appendChild(modal);
}

function collectUselessMaterialDataForm(form, definition) {
  const fields = Object.fromEntries([...form.querySelectorAll('[data-official-form-field]')].map((input) => [input.dataset.officialFormField, input.value]));
  const items = collectOfficialFormRows(form, '[data-official-material-items] tr');
  return { ...fields, items };
}

async function ensureOfficialExhpDocument(type, exhpId) {
  const documents = await window.appApi.exhpDocs.getByExhp(exhpId);
  const existing = documents.find((item) => item.documentType === type);
  if (existing) return existing;
  const result = await window.appApi.exhpDocs.create(exhpId, type);
  return result.document || result;
}
