function mapExhpSupportTemplate(row) {
  return {
    id: row.id,
    issueReason: row.issue_reason,
    documentCode: row.document_code,
    title: row.title,
    required: Boolean(row.required),
    printable: Boolean(row.printable)
  };
}

function saveRegularExhpItem(repository, exhp, documentId, registryNumber, item, documentItems) {
  let share = repository.findShareByNumber(item.shareNumber);
  if (share && share.archive_status !== 'Ενεργή') {
    throw new Error(`Η μερίδα ${item.shareNumber} δεν βρέθηκε.`);
  }
  if (!share) {
    const canCreateZeroComposition = item.quantity === 0
      && isToolCollectionReason(exhp.issueReason)
      && Boolean(item.createComposition && item.createComposition.length);
    if (item.transactionType === 'Πίστωση' && !canCreateZeroComposition) {
      throw new Error('Το υπόλοιπο δεν επαρκεί για την πραγματοποίηση της δοσοληψίας.');
    }
    share = repository.createShare({
      shareNumber: item.shareNumber,
      nominalNumber: item.nominalNumber,
      description: item.description,
      materialType: item.materialType || 'Υλικό',
      measurementUnit: item.measurementUnit,
      accountingBalance: 0,
      chargedQuantity: 0,
      excludeFromInventory: isConsumableMaterial(item.materialType),
      requiresComposition: Boolean(item.createComposition && item.createComposition.length),
      requiresChangeSheet: Boolean(item.createComposition && item.createComposition.length)
    });
    if (item.createComposition && item.createComposition.length) {
      repository.replaceCompositionItems(share.id, item.createComposition);
      share = repository.findShareByNumber(item.shareNumber);
    }
  }
  const zeroCompositionMovement = item.quantity === 0
    && isToolCollectionReason(exhp.issueReason)
    && Boolean(share.requires_composition);
  if (item.quantity === 0 && !zeroCompositionMovement) {
    throw new Error('Η ποσότητα πρέπει να είναι θετικός αριθμός.');
  }
  if (item.transactionType === 'Πίστωση' && item.quantity > Number(share.accounting_balance || 0)) {
    throw new Error('Το υπόλοιπο δεν επαρκεί για την πραγματοποίηση της δοσοληψίας.');
  }
  let shareTransactionId = null;
  let ledgerSerial = 'Φ.Μ.';
  if (!zeroCompositionMovement) {
    const quantityDelta = item.transactionType === 'Χρέωση' ? item.quantity : -item.quantity;
    repository.adjustAccountingBalance(share.id, quantityDelta);
    shareTransactionId = repository.createShareTransaction({
      shareId: share.id,
      transactionDate: exhp.documentDate,
      transactionUnit: exhp.serviceUnit,
      transactionType: item.transactionType,
      documentReference: `ΕΧΠ ${registryNumber}/${exhp.fiscalYear}`,
      quantity: item.quantity,
      notes: exhp.issueReason
    });
    ledgerSerial = repository.getShareTransactionSerialForYear(
      share.id,
      shareTransactionId,
      exhp.documentDate
    );
  }
  const savedItem = {
    ...item,
    composition: item.composition && item.composition.length
      ? item.composition
      : buildCompositionSnapshot(repository, share.id, item.quantity, share.material_type)
  };
  repository.createExhpItem(documentId, savedItem, share.id, shareTransactionId);
  documentItems.push({ ...savedItem, ledgerSerial });
}

