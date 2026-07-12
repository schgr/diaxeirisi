import { EXP_AITIOLOGIES, getAitiologiaByCode } from '../../exhpForm/aitiologies.js';

export const OFFICIAL_EXHP_FORM_REASON_CODES = new Set(['a', 'b', 'd', 'ia', 'st', 'z']);
export const EXHP_SECOND_OPINION_REASON_CODES = new Set(['a', 'd', 'th', 'i']);

export function getAitiologiaCodeForIssueReason(issueReason, explicitCode = '') {
  if (explicitCode && getAitiologiaByCode(explicitCode)) return explicitCode;

  const normalized = normalizeReason(issueReason);
  const direct = EXP_AITIOLOGIES.find((item) => normalizeReason(item.label) === normalized);
  if (direct) return direct.code;

  if (normalized.includes('αναλωσιμου') && normalized.includes('σταθερων')) return 'z';
  if (normalized.includes('πυρομαχικων') && normalized.includes('εκπαιδευσεως')) return 'ia';

  return '';
}

export function shouldShowOfficialExhpForms(issueReason, explicitCode = '') {
  return OFFICIAL_EXHP_FORM_REASON_CODES.has(getAitiologiaCodeForIssueReason(issueReason, explicitCode));
}

export function shouldFillExhpSecondOpinion(issueReason, explicitCode = '', secondOpinionText = '') {
  const code = getAitiologiaCodeForIssueReason(issueReason, explicitCode);
  if (EXHP_SECOND_OPINION_REASON_CODES.has(code)) return true;
  return code === 'ib' && Boolean(String(secondOpinionText || '').trim());
}

export function hasAitiologiaModule(issueReason, explicitCode = '') {
  const code = getAitiologiaCodeForIssueReason(issueReason, explicitCode);
  return Boolean(getAitiologiaByCode(code)?.module);
}

export function renderNewSupportDocumentEditor(issueReason, context = {}) {
  const code = getAitiologiaCodeForIssueReason(issueReason, context.reasonCode);
  const aitiologia = getAitiologiaByCode(code);
  if (!aitiologia?.module) return '';

  const data = getInitialModuleData(code, context);
  const instance = aitiologia.module({
    monada: data.commonFields.monada,
    addyAxp: data.commonFields.addyAxp,
    data,
    materialCatalog: context.referenceData?.shares || context.shares || []
  });

  return `
    <section class="new-exhp-support-module" data-new-exhp-support-module="${code}">
      <div class="requests-status-header">
        <div>
          <h4>${aitiologia.label}</h4>
          ${['d', 'st'].includes(code) ? '' : `<p class="muted">${data.formCode}</p>`}
        </div>
      </div>
      ${instance.renderEdit()}
      <div class="support-template-form-actions"${code === 'a' ? ' hidden' : ''}>
        <button class="secondary-button" data-preview-new-exhp-support="${code}" type="button">Προεπισκόπηση</button>
        <button class="primary-button" data-save-new-exhp-support="${code}" type="button">Αποθήκευση δικαιολογητικού</button>
      </div>
    </section>
  `;
}

export function collectNewSupportDocumentData(editor, issueReason, context = {}) {
  const code = getAitiologiaCodeForIssueReason(issueReason, context.reasonCode);
  if (code === 'a') return collectDocAData(editor, context);
  if (code === 'd') return collectDocDData(editor, context);
  if (code === 'z') return collectDocZData(editor, context);
  if (code === 'ia') return collectDocIAData(editor, context);
  if (code === 'st') return collectDocSTData(editor, context);
  return null;
}

export function validateNewSupportDocumentData(data) {
  const aitiologia = getAitiologiaByCode(data?.aitiologiaCode);
  if (!aitiologia?.module) return { valid: false, errors: [{ message: 'Δεν υπάρχει νέο module για την αιτιολογία.' }] };
  const instance = aitiologia.module({ data });
  return instance.validate();
}

