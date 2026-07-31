const { createSharesRepository } = require('../db/sharesRepository');
const { AppError } = require('../core/errorHandler');
const { requirePositiveId } = require('../core/validation');
const { mapShare } = require('../shares/shareMapper');
const { validateShare } = require('../shares/shareValidation');

function createSharesService(db) {
  const repository = createSharesRepository(db);

  return {
    listShares() {
      return repository.listShares().map(mapShare);
    },

    getShareByNumber(shareNumber) {
      const value = String(shareNumber || '').trim();
      if (!value) {
        throw new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND');
      }
      const share = repository.getShareByNumber(value);
      if (!share) {
        throw new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND');
      }
      return mapShare(share);
    },

    addShare(payload) {
      repository.createShare(validateShare(payload));
      return this.listShares();
    },

    updateShareDetails(id, payload) {
      const shareId = requirePositiveId(id);
      const share = repository.getShare(shareId);

      const unitPriceText = payload && payload.unitPrice !== undefined
        ? String(payload.unitPrice).trim()
        : String(share && share.unit_price !== null && share.unit_price !== undefined ? share.unit_price : '').trim();
      const unitPrice = unitPriceText ? Number(unitPriceText) : null;

      if (unitPriceText && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
        throw new AppError('Η τιμή πρέπει να είναι θετικός αριθμός.', 'VALIDATION_ERROR');
      }

      if (!share) {
        throw new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND');
      }

      const updatedShare = repository.updateShareDetails(shareId, {
        ...validateShare({
          shareNumber: payload && payload.shareNumber !== undefined ? payload.shareNumber : share.share_number,
          nominalNumber: payload && payload.nominalNumber !== undefined ? payload.nominalNumber : share.nominal_number,
          description: payload && payload.description !== undefined ? payload.description : share.description,
          materialType: payload && payload.materialType !== undefined ? payload.materialType : share.material_type,
          materialCode: payload && payload.materialCode !== undefined ? payload.materialCode : share.material_code,
          projectedQuantity:
            payload && payload.projectedQuantity !== undefined ? payload.projectedQuantity : share.projected_quantity,
          accountingBalance:
            payload && payload.accountingBalance !== undefined ? payload.accountingBalance : share.accounting_balance,
          chargedQuantity:
            payload && payload.chargedQuantity !== undefined ? payload.chargedQuantity : share.charged_quantity
        }),
        mainMaterialNumber: String(
          payload && payload.mainMaterialNumber !== undefined
            ? payload.mainMaterialNumber
            : share.main_material_number || ''
        ).trim(),
        unitPrice,
        photoPath: String(
          payload && payload.photoPath !== undefined ? payload.photoPath : share.photo_path || ''
        ).trim(),
        requiresComposition: payload && payload.requiresComposition !== undefined
          ? Boolean(payload.requiresComposition)
          : Boolean(share.requires_composition),
        requiresSerialNumber: payload && payload.requiresSerialNumber !== undefined
          ? Boolean(payload.requiresSerialNumber)
          : Boolean(share.requires_serial_number),
        requiresWeaponRegistry: payload && payload.requiresWeaponRegistry !== undefined
          ? Boolean(payload.requiresWeaponRegistry)
          : Boolean(share.requires_weapon_registry),
        requiresAmmunitionBatchBook: payload && payload.requiresAmmunitionBatchBook !== undefined
          ? Boolean(payload.requiresAmmunitionBatchBook)
          : Boolean(share.requires_ammunition_batch_book),
        requiresChangeSheet: payload && payload.requiresChangeSheet !== undefined
          ? Boolean(payload.requiresChangeSheet)
          : Boolean(share.requires_change_sheet)
      });

      return mapShare(updatedShare);
    },

    getShareCard(id, year = new Date().getFullYear()) {
      const shareId = requirePositiveId(id);
      const archivedYear = readFiscalYearArchive(repository, Number(year));
      if (archivedYear) {
        const archivedCard = archivedYear.cards.find((card) => Number(card.share.id) === shareId);
        if (!archivedCard) throw new AppError('Η μερίδα δεν βρέθηκε στο αρχείο του έτους.', 'NOT_FOUND');
        return archivedCard;
      }
      const share = repository.getShare(shareId);

      if (!share) {
        throw new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND');
      }

      const transactions = repository
        .listShareTransactionsForYear(shareId, Number(year))
        .map((row, index) => {
          const isCharge = row.transaction_type === 'Χρέωση';
          return {
            serialNumber: index + 1,
            id: row.id,
            date: row.transaction_date,
            transactionUnit: row.transaction_unit,
            registryNumber: formatCardRegistryNumber(row.document_reference, row.transaction_type),
            imports: isCharge ? row.quantity : 0,
            exports: isCharge ? 0 : row.quantity,
            notes: ''
          };
        });

      const beforeYearBalance = repository.getTransactionBalanceBeforeYear(shareId, Number(year));
      const openingInventory = repository.getOpeningInventoryBeforeYear(shareId, Number(year));
      const cardOpeningInventory = repository.getOpeningInventoryForCardYear(shareId, Number(year));
      const openingInventoryIsInYear = cardOpeningInventory
        && String(cardOpeningInventory.transaction_date).startsWith(`${Number(year)}-`);
      let runningBalance = openingInventoryIsInYear
        ? Number(cardOpeningInventory.quantity || 0)
        : beforeYearBalance;
      const transactionsWithBalance = transactions.map((transaction) => {
        runningBalance += transaction.imports - transaction.exports;
        return {
          ...transaction,
          balance: runningBalance
        };
      });
      const displayedTransactions = transactionsWithBalance;
      const cardBaseBalance = openingInventoryIsInYear
        ? Number(cardOpeningInventory.quantity || 0)
        : beforeYearBalance;
      const cardShare = createCardShare(share, displayedTransactions, cardBaseBalance);

      const compositionItems = repository.listCompositionItems(shareId).map((row) => ({
        id: row.id,
        componentNominalNumber: row.component_nominal_number,
        componentDescription: row.component_description,
        measurementUnit: row.measurement_unit,
        projectedQuantity: Number(row.quantity) * Number(cardShare.accountingBalance || 0),
        quantityPerMaterial: Number(row.quantity),
        notIssuedQuantity: Number(row.not_issued_quantity || 0),
        quantity: Number(row.quantity),
        notes: row.notes
      }));
      const savedChangeEntries = repository.listChangeSheetEntries(shareId).map((row) => ({
        id: row.id,
        changeDate: row.change_date,
        orderReference: row.order_reference,
        previousValue: row.previous_value,
        newValue: row.new_value,
        changeReason: row.change_reason,
        notes: row.notes,
        componentLineNumber: Number(row.component_line_number || 1),
        movementType: row.movement_type || 'ΧΡΕΩΣΗ',
        quantity: Number(row.quantity || 0)
      }));
      const documentChangeEntries = buildDocumentChangeEntries(
        repository.listDocumentCompositionMovements(shareId, Number(year)),
        compositionItems
      ).filter((documentEntry) => !savedChangeEntries.some((savedEntry) =>
        savedEntry.changeDate === documentEntry.changeDate &&
        savedEntry.orderReference === documentEntry.orderReference &&
        savedEntry.componentLineNumber === documentEntry.componentLineNumber &&
        savedEntry.movementType === documentEntry.movementType
      ));

      return {
        share: cardShare,
        year: Number(year),
        openingTransfer: {
          balance: Number(beforeYearBalance || 0),
          inventoryDate: openingInventory ? openingInventory.transaction_date : '',
          reference: openingInventory ? openingInventory.document_reference : ''
        },
        transactions: displayedTransactions,
        compositionItems,
        changeSheetEntries: [...savedChangeEntries, ...documentChangeEntries],
        assignments: repository.listShareAssignments(shareId).map((row) => ({
          id: row.id,
          holderName: row.holder_name,
          department: row.department,
          quantity: row.quantity,
          assignedAt: row.assigned_at,
          notes: row.notes
        }))
      };
    },

    listMovedShareCards(year = new Date().getFullYear()) {
      const fiscalYear = Number(year);
      if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
        throw new AppError('Το οικονομικό έτος δεν είναι έγκυρο.', 'VALIDATION_ERROR');
      }
      const archivedYear = readFiscalYearArchive(repository, fiscalYear);
      if (archivedYear) return archivedYear.movedCards || [];
      return repository
        .listShareIdsWithTransactionsForYear(fiscalYear)
        .map((shareId) => this.getShareCard(shareId, fiscalYear));
    },

    getShareCardsBatch(payload = {}) {
      const fiscalYear = Number(payload.year || new Date().getFullYear());
      if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
        throw new AppError('Το οικονομικό έτος δεν είναι έγκυρο.', 'VALIDATION_ERROR');
      }
      const mode = ['single', 'all', 'moved'].includes(payload.mode) ? payload.mode : 'single';
      const options = {
        mode,
        shareId: mode === 'single' ? requirePositiveId(payload.shareId) : null,
        fromShareNumber: normalizeOptionalShareBoundary(payload.fromShareNumber),
        toShareNumber: normalizeOptionalShareBoundary(payload.toShareNumber)
      };
      const archivedYear = readFiscalYearArchive(repository, fiscalYear);
      if (archivedYear) {
        return filterArchivedPrintCards(archivedYear.cards || [], options);
      }
      const shares = repository.listSharePrintRows(fiscalYear, options);
      const shareIds = shares.map((share) => Number(share.id));
      const transactions = repository.listTransactionsForSharePrint(fiscalYear, shareIds);
      const balances = new Map(
        repository.listBalancesBeforeYearForSharePrint(fiscalYear, shareIds)
          .map((row) => [Number(row.share_id), Number(row.movement || 0)])
      );
      const inventories = repository.listInventoriesForSharePrint(fiscalYear, shareIds);
      const compositions = repository.listCompositionsForSharePrint(shareIds);
      const savedChanges = repository.listChangeSheetsForSharePrint(shareIds);
      const assignments = repository.listAssignmentsForSharePrint(shareIds);
      const documentMovements = repository.listDocumentMovementsForSharePrint(fiscalYear, shareIds);
      const transactionsByShare = groupRowsByShare(transactions);
      const inventoriesByShare = groupRowsByShare(inventories);
      const compositionsByShare = groupRowsByShare(compositions);
      const changesByShare = groupRowsByShare(savedChanges);
      const assignmentsByShare = groupRowsByShare(assignments);
      const documentMovementsByShare = groupRowsByShare(documentMovements);
      return shares.map((share) => {
        const shareId = Number(share.id);
        const card = buildPrintCard(
          share,
          fiscalYear,
          transactionsByShare.get(shareId) || [],
          balances.get(shareId) || 0,
          inventoriesByShare.get(shareId) || []
        );
        return addPrintCardDetails(
          card,
          compositionsByShare.get(shareId) || [],
          changesByShare.get(shareId) || [],
          documentMovementsByShare.get(shareId) || [],
          assignmentsByShare.get(shareId) || []
        );
      });
    },

    saveComposition(id, items) {
      const shareId = requirePositiveId(id);
      if (!repository.getShare(shareId)) throw new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND');
      const cleanItems = (Array.isArray(items) ? items : []).map((item) => {
        const projectedQuantity = Number(
          item.projectedQuantity !== undefined ? item.projectedQuantity : item.quantity
        );
        const notIssuedQuantity = Number(item.notIssuedQuantity || 0);
        if (
          !String(item.componentDescription || '').trim() ||
          !Number.isFinite(projectedQuantity) ||
          projectedQuantity <= 0 ||
          !Number.isFinite(notIssuedQuantity) ||
          notIssuedQuantity < 0
        ) {
          throw new AppError(
            'Κάθε γραμμή σύνθεσης χρειάζεται περιγραφή, θετική προβλεπόμενη ποσότητα και μη αρνητική μη χορηγηθείσα ποσότητα.',
            'VALIDATION_ERROR'
          );
        }
        return {
          componentNominalNumber: String(item.componentNominalNumber || '').trim(),
          componentDescription: String(item.componentDescription || '').trim(),
          measurementUnit: String(item.measurementUnit || '').trim(),
          projectedQuantity,
          notIssuedQuantity,
          notes: String(item.notes || '').trim()
        };
      });
      repository.replaceCompositionItems(shareId, cleanItems);
      return { message: 'Η σύνθεση υλικού αποθηκεύτηκε.' };
    },

    saveChangeSheet(id, entries) {
      const shareId = requirePositiveId(id);
      if (!repository.getShare(shareId)) throw new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND');
      const cleanEntries = (Array.isArray(entries) ? entries : []).map((entry) => {
        const changeDate = String(entry.changeDate || '').trim();
        const componentLineNumber = Number(entry.componentLineNumber);
        const movementType = String(entry.movementType || '').trim();
        const quantity = Number(entry.quantity);
        if (
          !changeDate ||
          !Number.isInteger(componentLineNumber) ||
          componentLineNumber <= 0 ||
          !['ΧΡΕΩΣΗ', 'ΠΙΣΤΩΣΗ'].includes(movementType) ||
          !Number.isFinite(quantity) ||
          quantity <= 0
        ) {
          throw new AppError(
            'Κάθε μεταβολή χρειάζεται υλικό σύνθεσης, ημερομηνία, τύπο ΧΡΕΩΣΗ/ΠΙΣΤΩΣΗ και θετική ποσότητα.',
            'VALIDATION_ERROR'
          );
        }
        return {
          changeDate,
          orderReference: String(entry.orderReference || '').trim(),
          previousValue: String(entry.previousValue || '').trim(),
          newValue: String(entry.newValue || '').trim(),
          changeReason: String(entry.changeReason || '').trim(),
          notes: String(entry.notes || '').trim(),
          componentLineNumber,
          movementType,
          quantity
        };
      });
      repository.replaceChangeSheetEntries(shareId, cleanEntries);
      return { message: 'Το φύλλο μεταβολών αποθηκεύτηκε.' };
    },

    listSerialNumberRegistry() {
      return repository.listSerialNumberShares().map((row) => {
        const share = mapShare(row);
        const assignments = repository.listShareAssignments(row.id);
        const quantity = Math.max(0, Math.trunc(Number(share.chargedQuantity || 0)));
        const departments = assignments.flatMap((assignment) =>
          Array.from(
            { length: Math.max(0, Math.trunc(Number(assignment.quantity || 0))) },
            () => assignment.department || ''
          )
        );
        const saved = new Map(
          repository.listSerialNumbers(row.id).map((entry) => [Number(entry.position), entry])
        );
        return {
          share,
          quantity,
          entries: Array.from({ length: quantity }, (_, index) => {
            const position = index + 1;
            const entry = saved.get(position);
            return {
              position,
              serialNumber: entry ? entry.serial_number : '',
              department: departments[index] || '',
              notes: entry ? entry.notes : ''
            };
          })
        };
      });
    },

    saveSerialNumbers(id, entries) {
      const shareId = requirePositiveId(id);
      const share = repository.getShare(shareId);
      if (!share || !share.requires_serial_number) {
        throw new AppError('Η μερίδα δεν έχει ενεργοποιημένο σειριακό αριθμό.', 'VALIDATION_ERROR');
      }
      const maximum = Math.max(0, Math.trunc(Number(share.charged_quantity || 0)));
      const cleanEntries = (Array.isArray(entries) ? entries : []).map((entry) => {
        const position = Number(entry.position);
        if (!Number.isInteger(position) || position < 1 || position > maximum) {
          throw new AppError('Η θέση του σειριακού αριθμού δεν είναι έγκυρη.', 'VALIDATION_ERROR');
        }
        return {
          position,
          serialNumber: String(entry.serialNumber || '').trim(),
          notes: String(entry.notes || '').trim()
        };
      });
      repository.saveSerialNumbers(shareId, cleanEntries);
      return { message: 'Οι σειριακοί αριθμοί αποθηκεύτηκαν.' };
    },

    listAmmunitionBatchRegistry() {
      return repository.listAmmunitionBatchShares().map((row) => {
        const departments = aggregateAssignmentQuantities(
          repository.listShareAssignments(row.id)
        );
        const defaultDepartment = departments.length === 1 ? departments[0].department : '';
        return {
          share: mapShare(row),
          departments,
          entries: repository.listAmmunitionBatches(row.id).map((entry) => ({
            position: Number(entry.position),
            batchNumber: entry.batch_number,
            quantity: Number(entry.quantity || 0),
            department: entry.department || defaultDepartment,
            notes: entry.notes || ''
          }))
        };
      });
    },

    saveAmmunitionBatches(id, entries) {
      const shareId = requirePositiveId(id);
      const share = repository.getShare(shareId);
      if (!share || !share.requires_ammunition_batch_book) {
        throw new AppError('Η μερίδα δεν έχει ενεργοποιημένο το Βιβλίο Μερίδων Β.Φ.', 'VALIDATION_ERROR');
      }
      const expectedDepartments = aggregateAssignmentQuantities(
        repository.listShareAssignments(shareId)
      );
      const cleanEntries = (Array.isArray(entries) ? entries : []).map((entry) => {
        const batchNumber = String(entry && entry.batchNumber || '').trim();
        const quantity = Number(entry && entry.quantity);
        const department = String(entry && entry.department || '').trim();
        if (!batchNumber) {
          throw new AppError('Η Μερίδα Πυρκού είναι υποχρεωτική.', 'VALIDATION_ERROR');
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new AppError('Η ποσότητα της Μερίδας Πυρκού πρέπει να είναι θετικός αριθμός.', 'VALIDATION_ERROR');
        }
        if (expectedDepartments.length && !department) {
          throw new AppError('Το Τμήμα της Μερίδας Πυρκού είναι υποχρεωτικό.', 'VALIDATION_ERROR');
        }
        return {
          batchNumber,
          quantity,
          department,
          notes: String(entry && entry.notes || '').trim()
        };
      });
      if (expectedDepartments.length) {
        validateAmmunitionBatchAllocations(cleanEntries, expectedDepartments);
      }
      repository.replaceAmmunitionBatches(shareId, cleanEntries);
      return { message: 'Οι μερίδες πυρκού αποθηκεύτηκαν.' };
    }
  };
}

