import {
  addManualExhpSupportRow, captureExhpDraftSupports, collectExhpSupports,
  collectManualExhpSupportDocuments, createDraftSupportDocument, isInventorySupportTemplate,
  openExhpSupportFolder, openExhpSupportTemplate, renderExhpSupportChecklist,
  renderSupportTemplateCards, setManualExhpSupportRows
} from '../exhpSupportDocuments.js';
import { saveDraftExhpDocuments } from '../exhpOfficialDocuments.js';
import { openAddyDocument, shouldOpenAddyDocument } from '../addyPrint.js';
import { openExhpDocument } from '../exhpPrint.js';
import {
  applyExhpShareDefaults, applyShareDefaults, canAddItem, clearExhpLine, clearLineControls,
  clearShareDefaults, confirmFutureTransactionDate, findCurrentShare, getControls, getExhpControls,
  isToolCollectionReason, maybeSuggestShareNumber, openAddyCompositionDialog,
  openNewToolCollectionCompositionDialog, openToolCollectionCreditDialog, renderExhpEntryState,
  renderSavedAddyRows, renderState, updateAddButton
} from '../entryHelpers.js';
import {
  compareShareNumbers, findShareByNominal, findShareByNumber, findSharesByNominal, isCommerceUnit
} from '../shared.js';
import { captureNewSupportModuleDraft, loadExhpDocumentsEditor } from '../exhpDocumentsWizard.js';
import {
  getAitiologiaCodeForIssueReason, hasAitiologiaModule, shouldShowOfficialExhpForms,
  syncSavedSecondaryMaterialsToExhpItems, syncSupportDocumentMaterialsToExhpItems
} from '../exhpFormModuleBridge.js';
import { syncExhpIssueReasonSettings } from '../../pages/settingsPage.js';
import { buildToolCompositionChargeItems } from './addyCalculations.js';
import {
  openAddyDepartmentAllocationDialog, openAddyEditDialog, openAddyShareSelectionDialog,
  restoreAddyEntryFocus
} from './addyDom.js';
import {
  ADDY_DRAFT_KEY, EXHP_DRAFT_KEY, clearIssuedExhpDraftState, exhpDraftKey,
  scheduleAddyDraftSave, scheduleExhpDraftSave
} from './addyState.js';

