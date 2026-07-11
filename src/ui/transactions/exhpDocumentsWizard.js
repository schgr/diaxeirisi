import { escapeHtml } from '../components/forms.js';
import {
  applyShareToMaterialPickerRow,
  getShareForMaterialPickerValue,
  renderMaterialPickerRow
} from '../../exhpForm/supportingDocs/shared/materialPicker.js';
import { renderExhpEntryState } from './entryHelpers.js';
import { formatDate } from './shared.js';
import {
  USELESS_MATERIAL_FORMS,
  autofillShareDocumentRow,
  collectExhpDocumentPreviewData,
  ensureExhpSupportDocument,
  isAmmoConsumptionReason,
  isUselessMaterialReason,
  openExhpDocumentModal,
  openUselessMaterialFormModal,
  prepareUselessProtocolData,
  previewExhpDocument,
  renderExhpDocumentItemRow,
  renderUselessMaterialTabs,
  saveExhpDocumentForm
} from './exhpOfficialDocuments.js';
import {
  collectNewSupportDocumentData,
  getAitiologiaCodeForIssueReason,
  hasAitiologiaModule,
  renderNewSupportDocumentEditor,
  renderNewSupportDocumentPrint,
  saveNewSupportDocument,
  saveNewSupportDocumentDraft,
  shouldShowOfficialExhpForms,
  syncSupportDocumentMaterialsToExhpItems,
  toLegacyPreviewPayload,
  validateNewSupportDocumentData
} from './exhpFormModuleBridge.js';
import { getGreekWeekday } from '../../exhpForm/supportingDocs/docIA_pyromaxika.js';