function normalizeOptionalShareBoundary(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new AppError('Το εύρος μερίδων δεν είναι έγκυρο.', 'VALIDATION_ERROR');
  }
  return number;
}

function groupRowsByShare(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const id = Number(row.share_id);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  });
  return grouped;
}

function buildPrintCard(share, year, rows, beforeYearBalance, inventories) {
  const transactions = rows.map((row, index) => {
    const isCharge = row.transaction_type === 'Χρέωση';
    return {
      serialNumber: index + 1,
      id: row.id,
      date: row.transaction_date,
      transactionUnit: row.transaction_unit,
      registryNumber: formatCardRegistryNumber(row.document_reference, row.transaction_type),
      imports: isCharge ? row.quantity : 0,
      exports: isCharge ? 0 : row.quantity,
      notes: ''
    };
  });
  const cardYearInventory = inventories.find((row) =>
    String(row.transaction_date).startsWith(`${year}-`)
  );
  const openingInventory = inventories.find((row) => row.transaction_date < `${year}-01-01`);
  let runningBalance = cardYearInventory ? Number(cardYearInventory.quantity || 0) : beforeYearBalance;
  const transactionsWithBalance = transactions.map((transaction) => {
    runningBalance += transaction.imports - transaction.exports;
    return { ...transaction, balance: runningBalance };
  });
  const cardBaseBalance = cardYearInventory
    ? Number(cardYearInventory.quantity || 0)
    : beforeYearBalance;
  return {
    share: createCardShare(share, transactionsWithBalance, cardBaseBalance),
    year,
    openingTransfer: {
      balance: Number(beforeYearBalance || 0),
      inventoryDate: openingInventory ? openingInventory.transaction_date : '',
      reference: openingInventory ? openingInventory.document_reference : ''
    },
    transactions: transactionsWithBalance
  };
}