export function renderNewSupportDocumentPrint(data) {
  const aitiologia = getAitiologiaByCode(data?.aitiologiaCode);
  if (!aitiologia?.module) return '';
  return aitiologia.module({ data }).renderPrint();
}

export function saveNewSupportDocumentDraft(documentsState, data) {
  documentsState.newModuleDrafts ||= {};
  const docAKey = `${data.committeeTier || 'primary'}_${data.formKey || 'a'}`;
  documentsState.newModuleDrafts[data.aitiologiaCode === 'a' ? `a_${docAKey}` : data.aitiologiaCode] = data;
  if (data.aitiologiaCode === 'z') documentsState.draftUselessA = toLegacyUselessA(data);
  if (data.aitiologiaCode === 'ia') documentsState.draftAmmo = toLegacyAmmo(data);
  if (data.aitiologiaCode === 'd') documentsState.transformation = data;
  if (data.aitiologiaCode === 'st') documentsState.clothingMonthlySummary = data;
  if (data.aitiologiaCode === 'a') {
    documentsState.uselessMaterialForms ||= {};
    documentsState.uselessMaterialForms[docAKey] = data;
    documentsState.uselessStatements ||= {};
    documentsState.uselessStatements[docAKey] = data;
    if ((data.committeeTier || 'primary') === 'primary') {
      copyPrimaryMaterialsToSecondary(documentsState, data);
    }
  }
  rememberCommittee(data.specificFields);
}

export async function saveNewSupportDocument(exhpDocsApi, documentsState, selectedExhp, data) {
  if (!selectedExhp?.id) {
    saveNewSupportDocumentDraft(documentsState, data);
    return { message: 'Το δικαιολογητικό θα αποθηκευτεί μαζί με τη νέα ΕΧΠ.' };
  }

  documentsState.newModuleDrafts ||= {};
  const docAKey = `${data.committeeTier || 'primary'}_${data.formKey || 'a'}`;
  documentsState.newModuleDrafts[data.aitiologiaCode === 'a' ? `a_${docAKey}` : data.aitiologiaCode] = data;
  if (data.aitiologiaCode === 'a') {
    documentsState.uselessMaterialForms ||= {};
    documentsState.uselessMaterialForms[docAKey] = data;
    documentsState.uselessStatements ||= {};
    documentsState.uselessStatements[docAKey] = data;
    if ((data.committeeTier || 'primary') === 'primary') {
      copyPrimaryMaterialsToSecondary(documentsState, data);
    }
  }

  if (data.aitiologiaCode === 'z') {
    const document = await ensureSupportDocument(exhpDocsApi, documentsState, selectedExhp.id, 'useless_material_a');
    return exhpDocsApi.saveUselessA(document.id, toLegacyUselessA(data));
  }
  if (data.aitiologiaCode === 'ia') {
    const document = await ensureSupportDocument(exhpDocsApi, documentsState, selectedExhp.id, 'ammo_consumption');
    return exhpDocsApi.saveAmmo(document.id, toLegacyAmmo(data));
  }
  if (data.aitiologiaCode === 'd') {
    const document = await ensureSupportDocument(exhpDocsApi, documentsState, selectedExhp.id, 'transformation_materials');
    return exhpDocsApi.saveGeneric(document.id, data);
  }
  if (data.aitiologiaCode === 'st') {
    const document = await ensureSupportDocument(exhpDocsApi, documentsState, selectedExhp.id, 'clothing_monthly_summary');
    return exhpDocsApi.saveGeneric(document.id, data);
  }
  if (data.aitiologiaCode === 'a') {
    return exhpDocsApi.saveUselessStatement(selectedExhp.id, docAKey, data);
  }
  return { message: 'Δεν έγινε αποθήκευση.' };
}

