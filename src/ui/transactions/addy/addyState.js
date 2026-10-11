

export const ADDY_DRAFT_KEY = 'addy-new-document';
export const EXHP_DRAFT_KEY = 'exhp-new-document';

export function exhpDraftKey(reason) {
  const normalizedReason = String(reason || '').trim();
  return normalizedReason
    ? `${EXHP_DRAFT_KEY}:${encodeURIComponent(normalizedReason)}`
    : EXHP_DRAFT_KEY;
}

let addySaveDraftTimeout = null;

export function scheduleAddyDraftSave(controls, state) {
  clearTimeout(addySaveDraftTimeout);
  window.appApi.drafts.save(ADDY_DRAFT_KEY, {
    documentDate: controls.date.value,
    transactionUnit: controls.unit.value,
    notes: controls.notes.value,
    invoiceNumber: controls.invoiceNumber.value,
    invoiceDate: controls.invoiceDate.value,
    commerceCompanyId: controls.commerceCompany.value,
    items: state.items
  }).catch((error) => console.error('Αποτυχία αποθήκευσης πρόχειρου ΑΔΔΥ:', error));
}

let exhpSaveDraftTimeout = null;

export function scheduleExhpDraftSave(container, state) {
  clearTimeout(exhpSaveDraftTimeout);
  const exhpDate = container.querySelector('#exhp-date')?.value || '';
  const exhpUnit = container.querySelector('#exhp-unit')?.value || '';
  const exhpReasonValue = container.querySelector('#exhp-reason')?.value || '';
  const supports = Array.from(state.exhpDraftSupports?.values?.() || []);
  const manualSupportDocuments = Array.from(container.querySelectorAll('[data-manual-exhp-support]'))
    .map((input) => input.value.trim())
    .filter(Boolean);
  const documentsState = state.exhpDocumentsState || {};
  return window.appApi.drafts.save(exhpDraftKey(exhpReasonValue), {
    exhpDate,
    exhpUnit,
    exhpReason: exhpReasonValue,
    items: state.exhpItems,
    supports,
    manualSupportDocuments,
    documentDrafts: {
      draftUselessA: documentsState.draftUselessA,
      draftUselessB: documentsState.draftUselessB,
      draftAmmo: documentsState.draftAmmo,
      newModuleDrafts: documentsState.newModuleDrafts,
      uselessStatements: documentsState.uselessStatements
    }
  }).catch((error) => console.error('Αποτυχία αποθήκευσης πρόχειρου ΕΧΠ:', error));
}

export function clearIssuedExhpDraftState(state) {
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