function addPrintCardDetails(card, compositionRows, savedChangeRows, documentMovements, assignmentRows) {
  const compositionItems = compositionRows.map((row) => ({
    id: row.id,
    componentNominalNumber: row.component_nominal_number,
    componentDescription: row.component_description,
    measurementUnit: row.measurement_unit,
    projectedQuantity: Number(row.quantity) * Number(card.share.accountingBalance || 0),
    quantityPerMaterial: Number(row.quantity),
    notIssuedQuantity: Number(row.not_issued_quantity || 0),
    quantity: Number(row.quantity),
    notes: row.notes
  }));
  const savedChangeEntries = savedChangeRows.map((row) => ({
    id: row.id,
    changeDate: row.change_date,
    orderReference: row.order_reference,
    previousValue: row.previous_value,
    newValue: row.new_value,
    changeReason: row.change_reason,
    notes: row.notes,
    componentLineNumber: Number(row.component_line_number || 1),
    movementType: row.movement_type || 'ΧΡΕΩΣΗ',
    quantity: Number(row.quantity || 0)
  }));
  const documentChangeEntries = buildDocumentChangeEntries(documentMovements, compositionItems)
    .filter((documentEntry) => !savedChangeEntries.some((savedEntry) =>
      savedEntry.changeDate === documentEntry.changeDate &&
      savedEntry.orderReference === documentEntry.orderReference &&
      savedEntry.componentLineNumber === documentEntry.componentLineNumber &&
      savedEntry.movementType === documentEntry.movementType
    ));
  return {
    ...card,
    compositionItems,
    changeSheetEntries: [...savedChangeEntries, ...documentChangeEntries],
    assignments: assignmentRows.map((row) => ({
      id: row.id,
      holderName: row.holder_name,
      department: row.department,
      quantity: row.quantity,
      assignedAt: row.assigned_at,
      notes: row.notes
    }))
  };
}