export function toLegacyPreviewPayload(data) {
  if (data?.aitiologiaCode === 'z') return { type: 'useless_material_a', payload: toLegacyUselessA(data) };
  if (data?.aitiologiaCode === 'ia') return { type: 'ammo_consumption', payload: toLegacyAmmo(data) };
  return null;
}

function getInitialModuleData(code, context) {
  const draft = context.documentsState?.newModuleDrafts?.[code];
  if (draft) return draft;
  if (code === 'z') return fromLegacyUselessA(context);
  if (code === 'ia') return fromLegacyAmmo(context);
  if (code === 'd' && context.documentsState?.transformation) return context.documentsState.transformation;
  if (code === 'st' && context.documentsState?.clothingMonthlySummary) return context.documentsState.clothingMonthlySummary;
  if (code === 'a') return baseData(code, context);
  return baseData(code, context);
}

function baseData(code, context) {
  const aitiologia = getAitiologiaByCode(code);
  return {
    aitiologiaCode: code,
    formCode: code === 'ia' ? 'ΔΥΠ/192' : code === 'd' ? 'ΕΦΕΔ 506' : code === 'st' ? 'ΔΥΠ/189' : 'ΕΦΕΔ 505',
    commonFields: {
      monada: context.serviceUnit || context.selectedExhp?.serviceUnit || '',
      addyAxp: context.indexNumber || formatExhpIndex(context.selectedExhp),
      date: context.selectedExhp?.documentDate || ''
    },
    financialOfficers: {
      commander: context.settings?.financialOfficers?.commander || '',
      ped: context.settings?.financialOfficers?.ped || '',
      manager: context.settings?.financialOfficers?.manager || ''
    },
    specificFields: code === 'd'
      ? { topos: context.settings?.serviceInfo?.serviceLocation || '' }
      : code === 'st'
        ? {
            month: String(context.selectedExhp?.documentDate || new Date().toISOString()).slice(0, 7),
            stg: '',
            commander: context.settings?.financialOfficers?.commander || '',
            manager: context.settings?.financialOfficers?.manager || ''
          }
        : {},
    materials: code === 'a' ? [] : code === 'z' ? mapExhpItemsToMaterials(context.items || []) : [],
    formDrafts: code === 'a' ? (context.documentsState?.uselessMaterialForms || {}) : undefined,
    materialsUsed: [],
    materialsProduced: [],
    entries: code === 'st' ? [] : undefined,
    label: aitiologia?.label || ''
  };
}

function fromLegacyUselessA(context) {
  const legacy = context.documentsState?.draftUselessA || context.documentsState?.uselessA || {};
  const data = baseData('z', context);
  return {
    ...data,
    specificFields: {
      topos: legacy.location || context.settings?.serviceInfo?.serviceLocation || '',
      imera: '',
      minas: '',
      etos: '',
      imerominia: data.commonFields.date || '',
      hdmArithmos: legacy.hdmNumber || '',
      proedros: legacy.president || '',
      melosA: legacy.memberA || '',
      melosB: legacy.memberB || '',
      apoDate: legacy.periodFrom || '',
      eosDate: legacy.periodTo || ''
    },
    materials: Array.isArray(legacy.items) && legacy.items.length
      ? legacy.items.map((item, index) => ({
          seq: item.aa || index + 1,
          nomenclature: item.nomenclatureNumber || item.nominalNumber || '',
          description: item.description || '',
          unit: item.unit || item.measurementUnit || '',
          quantity: item.quantity ?? '',
          notes: item.remarks || item.notes || ''
        }))
      : data.materials
  };
}

