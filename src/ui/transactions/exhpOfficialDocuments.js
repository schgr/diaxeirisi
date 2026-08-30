export {
  USELESS_MATERIAL_FORMS,
  isAmmoConsumptionReason,
  isUselessMaterialReason,
  prepareUselessProtocolData
} from './exhp/officialDocuments/officialDocumentRules.js';
export {
  collectExhpDocumentPreviewData,
  ensureExhpSupportDocument,
  saveDraftExhpDocuments,
  saveExhpDocumentForm
} from './exhp/officialDocuments/officialDocumentState.js';
export { validateSharedMaterialPayload } from './exhp/officialDocuments/officialDocumentValidation.js';
export {
  renderAmmoTable,
  renderExhpDocumentItemRow,
  renderUselessBForm,
  renderUselessMaterialTabs
} from './exhp/officialDocuments/officialDocumentRenderer.js';
export { previewExhpDocument } from './exhp/officialDocuments/officialDocumentPrint.js';
export {
  autofillShareDocumentRow,
  bindShareRows,
  openExhpDocumentModal,
  openUselessMaterialFormModal
} from './exhp/officialDocuments/officialDocumentActions.js';
