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
import { showConfirmDialog } from '../components/dialogs.js';
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
  renderSavedAddyRows,
  renderState,
  updateAddButton
} from './entryHelpers.js';
import {
  compareShareNumbers,
  findShareByNominal,
  findShareByNumber,
  findSharesByNominal,
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
  if (container.__addyInputHandler) {
    container.removeEventListener('input', container.__addyInputHandler);
  }
  if (container.__addyClickHandler) {
    container.removeEventListener('click', container.__addyClickHandler);
  }

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

  const inputHandler = (event) => {
    const transferInput = event.target.closest('[data-exhp-transfer-share-number]');
    const nominalInput = event.target.closest('[data-exhp-transfer-nominal-number]');
    if (!transferInput && !nominalInput) return;
    const itemIndex = Number(
      transferInput?.dataset.exhpTransferShareNumber
      ?? nominalInput.dataset.exhpTransferNominalNumber
    );
    const item = state.exhpItems[itemIndex];
    if (item && transferInput) item.shareNumber = transferInput.value.trim();
    if (item && nominalInput) item.nominalNumber = nominalInput.value.trim();
    container.querySelector('#exhp-save').disabled = state.exhpItems.some((entry) =>
      entry.sourceShareNumber && (
        !String(entry.shareNumber || '').trim() || !String(entry.nominalNumber || '').trim()
      )
    );
  };
  container.addEventListener('input', inputHandler);
  container.__addyInputHandler = inputHandler;

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

    const pendingCredit = state.exhpItems
      .filter((item) => item.transactionType === 'Πίστωση' && item.shareNumber === share?.shareNumber)
      .reduce((total, item) => total + Number(item.quantity || 0), 0);
    if (
      transactionType === 'Πίστωση' &&
      pendingCredit + quantity > Number(share.accountingBalance || 0) + 0.000001
    ) {
      showToast(
        `Η ποσότητα πίστωσης υπερβαίνει το υπόλοιπο της μερίδας (διαθέσιμο: ${Number(share.accountingBalance || 0)}).`,
        'error'
      );
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
        nominalNumber: '',
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

  controls.nominalNumber.addEventListener('input', async () => {
    if (controls.shareNumber.value.trim()) {
      updateAddButton(controls, state);
      return;
    }
    const nominalNumber = controls.nominalNumber.value.trim();
    const matchingShares = findSharesByNominal(referenceData.shares, nominalNumber);
    if (matchingShares.length === 1) {
      controls.shareNumber.value = matchingShares[0].shareNumber;
      applyShareDefaults(controls, matchingShares[0]);
    } else if (matchingShares.length > 1) {
      if (controls.nominalNumber.dataset.shareSelectionOpen === 'true') return;
      controls.nominalNumber.dataset.shareSelectionOpen = 'true';
      const selectedShare = await openAddyShareSelectionDialog(matchingShares);
      delete controls.nominalNumber.dataset.shareSelectionOpen;
      if (selectedShare && !controls.shareNumber.value.trim() && controls.nominalNumber.value.trim() === nominalNumber) {
        controls.shareNumber.value = selectedShare.shareNumber;
        applyShareDefaults(controls, selectedShare);
      }
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
    const nextTransactionType = controls.transactionType.value;
    const nextShareNumber = controls.shareNumber.value.trim();
    const nextQuantity = Number(controls.quantity.value);
    const otherDraftItems = state.items.filter((_item, index) => index !== state.addyEditingIndex);
    if (otherDraftItems.some((item) => item.transactionType !== nextTransactionType)) {
      showToast('Στο ίδιο ΑΔΔΥ δεν μπορούν να συνυπάρχουν υλικά Χρέωσης και Πίστωσης.', 'error');
      return;
    }
    if (nextTransactionType === 'Πίστωση') {
      const availableBalance = Number(
        selectedShare?.accountingBalance ?? selectedShare?.accounting_balance ?? 0
      );
      const pendingCredit = otherDraftItems
        .filter((item) => item.transactionType === 'Πίστωση' && item.shareNumber === nextShareNumber)
        .reduce((total, item) => total + Number(item.quantity || 0), 0);
      if (!selectedShare || pendingCredit + nextQuantity > availableBalance + 0.000001) {
        showToast(
          `Η ποσότητα πίστωσης υπερβαίνει το υπόλοιπο της μερίδας (διαθέσιμο: ${availableBalance}).`,
          'error'
        );
        return;
      }
    }
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

    const nextItem = {
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
    };
    if (Number.isInteger(state.addyEditingIndex)) {
      state.items[state.addyEditingIndex] = nextItem;
      state.addyEditingIndex = null;
      controls.addItem.textContent = 'Προσθήκη';
    } else {
      state.items.push(nextItem);
    }
    state.items.sort(compareShareNumbers);

    clearLineControls(controls);
    renderState(container, state);
    updateAddButton(controls, state);
  });

  const clickHandler = async (event) => {
    const editButton = event.target.closest('[data-edit-addy-item]');
    if (editButton) {
      const editIndex = Number(editButton.dataset.editAddyItem);
      const item = state.items[editIndex];
      if (!item) return;
      state.addyEditingIndex = editIndex;
      controls.unit.value = item.transactionUnit || '';
      controls.shareNumber.value = item.shareNumber || '';
      controls.nominalNumber.value = item.nominalNumber || '';
      controls.description.value = item.description || '';
      controls.quantity.value = item.quantity;
      controls.unitPrice.value = item.unitPrice ?? '';
      controls.measurementUnit.value = item.measurementUnit || '';
      controls.transactionType.value = item.transactionType || '';
      controls.materialType.value = item.materialType || '';
      controls.addItem.textContent = 'Αποθήκευση αλλαγών';
      updateAddButton(controls, state);
      controls.shareNumber.focus();
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
        const savedAddyBody = editAddy.closest('tbody');
        openAddyEditDialog(documentData, transactionsApi, showToast, async () => {
          state.documents = await transactionsApi.listAddyDocuments();
          savedAddyBody.innerHTML = renderSavedAddyRows(state.documents);
          restoreAddyEntryFocus(controls);
        });
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση του ΑΔΔΥ.', 'error');
      }
      return;
    }

    const deleteAddy = event.target.closest('[data-delete-addy-document]');
    if (deleteAddy) {
      const accepted = await confirmAddyAction(
        'Αυτή η ενέργεια θα διαγράψει το ΑΔΔΥ από το Ευρετήριο Εξωτερικών Δοσοληψιών και τις κινήσεις από τις Μερίδες Υλικού. Να προχωρήσω;'
      );
      if (!accepted) return;
      try {
        const result = await transactionsApi.deleteAddy(
          Number(deleteAddy.dataset.deleteAddyDocument)
        );
        showToast(result.message);
        state.documents = state.documents.filter(
          (documentItem) => Number(documentItem.id) !== Number(deleteAddy.dataset.deleteAddyDocument)
        );
        deleteAddy.closest('tbody').innerHTML = renderSavedAddyRows(state.documents);
        for (const affectedShare of result.affectedShares || []) {
          const share = referenceData.shares.find((item) => Number(item.id) === Number(affectedShare.id));
          if (!share) continue;
          share.accountingBalance = affectedShare.accountingBalance;
          share.chargedQuantity = affectedShare.chargedQuantity;
        }
        restoreAddyEntryFocus(controls);
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η διαγραφή του ΑΔΔΥ.', 'error');
      }
      return;
    }

    if (event.target.closest('#exhp-save')) {
      if (state.viewedExhp) return;

      try {
        const exhpDate = container.querySelector('#exhp-date').value;
    if (!await confirmFutureTransactionDate(exhpDate)) return;
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
        for (const transactionType of ['Πίστωση', 'Χρέωση']) {
          const savedItems = (result.document?.items || []).filter((item) =>
            item.transactionType === transactionType && item.exhpItemId
          );
          if (!savedItems.length) continue;
          const updateDepartments = await showConfirmDialog(
            `Θέλετε να γίνει ${transactionType === 'Χρέωση' ? 'χρέωση' : 'πίστωση'} των υλικών της ΕΧΠ στις Μερικές Διαχειρίσεις;`,
            { title: `${transactionType} ΕΧΠ στις Μερικές Διαχειρίσεις`, confirmLabel: 'Ναι', cancelLabel: 'Όχι' }
          );
          if (!updateDepartments) continue;
          for (const item of savedItems) {
            const share = findShareByNumber(referenceData.shares, item.shareNumber);
            const allocations = await openAddyDepartmentAllocationDialog({
              departments: referenceData.departmentManagers || [],
              share,
              shareNumber: item.shareNumber,
              description: item.description,
              transactionType: item.transactionType,
              quantity: Number(item.quantity),
              documentLabel: 'ΕΧΠ'
            });
            if (allocations === null) break;
            const finalAllocations = share?.requiresComposition && item.composition?.length
              ? await openAddyCompositionAllocationDialog({
                  departments: referenceData.departmentManagers || [],
                  share,
                  allocations,
                  composition: item.composition,
                  transactionType: item.transactionType
                })
              : allocations;
            if (finalAllocations === null) break;
            const allocationResult = await transactionsApi.saveExhpDepartmentAllocations(
              result.documentId,
              { entries: [{ exhpItemId: item.exhpItemId, allocations: finalAllocations }] }
            );
            showToast(allocationResult.message);
          }
        }
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
      state.exhpItems.splice(Number(removeExhp.dataset.removeExhpItem), 1);
      renderExhpEntryState(container, state);
    }
  };
  container.addEventListener('click', clickHandler);
  container.__addyClickHandler = clickHandler;

  controls.save.addEventListener('click', async () => {
    try {
      if (!await confirmFutureTransactionDate(controls.date.value)) return;
      const result = await transactionsApi.saveAddy({
        documentDate: controls.date.value,
        transactionUnit: controls.unit.value.trim(),
        justificationReference: '',
        notes: controls.notes.value.trim(),
        items: state.items
      });
      showToast(result.message || 'Το ΑΔΔΥ αποθηκεύτηκε.');
      const transactionType = result.document?.items?.[0]?.transactionType || '';
      const updateDepartments = await showConfirmDialog(
        `Θέλετε να γίνει ${transactionType === 'Χρέωση' ? 'χρέωση' : 'πίστωση'} των υλικών στις Μερικές Διαχειρίσεις;`,
        {
          title: `${transactionType || 'Ενημέρωση'} Μερικών Διαχειρίσεων`,
          confirmLabel: 'Ναι',
          cancelLabel: 'Όχι'
        }
      );
      if (updateDepartments) {
        try {
          for (const item of result.document?.items || []) {
            const share = findShareByNumber(referenceData.shares, item.shareNumber);
            const allocations = await openAddyDepartmentAllocationDialog({
              departments: referenceData.departmentManagers || [],
              share,
              shareNumber: item.shareNumber,
              description: item.description,
              transactionType: item.transactionType,
              quantity: Number(item.column22)
            });
            if (allocations === null) {
              showToast('Το ΑΔΔΥ αποθηκεύτηκε χωρίς μεταβολή στις χρεώσεις ή πιστώσεις των τμημάτων.');
              break;
            }
            const finalAllocations = share?.requiresComposition && item.composition?.length
              ? await openAddyCompositionAllocationDialog({
                  departments: referenceData.departmentManagers || [],
                  share,
                  allocations,
                  composition: item.composition,
                  transactionType: item.transactionType
                })
              : allocations;
            if (finalAllocations === null) {
              showToast('Το ΑΔΔΥ αποθηκεύτηκε χωρίς μεταβολή στις χρεώσεις ή πιστώσεις των τμημάτων.');
              break;
            }
            const allocationResult = await transactionsApi.saveAddyDepartmentAllocations(
              result.documentId,
              { entries: [{ addyItemId: item.addyItemId, allocations: finalAllocations }] }
            );
            showToast(allocationResult.message);
          }
        } catch (error) {
          showToast(
            error.message || 'Το ΑΔΔΥ αποθηκεύτηκε, αλλά δεν αποθηκεύτηκαν οι κινήσεις των τμημάτων.',
            'error'
          );
        }
      } else {
        showToast('Το ΑΔΔΥ αποθηκεύτηκε χωρίς μεταβολή στις Μερικές Διαχειρίσεις.');
      }
        if (result.document && shouldOpenAddyDocument(result.document)) {
          openAddyDocument(result.document);
        }
        state.items.length = 0;
        await rerender(container, transactionsApi, settingsApi, showToast, 'addy');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση ΑΔΔΥ.', 'error');
    }
  });
}

function restoreAddyEntryFocus(controls) {
  window.requestAnimationFrame(() => {
    controls.unit.focus({ preventScroll: true });
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
          <h2>Επεξεργασία ΑΔΔΥ</h2>
        </div>
        <button class="secondary-button" data-close-addy-edit type="button">Κλείσιμο</button>
      </header>
      <form data-addy-edit-form class="stacked-form">
        <div class="inline-form">
          <label class="field">
            <span>Αριθμός ΑΔΔΥ</span>
            <input data-addy-edit-id type="number" min="1" step="1" value="${Number(documentData.id)}" required />
          </label>
          <label class="field">
            <span>Ημερομηνία</span>
            <input data-addy-edit-date type="date" value="${documentData.documentDate}" required />
          </label>
          <button class="primary-button" type="submit">Αποθήκευση</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Μερίδα</th>
                <th>Αριθμός Ονομαστικού</th>
                <th>Περιγραφή</th>
                <th>Είδος</th>
                <th>Ποσότητα</th>
                <th>Ενέργεια</th>
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
                  <td><button class="danger-button" data-remove-addy-edit-item="${Number(item.id)}" type="button">Διαγραφή</button></td>
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
        </div>
      </form>
    </section>
  `;

  const close = () => modal.remove();
  const removedItemIds = new Set();
  modal.querySelectorAll('[data-close-addy-edit]').forEach((button) => {
    button.addEventListener('click', close);
  });
  modal.addEventListener('click', async (event) => {
    if (event.target === modal) close();
    const removeButton = event.target.closest('[data-remove-addy-edit-item]');
    if (!removeButton) return;
    const remainingRows = modal.querySelectorAll('[data-addy-edit-quantity]');
    if (remainingRows.length <= 1) {
      showToast('Το ΑΔΔΥ πρέπει να περιέχει τουλάχιστον ένα υλικό.', 'error');
      return;
    }
    const accepted = await confirmAddyAction('Να διαγραφεί μόνο αυτό το υλικό από το ΑΔΔΥ και από την αντίστοιχη Μερίδα Υλικού;');
    if (!accepted) return;
    removedItemIds.add(Number(removeButton.dataset.removeAddyEditItem));
    removeButton.closest('tr')?.remove();
  });
  modal.querySelector('[data-addy-edit-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const quantityInputs = [...modal.querySelectorAll('[data-addy-edit-quantity]')];
    const quantityChanged = quantityInputs.some(
      (input) => Number(input.value) !== Number(input.dataset.originalQuantity)
    );
    const newId = Number(modal.querySelector('[data-addy-edit-id]').value);
    const newDate = modal.querySelector('[data-addy-edit-date]').value;
    const idChanged = newId !== Number(documentData.id);
    const dateChanged = newDate !== documentData.documentDate;

    if (quantityChanged) {
      const accepted = await confirmAddyAction(
        'Αυτή η ενέργεια θα αλλάξει την Ποσότητα από το ΑΔΔΥ και τις κινήσεις από τις Μερίδες Υλικού. Να προχωρήσω;'
      );
      if (!accepted) return;
    }
    if (idChanged) {
      const accepted = await confirmAddyAction('Αυτή η ενέργεια θα αλλάξει τον αριθμό του ΑΔΔΥ. Να προχωρήσω;');
      if (!accepted) return;
    }
    if (dateChanged) {
      const accepted = await confirmAddyAction('Αυτή η ενέργεια θα αλλάξει την ημερομηνία του ΑΔΔΥ. Να προχωρήσω;');
      if (!accepted) return;
    }
    try {
      const result = await transactionsApi.updateAddy(documentData.id, {
        id: newId,
        documentDate: newDate,
        notes: modal.querySelector('[data-addy-edit-notes]').value,
        items: quantityInputs.map((input) => ({
          id: Number(input.dataset.addyEditQuantity),
          quantity: Number(input.value)
        })),
        removedItemIds: [...removedItemIds]
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

function confirmAddyAction(message) {
  return new Promise((resolve) => {
    const modal = window.document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <section class="request-document-modal" role="dialog" aria-modal="true" aria-labelledby="addy-confirm-title">
        <header class="material-card-header">
          <h2 id="addy-confirm-title">Επιβεβαίωση</h2>
        </header>
        <p data-addy-confirm-message></p>
        <div class="row-actions">
          <button class="secondary-button" data-addy-confirm-cancel type="button">Ακύρωση</button>
          <button class="danger-button" data-addy-confirm-accept type="button">Συνέχεια</button>
        </div>
      </section>
    `;
    modal.querySelector('[data-addy-confirm-message]').textContent = message;

    const finish = (accepted) => {
      window.document.removeEventListener('keydown', onKeyDown);
      modal.remove();
      resolve(accepted);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(false);
    };

    modal.querySelector('[data-addy-confirm-cancel]').addEventListener('click', () => finish(false));
    modal.querySelector('[data-addy-confirm-accept]').addEventListener('click', () => finish(true));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) finish(false);
    });
    window.document.addEventListener('keydown', onKeyDown);
    window.document.body.appendChild(modal);
    window.requestAnimationFrame(() => {
      modal.querySelector('[data-addy-confirm-cancel]').focus({ preventScroll: true });
    });
  });
}