function fromLegacyAmmo(context) {
  const legacy = context.documentsState?.draftAmmo || context.documentsState?.ammo || {};
  const data = baseData('ia', context);
  const consumedMaterials = legacyAmmoItemsToMaterialRows((legacy.items || [])
    .filter((item) => item.itemType === 'consumed'));
  const returnedPackagingMaterials = legacyAmmoItemsToMaterialRows((legacy.items || [])
    .filter((item) => item.itemType === 'empty'));
  return {
    ...data,
    specificFields: {
      vathmosOnomatepwnymo: [legacy.officerRank, legacy.officerName].filter(Boolean).join(' - '),
      monadaTmima: legacy.unit || data.commonFields.monada || '',
      imerominia: legacy.firingDate || '',
      imeraEvdomadas: legacy.dayOfWeek || '',
      consumedMaterials,
      returnedPackagingMaterials,
      consumedAmmo: normalizeList(consumedMaterials.map(formatAmmoMaterialLine)),
      returnedPackaging: normalizeList(returnedPackagingMaterials.map(formatAmmoMaterialLine)),
      antigrafa: legacy.copiesCount ?? ''
    },
    materials: []
  };
}

function collectDocDData(editor, context) {
  const data = {
    ...baseData('d', context),
    specificFields: {
      topos: context.settings?.serviceInfo?.serviceLocation || '',
      dgiArithmos: '',
      proedros: '',
      melosA: '',
      melosB: ''
    },
    materialsUsed: [],
    materialsProduced: []
  };
  readPathFields(editor, '[data-doc-d-field]', data);
  data.materialsUsed = collectMaterialRows(editor.querySelector('[data-doc-d-materials="used"]'));
  data.materialsProduced = collectMaterialRows(editor.querySelector('[data-doc-d-materials="produced"]'));
  rememberCommittee(data.specificFields);
  return data;
}

function collectDocAData(editor, context) {
  const formKey = context.formKey || 'a';
  const committeeTier = context.committeeTier || 'primary';
  const tierRoot = editor.querySelector(`[data-doc-a-tier="${committeeTier}"]`);
  const root = tierRoot?.querySelector(`[data-doc-a-form="${formKey}"]`);
  const data = {
    ...baseData('a', context),
    formKey,
    committeeTier,
    specificFields: { proedros: '', melosA: '', melosB: '', logistirio: '' },
    materials: []
  };
  readPathFields(tierRoot || editor, '[data-doc-a-field]', data);
  data.materials = collectMaterialRows(root?.querySelector('[data-doc-a-materials]'));
  rememberCommittee(data.specificFields);
  return data;
}

function collectDocZData(editor, context) {
  const data = {
    ...baseData('z', context),
    specificFields: {
      topos: '',
      imera: '',
      minas: '',
      etos: '',
      imerominia: '',
      hdmArithmos: '',
      proedros: '',
      melosA: '',
      melosB: '',
      apoDate: '',
      eosDate: ''
    },
    materials: []
  };
  readPathFields(editor, '[data-doc-z-field]', data);
  data.materials = Array.from(editor.querySelectorAll('[data-materials-row]')).map((row, index) => ({
    seq: readRowField(row, 'seq') || String(index + 1),
    shareNumber: readRowField(row, 'shareNumber'),
    nomenclature: readRowField(row, 'nomenclature'),
    description: readRowField(row, 'description'),
    unit: readRowField(row, 'unit'),
    quantity: readRowField(row, 'quantity'),
    notes: readRowField(row, 'notes')
  }));
  rememberCommittee(data.specificFields);
  return data;
}

function collectDocIAData(editor, context) {
  const data = {
    ...baseData('ia', context),
    specificFields: {
      vathmosOnomatepwnymo: '',
      monadaTmima: '',
      imerominia: '',
      imeraEvdomadas: '',
      consumedAmmo: ['', '', '', '', ''],
      returnedPackaging: ['', '', '', '', ''],
      consumedMaterials: [],
      returnedPackagingMaterials: [],
      antigrafa: ''
    },
    materials: []
  };
  readPathFields(editor, '[data-doc-ia-field]', data);
  data.specificFields.consumedMaterials = collectMaterialRows(editor.querySelector('[data-doc-ia-materials="consumed"]'));
  data.specificFields.returnedPackagingMaterials = collectMaterialRows(editor.querySelector('[data-doc-ia-materials="returned"]'));
  data.specificFields.consumedAmmo = normalizeList(data.specificFields.consumedMaterials.map(formatAmmoMaterialLine));
  data.specificFields.returnedPackaging = normalizeList(data.specificFields.returnedPackagingMaterials.map(formatAmmoMaterialLine));
  return data;
}

