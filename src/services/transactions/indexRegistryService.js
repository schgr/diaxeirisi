function createIndexRegistryService(dependencies) {
  const { repository, requirePositiveId } = dependencies;
  const { mapExhpSupportTemplate, saveRegularExhpItem, saveToolCollectionTransfers, isToolCollectionReason, aggregateCompositionCharges, addChangeSheetCompositionCharges, compositionChargeKey, saveNominalNumberTransfer, buildCompositionSnapshot, readTransactionArchive, mapExhpDocumentSupport, collectMaterialTypes, addMaterialType, mapAddyDocumentItem, formatDate, normalize, isConsumableMaterial, compareShareNumbers } = dependencies.shared;

  return {
    updateExhpIndexFields(documentId, payload) {
      const id = requirePositiveId(documentId);
      const document = repository.getExhpDocument(id);
      if (!document) throw new Error('Η ΕΧΠ δεν βρέθηκε.');
      repository.updateExhpIndexFields(
        id,
        String((payload && payload.field6) || '').trim(),
        String((payload && payload.field7) || '').trim()
      );
      return {
        message: `Το ευρετήριο για την ΕΧΠ ${document.registry_number}/${document.fiscal_year} ενημερώθηκε.`
      };
    },

    updateAddyIndexFields(documentId, payload) {
      const id = requirePositiveId(documentId);
      const document = repository.getAddyDocument(id);
      if (!document) throw new Error('Το ΑΔΔΥ δεν βρέθηκε.');
      repository.updateAddyIndexFields(
        id,
        String((payload && payload.field7) || '').trim(),
        String((payload && payload.field8) || '').trim(),
        String((payload && payload.field9) || '').trim()
      );
      return { message: `Το ευρετήριο για το ΑΔΔΥ ${document.id} ενημερώθηκε.` };
    },

    listExhpIndexRows(year = new Date().getFullYear()) {
      const fiscalYear = Number(year) || new Date().getFullYear();
      const archivedYear = readTransactionArchive(repository, fiscalYear);
      if (archivedYear) return archivedYear.exhpIndexRows || [];
      return repository.listExhpIndexRows(fiscalYear).map((row) => ({
        id: row.id,
        fiscalYear: row.fiscal_year,
        serial: row.registry_number,
        date: row.document_date,
        reason: row.issue_reason,
        indexField6: row.index_field_6,
        indexField7: row.index_field_7,
        status: row.status,
      }));
    },

    listFinancialYearMovementRows(source, year = new Date().getFullYear(), transactionType = 'Πίστωση') {
      const normalizedSource = String(source || '').toLowerCase();
      if (!['addy', 'exhp'].includes(normalizedSource)) {
        throw new Error('Η κατηγορία κινήσεων δεν είναι έγκυρη.');
      }
      const fiscalYear = Number(year);
      if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
        throw new Error('Το οικονομικό έτος δεν είναι έγκυρο.');
      }
      if (!['Χρέωση', 'Πίστωση'].includes(transactionType)) {
        throw new Error('Το είδος δοσοληψίας πρέπει να είναι Χρέωση ή Πίστωση.');
      }
      const archivedYear = readTransactionArchive(repository, fiscalYear);
      if (archivedYear) {
        const movementKey = transactionType === 'Χρέωση' ? 'charge' : 'credit';
        return archivedYear.financialMovements?.[normalizedSource]?.[movementKey] || [];
      }

      const rows = normalizedSource === 'addy'
        ? repository.listAddyFinancialYearMovementRows(fiscalYear, transactionType)
        : repository.listExhpFinancialYearMovementRows(fiscalYear, transactionType);

      return rows.map((row, index) => {
        const linkedTransaction = row.share_transaction_id
          ? { id: row.share_transaction_id }
          : normalizedSource === 'addy'
            ? repository.findAddyShareTransaction(
                row.share_id,
                row.document_id,
                row.document_date,
                row.transaction_type,
                row.quantity
              )
            : repository.findExhpShareTransaction(
                row.share_id,
                row.registry_number,
                row.fiscal_year,
                row.transaction_type,
                row.quantity
              );
        return {
          serial: index + 1,
          registryNumber: row.registry_number,
          shareNumber: row.share_number,
          ledgerSerial: linkedTransaction
            ? repository.getShareTransactionSerialForYear(
                row.share_id,
                linkedTransaction.id,
                row.document_date
              )
            : '',
          description: row.description,
          transactionKind: row.transaction_type === 'Πίστωση' ? 'Π' : 'Χ',
          date: row.document_date,
          quantity: Number(row.quantity || 0),
          ...(normalizedSource === 'addy' ? { transactionUnit: row.transaction_unit } : {})
        };
      });
    },

    listExternalTransactionIndexRows(year = new Date().getFullYear()) {
      const fiscalYear = Number(year) || new Date().getFullYear();
      const archivedYear = readTransactionArchive(repository, fiscalYear);
      if (archivedYear) return archivedYear.externalIndexRows || [];
      const serialByDocument = new Map();
      let nextSerial = 1;
      return repository.listExternalTransactionIndexRows(fiscalYear).map((row) => {
        if (!serialByDocument.has(row.document_id)) {
          serialByDocument.set(row.document_id, nextSerial);
          nextSerial += 1;
        }
        return {
          id: row.document_id,
          itemId: row.item_id,
          serial: serialByDocument.get(row.document_id),
          date: row.document_date,
          unit: row.transaction_unit,
          documentType: row.transaction_type === 'Χρέωση' ? 'Χ' : 'Π',
          nominalNumber: row.nominal_number || '',
          documentReference: row.transaction_type === 'Χρέωση'
            ? row.justification_reference || ''
            : `Π-${row.document_id} / ${formatDate(row.document_date)}`,
          movementDate: row.document_date,
          returnDate: '',
          indexField7: row.index_field_7,
          indexField8: row.index_field_8,
          indexField9: row.index_field_9,
          notes: row.description || row.notes || ''
        };
      });
    }
  };
}

module.exports = { createIndexRegistryService };