function openAddyShareSelectionDialog(shares) {
  return new Promise((resolve) => {
    const sortedShares = [...shares].sort(compareShareNumbers);
    const modal = window.document.createElement('div');
    modal.className = 'modal-backdrop request-document-backdrop';
    modal.innerHTML = `
      <section class="request-document-modal" role="dialog" aria-modal="true" aria-labelledby="addy-share-selection-title">
        <header class="material-card-header">
          <div>
            <p class="eyebrow">ΕΠΙΛΟΓΗ ΜΕΡΙΔΑΣ</p>
            <h2 id="addy-share-selection-title">Μερίδες με τον ίδιο Αριθμό Ονομαστικού</h2>
          </div>
          <button class="secondary-button" data-close-addy-share-selection type="button">Κλείσιμο</button>
        </header>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Α/Α Μερίδας</th>
                <th>Αριθμός Ονομαστικού</th>
                <th>Περιγραφή</th>
                <th>Υπόλοιπο Μερίδας</th>
                <th>Επιλογή</th>
              </tr>
            </thead>
            <tbody>
              ${sortedShares.map((share, index) => `
                <tr>
                  <td>${escapeAddyEditHtml(share.shareNumber)}</td>
                  <td>${escapeAddyEditHtml(share.nominalNumber)}</td>
                  <td>${escapeAddyEditHtml(share.description)}</td>
                  <td>${escapeAddyEditHtml(formatAddyShareBalance(share.accountingBalance))}</td>
                  <td><button class="primary-button" data-select-addy-share="${index}" type="button">Επιλογή</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;

    const finish = (share = null) => {
      window.document.removeEventListener('keydown', onKeyDown);
      modal.remove();
      resolve(share);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish();
    };

    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-close-addy-share-selection]')) {
        finish();
        return;
      }
      const selectButton = event.target.closest('[data-select-addy-share]');
      if (selectButton) finish(sortedShares[Number(selectButton.dataset.selectAddyShare)] || null);
    });
    window.document.addEventListener('keydown', onKeyDown);
    window.document.body.appendChild(modal);
    window.requestAnimationFrame(() => {
      modal.querySelector('[data-select-addy-share]')?.focus({ preventScroll: true });
    });
  });
}