function collectDocSTData(editor, context) {
  const data = { ...baseData('st', context), specificFields: { month: '', stg: '', commander: '', manager: '' }, entries: [] };
  readPathFields(editor, '[data-doc-st-field]', data);
  data.entries = Array.from(editor.querySelectorAll('[data-doc-st-row]')).map((row) => ({
    shareNumber: row.querySelector('[data-doc-st-entry="shareNumber"]')?.value.trim() || '',
    item: row.querySelector('[data-doc-st-entry="item"]')?.value.trim() || '',
    subunit: row.querySelector('[data-doc-st-entry="subunit"]')?.value.trim() || '',
    quantity: row.querySelector('[data-doc-st-entry="quantity"]')?.value || '',
    movement: row.querySelector('[data-doc-st-entry="movement"]')?.value || 'initial'
  }));
  return data;
}

function readPathFields(editor, selector, data) {
  editor.querySelectorAll(selector).forEach((input) => {
    const path = input.dataset.docZField || input.dataset.docIaField || input.dataset.docDField || input.dataset.docAField || input.dataset.docStField;
    setPath(data, path, input.value.trim());
  });
}

function collectMaterialRows(root) {
  return Array.from(root?.querySelectorAll('[data-materials-row]') || []).map((row, index) => ({
    seq: readRowField(row, 'seq') || String(index + 1),
    shareNumber: readRowField(row, 'shareNumber'),
    nomenclature: readRowField(row, 'nomenclature'),
    description: readRowField(row, 'description'),
    unit: readRowField(row, 'unit'),
    quantity: readRowField(row, 'quantity'),
    quantityWords: readRowField(row, 'quantityWords'),
    acquisitionPrice: readRowField(row, 'acquisitionPrice'),
    acquisitionDate: readRowField(row, 'acquisitionDate'),
    notes: readRowField(row, 'notes')
  }));
}

function collectLettered(editor, prefix) {
  const values = ['', '', '', '', ''];
  editor.querySelectorAll(`[data-lettered-list-field^="${prefix}."]`).forEach((input) => {
    const index = Number(input.dataset.letteredListField.slice(prefix.length + 1));
    if (Number.isInteger(index) && index >= 0 && index < values.length) values[index] = input.value.trim();
  });
  return values;
}

function legacyAmmoItemsToMaterialRows(items = []) {
  return (Array.isArray(items) ? items : []).map((item, index) => ({
    seq: item.aa || index + 1,
    shareNumber: item.shareNumber || '',
    nomenclature: item.nomenclatureNumber || item.nominalNumber || '',
    description: item.description || '',
    unit: item.unit || item.measurementUnit || '',
    quantity: item.quantity ?? ''
  }));
}

function normalizeAmmoMaterialRows(rows = [], fallbackList = []) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  if (sourceRows.some(hasAmmoMaterialValue)) {
    return sourceRows.map((row, index) => ({
      seq: row.seq || index + 1,
      shareNumber: row.shareNumber || '',
      nomenclature: row.nomenclature || row.nomenclatureNumber || row.nominalNumber || '',
      description: row.description || '',
      unit: row.unit || row.measurementUnit || '',
      quantity: row.quantity ?? ''
    }));
  }
  return normalizeList(fallbackList)
    .filter(Boolean)
    .map((description, index) => ({
      seq: index + 1,
      shareNumber: '',
      nomenclature: '',
      description,
      unit: '',
      quantity: ''
    }));
}