export function bindExhpDocumentsWizard(container, state, settings, showToast) {
  const exhpDocsApi = window.appApi?.exhpDocs;
  const selector = container.querySelector('#exhp-documents-exhp');
  const editor = container.querySelector('#exhp-documents-editor');
  const reasonLabel = container.querySelector('#exhp-documents-reason strong');
  if (!selector || !editor || !exhpDocsApi) return;

  const documentsState = state.exhpDocumentsState;
  documentsState.currentItems = state.exhpItems || [];
  documentsState.referenceData = state.referenceData || {};

  selector.addEventListener('change', async () => {
    documentsState.currentItems = state.exhpItems || [];
    await loadExhpDocumentsEditor(selector, editor, reasonLabel, state.exhpDocuments, documentsState, exhpDocsApi, showToast, settings);
  });

  editor.addEventListener('focusout', async (event) => {
    const input = event.target.closest('[data-row-field="shareNumber"]');
    if (!input || !input.value.trim()) return;
    await autofillShareDocumentRow(input, showToast);
  });
  editor.addEventListener('input', (event) => {
    const materialPicker = event.target.closest('[data-material-picker-select]');
    if (!materialPicker) return;
    const share = getShareForMaterialPickerValue(state.referenceData?.shares || [], materialPicker.value);
    if (share) applyShareToMaterialPickerRow(materialPicker.closest('[data-material-picker-row]'), share);
  });
  editor.addEventListener('change', (event) => {
    const docAMenu = event.target.closest('[data-doc-a-menu]');
    if (docAMenu) {
      const tierRoot = docAMenu.closest('[data-doc-a-tier]');
      const formKey = docAMenu.value;
      tierRoot?.querySelectorAll('[data-doc-a-form]').forEach((panel) => {
        panel.hidden = panel.dataset.docAForm !== formKey;
      });
      if (formKey) {
        tierRoot?.querySelector(`[data-doc-a-form="${formKey}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      return;
    }

    const ammoDate = event.target.closest(
      '[data-doc-ia-field="specificFields.imerominia"]'
    );
    if (ammoDate) {
      const weekday = editor.querySelector(
        '[data-doc-ia-field="specificFields.imeraEvdomadas"]'
      );
      if (weekday) weekday.value = getGreekWeekday(ammoDate.value);
      return;
    }

    const materialPicker = event.target.closest('[data-material-picker-select]');
    if (materialPicker) {
      const share = getShareForMaterialPickerValue(state.referenceData?.shares || [], materialPicker.value);
      if (share) applyShareToMaterialPickerRow(materialPicker.closest('[data-material-picker-row]'), share);
      return;
    }

    const quantity = event.target.closest(
      '[data-row-field="quantity"], [data-row-field="qtyPrimary"], [data-row-field="qtySecondary"]'
    );
    if (!quantity || !quantity.value) return;
    const available = Number(quantity.closest('tr')?.dataset.availableQuantity);
    if (Number.isFinite(available) && Number(quantity.value) > available) {
      showToast(`Η ποσότητα υπερβαίνει το διαθέσιμο υπόλοιπο της μερίδας (διαθέσιμο: ${available})`, 'error');
      quantity.value = '';
    }
  });

  editor.addEventListener('click', async (event) => {
    const previousCommittee = event.target.closest('[data-use-previous-exhp-committee]');
    if (previousCommittee) {
      try {
        const committee = JSON.parse(window.localStorage?.getItem('exhp:lastCommittee') || '{}');
        Object.entries(committee).forEach(([key, value]) => {
          const input = previousCommittee.closest('[data-doc-a-form]')?.querySelector(`[data-committee-field="${key}"]`)
            || editor.querySelector(`[data-committee-field="${key}"]`);
          if (input && value) input.value = value;
        });
      } catch (_error) {
        // Missing or malformed localStorage data simply leaves the fields unchanged.
      }
      return;
    }

    const previewNew = event.target.closest('[data-preview-new-exhp-support]');
    if (previewNew) {
      const reasonCode = previewNew.dataset.previewNewExhpSupport;
      try {
        const data = collectNewSupportDocumentData(editor, selector.dataset.issueReason || documentsState.selectedExhp?.issueReason || '', {
          reasonCode,
          formKey: previewNew.dataset.exhpFormKey || '',
          committeeTier: previewNew.dataset.committeeTier || 'primary',
          selectedExhp: documentsState.selectedExhp,
          documentsState,
          settings,
          serviceUnit: selector.dataset.serviceUnit || documentsState.selectedExhp?.serviceUnit || '',
          items: documentsState.currentItems || [],
          referenceData: state.referenceData || {}
        });
        const validation = validateNewSupportDocumentData(data);
        if (!validation.valid) {
          showToast(validation.errors[0]?.message || 'Συμπλήρωσε τα υποχρεωτικά πεδία.', 'error');
          return;
        }
        openNewSupportPreview(renderNewSupportDocumentPrint(data));
      } catch (error) {
        console.error(`Νέο module αιτιολογίας '${reasonCode}' απέτυχε, fallback σε legacy render`, error);
        try {
          const data = collectNewSupportDocumentData(editor, selector.dataset.issueReason || documentsState.selectedExhp?.issueReason || '', {
            reasonCode,
            formKey: previewNew.dataset.exhpFormKey || '',
            committeeTier: previewNew.dataset.committeeTier || 'primary',
            selectedExhp: documentsState.selectedExhp,
            documentsState,
            settings,
            serviceUnit: selector.dataset.serviceUnit || documentsState.selectedExhp?.serviceUnit || '',
            items: documentsState.currentItems || [],
            referenceData: state.referenceData || {}
          });
          const legacy = toLegacyPreviewPayload(data);
          if (legacy) previewExhpDocument(legacy.type, legacy.payload);
        } catch (fallbackError) {
          showToast(fallbackError.message || 'Δεν ήταν δυνατή η προεπισκόπηση.', 'error');
        }
      }
      return;
    }

    const saveNew = event.target.closest('[data-save-new-exhp-support]');
    if (saveNew) {
      const reasonCode = saveNew.dataset.saveNewExhpSupport;
      try {
        const data = collectNewSupportDocumentData(editor, selector.dataset.issueReason || documentsState.selectedExhp?.issueReason || '', {
          reasonCode,
          formKey: saveNew.dataset.exhpFormKey || '',
          committeeTier: saveNew.dataset.committeeTier || 'primary',
          selectedExhp: documentsState.selectedExhp,
          documentsState,
          settings,
          serviceUnit: selector.dataset.serviceUnit || documentsState.selectedExhp?.serviceUnit || '',
          items: documentsState.currentItems || [],
          referenceData: state.referenceData || {}
        });
        const validation = validateNewSupportDocumentData(data);
        if (!validation.valid) {
          showToast(validation.errors[0]?.message || 'Συμπλήρωσε τα υποχρεωτικά πεδία.', 'error');
          return;
        }
        const result = await saveNewSupportDocument(exhpDocsApi, documentsState, documentsState.selectedExhp, data);
        if (data.aitiologiaCode === 'a' && (data.committeeTier || 'primary') === 'primary') {
          copyPrimaryMaterialsIntoSecondaryEditor(editor, data);
        }
        if (!documentsState.selectedExhp && ['a', 'z', 'd'].includes(data.aitiologiaCode)) {
          state.exhpItems = syncSupportDocumentMaterialsToExhpItems(state.exhpItems, data);
          documentsState.currentItems = state.exhpItems;
          renderExhpEntryState(container, state);
        }
        showToast(result.message || 'Το δικαιολογητικό αποθηκεύτηκε.');
      } catch (error) {
        console.error(`Νέο module αιτιολογίας '${reasonCode}' απέτυχε, fallback σε legacy render`, error);
        showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του δικαιολογητικού.', 'error');
      }
      return;
    }

    const addMaterialRow = event.target.closest('[data-material-picker-add-row]');
    if (addMaterialRow) {
      const table = addMaterialRow.closest('[data-material-picker-table]');
      const body = table?.querySelector('[data-material-picker-body]');
      if (!body) return;
      body.insertAdjacentHTML(
        'beforeend',
        renderMaterialPickerRow(
          {},
          body.querySelectorAll('[data-material-picker-row]').length,
          { variant: table?.dataset.materialPickerVariant || 'default' }
        )
      );
      renumberMaterialPickerRows(body);
      return;
    }

    const removeMaterialRow = event.target.closest('[data-material-picker-remove-row]');
    if (removeMaterialRow) {
      const body = removeMaterialRow.closest('[data-material-picker-body]');
      const table = removeMaterialRow.closest('[data-material-picker-table]');
      removeMaterialRow.closest('[data-material-picker-row]')?.remove();
      if (body && !body.querySelector('[data-material-picker-row]')) {
        body.insertAdjacentHTML(
          'beforeend',
          renderMaterialPickerRow({}, 0, { variant: table?.dataset.materialPickerVariant || 'default' })
        );
      }
      if (body) renumberMaterialPickerRows(body);
      return;
    }

    const openOfficialDocument = event.target.closest('[data-open-official-exhp-document]');
    if (openOfficialDocument) {
      const type = openOfficialDocument.dataset.openOfficialExhpDocument;
      const selectedExhp = documentsState.selectedExhp;
      const exhp = {
        id: selectedExhp?.id || null,
        indexNumber: selectedExhp
          ? `${selectedExhp.registryNumber}/${selectedExhp.fiscalYear}`
          : '',
        serviceUnit: selectedExhp?.serviceUnit || selector.dataset.serviceUnit || '',
        onDraftSave: (savedData) => {
          if (type === 'useless_material_a') {
            documentsState.draftUselessA = savedData;
          } else {
            documentsState.draftAmmo = savedData;
          }
        }
      };
      const data = type === 'useless_material_a'
        ? prepareUselessProtocolData(
            documentsState.draftUselessA || documentsState.uselessA || {}
          )
        : documentsState.draftAmmo || documentsState.ammo || {};
      openExhpDocumentModal(type, exhp, data, settings, showToast);
      return;
    }

    const uselessFormButton = event.target.closest('[data-open-useless-material-form]');
    if (uselessFormButton) {
      const definition = USELESS_MATERIAL_FORMS.find((item) => item.key === uselessFormButton.dataset.openUselessMaterialForm);
      if (!definition) return;
      const selectedExhp = documentsState.selectedExhp;
      const exhp = {
        id: selectedExhp?.id || null,
        indexNumber: selectedExhp ? `${selectedExhp.registryNumber}/${selectedExhp.fiscalYear}` : '',
        serviceUnit: selectedExhp?.serviceUnit || selector.dataset.serviceUnit || ''
      };
      if (definition.kind === 'primary') {
        openExhpDocumentModal(
          'useless_material_a',
          { ...exhp, onDraftSave: (saved) => { documentsState.draftUselessA = saved; } },
          prepareUselessProtocolData(documentsState.draftUselessA || documentsState.uselessA || {}),
          settings,
          showToast
        );
        return;
      }
      const existingData = definition.kind === 'differences'
        ? (documentsState.draftUselessB || documentsState.uselessB || {})
        : (documentsState.uselessStatements[definition.key] || {});
      openUselessMaterialFormModal(definition, exhp, existingData, settings, showToast, async (payload) => {
        if (!selectedExhp) {
          if (definition.kind === 'differences') documentsState.draftUselessB = payload;
          else documentsState.uselessStatements[definition.key] = payload;
          return { message: 'Το έντυπο θα αποθηκευτεί μαζί με την ΕΧΠ.' };
        }
        if (definition.kind === 'differences') {
          const document = await ensureExhpSupportDocument(exhpDocsApi, documentsState, selectedExhp.id, 'useless_material_b');
          return exhpDocsApi.saveUselessB(document.id, payload);
        }
        documentsState.uselessStatements[definition.key] = payload;
        return exhpDocsApi.saveUselessStatement(selectedExhp.id, definition.key, payload);
      });
      return;
    }

    const tab = event.target.closest('[data-exhp-doc-form-tab]');
    if (tab) {
      editor.querySelectorAll('[data-exhp-doc-form-tab]').forEach((button) => {
        button.classList.toggle('active', button === tab);
      });
      editor.querySelectorAll('[data-exhp-doc-form-panel]').forEach((panel) => {
        const isActive = panel.dataset.exhpDocFormPanel === tab.dataset.exhpDocFormTab;
        panel.hidden = !isActive;
        panel.classList.toggle('active', isActive);
      });
      return;
    }

    const addRow = event.target.closest('[data-add-exhp-doc-row]');
    if (addRow) {
      const target = editor.querySelector(`[data-${addRow.dataset.addExhpDocRow}-items]`);
      if (!target) return;
      if (addRow.dataset.addExhpDocRow.startsWith('ammo') && target.querySelectorAll('tr').length >= 5) {
        showToast('Ο πίνακας δέχεται έως 5 γραμμές.', 'error');
        return;
      }
      target.insertAdjacentHTML(
        'beforeend',
        renderExhpDocumentItemRow(addRow.dataset.addExhpDocRow, {}, target.querySelectorAll('tr').length)
      );
      return;
    }

    const removeRow = event.target.closest('[data-remove-exhp-doc-row]');
    if (removeRow) {
      removeRow.closest('tr')?.remove();
      return;
    }

    const save = event.target.closest('[data-save-exhp-doc]');
    const preview = event.target.closest('[data-preview-exhp-doc]');
    if (!save && !preview) return;

    try {
      const type = save
        ? save.dataset.saveExhpDoc
        : preview.dataset.previewExhpDoc;
      if (preview) {
        const previewData = collectExhpDocumentPreviewData(type, editor);
        previewData.serviceUnit = editor.querySelector('.official-unit-input')?.value || previewData.unit || '';
        previewExhpDocument(type, previewData);
        return;
      }
      if (!documentsState.selectedExhp) {
        showToast('Το δικαιολογητικό θα αποθηκευτεί μαζί με τη νέα ΕΧΠ.');
        return;
      }

      const document = await ensureExhpSupportDocument(
        exhpDocsApi,
        documentsState,
        documentsState.selectedExhp.id,
        type
      );
      const result = await saveExhpDocumentForm(exhpDocsApi, type, document.id, editor);
      showToast(result.message || 'Το δικαιολογητικό αποθηκεύτηκε.');
      await loadExhpDocumentsEditor(selector, editor, reasonLabel, state.exhpDocuments, documentsState, exhpDocsApi, showToast, settings);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του δικαιολογητικού.', 'error');
    }
  });
}

function renumberMaterialPickerRows(body) {
  body.querySelectorAll('[data-material-picker-row]').forEach((row, index) => {
    const seqInput = row.querySelector('[data-materials-field="seq"]');
    if (seqInput) seqInput.value = String(index + 1);
  });
}

function copyPrimaryMaterialsIntoSecondaryEditor(editor, data) {
  const secondaryPanel = editor.querySelector(
    `[data-doc-a-form="${data.formKey || 'a'}"][data-committee-tier="secondary"]`
  );
  const body = secondaryPanel?.querySelector('[data-material-picker-body]');
  if (!body) return;
  const rows = Array.isArray(data.materials) && data.materials.length ? data.materials : [{}];
  body.innerHTML = rows.map((row, index) =>
    renderMaterialPickerRow(row, index, { variant: 'axristo' })
  ).join('');
  renumberMaterialPickerRows(body);
}

export async function loadExhpDocumentsEditor(selector, editor, reasonLabel, exhpDocuments, documentsState, exhpDocsApi, showToast, settings = {}) {
  const exhpId = Number(selector.value);
  const selectedExhp = exhpDocuments.find((documentItem) => documentItem.id === exhpId);
  const draftIssueReason = selector.dataset.issueReason || '';
  const draftIssueReasonCode = selector.dataset.issueReasonCode || '';
  documentsState.selectedExhp = selectedExhp || null;
  documentsState.supportDocuments = [];
  documentsState.uselessA = null;
  documentsState.uselessB = null;
  documentsState.ammo = null;
  documentsState.transformation = null;
  documentsState.newModuleDrafts ||= {};
  documentsState.uselessStatements = {};

  if (!selectedExhp) {
    if (reasonLabel) reasonLabel.textContent = draftIssueReason;
    editor.innerHTML = draftIssueReason
      ? renderExhpDocumentsEditor({
          issueReason: draftIssueReason,
          issueReasonCode: draftIssueReasonCode,
          serviceUnit: selector.dataset.serviceUnit || ''
        }, documentsState, settings)
      : '<p class="muted">Επίλεξε Αιτιολογία Εκδόσεως για να εμφανιστούν τα διαθέσιμα δικαιολογητικά.</p>';
    return;
  }
  documentsState.uselessMaterialForms = {};
  if (reasonLabel) reasonLabel.textContent = selectedExhp.issueReason || '';

  try {
    documentsState.supportDocuments = await exhpDocsApi.getByExhp(selectedExhp.id);
    await loadSavedExhpDocumentForms(documentsState, exhpDocsApi);
    if (isUselessMaterialReason(selectedExhp.issueReason)) {
      documentsState.uselessStatements = await exhpDocsApi.getUselessStatements(selectedExhp.id);
      documentsState.uselessMaterialForms = Object.fromEntries(
        Object.entries(documentsState.uselessStatements || {}).filter(([key]) =>
          /^(primary|secondary)_(a|b|d2|d3)$/.test(key)
        )
      );
    }
    selectedExhp.issueReasonCode = getAitiologiaCodeForIssueReason(selectedExhp.issueReason, draftIssueReasonCode);
    editor.innerHTML = renderExhpDocumentsEditor(selectedExhp, documentsState, settings);
  } catch (error) {
    editor.innerHTML = '<p class="empty-table">Δεν ήταν δυνατή η φόρτωση των δικαιολογητικών.</p>';
    showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση των δικαιολογητικών.', 'error');
  }
}

async function loadSavedExhpDocumentForms(documentsState, exhpDocsApi) {
  const uselessA = documentsState.supportDocuments.find((documentItem) =>
    documentItem.documentType === 'useless_material_a'
  );
  const uselessB = documentsState.supportDocuments.find((documentItem) =>
    documentItem.documentType === 'useless_material_b'
  );
  const ammo = documentsState.supportDocuments.find((documentItem) =>
    documentItem.documentType === 'ammo_consumption'
  );
  const transformation = documentsState.supportDocuments.find((documentItem) =>
    documentItem.documentType === 'transformation_materials'
  );

  documentsState.uselessA = uselessA ? await exhpDocsApi.getUselessA(uselessA.id) : null;
  documentsState.uselessB = uselessB ? await exhpDocsApi.getUselessB(uselessB.id) : null;
  documentsState.ammo = ammo ? await exhpDocsApi.getAmmo(ammo.id) : null;
  const transformationPayload = transformation ? await exhpDocsApi.getGeneric(transformation.id) : null;
  documentsState.transformation = transformationPayload?.data || null;
  if (documentsState.transformation) {
    documentsState.newModuleDrafts.d = documentsState.transformation;
  }
}

export function renderExhpDocumentOptions(documents) {
  return documents.map((documentItem) => `
    <option value="${documentItem.id}">
      ${escapeHtml(`${documentItem.registryNumber} - ${formatDate(documentItem.documentDate)}`)}
    </option>
  `).join('');
}

function renderExhpDocumentsEditor(selectedExhp, documentsState, settings = {}) {
  const showOfficialForms = shouldShowOfficialExhpForms(selectedExhp.issueReason, selectedExhp.issueReasonCode);
  if (!showOfficialForms) {
    return '';
  }

  if (hasAitiologiaModule(selectedExhp.issueReason, selectedExhp.issueReasonCode)) {
    try {
      return renderNewSupportDocumentEditor(selectedExhp.issueReason, {
        reasonCode: selectedExhp.issueReasonCode,
        selectedExhp,
        documentsState,
        settings,
        serviceUnit: selectedExhp.serviceUnit || '',
        items: documentsState.currentItems || [],
        referenceData: documentsState.referenceData || {}
      });
    } catch (error) {
      console.error(
        `Νέο module αιτιολογίας '${selectedExhp.issueReasonCode || selectedExhp.issueReason}' απέτυχε, fallback σε legacy render`,
        error
      );
    }
  }

  if (isUselessMaterialReason(selectedExhp.issueReason)) {
    return `
      ${renderUselessMaterialTabs()}
    `;
  }

  if (isAmmoConsumptionReason(selectedExhp.issueReason)) {
    return `
      <div class="row-actions">
        <button class="primary-button" data-open-official-exhp-document="ammo_consumption" type="button">
          Άνοιγμα Εντύπου ΔΥΠ/192
        </button>
      </div>
    `;
  }

  return '';
}

export function captureNewSupportModuleDraft(editor, documentsState, issueReason, reasonCode, context = {}) {
  if (!hasAitiologiaModule(issueReason, reasonCode)) return null;
  const resolvedCode = getAitiologiaCodeForIssueReason(issueReason, reasonCode);
  if (resolvedCode === 'a' && Object.keys(documentsState.uselessMaterialForms || {}).length) {
    return { data: null, validation: { valid: true, errors: [] } };
  }
  const data = collectNewSupportDocumentData(editor, issueReason, {
    ...context,
    reasonCode,
    documentsState,
    items: documentsState.currentItems || context.items || []
  });
  const validation = validateNewSupportDocumentData(data);
  if (!validation.valid) return { data, validation };
  saveNewSupportDocumentDraft(documentsState, data);
  return { data, validation };
}

function openNewSupportPreview(html) {
  const existing = document.querySelector('.new-exhp-support-preview-backdrop');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop new-exhp-support-preview-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal handover-document-modal new-exhp-support-preview-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">ΔΙΚΑΙΟΛΟΓΗΤΙΚΟ ΕΧΠ</p><h2>Προεπισκόπηση</h2></div>
        <div class="row-actions">
          <button class="secondary-button" data-close-new-support-preview type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-new-support-preview type="button">Εκτύπωση</button>
        </div>
      </header>
      <div class="handover-document-preview">${html}</div>
    </section>
  `;
  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-close-new-support-preview]')) {
      modal.remove();
      return;
    }
    if (event.target.closest('[data-print-new-support-preview]')) window.print();
  });
  document.body.appendChild(modal);
}