async function openAddyDepartmentAllocationDialog({ departments, share, shareNumber, description, transactionType, quantity, documentLabel = 'ΑΔΔΥ' }) {
  const availableDepartments = departments.length
    ? departments
    : (await window.appApi.internal.getReferenceData()).departmentManagers;
  const balances = await Promise.all(availableDepartments.map(async (department) => {
    if (!share?.id) return { department, quantity: 0 };
    const rows = await window.appApi.internal.listDepartmentBalances(department.id);
    const balance = rows.find((item) => Number(item.shareId) === Number(share.id));
    return { department, quantity: Number(balance?.finalQuantity || 0) };
  }));
  return new Promise((resolve) => {
    const isCharge = transactionType === 'Χρέωση';
    const modal = window.document.createElement('div');
    modal.className = 'modal-backdrop request-document-backdrop';
    modal.innerHTML = `
      <section class="request-document-modal" role="dialog" aria-modal="true" aria-labelledby="addy-department-allocation-title">
        <header class="material-card-header">
          <div>
            <p class="eyebrow">${isCharge ? 'ΧΡΕΩΣΗ ΤΜΗΜΑΤΩΝ' : 'ΠΙΣΤΩΣΗ ΤΜΗΜΑΤΩΝ'}</p>
            <h2 id="addy-department-allocation-title">${escapeAddyEditHtml(shareNumber)} — ${escapeAddyEditHtml(description)}</h2>
            <p class="muted">${isCharge
              ? `Κατανείμετε την ποσότητα του ${escapeAddyEditHtml(documentLabel)} στα τμήματα.`
              : `Επιλέξτε από ποια τμήματα θα αφαιρεθεί η ποσότητα του ${escapeAddyEditHtml(documentLabel)}.`}
              Οι κινήσεις θα γίνουν μόνο αν πατήσετε Αποθήκευση.</p>
            ${share?.requiresComposition ? '<p class="muted">Η σύνθεση θα κατανεμηθεί αναλογικά σε κάθε τμηματική κίνηση.</p>' : ''}
          </div>
        </header>
        <div class="table-wrap">
          <table class="editable-records-table">
            <thead><tr><th>Τμήμα Μονάδος</th><th>Χρεωμένη ποσότητα</th><th>${isCharge ? 'Ποσότητα χρέωσης' : 'Ποσότητα πίστωσης'}</th></tr></thead>
            <tbody>
              ${balances.length ? balances.map(({ department, quantity: currentQuantity }) => `
                <tr data-addy-department-allocation-row data-department-id="${department.id}" data-current-quantity="${currentQuantity}">
                  <td>${escapeAddyEditHtml(department.departmentName)}</td>
                  <td class="number-cell">${formatAddyShareBalance(currentQuantity)}</td>
                  <td><input data-addy-department-allocation-quantity type="number" min="0"
                    ${isCharge ? '' : `max="${currentQuantity}"`}
                    step="0.001" value="0" ${!isCharge && currentQuantity <= 0 ? 'disabled' : ''} /></td>
                </tr>
              `).join('') : '<tr><td colspan="3" class="empty-table">Δεν έχουν καταχωρηθεί τμήματα Μονάδος.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="addy-save-row">
          <strong data-addy-allocation-total>Σύνολο: 0 / ${formatAddyShareBalance(quantity)}</strong>
          <span class="form-error" data-addy-allocation-mismatch></span>
          <button class="secondary-button" data-close-addy-allocation type="button">Κλείσιμο</button>
          <button class="primary-button" data-confirm-addy-allocation type="button" disabled>Αποθήκευση</button>
        </div>
      </section>`;
    const updateAgreement = () => {
      const inputs = [...modal.querySelectorAll('[data-addy-department-allocation-quantity]:not(:disabled)')];
      const invalidCredit = !isCharge && inputs.some((input) => {
        const enteredQuantity = Number(input.value || 0);
        const currentQuantity = Number(input.closest('[data-addy-department-allocation-row]')?.dataset.currentQuantity || 0);
        return enteredQuantity > 0 && exceedsAddyDepartmentBalance(enteredQuantity, currentQuantity);
      });
      const total = inputs.reduce((sum, input) => sum + (Number(input.value) || 0), 0);
      const difference = total - quantity;
      modal.querySelector('[data-addy-allocation-total]').textContent = `Σύνολο: ${formatAddyShareBalance(total)} / ${formatAddyShareBalance(quantity)}`;
      modal.querySelector('[data-addy-allocation-mismatch]').textContent = invalidCredit
        ? 'Μη συμφωνία: κάποιο τμήμα δεν έχει επαρκή χρεωμένη ποσότητα.'
        : Math.abs(difference) < 0.000001
          ? ''
          : difference < 0
            ? `Μη συμφωνία: υπολείπονται ${formatAddyShareBalance(-difference)}.`
            : `Μη συμφωνία: η κατανομή υπερβαίνει κατά ${formatAddyShareBalance(difference)}.`;
      modal.querySelector('[data-confirm-addy-allocation]').disabled = invalidCredit || Math.abs(difference) >= 0.000001;
    };
    const finish = (result) => {
      window.document.removeEventListener('keydown', onKeyDown);
      modal.remove();
      resolve(result);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(null);
    };
    modal.addEventListener('input', (event) => {
      if (event.target.matches('[data-addy-department-allocation-quantity]')) updateAgreement();
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-close-addy-allocation]')) {
        finish(null);
        return;
      }
      if (!event.target.closest('[data-confirm-addy-allocation]')) return;
      const allocations = [...modal.querySelectorAll('[data-addy-department-allocation-row]')]
        .map((row) => ({
          departmentManagerId: Number(row.dataset.departmentId),
          quantity: Number(row.querySelector('[data-addy-department-allocation-quantity]')?.value || 0)
        }))
        .filter((allocation) => allocation.quantity > 0);
      finish(allocations);
    });
    window.document.addEventListener('keydown', onKeyDown);
    window.document.body.appendChild(modal);
    updateAgreement();
  });
}

