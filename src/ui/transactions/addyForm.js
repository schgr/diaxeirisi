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
  clearShareDefaults,
  confirmFutureTransactionDate,
  findCurrentShare,
  getControls,
  getExhpControls,
  isToolCollectionReason,
  maybeSuggestShareNumber,
  openAddyCompositionDialog,
  openToolCollectionCreditDialog,
  renderExhpEntryState,
  renderState,
  updateAddButton
} from './entryHelpers.js';
import {
  compareShareNumbers,
  findShareByNominal,
  findShareByNumber,
  isCommerceUnit
} from './shared.js';
import { captureNewSupportModuleDraft, loadExhpDocumentsEditor } from './exhpDocumentsWizard.js';
import {
  getAitiologiaCodeForIssueReason,
  hasAitiologiaModule,
  shouldShowOfficialExhpForms,
  syncSavedSecondaryMaterialsToExhpItems,
  syncSupportDocumentMaterialsToExhpItems
} from './exhpFormModuleBridge.js';
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
    if (container.querySelector('[data-transaction-panel="exhp"].exhp-flat-flow')) return;
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
      state.exhpItems = [];
      state.exhpDocumentsState.currentItems = state.exhpItems;
      clearExhpLine(exhpControls);
      renderExhpEntryState(container, state);
    }
    exhpWizardReason.value = reason;
    exhpReason.value = reason;
    if (exhpReasonDisplay) exhpReasonDisplay.value = reason;
    if (exhpSelectedReasonText) {
      exhpSelectedReasonText.textContent = reason || '';
    }
    container.querySelectorAll('[data-exhp-reason-tile]').forEach((button) => {
      button.classList.toggle('selected', button.dataset.exhpReasonTile === reason);
    });
    exhpSelector.value = '';
    exhpSelector.dataset.issueReason = reason;
    exhpSelector.dataset.issueReasonCode = reasonCode;
    const nominalTransfer = reasonCode === 'g';
    container.dataset.exhpNominalTransfer = nominalTransfer ? 'true' : 'false';
    exhpControls.transactionType.disabled = nominalTransfer;
    exhpControls.quantity.readOnly = nominalTransfer;
    if (nominalTransfer) {
      exhpControls.transactionType.value = 'Πίστωση';
    }
    exhpSelector.dataset.serviceUnit = referenceData.serviceName || '';
    state.exhpDocumentsState.currentItems = state.exhpItems;
    const useNewModule = hasAitiologiaModule(reason, reasonCode);
    renderExhpSupportChecklist(
      container,
      useNewModule ? [] : referenceData.exhpSupportTemplates.filter((item) => item.issueReason === reason),
      state.exhpDraftSupports,
      { showOfficialForms: shouldShowOfficialExhpForms(reason, reasonCode) }
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
      void applyExhpReason(button.dataset.exhpReasonTile, button.dataset.exhpReasonCode || '')
        .then(() => showExhpWizardStep(2));
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
    showExhpWizardStep(1);
  });
  exhpControls.shareNumber.addEventListener('input', () => {
    const share = findShareByNumber(referenceData.shares, exhpControls.shareNumber.value);
    applyExhpShareDefaults(exhpControls, share);
    if (container.dataset.exhpNominalTransfer === 'true') {
      exhpControls.quantity.value = share ? Number(share.accountingBalance || 0) : '';
      exhpControls.transactionType.value = 'Πίστωση';
    }
  });

  container.addEventListener('input', (event) => {
    const transferInput = event.target.closest('[data-exhp-transfer-share-number]');
    if (!transferInput) return;
    const item = state.exhpItems[Number(transferInput.dataset.exhpTransferShareNumber)];
    if (item) item.shareNumber = transferInput.value.trim();
    container.querySelector('#exhp-save').disabled = state.exhpItems.some((entry) =>
      entry.sourceShareNumber && !String(entry.shareNumber || '').trim()
    );
  });

  exhpControls.addItem.addEventListener('click', async () => {
    const share = findShareByNumber(referenceData.shares, exhpControls.shareNumber.value);
    const quantity = Number(exhpControls.quantity.value);
    const nominalTransfer = container.dataset.exhpNominalTransfer === 'true';
    const transactionType = nominalTransfer ? 'Πίστωση' : exhpControls.transactionType.value;
    const collectionTransfer = isToolCollectionReason(exhpReason.value);

    if (collectionTransfer) {
      if (!share?.requiresComposition || !Array.isArray(share.composition) || !share.composition.length) {
        showToast('Επίλεξε μερίδα συλλογής με καταχωρημένη σύνθεση.', 'error');
        return;
      }
      const selected = await openToolCollectionCreditDialog(share, referenceData.shares);
      if (!selected) return;
      selected.forEach(({ share: collectionShare, item, quantity: selectedQuantity, sourceShare }, index) => {
        const transferGroup = `collection-transfer-${Date.now()}-${index}`;
        const virtualCredit = Number(item.quantityPerMaterial || 0) <= 0 || !sourceShare;
        const shared = {
          nominalNumber: item.componentNominalNumber,
          description: item.componentDescription,
          measurementUnit: item.measurementUnit || sourceShare?.measurementUnit || '',
          materialType: sourceShare?.materialType || '',
          materialCode: sourceShare?.materialCode || '',
          quantity: selectedQuantity,
          supportingDocuments: '',
          collectionTransfer: true,
          collectionVirtualCredit: virtualCredit,
          collectionParentShareNumber: collectionShare.shareNumber,
          transferGroup
        };
        state.exhpItems.push({
          ...shared,
          shareNumber: sourceShare?.shareNumber || 'Φ.Μ.',
          transactionType: 'Πίστωση'
        }, {
          ...shared,
          shareNumber: '',
          sourceShareNumber: sourceShare?.shareNumber || 'Φ.Μ.',
          transactionType: 'Χρέωση'
        });
      });
      state.exhpItems.sort(compareShareNumbers);
      clearExhpLine(exhpControls);
      renderExhpEntryState(container, state);
      return;
    }

    if (!share || !quantity || quantity <= 0 || !transactionType) {
      showToast('Συμπλήρωσε μερίδα, ποσότητα και είδος δοσοληψίας.', 'error');
      return;
    }

    if (transactionType === 'Πίστωση' && quantity > Number(share.accountingBalance || 0)) {
      showToast('Το υπόλοιπο δεν επαρκεί για την πραγματοποίηση της δοσοληψίας.', 'error');
      return;
    }

    if (state.exhpItems.length + (nominalTransfer ? 2 : 1) > 280) {
      showToast('Η ΕΧΠ δέχεται έως 280 υλικά.', 'error');
      return;
    }

    if (nominalTransfer && Math.abs(quantity - Number(share.accountingBalance || 0)) > 0.000001) {
      showToast('Για τη μεταβολή Αριθμού Ονομαστικού πιστώνεται ολόκληρο το υπόλοιπο της μερίδας.', 'error');
      return;
    }

    if (nominalTransfer && state.exhpItems.some((item) =>
      item.transactionType === 'Πίστωση' && item.shareNumber === share.shareNumber
    )) {
      showToast('Η συγκεκριμένη μερίδα έχει ήδη προστεθεί.', 'error');
      return;
    }

    const transferGroup = nominalTransfer
      ? `nominal-transfer-${Date.now()}-${state.exhpItems.length}`
      : '';
    const baseItem = {
      shareNumber: share.shareNumber,
      nominalNumber: share.nominalNumber,
      description: share.description,
      measurementUnit: share.measurementUnit,
      materialType: share.materialType || '',
      materialCode: share.materialCode || '',
      quantity,
      transactionType,
      supportingDocuments: '',
      transferGroup
    };
    state.exhpItems.push(baseItem);
    if (nominalTransfer) {
      state.exhpItems.push({
        ...baseItem,
        shareNumber: '',
        sourceShareNumber: share.shareNumber,
        transactionType: 'Χρέωση'
      });
    }
    state.exhpItems.sort(compareShareNumbers);
    clearExhpLine(exhpControls);
    if (nominalTransfer) exhpControls.transactionType.value = 'Πίστωση';
    renderExhpEntryState(container, state);
  });

  controls.shareNumber.addEventListener('input', () => {
    controls.shareNumber.dataset.suggestionAsked = 'false';
    controls.shareNumber.dataset.proposedShareCreated = 'false';
    const share = findShareByNumber(referenceData.shares, controls.shareNumber.value);
    if (share) {
      applyShareDefaults(controls, share);
    } else {
      clearShareDefaults(controls, { clearNominalNumber: true });
    }
    updateAddButton(controls, state);
  });

  controls.nominalNumber.addEventListener('input', () => {
    const share = findShareByNominal(referenceData.shares, controls.nominalNumber.value);
    if (share) {
      controls.shareNumber.value = share.shareNumber;
      applyShareDefaults(controls, share);
    } else if (!controls.nominalNumber.value.trim()) {
      clearShareDefaults(controls, { clearShareNumber: true });
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
      justificationReference: '',
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

    const editAddy = event.target.closest('[data-edit-addy-document]');
    if (editAddy) {
      try {
        const documentData = await transactionsApi.getAddyDocument(
          Number(editAddy.dataset.editAddyDocument)
        );
        openAddyEditDialog(documentData, transactionsApi, showToast, async () => {
          await rerender(container, transactionsApi, settingsApi, showToast);
        });
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση του ΑΔΔΥ.', 'error');
      }
      return;
    }

    const deleteAddy = event.target.closest('[data-delete-addy-document]');
    if (deleteAddy) {
      const accepted = window.confirm(
        'Αυτή η ενέργεια θα διαγράψει το ΑΔΔΥ από το Ευρετήριο Εξωτερικών Δοσοληψιών και τις κινήσεις από τις Μερίδες Υλικού. Να προχωρήσω;'
      );
      if (!accepted) return;
      try {
        const result = await transactionsApi.deleteAddy(
          Number(deleteAddy.dataset.deleteAddyDocument)
        );
        showToast(result.message);
        await rerender(container, transactionsApi, settingsApi, showToast);
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η διαγραφή του ΑΔΔΥ.', 'error');
      }
      return;
    }

    if (event.target.closest('#exhp-save')) {
      if (state.viewedExhp) return;

      try {
        const exhpDate = container.querySelector('#exhp-date').value;
        if (!confirmFutureTransactionDate(exhpDate)) return;
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
        if (['z', 'd', 'st'].includes(newSupportCapture?.data?.aitiologiaCode)) {
          saveExhpItems = syncSupportDocumentMaterialsToExhpItems(state.exhpItems, newSupportCapture.data);
        }
        const issueReasonCode = getAitiologiaCodeForIssueReason(
          exhpReason.value,
          exhpSelector.dataset.issueReasonCode || ''
        );
        if (issueReasonCode === 'a') {
          saveExhpItems = syncSavedSecondaryMaterialsToExhpItems(
            saveExhpItems,
            state.exhpDocumentsState
          );
        }
        if (!saveExhpItems.length) {
          showToast('\u03a0\u03c1\u03cc\u03c3\u03b8\u03b5\u03c3\u03b5 \u03c4\u03bf\u03c5\u03bb\u03ac\u03c7\u03b9\u03c3\u03c4\u03bf\u03bd \u03ad\u03bd\u03b1 \u03c5\u03bb\u03b9\u03ba\u03cc \u03c3\u03c4\u03b7\u03bd \u0395\u03a7\u03a0.', 'error');
          return;
        }
        const supports = collectExhpSupports(container, state.exhpDraftSupports);
        const result = await transactionsApi.saveExhp({
          documentDate: exhpDate,
          serviceUnit: container.querySelector('#exhp-unit').value,
          issueReason: container.querySelector('#exhp-reason').value,
          approvalReference: '',
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
          clearIssuedExhpDraftState(state);
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
      event.preventDefault();
      event.stopImmediatePropagation();
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
          detail: { sectionId: 'as', inventoryTab: 'counts' }
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
            referenceData.exhpSupportTemplates.filter((item) => item.issueReason === exhpReason.value),
            state.exhpDraftSupports,
            {
              showOfficialForms: shouldShowOfficialExhpForms(
                exhpReason.value,
                exhpSelector.dataset.issueReasonCode || ''
              )
            }
          );
          setManualExhpSupportRows(container, manualSupportDocuments);
          showToast('Το επίσημο έντυπο προετοιμάστηκε και θα αποθηκευτεί μαζί με την ΕΧΠ.');
        }
      });
      return;
    }

    const removeExhp = event.target.closest('[data-remove-exhp-item]');
    if (removeExhp) {
      const removed = state.exhpItems[Number(removeExhp.dataset.removeExhpItem)];
      if (removed?.transferGroup) {
        state.exhpItems = state.exhpItems.filter((item) => item.transferGroup !== removed.transferGroup);
      } else {
        state.exhpItems.splice(Number(removeExhp.dataset.removeExhpItem), 1);
      }
      renderExhpEntryState(container, state);
    }
  });

  controls.save.addEventListener('click', async () => {
    try {
      if (!confirmFutureTransactionDate(controls.date.value)) return;
      const result = await transactionsApi.saveAddy({
        documentDate: controls.date.value,
        transactionUnit: controls.unit.value.trim(),
        justificationReference: '',
        notes: controls.notes.value.trim(),
        items: state.items
      });
      showToast(result.message || 'Το ΑΔΔΥ αποθηκεύτηκε.');
        if (result.document && shouldOpenAddyDocument(result.document)) {
          openAddyDocument(result.document);
        }
        state.items.length = 0;
        await rerender(container, transactionsApi, settingsApi, showToast);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση ΑΔΔΥ.', 'error');
    }
  });
}