function filterArchivedPrintCards(cards, options) {
  return cards.filter((card) => {
    const number = Number(card.share.shareNumber);
    if (options.mode === 'single' && Number(card.share.id) !== Number(options.shareId)) return false;
    if (options.mode === 'moved' && !(card.transactions || []).length) return false;
    if (options.fromShareNumber !== null && number < options.fromShareNumber) return false;
    if (options.toShareNumber !== null && number > options.toShareNumber) return false;
    return true;
  });
}

function aggregateAssignmentQuantities(assignments) {
  const totals = new Map();
  (Array.isArray(assignments) ? assignments : []).forEach((assignment) => {
    const department = String(assignment.department || '').trim();
    const quantity = Number(assignment.quantity || 0);
    if (!department || !Number.isFinite(quantity) || quantity <= 0) return;
    totals.set(department, (totals.get(department) || 0) + quantity);
  });
  return [...totals].map(([department, quantity]) => ({ department, quantity }));
}

function validateAmmunitionBatchAllocations(entries, expectedDepartments) {
  const expected = new Map(
    expectedDepartments.map((item) => [item.department, Number(item.quantity || 0)])
  );
  const actual = new Map();
  entries.forEach((entry) => {
    if (!expected.has(entry.department)) {
      throw new AppError(
        `Το Τμήμα «${entry.department}» δεν έχει χρεωμένη ποσότητα σε αυτή τη μερίδα.`,
        'VALIDATION_ERROR'
      );
    }
    actual.set(entry.department, (actual.get(entry.department) || 0) + entry.quantity);
  });
  expected.forEach((quantity, department) => {
    const assigned = actual.get(department) || 0;
    if (Math.abs(assigned - quantity) > 0.000001) {
      throw new AppError(
        `Οι Μερίδες Πυρκού για το Τμήμα «${department}» πρέπει να έχουν συνολική ποσότητα ${quantity}.`,
        'VALIDATION_ERROR'
      );
    }
  });
}