function saveToolCollectionTransfers(repository, exhp, documentId, registryNumber, documentItems) {
  const collectionItems = exhp.items.filter((item) => item.collectionTransfer);
  const regularItems = exhp.items.filter((item) => !item.collectionTransfer);
  if (collectionItems.some((item) => item.quantity <= 0)) {
    throw new Error('Η ποσότητα πρέπει να είναι θετικός αριθμός.');
  }
  regularItems.forEach((item) =>
    saveRegularExhpItem(repository, exhp, documentId, registryNumber, item, documentItems)
  );
  const credits = collectionItems.filter((item) => item.transactionType === 'Πίστωση');
  for (const credit of credits) {
    const charge = collectionItems.find((item) =>
      item.transactionType === 'Χρέωση' && item.transferGroup === credit.transferGroup
    );
    if (!charge) throw new Error(`Δεν βρέθηκε νέα μερίδα για το υλικό ${credit.nominalNumber}.`);
    if (repository.findShareByNumber(charge.shareNumber)) {
      throw new Error(`Ο Αριθμός Μερίδας ${charge.shareNumber} χρησιμοποιείται ήδη.`);
    }

    let sourceShare = null;
    let creditTransactionId = null;
    let creditSerial = 'Φ.Μ.';
    if (!credit.collectionVirtualCredit) {
      sourceShare = repository.findShareByNumber(credit.shareNumber);
      if (!sourceShare || Number(credit.quantity) > Number(sourceShare.accounting_balance || 0)) {
        throw new Error(`Η χρεωμένη ποσότητα δεν επαρκεί για το υλικό ${credit.nominalNumber}.`);
      }
      repository.adjustAccountingBalance(sourceShare.id, -credit.quantity);
      creditTransactionId = repository.createShareTransaction({
        shareId: sourceShare.id,
        transactionDate: exhp.documentDate,
        transactionUnit: exhp.serviceUnit,
        transactionType: 'Πίστωση',
        documentReference: `ΕΧΠ ${registryNumber}/${exhp.fiscalYear}`,
        quantity: credit.quantity,
        notes: exhp.issueReason
      });
      creditSerial = repository.getShareTransactionSerialForYear(
        sourceShare.id, creditTransactionId, exhp.documentDate
      );
    } else {
      sourceShare = repository.findShareByNumber(credit.collectionParentShareNumber);
      if (!sourceShare) throw new Error('Δεν βρέθηκε η μερίδα της συλλογής.');
    }
    repository.createExhpItem(documentId, credit, sourceShare.id, creditTransactionId);
    documentItems.push({ ...credit, ledgerSerial: creditSerial });

    const targetShare = repository.createShare({
      shareNumber: charge.shareNumber,
      nominalNumber: charge.nominalNumber,
      description: charge.description,
      materialType: charge.materialType,
      materialCode: charge.materialCode,
      measurementUnit: charge.measurementUnit,
      accountingBalance: 0,
      chargedQuantity: 0
    });
    repository.adjustAccountingBalance(targetShare.id, charge.quantity);
    const chargeTransactionId = repository.createShareTransaction({
      shareId: targetShare.id,
      transactionDate: exhp.documentDate,
      transactionUnit: exhp.serviceUnit,
      transactionType: 'Χρέωση',
      documentReference: `ΕΧΠ ${registryNumber}/${exhp.fiscalYear}`,
      quantity: charge.quantity,
      notes: exhp.issueReason
    });
    const chargeSerial = repository.getShareTransactionSerialForYear(
      targetShare.id, chargeTransactionId, exhp.documentDate
    );
    repository.createExhpItem(documentId, charge, targetShare.id, chargeTransactionId);
    documentItems.push({ ...charge, ledgerSerial: chargeSerial });
  }
}

function isToolCollectionReason(value) {
  return String(value || '').toLocaleLowerCase('el-GR').includes('συλλογές εργαλείων');
}

function aggregateCompositionCharges(rows) {
  const totals = new Map();
  rows.forEach((row) => {
    let snapshot = [];
    try { snapshot = JSON.parse(row.composition_snapshot || '[]'); } catch (_error) {}
    snapshot.forEach((item) => {
      const key = compositionChargeKey(
        row.share_id, item.componentNominalNumber, item.componentDescription
      );
      const direction = row.movement_type === 'Επιστροφή' ? -1 : 1;
      totals.set(key, (totals.get(key) || 0) + direction * Number(item.quantity || 0));
    });
  });
  return totals;
}

function addChangeSheetCompositionCharges(totals, rows) {
  rows.forEach((row) => {
    const key = compositionChargeKey(
      row.share_id,
      row.component_nominal_number,
      row.component_description
    );
    const movement = String(row.movement_type || '').toLocaleUpperCase('el-GR');
    const direction = movement === 'ΠΙΣΤΩΣΗ' || movement === 'ΕΠΙΣΤΡΟΦΗ' ? -1 : 1;
    totals.set(key, (totals.get(key) || 0) + direction * Number(row.quantity || 0));
  });
  return totals;
}