async function openAddyCompositionAllocationDialog({ departments, share, allocations, composition, transactionType }) {
  const availableDepartments = departments.length
    ? departments
    : (await window.appApi.internal.getReferenceData()).departmentManagers;
  const selectedDepartments = availableDepartments.filter((department) =>
    allocations.some((allocation) => Number(allocation.departmentManagerId) === Number(department.id))
  );
  const balances = await Promise.all(selectedDepartments.map(async (department) => {
    const rows = await window.appApi.internal.listDepartmentBalances(department.id);
    const shareBalance = rows.find((item) => Number(item.shareId) === Number(share.id));
    return { department, components: shareBalance?.composition || [] };
  }));
  const components = composition.map((component) => ({
    componentNominalNumber: component.componentNominalNumber || '',
    componentDescription: component.componentDescription || '',
    measurementUnit: component.measurementUnit || '',
    quantity: Math.max(0, Number(component.projectedQuantity || 0) - Number(component.notIssuedQuantity || 0))
  }));
  const isCharge = transactionType === 'Χρέωση';

  return new Promise((resolve) => {
    const modal = window.document.createElement('div');
    modal.className = 'modal-backdrop request-document-backdrop';
    modal.innerHTML = `
      <section class="request-document-modal" role="dialog" aria-modal="true" aria-labelledby="addy-composition-allocation-title">
        <header class="material-card-header">
          <div>
            <p class="eyebrow">${isCharge ? 'ΧΡΕΩΣΗ' : 'ΠΙΣΤΩΣΗ'} ΥΛΙΚΩΝ ΣΥΝΘΕΣΗΣ</p>
            <h2 id="addy-composition-allocation-title">${escapeAddyEditHtml(share.shareNumber)} — ${escapeAddyEditHtml(share.description)}</h2>
            <p class="muted">Κατανείμετε κάθε υλικό σύνθεσης στα τμήματα. Ισχύουν οι ίδιοι έλεγχοι συμφωνίας και διαθέσιμης ποσότητας.</p>
          </div>
        </header>
        <div class="table-wrap addy-composition-allocation-scroll">
          <table class="editable-records-table">
            <thead><tr><th>Α/Ο</th><th>Υλικό σύνθεσης</th><th>Τμήμα</th><th>Χρεωμένη ποσότητα</th><th>${isCharge ? 'Ποσότητα χρέωσης' : 'Ποσότητα πίστωσης'}</th></tr></thead>
            <tbody>${components.flatMap((component, componentIndex) =>
              balances.map(({ department, components: departmentComponents }) => {
                const current = Number(departmentComponents.find((candidate) =>
                  candidate.componentNominalNumber === component.componentNominalNumber &&
                  candidate.componentDescription === component.componentDescription &&
                  candidate.measurementUnit === component.measurementUnit
                )?.finalQuantity || 0);
                return `<tr data-addy-composition-allocation-row data-component-index="${componentIndex}" data-department-id="${department.id}" data-current-quantity="${current}">
                  <td>${escapeAddyEditHtml(component.componentNominalNumber)}</td>
                  <td>${escapeAddyEditHtml(component.componentDescription)}</td>
                  <td>${escapeAddyEditHtml(department.departmentName)}</td>
                  <td class="number-cell">${formatAddyShareBalance(current)}</td>
                  <td><input data-addy-composition-allocation-quantity type="number" min="0" step="0.001" value="0" ${!isCharge && current <= 0 ? 'disabled' : ''}></td>
                </tr>`;
              })
            ).join('')}</tbody>
          </table>
        </div>
        <div class="addy-save-row">
          <span class="form-error" data-addy-composition-allocation-error></span>
          <button class="secondary-button" data-close-addy-composition-allocation type="button">Κλείσιμο</button>
          <button class="primary-button" data-confirm-addy-composition-allocation type="button" disabled>Αποθήκευση</button>
        </div>
      </section>`;

    const validate = () => {
      let message = '';
      components.some((component, componentIndex) => {
        const rows = [...modal.querySelectorAll(`[data-component-index="${componentIndex}"]`)];
        const invalidBalance = !isCharge && rows.some((row) =>
          exceedsAddyDepartmentBalance(
            Number(row.querySelector('[data-addy-composition-allocation-quantity]')?.value || 0),
            Number(row.dataset.currentQuantity || 0)
          )
        );
        const total = rows.reduce((sum, row) =>
          sum + Number(row.querySelector('[data-addy-composition-allocation-quantity]')?.value || 0), 0);
        if (invalidBalance) message = `${component.componentDescription}: κάποιο τμήμα δεν έχει επαρκή ποσότητα.`;
        else if (Math.abs(total - component.quantity) >= 0.000001) {
          message = `${component.componentDescription}: σύνολο ${formatAddyShareBalance(total)} / ${formatAddyShareBalance(component.quantity)}.`;
        }
        return Boolean(message);
      });
      modal.querySelector('[data-addy-composition-allocation-error]').textContent = message;
      modal.querySelector('[data-confirm-addy-composition-allocation]').disabled = Boolean(message);
    };
    const finish = (value) => {
      window.document.removeEventListener('keydown', onKeyDown);
      modal.remove();
      resolve(value);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(null);
    };
    modal.addEventListener('input', validate);
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-close-addy-composition-allocation]')) return finish(null);
      if (!event.target.closest('[data-confirm-addy-composition-allocation]')) return;
      finish(allocations.map((allocation) => ({
        ...allocation,
        composition: components.map((component, componentIndex) => {
          const row = modal.querySelector(
            `[data-component-index="${componentIndex}"][data-department-id="${allocation.departmentManagerId}"]`
          );
          return {
            componentNominalNumber: component.componentNominalNumber,
            componentDescription: component.componentDescription,
            measurementUnit: component.measurementUnit,
            quantity: Number(row?.querySelector('[data-addy-composition-allocation-quantity]')?.value || 0)
          };
        })
      })));
    });
    window.document.addEventListener('keydown', onKeyDown);
    window.document.body.appendChild(modal);
    validate();
  });
}

export function exceedsAddyDepartmentBalance(requestedQuantity, currentQuantity) {
  return Number(requestedQuantity || 0) > Number(currentQuantity || 0) + 0.000001;
}

function formatAddyShareBalance(value) {
  const balance = Number(value || 0);
  return Number.isFinite(balance)
    ? balance.toLocaleString('el-GR', { maximumFractionDigits: 3 })
    : '0';
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