function buildDocumentChangeEntries(movements, compositionItems) {
  return movements.flatMap((movement) => {
    const snapshot = parseCompositionSnapshot(movement.composition_snapshot);
    return compositionItems.map((component, index) => {
      const snapshotComponent = snapshot[index];
      const snapshotQuantity = snapshotComponent
        ? Number(snapshotComponent.projectedQuantity || 0) -
          Number(snapshotComponent.notIssuedQuantity || 0)
        : NaN;
      const quantity = Number.isFinite(snapshotQuantity)
        ? snapshotQuantity
        : Number(component.quantityPerMaterial || 0) * Number(movement.quantity || 0);
      const movementType = movement.transaction_type === 'Πίστωση' ? 'ΠΙΣΤΩΣΗ' : 'ΧΡΕΩΣΗ';
      const prefix = movement.source_type === 'ΕΧΠ'
        ? 'ΕΧΠ'
        : movementType === 'ΠΙΣΤΩΣΗ' ? 'Π' : 'Χ';
      return {
        id: `document-${movement.transaction_id}-${index + 1}`,
        changeDate: movement.transaction_date,
        orderReference: `${prefix}-${movement.document_number}`,
        previousValue: '',
        newValue: '',
        changeReason: movement.source_type,
        notes: '',
        componentLineNumber: index + 1,
        movementType,
        quantity
      };
    }).filter((entry) => entry.quantity > 0);
  });
}