function openAddyEditDialog(documentData, transactionsApi, showToast, onSaved) {
  const modal = window.document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal addy-edit-modal">
      <header class="material-card-header">
        <div>
          <p class="eyebrow">ΚΑΤΑΧΩΡΗΜΕΝΟ ΑΔΔΥ</p>
          <h2>Επεξεργασία ΑΔΔΥ ${Number(documentData.id)}</h2>
        </div>
        <button class="secondary-button" data-close-addy-edit type="button">Κλείσιμο</button>
      </header>
      <form data-addy-edit-form class="stacked-form">
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Μερίδα</th>
                <th>Αριθμός Ονομαστικού</th>
                <th>Περιγραφή</th>
                <th>Είδος</th>
                <th>Ποσότητα</th>
              </tr>
            </thead>
            <tbody>
              ${documentData.items.map((item) => `
                <tr>
                  <td>${escapeAddyEditHtml(item.shareNumber)}</td>
                  <td>${escapeAddyEditHtml(item.nominalNumber)}</td>
                  <td>${escapeAddyEditHtml(item.description)}</td>
                  <td>${escapeAddyEditHtml(item.transactionType)}</td>
                  <td>
                    <input
                      data-addy-edit-quantity="${Number(item.id)}"
                      data-original-quantity="${Number(item.quantity)}"
                      type="number"
                      min="0.000001"
                      step="any"
                      value="${Number(item.quantity)}"
                      required
                    />
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <label class="field">
          <span>Πληροφορίες</span>
          <textarea data-addy-edit-notes rows="4">${escapeAddyEditHtml(documentData.notes || '')}</textarea>
        </label>
        <div class="row-actions">
          <button class="secondary-button" data-close-addy-edit type="button">Ακύρωση</button>
          <button class="primary-button" type="submit">Αποθήκευση αλλαγών</button>
        </div>
      </form>
    </section>
  `;

  const close = () => modal.remove();
  modal.querySelectorAll('[data-close-addy-edit]').forEach((button) => {
    button.addEventListener('click', close);
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) close();
  });
  modal.querySelector('[data-addy-edit-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const quantityInputs = [...modal.querySelectorAll('[data-addy-edit-quantity]')];
    const quantityChanged = quantityInputs.some(
      (input) => Number(input.value) !== Number(input.dataset.originalQuantity)
    );
    if (
      quantityChanged &&
      !window.confirm(
        'Αυτή η ενέργεια θα αλλάξει την Ποσότητα από το ΑΔΔΥ και τις κινήσεις από τις Μερίδες Υλικού. Να προχωρήσω;'
      )
    ) {
      return;
    }
    try {
      const result = await transactionsApi.updateAddy(documentData.id, {
        notes: modal.querySelector('[data-addy-edit-notes]').value,
        items: quantityInputs.map((input) => ({
          id: Number(input.dataset.addyEditQuantity),
          quantity: Number(input.value)
        }))
      });
      close();
      showToast(result.message);
      await onSaved();
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ΑΔΔΥ.', 'error');
    }
  });
  window.document.body.appendChild(modal);
}

function escapeAddyEditHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clearIssuedExhpDraftState(state) {
  const documentsState = state.exhpDocumentsState || {};
  documentsState.newModuleDrafts = {};
  documentsState.uselessMaterialForms = {};
  documentsState.uselessStatements = {};
  documentsState.draftUselessA = null;
  documentsState.draftUselessB = null;
  documentsState.draftAmmo = null;
  documentsState.transformation = null;
  if (state.exhpDraftSupports?.clear) state.exhpDraftSupports.clear();
  state.exhpItems = [];
  documentsState.currentItems = state.exhpItems;
}
