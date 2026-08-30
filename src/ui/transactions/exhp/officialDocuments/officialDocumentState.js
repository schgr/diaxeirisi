import {
  collectRows,
  readOptionalNumber,
  readRowField,
  readSupportField
} from '../../shared.js';
import {
  isAmmoConsumptionReason,
  isUselessMaterialReason
} from './officialDocumentRules.js';

export async function ensureExhpSupportDocument(exhpDocsApi, documentsState, exhpId, documentType) {
  const existing = documentsState.supportDocuments.find((documentItem) =>
    documentItem.documentType === documentType
  );
  if (existing) return existing;

  const result = await exhpDocsApi.create(exhpId, documentType);
  const document = result.document || result;
  documentsState.supportDocuments.push(document);
  return document;
}

export function saveExhpDocumentForm(exhpDocsApi, documentType, documentId, editor) {
  if (documentType === 'useless_material_a') {
    return exhpDocsApi.saveUselessA(documentId, collectUselessA(editor));
  }
  if (documentType === 'useless_material_b') {
    return exhpDocsApi.saveUselessB(documentId, collectUselessB(editor));
  }
  return exhpDocsApi.saveAmmo(documentId, collectAmmo(editor));
}

export async function saveDraftExhpDocuments(exhpDocsApi, exhpId, issueReason, editor, documentsState) {
  if (!exhpDocsApi || !exhpId || !editor) return;
  const saveState = { supportDocuments: [] };
  if (isUselessMaterialReason(issueReason)) {
    if (documentsState?.draftUselessA) {
      const primaryDocument = await ensureExhpSupportDocument(
        exhpDocsApi,
        saveState,
        exhpId,
        'useless_material_a'
      );
      await exhpDocsApi.saveUselessA(primaryDocument.id, documentsState.draftUselessA);
    }
    if (documentsState?.draftUselessB) {
      const secondaryDocument = await ensureExhpSupportDocument(
        exhpDocsApi,
        saveState,
        exhpId,
        'useless_material_b'
      );
      await exhpDocsApi.saveUselessB(secondaryDocument.id, documentsState.draftUselessB);
    }
    for (const [formKey, payload] of Object.entries(documentsState?.uselessStatements || {})) {
      if (payload && Object.keys(payload).length) {
        await exhpDocsApi.saveUselessStatement(exhpId, formKey, payload);
      }
    }
    return;
  }
  if (isAmmoConsumptionReason(issueReason) && documentsState?.draftAmmo) {
    const ammoDocument = await ensureExhpSupportDocument(
      exhpDocsApi,
      saveState,
      exhpId,
      'ammo_consumption'
    );
    await exhpDocsApi.saveAmmo(ammoDocument.id, documentsState.draftAmmo);
  }
  if (documentsState?.newModuleDrafts?.d) {
    const transformationDocument = await ensureExhpSupportDocument(
      exhpDocsApi,
      saveState,
      exhpId,
      'transformation_materials'
    );
    await exhpDocsApi.saveGeneric(transformationDocument.id, documentsState.newModuleDrafts.d);
  }
  if (documentsState?.newModuleDrafts?.st) {
    const clothingDocument = await ensureExhpSupportDocument(
      exhpDocsApi,
      saveState,
      exhpId,
      'clothing_monthly_summary'
    );
    await exhpDocsApi.saveGeneric(clothingDocument.id, documentsState.newModuleDrafts.st);
  }
}

function collectUselessA(editor) {
  return {
    location: readSupportField(editor, 'useless-a', 'location'),
    date: readSupportField(editor, 'useless-a', 'date'),
    hdmNumber: readSupportField(editor, 'useless-a', 'hdmNumber'),
    president: readSupportField(editor, 'useless-a', 'president'),
    memberA: readSupportField(editor, 'useless-a', 'memberA'),
    memberB: readSupportField(editor, 'useless-a', 'memberB'),
    periodFrom: readSupportField(editor, 'useless-a', 'periodFrom'),
    periodTo: readSupportField(editor, 'useless-a', 'periodTo'),
    items: collectRows(editor, '[data-useless-a-items] tr').map((row, index) => ({
      aa: index + 1,
      shareNumber: readRowField(row, 'shareNumber'),
      nomenclatureNumber: readRowField(row, 'nomenclatureNumber'),
      description: readRowField(row, 'description'),
      unit: readRowField(row, 'unit'),
      quantity: readOptionalNumber(readRowField(row, 'quantity')),
      acquisitionPrice: readRowField(row, 'acquisitionPrice'),
      acquisitionDate: readRowField(row, 'acquisitionDate'),
      remarks: readRowField(row, 'remarks')
    }))
  };
}

function collectUselessB(editor) {
  return {
    president: readSupportField(editor, 'useless-b', 'president'),
    memberA: readSupportField(editor, 'useless-b', 'memberA'),
    memberB: readSupportField(editor, 'useless-b', 'memberB'),
    commander: readSupportField(editor, 'useless-b', 'commander'),
    generalManager: readSupportField(editor, 'useless-b', 'generalManager'),
    uselessManager: readSupportField(editor, 'useless-b', 'uselessManager'),
    items: collectRows(editor, '[data-useless-b-items] tr').map((row, index) => ({
      aa: index + 1,
      shareNumber: readRowField(row, 'shareNumber'),
      nomenclatureNumber: readRowField(row, 'nomenclatureNumber'),
      description: readRowField(row, 'description'),
      unit: readRowField(row, 'unit'),
      qtyPrimary: readOptionalNumber(readRowField(row, 'qtyPrimary')),
      qtySecondary: readOptionalNumber(readRowField(row, 'qtySecondary')),
      diffPlus: readOptionalNumber(readRowField(row, 'diffPlus')),
      diffMinus: readOptionalNumber(readRowField(row, 'diffMinus'))
    }))
  };
}

function collectAmmo(editor) {
  return {
    officerRank: readSupportField(editor, 'ammo', 'officerRank'),
    officerName: readSupportField(editor, 'ammo', 'officerName'),
    unit: readSupportField(editor, 'ammo', 'unit'),
    firingDate: readSupportField(editor, 'ammo', 'firingDate'),
    dayOfWeek: readSupportField(editor, 'ammo', 'dayOfWeek'),
    copiesCount: readOptionalNumber(readSupportField(editor, 'ammo', 'copiesCount')),
    items: [
      ...collectRows(editor, '[data-ammo-consumed-items] tr').map((row) => ({
        itemType: 'consumed',
        description: readRowField(row, 'description'),
        quantity: readOptionalNumber(readRowField(row, 'quantity'))
      })),
      ...collectRows(editor, '[data-ammo-empty-items] tr').map((row) => ({
        itemType: 'empty',
        description: readRowField(row, 'description'),
        quantity: readOptionalNumber(readRowField(row, 'quantity'))
      }))
    ]
  };
}

export function collectExhpDocumentPreviewData(type, editor) {
  if (type === 'useless_material_a') return collectUselessA(editor);
  if (type === 'useless_material_b') return collectUselessB(editor);
  return collectAmmo(editor);
}