function hasAmmoMaterialValue(row = {}) {
  return Boolean(
    String(row.shareNumber || '').trim() ||
    String(row.description || '').trim() ||
    String(row.unit || '').trim() ||
    String(row.quantity || '').trim()
  );
}

function formatAmmoMaterialLine(row = {}) {
  return [
    row.description || '',
    row.unit || '',
    row.quantity === null || row.quantity === undefined ? '' : row.quantity
  ].filter((value) => String(value).trim()).join(' / ');
}

function toLegacyUselessA(data) {
  const fields = data.specificFields || {};
  return {
    location: fields.topos || '',
    date: data.commonFields?.date || '',
    hdmNumber: fields.hdmArithmos || '',
    president: fields.proedros || '',
    memberA: fields.melosA || '',
    memberB: fields.melosB || '',
    periodFrom: fields.apoDate || '',
    periodTo: fields.eosDate || '',
    items: (data.materials || []).map((item, index) => ({
      aa: Number(item.seq) || index + 1,
      shareNumber: item.shareNumber || '',
      nomenclatureNumber: item.nomenclature || '',
      description: item.description || '',
      unit: item.unit || '',
      quantity: optionalNumber(item.quantity),
      acquisitionPrice: '',
      acquisitionDate: '',
      remarks: item.notes || ''
    }))
  };
}

function toLegacyAmmo(data) {
  const fields = data.specificFields || {};
  const consumedRows = normalizeAmmoMaterialRows(fields.consumedMaterials, fields.consumedAmmo);
  const returnedRows = normalizeAmmoMaterialRows(fields.returnedPackagingMaterials, fields.returnedPackaging);
  const items = [
    ...consumedRows.filter(hasAmmoMaterialValue).map((row) => ({
      itemType: 'consumed',
      shareNumber: row.shareNumber || '',
      nomenclatureNumber: row.nomenclature || '',
      description: row.description || '',
      unit: row.unit || '',
      quantity: optionalNumber(row.quantity)
    })),
    ...returnedRows.filter(hasAmmoMaterialValue).map((row) => ({
      itemType: 'empty',
      shareNumber: row.shareNumber || '',
      nomenclatureNumber: row.nomenclature || '',
      description: row.description || '',
      unit: row.unit || '',
      quantity: optionalNumber(row.quantity)
    }))
  ];
  return {
    officerRank: '',
    officerName: fields.vathmosOnomatepwnymo || '',
    unit: fields.monadaTmima || '',
    firingDate: fields.imerominia || '',
    dayOfWeek: fields.imeraEvdomadas || '',
    copiesCount: optionalInteger(fields.antigrafa),
    items
  };
}

async function ensureSupportDocument(exhpDocsApi, documentsState, exhpId, documentType) {
  const existing = documentsState.supportDocuments.find((documentItem) =>
    documentItem.documentType === documentType
  );
  if (existing) return existing;

  const result = await exhpDocsApi.create(exhpId, documentType);
  const document = result.document || result;
  documentsState.supportDocuments.push(document);
  return document;
}

function mapExhpItemsToMaterials(items) {
  return (items || []).map((item, index) => ({
    seq: index + 1,
    shareNumber: item.shareNumber || '',
    nomenclature: item.nominalNumber || item.nomenclature || '',
    description: item.description || '',
    unit: item.measurementUnit || item.unit || '',
    quantity: item.quantity ?? '',
    notes: item.supportingDocuments || item.notes || ''
  }));
}

function formatExhpIndex(selectedExhp) {
  if (!selectedExhp) return '';
  return selectedExhp.fiscalYear
    ? `${selectedExhp.registryNumber}/${selectedExhp.fiscalYear}`
    : String(selectedExhp.registryNumber || '');
}

export function syncDocZMaterialsToExhpCreditItems(items = [], data = {}) {
  return syncSupportDocumentMaterialsToExhpItems(items, data);
}