function compositionChargeKey(shareId, nominalNumber, description) {
  return [
    Number(shareId),
    String(nominalNumber || '').trim().toLocaleUpperCase('el-GR'),
    String(description || '').trim().toLocaleUpperCase('el-GR')
  ].join('\u0000');
}

function saveNominalNumberTransfer(repository, exhp, documentId, registryNumber, documentItems) {
  const credits = exhp.items.filter((item) => item.transactionType === 'Πίστωση');
  for (const creditInput of credits) {
    const chargeInput = exhp.items.find((item) =>
      item.transactionType === 'Χρέωση' &&
      item.sourceShareNumber === creditInput.shareNumber &&
      (!creditInput.transferGroup || item.transferGroup === creditInput.transferGroup)
    );
    const sourceShare = repository.findShareByNumber(creditInput.shareNumber);
    if (!sourceShare || sourceShare.archive_status !== 'Ενεργή') {
      throw new Error(`Η μερίδα ${creditInput.shareNumber} δεν βρέθηκε.`);
    }
    if (repository.findShareByNumber(chargeInput.shareNumber)) {
      throw new Error(`Ο Αριθμός Μερίδας ${chargeInput.shareNumber} χρησιμοποιείται ήδη.`);
    }
    const balance = Number(sourceShare.accounting_balance || 0);
    if (Math.abs(Number(creditInput.quantity) - balance) > 0.000001) {
      throw new Error(`Η μερίδα ${sourceShare.share_number} πρέπει να πιστωθεί με ολόκληρο το υπόλοιπο ${balance}.`);
    }

    const composition = buildCompositionSnapshot(repository, sourceShare.id, balance, sourceShare.material_type);
    const sharedFields = {
      nominalNumber: sourceShare.nominal_number,
      description: sourceShare.description,
      measurementUnit: sourceShare.measurement_unit,
      materialType: sourceShare.material_type,
      materialCode: sourceShare.material_code || '',
      quantity: balance,
      supportingDocuments: creditInput.supportingDocuments || '',
      transferGroup: creditInput.transferGroup || chargeInput.transferGroup || '',
      composition
    };
    const credit = {
      ...sharedFields,
      shareNumber: sourceShare.share_number,
      transactionType: 'Πίστωση',
      sourceShareNumber: ''
    };
    repository.adjustAccountingBalance(sourceShare.id, -balance);
    const creditTransactionId = repository.createShareTransaction({
      shareId: sourceShare.id,
      transactionDate: exhp.documentDate,
      transactionUnit: exhp.serviceUnit,
      transactionType: 'Πίστωση',
      documentReference: `ΕΧΠ ${registryNumber}/${exhp.fiscalYear}`,
      quantity: balance,
      notes: exhp.issueReason
    });
    const creditSerial = repository.getShareTransactionSerialForYear(
      sourceShare.id,
      creditTransactionId,
      exhp.documentDate
    );
    repository.createExhpItem(documentId, credit, sourceShare.id, creditTransactionId);
    documentItems.push({ ...credit, ledgerSerial: creditSerial });

    const targetShare = repository.createTransferredShare(
      sourceShare.id,
      chargeInput.shareNumber,
      chargeInput.nominalNumber
    );
    repository.moveCurrentShareState(sourceShare.id, targetShare);
    const charge = {
      ...sharedFields,
      shareNumber: targetShare.share_number,
      nominalNumber: targetShare.nominal_number,
      transactionType: 'Χρέωση',
      sourceShareNumber: sourceShare.share_number
    };
    repository.adjustAccountingBalance(targetShare.id, balance);
    const chargeTransactionId = repository.createShareTransaction({
      shareId: targetShare.id,
      transactionDate: exhp.documentDate,
      transactionUnit: exhp.serviceUnit,
      transactionType: 'Χρέωση',
      documentReference: `ΕΧΠ ${registryNumber}/${exhp.fiscalYear}`,
      quantity: balance,
      notes: exhp.issueReason
    });
    const chargeSerial = repository.getShareTransactionSerialForYear(
      targetShare.id,
      chargeTransactionId,
      exhp.documentDate
    );
    repository.createExhpItem(documentId, charge, targetShare.id, chargeTransactionId);
    documentItems.push({ ...charge, ledgerSerial: chargeSerial });
    repository.keepTransferredShareActive(sourceShare.id);
  }
}