export function bindAddyForm(container, transactionsApi, settingsApi, referenceData, settings, state, showToast, rerender) {
  if (container.__addyInputHandler) {
    container.removeEventListener('input', container.__addyInputHandler);
  }
  if (container.__addyClickHandler) {
    container.removeEventListener('click', container.__addyClickHandler);
  }

  const controls = getControls(container);
  const initialDraftRestore = (async () => {
    try {
      const existingDraft = await window.appApi.drafts.get(ADDY_DRAFT_KEY);
      if (existingDraft?.data) {
        const draft = existingDraft.data;
        if (draft.documentDate) controls.date.value = draft.documentDate;
        if (draft.transactionUnit) controls.unit.value = draft.transactionUnit;
        if (draft.notes) controls.notes.value = draft.notes;
        if (draft.invoiceNumber) controls.invoiceNumber.value = draft.invoiceNumber;
        if (draft.invoiceDate) controls.invoiceDate.value = draft.invoiceDate;
        if (draft.commerceCompanyId) controls.commerceCompany.value = draft.commerceCompanyId;
        state.items = Array.isArray(draft.items) ? draft.items : [];
        renderState(container, state);
      }
      const legacyExhpDraft = await window.appApi.drafts.get(EXHP_DRAFT_KEY);
      if (legacyExhpDraft?.data?.exhpReason) {
        const keyedDraft = await window.appApi.drafts.get(
          exhpDraftKey(legacyExhpDraft.data.exhpReason)
        );
        if (!keyedDraft) {
          await window.appApi.drafts.save(
            exhpDraftKey(legacyExhpDraft.data.exhpReason),
            legacyExhpDraft.data
          );
        }
        await window.appApi.drafts.clear(EXHP_DRAFT_KEY);
      }
    } catch (error) {
      console.error('Αποτυχία επαναφοράς πρόχειρου ΑΔΔΥ:', error);
    }
  })();
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
  for (const control of [
    container.querySelector('#exhp-date'),
    container.querySelector('#exhp-unit'),
    exhpReason
  ]) {
    control.addEventListener('change', () => scheduleExhpDraftSave(container, state));
  }
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
    await initialDraftRestore;
    const previousReason = exhpReason.value;
    const reasonChanged = previousReason !== reason;
    let reasonDraft = null;
    if (clearDrafts && reasonChanged) {
      if (previousReason) await scheduleExhpDraftSave(container, state);
      const existingReasonDraft = await window.appApi.drafts.get(exhpDraftKey(reason));
      if (existingReasonDraft?.data) {
        reasonDraft = existingReasonDraft.data;
      }
      state.exhpDraftSupports.clear();
      state.exhpItems = Array.isArray(reasonDraft?.items) ? reasonDraft.items : [];
      state.exhpDocumentsState.currentItems = state.exhpItems;
      if (reasonDraft?.exhpDate) container.querySelector('#exhp-date').value = reasonDraft.exhpDate;
      if (reasonDraft?.exhpUnit) container.querySelector('#exhp-unit').value = reasonDraft.exhpUnit;
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
    return true;
  };
  exhpWizardReason.addEventListener('change', () => {
    const selected = exhpWizardReason.selectedOptions[0];
    void applyExhpReason(exhpWizardReason.value, selected?.dataset.issueReasonCode || '');
  });
  container.querySelectorAll('[data-exhp-reason-tile]').forEach((button) => {
    button.addEventListener('click', () => {
      void applyExhpReason(button.dataset.exhpReasonTile, button.dataset.exhpReasonCode || '')
        .then((selected) => {
          if (selected) showExhpWizardStep(2);
        });
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
  const updateExhpShareEntryMode = (share) => {
    const hasShareNumber = Boolean(exhpControls.shareNumber.value.trim());
    const nominalTransfer = container.dataset.exhpNominalTransfer === 'true';
    const isNewShare = hasShareNumber && !share && !nominalTransfer;
    exhpControls.nominalNumber.readOnly = !isNewShare;
    exhpControls.description.readOnly = !isNewShare;
    exhpControls.measurementUnit.disabled = !isNewShare;
    const creditOption = exhpControls.transactionType.querySelector('option[value="Πίστωση"]');
    if (creditOption) creditOption.disabled = isNewShare;
    if (isNewShare) exhpControls.transactionType.value = 'Χρέωση';
  };
  exhpControls.shareNumber.addEventListener('input', () => {
    const share = findShareByNumber(referenceData.shares, exhpControls.shareNumber.value);
    applyExhpShareDefaults(exhpControls, share);
    updateExhpShareEntryMode(share);
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
    const quantityText = exhpControls.quantity.value.trim();
    const quantity = Number(quantityText);
    const nominalTransfer = container.dataset.exhpNominalTransfer === 'true';
    const transactionType = nominalTransfer ? 'Πίστωση' : exhpControls.transactionType.value;
    const collectionTransfer = isToolCollectionReason(exhpReason.value);

    if (!share && !nominalTransfer) {
      if (
        quantityText === '' || !Number.isFinite(quantity) || quantity <= 0 ||
        transactionType !== 'Χρέωση' || !exhpControls.shareNumber.value.trim() ||
        !exhpControls.nominalNumber.value.trim() || !exhpControls.description.value.trim() ||
        !exhpControls.measurementUnit.value.trim()
      ) {
        showToast('Για νέα μερίδα συμπλήρωσε όλα τα στοιχεία και επίλεξε Χρέωση με θετική ποσότητα.', 'error');
        return;
      }
      const newComposition = collectionTransfer
        ? await openNewToolCollectionCompositionDialog(
            referenceData.shares,
            quantity,
            'ΕΧΠ',
            referenceData.measurementUnits
          )
        : [];
      if (collectionTransfer && !newComposition) return;
      if (state.exhpItems.length + 1 > 1000) {
        showToast('Η ΕΧΠ δέχεται έως 1000 υλικά.', 'error');
        return;
      }
      state.exhpItems.push({
        shareNumber: exhpControls.shareNumber.value.trim(),
        nominalNumber: exhpControls.nominalNumber.value.trim(),
        description: exhpControls.description.value.trim(),
        measurementUnit: exhpControls.measurementUnit.value.trim(),
        materialType: 'Υλικό',
        materialCode: '',
        quantity,
        transactionType: 'Χρέωση',
        supportingDocuments: '',
        transferGroup: '',
        createComposition: newComposition.map((item) => ({
          componentNominalNumber: item.componentNominalNumber,
          componentDescription: item.componentDescription,
          measurementUnit: item.measurementUnit,
          projectedQuantity: item.quantityPerMaterial,
          notIssuedQuantity: item.notIssuedQuantity,
          notes: ''
        })),
        composition: newComposition.map((item) => ({
          componentNominalNumber: item.componentNominalNumber,
          componentDescription: item.componentDescription,
          measurementUnit: item.measurementUnit,
          projectedQuantity: item.quantityPerMaterial * quantity,
          notIssuedQuantity: item.notIssuedQuantity,
          notes: ''
        }))
      });
      state.exhpItems.sort(compareShareNumbers);
      clearExhpLine(exhpControls);
      updateExhpShareEntryMode(null);
      renderExhpEntryState(container, state);
      scheduleExhpDraftSave(container, state);
      return;
    }

    if (
      collectionTransfer &&
      share?.requiresComposition &&
      Array.isArray(share.composition) &&
      share.composition.length
    ) {
      if (quantityText === '' || !Number.isFinite(quantity) || quantity < 0 || !transactionType) {
        showToast('Συμπλήρωσε ποσότητα και είδος δοσοληψίας.', 'error');
        return;
      }
      if (transactionType === 'Πίστωση' && quantity > Number(share.accountingBalance || 0)) {
        showToast('Το υπόλοιπο δεν επαρκεί για την πραγματοποίηση της δοσοληψίας.', 'error');
        return;
      }
      if (state.exhpItems.length >= 1000) {
        showToast('Η ΕΧΠ δέχεται έως 1000 υλικά.', 'error');
        return;
      }
      const selected = await openToolCollectionCreditDialog(
        share,
        referenceData.shares,
        transactionType,
        quantity
      );
      if (!selected) return;
      const composition = selected.map(({ item, quantity: componentQuantity }) => ({
        componentNominalNumber: item.componentNominalNumber,
        componentDescription: item.componentDescription,
        measurementUnit: item.measurementUnit,
        projectedQuantity: componentQuantity,
        notIssuedQuantity: 0,
        notes: item.notes || ''
      }));
      const componentCharges = transactionType === 'Πίστωση'
        ? buildToolCompositionChargeItems(
            selected.map(({ item, quantity: movementQuantity, shareNumber }) => ({
              ...item,
              shareNumber,
              movementQuantity
            })),
            referenceData.shares
          )
        : [];
      if (state.exhpItems.length + componentCharges.length + 1 > 1000) {
        showToast('Η ΕΧΠ δέχεται έως 1000 υλικά.', 'error');
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
        supportingDocuments: '',
        transferGroup: '',
        composition
      }, ...componentCharges);
      state.exhpItems.sort(compareShareNumbers);
      clearExhpLine(exhpControls);
      updateExhpShareEntryMode(null);
      renderExhpEntryState(container, state);
      scheduleExhpDraftSave(container, state);
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

    if (state.exhpItems.length + (nominalTransfer ? 2 : 1) > 1000) {
      showToast('Η ΕΧΠ δέχεται έως 1000 υλικά.', 'error');
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
    updateExhpShareEntryMode(null);
    if (nominalTransfer) exhpControls.transactionType.value = 'Πίστωση';
    renderExhpEntryState(container, state);
    scheduleExhpDraftSave(container, state);
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

  const openCommerceDialog = () => new Promise((resolve) => {
    const cancelButtons = [...controls.commerceModal.querySelectorAll('[data-cancel-addy-commerce]')];
    const confirmButton = controls.commerceModal.querySelector('[data-confirm-addy-commerce]');
    const finish = (confirmed) => {
      controls.commerceModal.hidden = true;
      cancelButtons.forEach((button) => button.removeEventListener('click', cancel));
      confirmButton.removeEventListener('click', confirm);
      controls.commerceModal.removeEventListener('click', backdropClick);
      controls.commerceModal.removeEventListener('keydown', keydown);
      controls.save.focus();
      resolve(confirmed);
    };
    const cancel = () => finish(false);
    const confirm = () => {
      const companyMissing = !controls.commerceCompany.value || controls.commerceCompany.value === '__new__';
      if (!controls.invoiceNumber.value.trim() || !controls.invoiceDate.value || companyMissing) {
        showToast(
          'Για ΑΔΔΥ Εμπορίου απαιτούνται Αριθμός Τιμολογίου, Ημερομηνία Τιμολογίου και Επιχείρηση.',
          'error'
        );
        if (!controls.invoiceNumber.value.trim()) controls.invoiceNumber.focus();
        else if (!controls.invoiceDate.value) controls.invoiceDate.focus();
        else controls.commerceCompany.focus();
        return;
      }
      finish(true);
    };
    const backdropClick = (event) => {
      if (event.target === controls.commerceModal) cancel();
    };
    const keydown = (event) => {
      if (event.key === 'Escape') cancel();
    };

    cancelButtons.forEach((button) => button.addEventListener('click', cancel));
    confirmButton.addEventListener('click', confirm);
    controls.commerceModal.addEventListener('click', backdropClick);
    controls.commerceModal.addEventListener('keydown', keydown);
    controls.commerceModal.hidden = false;
    window.requestAnimationFrame(() => controls.invoiceNumber.focus());
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

  controls.commerceCompany.addEventListener('change', () => {
    const creatingCompany = controls.commerceCompany.value === '__new__';
    controls.newCompanyForm.hidden = !creatingCompany;
    if (creatingCompany) controls.newCompanyName.focus();
    scheduleAddyDraftSave(controls, state);
  });

  for (const control of [
    controls.date,
    controls.unit,
    controls.notes,
    controls.invoiceNumber,
    controls.invoiceDate
  ]) {
    control.addEventListener('change', () => scheduleAddyDraftSave(controls, state));
  }

  controls.newCompanySave.addEventListener('click', async () => {
    const name = controls.newCompanyName.value.trim();
    if (!name) {
      showToast('Συμπλήρωσε την επωνυμία της επιχείρησης.', 'error');
      controls.newCompanyName.focus();
      return;
    }
    try {
      const company = await transactionsApi.addCommerceCompany({
        name,
        taxNumber: controls.newCompanyTaxNumber.value.trim(),
        address: controls.newCompanyAddress.value.trim()
      });
      const option = window.document.createElement('option');
      option.value = String(company.id);
      option.textContent = company.name;
      const newCompanyOption = [...controls.commerceCompany.options]
        .find((candidate) => candidate.value === '__new__');
      controls.commerceCompany.insertBefore(option, newCompanyOption || null);
      controls.commerceCompany.value = String(company.id);
      referenceData.commerceCompanies = referenceData.commerceCompanies || [];
      referenceData.commerceCompanies.push(company);
      controls.newCompanyForm.hidden = true;
      controls.newCompanyName.value = '';
      controls.newCompanyTaxNumber.value = '';
      controls.newCompanyAddress.value = '';
      showToast('Η επιχείρηση προστέθηκε.');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η προσθήκη της επιχείρησης.', 'error');
    }
  });

  controls.addItem.addEventListener('click', async () => {
    await maybeSuggestShareNumber(transactionsApi, referenceData, controls, showToast);
    if (!canAddItem(controls, state)) {
      updateAddButton(controls, state);
      return;
    }

    const selectedShare = findShareByNumber(referenceData.shares, controls.shareNumber.value);
    let composition = [];
    let createComposition = [];
    if (!selectedShare && controls.transactionType.value === 'Χρέωση') {
      const result = await openNewToolCollectionCompositionDialog(
        referenceData.shares,
        Number(controls.quantity.value),
        'ΑΔΔΥ',
        referenceData.measurementUnits
      );
      if (!result) return;
      createComposition = result.map((item) => ({
        componentNominalNumber: item.componentNominalNumber,
        componentDescription: item.componentDescription,
        measurementUnit: item.measurementUnit,
        projectedQuantity: item.quantityPerMaterial,
        notIssuedQuantity: 0,
        notes: ''
      }));
      composition = result.map((item) => ({
        componentNominalNumber: item.componentNominalNumber,
        componentDescription: item.componentDescription,
        measurementUnit: item.measurementUnit,
        projectedQuantity: item.movementQuantity,
        notIssuedQuantity: 0,
        notes: ''
      }));
    }
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
      composition,
      createComposition
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
    scheduleAddyDraftSave(controls, state);
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
        if (error?.code === 'ADDY_DEPENDENT_TRANSACTIONS') {
          await showAddyDeleteBlockedNotice(error.message);
          return;
        }
        showToast(error.message || 'Δεν ήταν δυνατή η διαγραφή του ΑΔΔΥ.', 'error');
      }
      return;
    }

    if (event.target.closest('#exhp-save')) {
      if (state.viewedExhp) return;

      try {
        const exhpDate = container.querySelector('#exhp-date').value;
        if (!(await confirmFutureTransactionDate(exhpDate))) return;
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
        scheduleExhpDraftSave(container, state);
        try {
          await saveDraftExhpDocuments(
            window.appApi?.exhpDocs,
            result.documentId,
            exhpReason.value,
            container.querySelector('#exhp-documents-editor'),
            state.exhpDocumentsState
          );
          clearIssuedExhpDraftState(state);
          clearTimeout(exhpSaveDraftTimeout);
          await window.appApi.drafts.clear(exhpDraftKey(exhpReason.value));
        } catch (documentsError) {
          console.error('EXHP supporting documents save failed:', documentsError);
          showToast('Η ΕΧΠ αποθηκεύτηκε, αλλά ορισμένα δικαιολογητικά δεν αποθηκεύτηκαν.', 'error');
        }
        showToast(result.message || 'Η ΕΧΠ αποθηκεύτηκε.');
        const savedDocument = await transactionsApi.getExhpDocument(result.documentId);
        try {
          for (const item of savedDocument.items.filter((entry) => Number(entry.quantity) > 0)) {
            const share = findShareByNumber(referenceData.shares, item.shareNumber);
            const allocations = await openAddyDepartmentAllocationDialog({
              departments: referenceData.departmentManagers || [],
              share,
              shareNumber: item.shareNumber,
              description: item.description,
              transactionType: item.transactionType,
              quantity: item.quantity
            });
            if (allocations === null) break;
            const allocationResult = await transactionsApi.saveExhpDepartmentAllocations(
              result.documentId,
              { entries: [{ exhpItemId: item.id, allocations }] }
            );
            showToast(allocationResult.message);
          }
        } catch (allocationError) {
          showToast(
            allocationError.message || 'Η ΕΧΠ αποθηκεύτηκε, αλλά δεν αποθηκεύτηκαν οι κινήσεις των τμημάτων.',
            'error'
          );
        }
        openExhpDocument(savedDocument);
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
      scheduleExhpDraftSave(container, state);
    }
  };
  container.addEventListener('click', clickHandler);
  container.__addyClickHandler = clickHandler;

  controls.save.addEventListener('click', async () => {
    try {
      if (isCommerceUnit(controls.unit.value) && !(await openCommerceDialog())) return;
      if (!(await confirmFutureTransactionDate(controls.date.value))) return;
      const result = await transactionsApi.saveAddy({
        documentDate: controls.date.value,
        transactionUnit: controls.unit.value.trim(),
        justificationReference: '',
        notes: controls.notes.value.trim(),
        invoiceNumber: controls.invoiceNumber.value.trim(),
        invoiceDate: controls.invoiceDate.value,
        commerceCompanyId: controls.commerceCompany.value && controls.commerceCompany.value !== '__new__'
          ? controls.commerceCompany.value
          : null,
        items: state.items
      });
      showToast(result.message || 'Το ΑΔΔΥ αποθηκεύτηκε.');
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
            if (allocations === null) break;
            const allocationResult = await transactionsApi.saveAddyDepartmentAllocations(
              result.documentId,
              { entries: [{ addyItemId: item.addyItemId, allocations }] }
            );
            showToast(allocationResult.message);
          }
        } catch (error) {
          showToast(
            error.message || 'Το ΑΔΔΥ αποθηκεύτηκε, αλλά δεν αποθηκεύτηκαν οι κινήσεις των τμημάτων.',
            'error'
          );
        }
        if (result.document && shouldOpenAddyDocument(result.document)) {
          openAddyDocument(result.document);
        }
        state.items.length = 0;
        await window.appApi.drafts.clear(ADDY_DRAFT_KEY);
        await rerender(container, transactionsApi, settingsApi, showToast, 'addy');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση ΑΔΔΥ.', 'error');
    }
  });
}

function showAddyDeleteBlockedNotice(message) {
  return new Promise((resolve) => {
    const modal = window.document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <section class="request-document-modal action-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="addy-delete-blocked-title">
        <header class="material-card-header">
          <h2 id="addy-delete-blocked-title">Δεν είναι δυνατή η διαγραφή</h2>
        </header>
        <p data-addy-delete-blocked-message></p>
        <div class="row-actions">
          <button class="primary-button" data-close-addy-delete-blocked type="button">Εντάξει</button>
        </div>
      </section>
    `;
    modal.querySelector('[data-addy-delete-blocked-message]').textContent = message;

    const close = () => {
      window.document.removeEventListener('keydown', onKeyDown);
      modal.remove();
      resolve();
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape' || event.key === 'Enter') close();
    };

    modal.querySelector('[data-close-addy-delete-blocked]').addEventListener('click', close);
    modal.addEventListener('click', (event) => {
      if (event.target === modal) close();
    });
    window.document.addEventListener('keydown', onKeyDown);
    window.document.body.appendChild(modal);
    window.requestAnimationFrame(() => {
      modal.querySelector('[data-close-addy-delete-blocked]').focus({ preventScroll: true });
    });
  });
}
