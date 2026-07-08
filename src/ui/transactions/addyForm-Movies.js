import {
  addManualExhpSupportRow,
  captureExhpDraftSupports,
  collectExhpSupports,
  collectManualExhpSupportDocuments,
  createDraftSupportDocument,
  isInventorySupportTemplate,
  openExhpSupportFolder,
  openExhpSupportTemplate,
  renderExhpSupportChecklist,
  renderSupportTemplateCards,
  setManualExhpSupportRows
} from './exhpSupportDocuments.js';
import { saveDraftExhpDocuments } from './exhpOfficialDocuments.js';
import { openAddyDocument, shouldOpenAddyDocument } from './addyPrint.js';
import { openExhpDocument } from './exhpPrint.js';
import {
  applyExhpShareDefaults,
  applyShareDefaults,
  canAddItem,
  clearExhpLine,
  clearLineControls,
  findCurrentShare,
  getControls,
  getExhpControls,
  maybeSuggestShareNumber,
  openAddyCompositionDialog,
  renderExhpEntryState,
  renderState,
  updateAddButton
} from './entryHelpers.js';
import {
  compareShareNumbers,
  findShareByNominal,
  findShareByNumber,
  isSameIssueReason,
  isCommerceUnit
} from './shared.js';
import { captureNewSupportModuleDraft, loadExhpDocumentsEditor } from './exhpDocumentsWizard.js';
import { hasAitiologiaModule, syncSupportDocumentMaterialsToExhpItems } from './exhpFormModuleBridge.js';
import { syncExhpIssueReasonSettings } from '../pages/settingsPage.js';