function buildCompositionSnapshot(repository, shareId, quantity, materialType) {
  const skipMultiplication = isNonScalingCompositionMaterial(materialType);
  return repository.listCompositionItems(shareId).map((component) => ({
    componentNominalNumber: component.component_nominal_number,
    componentDescription: component.component_description,
    measurementUnit: component.measurement_unit,
    projectedQuantity: skipMultiplication
      ? Number(component.quantity || 0)
      : Number(component.quantity || 0) * Number(quantity || 0),
    notIssuedQuantity: 0,
    notes: component.notes || ''
  }));
}

function readTransactionArchive(repository, year) {
  const row = repository.getFiscalYearArchive(year);
  if (!row) return null;
  try {
    return JSON.parse(row.archive_snapshot || '{}');
  } catch (_error) {
    return null;
  }
}

function mapExhpDocumentSupport(row) {
  let formData = {};
  try {
    formData = JSON.parse(row.form_data || '{}');
  } catch (_error) {
    formData = {};
  }
  return {
    id: row.id,
    templateId: row.template_id,
    documentCode: row.document_code,
    title: row.title,
    required: Boolean(row.effective_required !== undefined ? row.effective_required : row.required),
    printable: Boolean(row.printable),
    documentReference: row.document_reference,
    completed: Boolean(row.completed),
    notes: row.notes,
    formData
  };
}

function collectMaterialTypes(materialCategories, shares) {
  const seen = new Set();
  const materialTypes = [];

  for (const category of materialCategories) {
    addMaterialType(materialTypes, seen, category.name);
  }

  for (const share of shares) {
    addMaterialType(materialTypes, seen, share.material_type);
  }

  return materialTypes;
}

function addMaterialType(materialTypes, seen, value) {
  const materialType = String(value || '').trim();
  const key = materialType.toLocaleLowerCase('el-GR');
  if (!materialType || seen.has(key)) {
    return;
  }

  seen.add(key);
  materialTypes.push(materialType);
}

function mapAddyDocumentItem({ item, share, ledgerSerial, transactionUnit, serviceName }) {
  const isCharge = item.transactionType === 'Χρέωση';
  const entryReference = ledgerSerial ? `${share.share_number}/${ledgerSerial}` : '';

  return {
    shareNumber: item.shareNumber || share.share_number || '',
    nominalNumber: item.nominalNumber || '',
    description: item.description || share.description || '',
    transactionType: item.transactionType,
    column1: isCharge ? serviceName : transactionUnit,
    column11: isCharge ? entryReference : '',
    column12: item.nominalNumber,
    column13: item.description || share.description || item.nominalNumber,
    column14: item.measurementUnit,
    column18: isCharge ? transactionUnit : serviceName,
    column22: item.quantity,
    column23: '',
    column24: isCharge ? '' : share.share_number,
    column25: isCharge ? '' : ledgerSerial,
    column26: item.unitPrice === null ? '' : item.unitPrice,
    notes: item.notes || ''
  };
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatAddyDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function normalize(value) {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('el-GR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isConsumableMaterial(value) {
  const normalized = normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized === 'αναλωσιμα' || normalized === 'αναλωσιμο';
}

function isNonScalingCompositionMaterial(value) {
  const normalized = normalize(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return normalized === 'κανονισμοι' || normalized === 'βιβλια';
}

function compareShareNumbers(left, right) {
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


module.exports = {
  mapExhpSupportTemplate,
  saveRegularExhpItem,
  saveToolCollectionTransfers,
  isToolCollectionReason,
  aggregateCompositionCharges,
  addChangeSheetCompositionCharges,
  compositionChargeKey,
  saveNominalNumberTransfer,
  buildCompositionSnapshot,
  readTransactionArchive,
  mapExhpDocumentSupport,
  collectMaterialTypes,
  addMaterialType,
  mapAddyDocumentItem,
  formatAddyDate,
  formatDate,
  normalize,
  isConsumableMaterial,
  isNonScalingCompositionMaterial,
  compareShareNumbers
};