function parseCompositionSnapshot(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function readFiscalYearArchive(repository, year) {
  const row = repository.getFiscalYearArchive(year);
  if (!row) return null;
  try {
    return JSON.parse(row.archive_snapshot || '{}');
  } catch (_error) {
    return null;
  }
}

module.exports = {
  createSharesService,
  formatCardRegistryNumber
};

function formatCardRegistryNumber(reference, transactionType = '') {
  const value = String(reference || '').trim();
  const addyMatch = value.match(/^ΑΔΔΥ\s+(\d+)/iu);
  if (addyMatch) {
    const documentType = String(transactionType).trim() === 'Χρέωση' ? 'Χ' : 'Π';
    return `${documentType}-${addyMatch[1]}`;
  }
  const exhpMatch = value.match(/^ΕΧΠ\s+(\d+)/iu);
  if (exhpMatch) return `ΕΧΠ-${exhpMatch[1]}`;
  return value;
}

function createCardShare(share, transactionsWithBalance, beforeYearBalance) {
  const mapped = mapShare(share);
  const accountingBalance = transactionsWithBalance.length
    ? transactionsWithBalance[transactionsWithBalance.length - 1].balance
    : beforeYearBalance;
  const availableQuantity = Number(accountingBalance) - Number(mapped.chargedQuantity);
  const differenceQuantity = Number(mapped.chargedQuantity) - Number(accountingBalance);

  return {
    ...mapped,
    accountingBalance,
    availableQuantity,
    differenceQuantity,
    status: differenceQuantity > 0 ? 'Πλεόνασμα' : differenceQuantity < 0 ? 'Έλλειμμα' : 'Ισοσκελισμένο',
    statusTone: differenceQuantity > 0 ? 'surplus' : differenceQuantity < 0 ? 'deficit' : 'balanced',
    requiresChangeSheet: Boolean(mapped.requiresChangeSheet)
  };
}