export function syncSavedSecondaryMaterialsToExhpItems(items = [], documentsState = {}) {
  const retained = (Array.isArray(items) ? items : []).filter((item) =>
    !String(item.supportModuleSource || '').startsWith('docA_axristo_secondary_')
  );
  return Object.entries(documentsState.uselessMaterialForms || {})
    .filter(([key, data]) => key.startsWith('secondary_') && data?.committeeTier === 'secondary')
    .sort(([left], [right]) => left.localeCompare(right, 'el'))
    .reduce((result, [, data]) => syncSupportDocumentMaterialsToExhpItems(result, data), retained);
}

export function syncSupportDocumentMaterialsToExhpItems(items = [], data = {}) {
  const existingItems = Array.isArray(items) ? items : [];
  if (!data?.aitiologiaCode) return existingItems;
  const docAKey = `${data.committeeTier || 'primary'}_${data.formKey || 'a'}`;
  const currentDocASource = data?.aitiologiaCode === 'a' ? `docA_axristo_${docAKey}` : '';
  const legacyPrimarySource = data?.aitiologiaCode === 'a' && (data.committeeTier || 'primary') === 'primary'
    ? `docA_axristo_${data.formKey || 'a'}`
    : '';
  const retained = existingItems.filter((item) =>
    item.supportModuleSource !== 'docZ_analosimo' &&
    item.supportModuleSource !== 'docD_metasximatismos_used' &&
    item.supportModuleSource !== 'docD_metasximatismos_produced' &&
    item.supportModuleSource !== 'docST_clothing_summary' &&
    item.supportModuleSource !== currentDocASource &&
    item.supportModuleSource !== legacyPrimarySource
  );
  if (data?.aitiologiaCode === 'a') {
    if ((data.committeeTier || 'primary') === 'primary') return retained;
    const credits = mapSupportMaterialsToExhpItems(data.materials, 'Πίστωση', `docA_axristo_${docAKey}`);
    return [...retained, ...credits].sort(compareShareNumbersForExhpItems);
  }
  if (data?.aitiologiaCode === 'd') {
    return [...retained, ...mapDocDMaterialsToExhpItems(data)].sort(compareShareNumbersForExhpItems);
  }
  if (data?.aitiologiaCode === 'st') {
    const grouped = new Map();
    (data.entries || []).filter((entry) => entry.shareNumber && Number(entry.quantity) > 0).forEach((entry) => {
      const key = String(entry.shareNumber).trim();
      const current = grouped.get(key) || { shareNumber: key, description: entry.item || '', quantity: 0 };
      current.quantity += Number(entry.quantity);
      if (!current.description) current.description = entry.item || '';
      grouped.set(key, current);
    });
    const credits = Array.from(grouped.values()).map((entry) => ({
      shareNumber: entry.shareNumber,
      nominalNumber: '',
      description: entry.description,
      measurementUnit: 'Τεμάχια',
      materialType: '',
      materialCode: '',
      quantity: entry.quantity,
      transactionType: 'Πίστωση',
      supportingDocuments: 'Συγκεντρωτική κατάσταση ΔΥΠ/189',
      supportModuleSource: 'docST_clothing_summary'
    }));
    return [...retained, ...credits].sort(compareShareNumbersForExhpItems);
  }
  if (data?.aitiologiaCode !== 'z') return retained;

  const credits = (data.materials || [])
    .filter((item) => item.shareNumber && Number(item.quantity) > 0)
    .map((item) => ({
      shareNumber: item.shareNumber,
      nominalNumber: item.nomenclature || '',
      description: item.description || '',
      measurementUnit: item.unit || '',
      materialType: '',
      materialCode: '',
      quantity: Number(item.quantity),
      transactionType: 'Πίστωση',
      supportingDocuments: item.notes || '',
      supportModuleSource: 'docZ_analosimo'
    }));

  return [...retained, ...credits].sort(compareShareNumbersForExhpItems);
}