export function bindAddyForm(container, transactionsApi, settingsApi, referenceData, settings, state, showToast, rerender) {
  const controls = getControls(container);
  controls.referenceData = referenceData;
  state.referenceData = referenceData;

  container.querySelectorAll('[data-transaction-tab]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const activeTab = tab.dataset.transactionTab;
      container.querySelectorAll('[data-transaction-tab]').forEach((item) => {
        item.classList.toggle('active', item.dataset.transactionTab === activeTab);
      });
      container.querySelectorAll('[data-transaction-panel]').forEach((panel) => {
        const isActive = panel.dataset.transactionPanel === activeTab;
        panel.hidden = !isActive;
        panel.classList.toggle('active', isActive);
      });
    });
  });

  const exhpControls = getExhpControls(container);
  const exhpReason = container.querySelector('#exhp-reason');
  const exhpReasonDisplay = container.querySelector('#exhp-reason-display');
  const exhpSelectedReasonText = container.querySelector('#exhp-selected-reason-text');
  const exhpWizardReason = container.querySelector('#exhp-wizard-reason');
  const exhpSelector = container.querySelector('#exhp-documents-exhp');
  const showExhpWizardStep = (step) => {
    container.querySelectorAll('[data-exhp-wizard-step]').forEach((panel) => {
      panel.hidden = panel.dataset.exhpWizardStep !== String(step);
    });
    container.querySelectorAll('[data-exhp-step-dot]').forEach((dot) => {
      dot.classList.toggle('active', dot.dataset.exhpStepDot === String(step));
    });
  };
  const applyExhpReason = async (reason, reasonCode = '', clearDrafts = true) => {
    if (clearDrafts) {
      state.exhpDraftSupports.clear();
      state.exhpItems = syncSupportDocumentMaterialsToExhpItems(state.exhpItems, null);
      state.exhpDocumentsState.currentItems = state.exhpItems;
      renderExhpEntryState(container, state);
    }
    exhpWizardReason.value = reason;
    exhpReason.value = reason;
    if (exhpReasonDisplay) exhpReasonDisplay.value = reason;
    if (exhpSelectedReasonText) {
      exhpSelectedReasonText.textContent = reason || 'Δεν έχει επιλεγεί αιτιολογία.';
    }
    container.querySelectorAll('[data-exhp-reason-tile]').forEach((button) => {
      button.classList.toggle('selected', button.dataset.exhpReasonTile === reason);
    });
    exhpSelector.value = '';
    exhpSelector.dataset.issueReason = reason;
    exhpSelector.dataset.issueReasonCode = reasonCode;
    exhpSelector.dataset.serviceUnit = referenceData.serviceName || '';
    state.exhpDocumentsState.currentItems = state.exhpItems;
    const useNewModule = hasAitiologiaModule(reason, reasonCode);
    renderExhpSupportChecklist(
      container,
      useNewModule ? [] : referenceData.exhpSupportTemplates.filter((item) => isSameIssueReason(item.issueReason, reason)),
      state.exhpDraftSupports
    );
    syncExhpIssueReasonSettings(container, settings.exhpIssueReasons, reason);
    await loadExhpDocumentsEditor(
      exhpSelector,
      container.querySelector('#exhp-documents-editor'),
      container.querySelector('#exhp-documents-reason strong'),
      state.exhpDocuments,
      state.exhpDocumentsState,
      window.appApi?.exhpDocs,
      showToast,
      settings
    );
  };
  exhpWizardReason.addEventListener('change', () => {
    const selected = exhpWizardReason.selectedOptions[0];
    void applyExhpReason(exhpWizardReason.value, selected?.dataset.issueReasonCode || '');
  });
  container.querySelectorAll('[data-exhp-reason-tile]').forEach((button) => {
    button.addEventListener('click', () => {
      void applyExhpReason(button.dataset.exhpReasonTile, button.dataset.exhpReasonCode || '');
    });
  });
  exhpReason.disabled = true;
  container.querySelector('#exhp-wizard-next').addEventListener('click', () => {
    if (!exhpWizardReason.value) {
      showToast('Επίλεξε Αιτιολογία Εκδόσεως για να συνεχίσεις.', 'error');
      return;
    }
    exhpReason.value = exhpWizardReason.value;
    if (exhpReasonDisplay) exhpReasonDisplay.value = exhpWizardReason.value;
    showExhpWizardStep(2);
  });
  container.querySelector('#exhp-reason-back').addEventListener('click', () => {
    showExhpWizardStep(1);
  });
  container.querySelector('#exhp-support-next').addEventListener('click', () => {
    if (!exhpWizardReason.value) {
      showToast('Επίλεξε Αιτιολογία Εκδόσεως για να συνεχίσεις.', 'error');
      return;
    }
    showExhpWizardStep(3);
  });
  container.querySelector('#exhp-wizard-back').addEventListener('click', () => {
    showExhpWizardStep(2);
  });
  exhpControls.shareNumber.addEventListener('input', () => {
    const share = findShareByNumber(referenceData.shares, exhpControls.shareNumber.value);
    applyExhpShareDefaults(exhpControls, share);
  });

  exhpControls.addItem.addEventListener('click', () => {
    const share = findShareByNumber(referenceData.shares, exhpControls.shareNumber.value);
    const quantity = Number(exhpControls.quantity.value);
    const transactionType = exhpControls.transactionType.value;

    if (!share || !quantity || quantity <= 0 || !transactionType) {
      showToast('Συμπλήρωσε μερίδα, ποσότητα και είδος δοσοληψίας.', 'error');
      return;
    }

    if (transactionType === 'Πίστωση' && quantity > Number(share.accountingBalance || 0)) {
      showToast('Το υπόλοιπο δεν επαρκεί για την πραγματοποίηση της δοσοληψίας.', 'error');
      return;
    }

    if (state.exhpItems.length >= 280) {
      showToast('Η ΕΧΠ δέχεται έως 280 υλικά.', 'error');
      return;
    }

    state.exhpItems.push({
      shareNumber: share.shareNumber,
      nominalNumber: share.nominalNumber,
      description: share.description,
      measurementUnit: share.measurementUnit,
      materialType: share.materialType || '',
      materialCode: share.materialCode || '',
      quantity,
      transactionType,
      supportingDocuments: ''
    });
    state.exhpItems.sort(compareShareNumbers);
    clearExhpLine(exhpControls);
    renderExhpEntryState(container, state);
  });

  controls.shareNumber.addEventListener('input', () => {
    controls.shareNumber.dataset.suggestionAsked = 'false';
    controls.shareNumber.dataset.proposedShareCreated = 'false';
    const share = findShareByNumber(referenceData.shares, controls.shareNumber.value);
    if (share) {
      applyShareDefaults(controls, share);
    }
    updateAddButton(controls, state);
  });

  controls.nominalNumber.addEventListener('input', () => {
    const share = findShareByNominal(referenceData.shares, controls.nominalNumber.value);
    if (share) {
      controls.shareNumber.value = share.shareNumber;
      applyShareDefaults(controls, share);
    }
    updateAddButton(controls, state);
  });

  for (const control of [
    controls.unit,
    controls.description,
    controls.quantity,
    controls.unitPrice,
    controls.measurementUnit,
    controls.transactionType,
    controls.justificationReference,
    controls.materialType
  ]) {
    control.addEventListener('input', () => updateAddButton(controls, state));
    control.addEventListener('change', async () => {
      await maybeSuggestShareNumber(transactionsApi, referenceData, controls, showToast);
      updateAddButton(controls, state);
    });
  }

  controls.addItem.addEventListener('click', async () => {
    await maybeSuggestShareNumber(transactionsApi, referenceData, controls, showToast);
    if (!canAddItem(controls, state)) {
      updateAddButton(controls, state);
      return;
    }

    const selectedShare = findShareByNumber(referenceData.shares, controls.shareNumber.value);
    let composition = [];
    if (
      controls.transactionType.value === 'Πίστωση' &&
      selectedShare?.requiresComposition &&
      selectedShare.composition?.length
    ) {
      const result = await openAddyCompositionDialog(
        selectedShare,
        Number(controls.quantity.value)
      );
      if (!result) return;
      composition = result;
    }

    state.items.push({
      shareNumber: controls.shareNumber.value.trim(),
      nominalNumber: controls.nominalNumber.value.trim(),
      description: controls.description.value.trim(),
      quantity: Number(controls.quantity.value),
      unitPrice: controls.unitPrice.value.trim(),
      measurementUnit: controls.measurementUnit.value,
      transactionType: controls.transactionType.value,
      transactionUnit: controls.unit.value.trim(),
      materialType: controls.materialType.value,
      justificationReference: controls.justificationReference.value.trim(),
      composition
    });
    state.items.sort(compareShareNumbers);

    clearLineControls(controls);
    renderState(container, state);
    updateAddButton(controls, state);
  });

  container.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-remove-addy-item]');
    if (button) {
      state.items.splice(Number(button.dataset.removeAddyItem), 1);
      renderState(container, state);
      updateAddButton(controls, state);
      return;
    }

    const view = event.target.closest('[data-view-addy-document]');
    if (view) {
      try {
        const documentData = await transactionsApi.getAddyDocument(Number(view.dataset.viewAddyDocument));
        if (shouldOpenAddyDocument(documentData)) {
          openAddyDocument(documentData);
        }
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η προβολή ΑΔΔΥ.', 'error');
      }
    }

    if (event.target.closest('#exhp-save')) {
      if (state.viewedExhp) return;

      try {
        captureExhpDraftSupports(container, state.exhpDraftSupports);
        state.exhpDocumentsState.currentItems = state.exhpItems;
        let saveExhpItems = state.exhpItems;
        const newSupportCapture = captureNewSupportModuleDraft(
          container.querySelector('#exhp-documents-editor'),
          state.exhpDocumentsState,
          exhpReason.value,
          exhpSelector.dataset.issueReasonCode || '',
          {
            selectedExhp: null,
            settings,
            serviceUnit: container.querySelector('#exhp-unit').value,
            items: state.exhpItems
          }
        );
        if (newSupportCapture && !newSupportCapture.validation.valid) {
          showToast(newSupportCapture.validation.errors[0]?.message || 'Συμπλήρωσε τα υποχρεωτικά πεδία δικαιολογητικού.', 'error');
          return;
        }
        if (['z', 'd'].includes(newSupportCapture?.data?.aitiologiaCode)) {
          saveExhpItems = syncSupportDocumentMaterialsToExhpItems(state.exhpItems, newSupportCapture.data);
        }
        if (!saveExhpItems.length) {
          showToast('\u03a0\u03c1\u03cc\u03c3\u03b8\u03b5\u03c3\u03b5 \u03c4\u03bf\u03c5\u03bb\u03ac\u03c7\u03b9\u03c3\u03c4\u03bf\u03bd \u03ad\u03bd\u03b1 \u03c5\u03bb\u03b9\u03ba\u03cc \u03c3\u03c4\u03b7\u03bd \u0395\u03a7\u03a0.', 'error');
          return;
        }
        const supports = collectExhpSupports(container, state.exhpDraftSupports);
        const result = await transactionsApi.saveExhp({
          serviceUnit: container.querySelector('#exhp-unit').value,
          issueReason: container.querySelector('#exhp-reason').value,
          approvalReference: container.querySelector('#exhp-approval-reference').value,
          otherSupportDocument: collectManualExhpSupportDocuments(container).join('\n'),
          supports,
          items: saveExhpItems
        });
        state.exhpItems = saveExhpItems;
        state.exhpDocumentsState.currentItems = state.exhpItems;
        renderExhpEntryState(container, state);
        try {
          await saveDraftExhpDocuments(
            window.appApi?.exhpDocs,
            result.documentId,
            exhpReason.value,
            container.querySelector('#exhp-documents-editor'),
            state.exhpDocumentsState
          );
        } catch (documentsError) {
          console.error('EXHP supporting documents save failed:', documentsError);
          showToast('Η ΕΧΠ αποθηκεύτηκε, αλλά ορισμένα δικαιολογητικά δεν αποθηκεύτηκαν.', 'error');
        }
        showToast(result.message || 'Η ΕΧΠ αποθηκεύτηκε.');
        openExhpDocument(result.document);
        await rerender(container, transactionsApi, settingsApi, showToast, 'exhp');
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση της ΕΧΠ.', 'error');
      }
      return;
    }

    const addManualSupport = event.target.closest('[data-add-manual-exhp-support]');
    if (addManualSupport) {
      addManualExhpSupportRow(container);
      return;
    }

    const removeManualSupport = event.target.closest('[data-remove-manual-exhp-support]');
    if (removeManualSupport) {
      const rows = container.querySelectorAll('[data-manual-exhp-support-row]');
      if (rows.length > 1) {
        removeManualSupport.closest('[data-manual-exhp-support-row]')?.remove();
      } else {
        const input = removeManualSupport.closest('[data-manual-exhp-support-row]')?.querySelector('input');
        if (input) input.value = '';
      }
      return;
    }

    const viewExhp = event.target.closest('[data-view-exhp-document]');
    if (viewExhp) {
      try {
        const documentData = await transactionsApi.getExhpDocument(Number(viewExhp.dataset.viewExhpDocument));
        openExhpDocument(documentData);
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η προβολή της ΕΧΠ.', 'error');
      }
      return;
    }

    const supportTemplate = event.target.closest('[data-open-support-template]');
    if (supportTemplate) {
      const template = referenceData.exhpSupportTemplates.find(
        (item) => item.id === Number(supportTemplate.dataset.openSupportTemplate)
      );
      if (!template) return;
      if (isInventorySupportTemplate(template)) {
        document.dispatchEvent(new CustomEvent('diaxeirisi:navigate', {
          detail: { sectionId: 'as', inventoryTab: 'statement' }
        }));
        return;
      }
      const existingDraft = state.exhpDraftSupports.get(template.id) || {};
      openExhpSupportTemplate(createDraftSupportDocument(
        referenceData,
        exhpReason.value || template.issueReason,
        state.exhpItems,
        container,
        settings
      ), {
        ...template,
        formData: existingDraft.formData || {},
        documentReference: existingDraft.documentReference || '',
        completed: Boolean(existingDraft.completed)
      }, transactionsApi, showToast, {
        draft: true,
        onSave: (draft) => {
          captureExhpDraftSupports(container, state.exhpDraftSupports);
          const manualSupportDocuments = collectManualExhpSupportDocuments(container);
          state.exhpDraftSupports.set(template.id, draft);
          renderExhpSupportChecklist(
            container,
            referenceData.exhpSupportTemplates.filter((item) => isSameIssueReason(item.issueReason, exhpReason.value)),
            state.exhpDraftSupports
          );
          setManualExhpSupportRows(container, manualSupportDocuments);
          showToast('Το επίσημο έντυπο προετοιμάστηκε και θα αποθηκευτεί μαζί με την ΕΧΠ.');
        }
      });
      return;
    }

    const removeExhp = event.target.closest('[data-remove-exhp-item]');
    if (removeExhp) {
      state.exhpItems.splice(Number(removeExhp.dataset.removeExhpItem), 1);
      renderExhpEntryState(container, state);
    }
  });

  controls.save.addEventListener('click', async () => {
    try {
      const result = await transactionsApi.saveAddy({
        documentDate: controls.date.value,
        transactionUnit: controls.unit.value.trim(),
        justificationReference: controls.justificationReference.value.trim(),
        notes: controls.notes.value.trim(),
        items: state.items
      });
      showToast(result.message || 'Το ΑΔΔΥ αποθηκεύτηκε.');
      if (result.document && shouldOpenAddyDocument(result.document)) {
        openAddyDocument(result.document);
      }
      await rerender(container, transactionsApi, settingsApi, showToast);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση ΑΔΔΥ.', 'error');
    }
  });
}
