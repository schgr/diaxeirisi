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

      return {
        share: cardShare,
        year: Number(year),
        openingTransfer: {
          balance: Number(beforeYearBalance || 0),
          inventoryDate: openingInventory ? openingInventory.transaction_date : '',
          reference: openingInventory ? openingInventory.document_reference : ''
        },
        transactions: displayedTransactions,
        compositionItems: repository.listCompositionItems(shareId).map((row) => ({
          id: row.id,
          componentNominalNumber: row.component_nominal_number,
          componentDescription: row.component_description,
          measurementUnit: row.measurement_unit,
          projectedQuantity: Number(row.quantity) * Number(cardShare.accountingBalance || 0),
          quantityPerMaterial: Number(row.quantity),
          notIssuedQuantity: Number(row.not_issued_quantity || 0),
          quantity: Number(row.quantity),
          notes: row.notes
        })),
        changeSheetEntries: repository.listChangeSheetEntries(shareId).map((row) => ({
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
        })),
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
      return repository.listAmmunitionBatchShares().map((row) => ({
        share: mapShare(row),
        entries: repository.listAmmunitionBatches(row.id).map((entry) => ({
          position: Number(entry.position),
          batchNumber: entry.batch_number,
          quantity: Number(entry.quantity || 0),
          notes: entry.notes || ''
        }))
      }));
    },

    saveAmmunitionBatches(id, entries) {
      const shareId = requirePositiveId(id);
      const share = repository.getShare(shareId);
      if (!share || !share.requires_ammunition_batch_book) {
        throw new AppError('Η μερίδα δεν έχει ενεργοποιημένο το Βιβλίο Μερίδων Β.Φ.', 'VALIDATION_ERROR');
      }
      const cleanEntries = (Array.isArray(entries) ? entries : []).map((entry) => {
        const batchNumber = String(entry && entry.batchNumber || '').trim();
        const quantity = Number(entry && entry.quantity);
        if (!batchNumber) {
          throw new AppError('Η Μερίδα Πυρκού είναι υποχρεωτική.', 'VALIDATION_ERROR');
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
          throw new AppError('Η ποσότητα της Μερίδας Πυρκού πρέπει να είναι θετικός αριθμός.', 'VALIDATION_ERROR');
        }
        return {
          batchNumber,
          quantity,
          notes: String(entry && entry.notes || '').trim()
        };
      });
      repository.replaceAmmunitionBatches(shareId, cleanEntries);
      return { message: 'Οι μερίδες πυρκού αποθηκεύτηκαν.' };
    }
  };
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