function copyPrimaryMaterialsToSecondary(documentsState, data) {
  const formKey = data.formKey || 'a';
  const secondaryKey = `secondary_${formKey}`;
  const existing = documentsState.uselessMaterialForms?.[secondaryKey] || {};
  const secondary = {
    ...data,
    ...existing,
    aitiologiaCode: 'a',
    formKey,
    committeeTier: 'secondary',
    commonFields: { ...(data.commonFields || {}), ...(existing.commonFields || {}) },
    financialOfficers: { ...(data.financialOfficers || {}), ...(existing.financialOfficers || {}) },
    specificFields: existing.specificFields || { proedros: '', melosA: '', melosB: '' },
    materials: cloneSupportMaterials(data.materials)
  };
  documentsState.uselessMaterialForms[secondaryKey] = secondary;
  documentsState.uselessStatements ||= {};
  documentsState.uselessStatements[secondaryKey] = secondary;
  documentsState.newModuleDrafts ||= {};
  documentsState.newModuleDrafts[`a_${secondaryKey}`] = secondary;
}

function cloneSupportMaterials(rows = []) {
  return (Array.isArray(rows) ? rows : []).map((row) => ({ ...row }));
}

function mapDocDMaterialsToExhpItems(data = {}) {
  const usedCredits = mapSupportMaterialsToExhpItems(
    data.materialsUsed,
    'Πίστωση',
    'docD_metasximatismos_used'
  );
  const producedDebits = mapSupportMaterialsToExhpItems(
    data.materialsProduced,
    'Χρέωση',
    'docD_metasximatismos_produced'
  );
  return [...usedCredits, ...producedDebits];
}

function mapSupportMaterialsToExhpItems(rows = [], transactionType, supportModuleSource) {
  return (rows || [])
    .filter((item) => item.shareNumber && Number(item.quantity) > 0)
    .map((item) => ({
      shareNumber: item.shareNumber,
      nominalNumber: item.nomenclature || '',
      description: item.description || '',
      measurementUnit: item.unit || '',
      materialType: '',
      materialCode: '',
      quantity: Number(item.quantity),
      transactionType,
      supportingDocuments: item.notes || '',
      supportModuleSource
    }));
}

function compareShareNumbersForExhpItems(left, right) {
  const leftValue = String(left.shareNumber || '').trim();
  const rightValue = String(right.shareNumber || '').trim();
  const leftNumber = Number(leftValue);
  const rightNumber = Number(rightValue);
  const leftNumeric = leftValue !== '' && Number.isFinite(leftNumber);
  const rightNumeric = rightValue !== '' && Number.isFinite(rightNumber);
  if (leftNumeric && rightNumeric && leftNumber !== rightNumber) return leftNumber - rightNumber;
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return leftValue.localeCompare(rightValue, 'el', { numeric: true });
}

function readRowField(row, name) {
  return row.querySelector(`[data-materials-field="${name}"]`)?.value?.trim() || '';
}

function setPath(target, path, value) {
  const parts = String(path || '').split('.');
  if (!parts.length) return;
  let cursor = target;
  for (const part of parts.slice(0, -1)) {
    cursor[part] ||= {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function normalizeList(items) {
  const source = Array.isArray(items) ? items : [];
  return Array.from({ length: 5 }, (_, index) => source[index] ?? '');
}

function optionalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function optionalInteger(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
}

function rememberCommittee(fields = {}) {
  const committee = {
    proedros: fields.proedros || '',
    melosA: fields.melosA || '',
    melosB: fields.melosB || ''
  };
  if (!committee.proedros && !committee.melosA && !committee.melosB) return;
  try {
    window.localStorage?.setItem('exhp:lastCommittee', JSON.stringify(committee));
  } catch (_error) {
    // localStorage is optional in tests and non-browser contexts.
  }
}

function normalizeReason(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('el-GR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ');
}
