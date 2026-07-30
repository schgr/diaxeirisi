function createAddyService(dependencies) {
  const { repository, settingsService, validateAddy, requirePositiveId } = dependencies;
  const { mapExhpSupportTemplate, saveRegularExhpItem, saveToolCollectionTransfers, isToolCollectionReason, aggregateCompositionCharges, addChangeSheetCompositionCharges, compositionChargeKey, saveNominalNumberTransfer, buildCompositionSnapshot, readTransactionArchive, mapExhpDocumentSupport, collectMaterialTypes, addMaterialType, mapAddyDocumentItem, formatDate, normalize, isConsumableMaterial, compareShareNumbers } = dependencies.shared;

  return {
    saveAddy(payload) {
      const addy = validateAddy(payload);
      const addyFiscalYear = Number(addy.documentDate.slice(0, 4));
      if (repository.isFiscalYearClosed(addyFiscalYear)) {
        throw new Error(`Το οικονομικό έτος ${addyFiscalYear} έχει κλείσει και δεν δέχεται νέες κινήσεις.`);
      }
      addy.items.sort(compareShareNumbers);
      addy.justificationReference =
        addy.items.find((item) => item.transactionType === 'Χρέωση' && item.justificationReference)
          ?.justificationReference ||
        addy.justificationReference;
      let documentId;
      const documentItems = [];
      const serviceName = repository.getServiceName();
      const settings = settingsService ? settingsService.getSettings() : null;
      const financialOfficers = settings
        ? settings.financialOfficers
        : { ped: '', manager: '' };

      repository.transaction(() => {
        repository.ensureTransactionUnit(addy.transactionUnit);
        documentId = repository.createAddyDocument(addy);

        for (const item of addy.items) {
          let share = repository.findShareByNumber(item.shareNumber);
          const externalConsumableCharge =
            !share && item.transactionType === 'Χρέωση' && isConsumableMaterial(item.materialType);

          if (!share && !externalConsumableCharge) {
            if (item.transactionType === 'Πίστωση') {
              throw new Error('Το υπόλοιπο δεν επαρκεί για την πραγματοποίηση της δοσοληψίας.');
            }

            share = repository.createShare({
              shareNumber: item.shareNumber,
              nominalNumber: item.nominalNumber,
              description: item.description,
              materialType: item.materialType,
              measurementUnit: item.measurementUnit,
              accountingBalance: 0,
              chargedQuantity: 0
            });
          }

          if (share && item.transactionType === 'Πίστωση' && Number(item.quantity) > Number(share.accounting_balance || 0)) {
            throw new Error('Το υπόλοιπο δεν επαρκεί για την πραγματοποίηση της δοσοληψίας.');
          }

          let transactionId = null;
          let ledgerSerial = '';
          if (share) {
            const quantityDelta = item.transactionType === 'Χρέωση' ? item.quantity : -item.quantity;
            repository.adjustAccountingBalance(share.id, quantityDelta);
            transactionId = repository.createShareTransaction({
              shareId: share.id,
              transactionDate: addy.documentDate,
              transactionUnit: addy.transactionUnit,
              transactionType: item.transactionType,
              documentReference: `ΑΔΔΥ ${documentId} / ${formatDate(addy.documentDate)}`,
              quantity: item.quantity,
              notes: addy.notes
            });
            ledgerSerial = repository.getShareTransactionSerialForYear(
              share.id,
              transactionId,
              addy.documentDate
            );
          }
          const savedItem = share
            ? {
                ...item,
                composition: item.composition && item.composition.length
                  ? item.composition
                  : buildCompositionSnapshot(repository, share.id, item.quantity)
              }
            : item;
          repository.createAddyItem(documentId, savedItem, share?.id || null, transactionId);
          documentItems.push(
            mapAddyDocumentItem({
              item: savedItem,
              share: share || { share_number: item.shareNumber, description: item.description },
              ledgerSerial,
              transactionUnit: addy.transactionUnit,
              serviceName
            })
          );
          documentItems[documentItems.length - 1].composition = savedItem.composition || [];
        }
      });

      return {
        documentId,
        document: {
          id: documentId,
          documentDate: addy.documentDate,
          transactionUnit: addy.transactionUnit,
          serviceName,
          financialOfficers,
          notes: addy.notes,
          items: documentItems
        },
        message: `Το ΑΔΔΥ ${documentId} αποθηκεύτηκε.`
      };
    },

    listAddyDocuments() {
      return repository.listAddyDocuments().map((row) => ({
        id: row.id,
        documentDate: row.document_date,
        transactionUnit: row.transaction_unit,
        transactionType: row.transaction_type || '',
        nominalNumber: row.nominal_number || '',
        description: row.description || '',
        quantity: Number(row.total_quantity || 0),
        canPrint: row.transaction_type === 'Πίστωση' || (row.transaction_type === 'Χρέωση' && normalize(row.transaction_unit) === 'εμπόριο')
      }));
    },

    updateAddyDocument(idValue, payload = {}) {
      const id = requirePositiveId(idValue);
      const document = repository.getAddyDocument(id);
      if (!document) throw new Error('Το ΑΔΔΥ δεν βρέθηκε.');
      const items = repository.listAddyDocumentItems(id);
      const quantities = Array.isArray(payload.items) ? payload.items : [];
      const quantityById = new Map(
        quantities.map((item) => [Number(item.id), Number(item.quantity)])
      );
      const notes = String(payload.notes || '').trim();

      repository.transaction(() => {
        for (const item of items) {
          if (!quantityById.has(Number(item.id))) continue;
          const nextQuantity = quantityById.get(Number(item.id));
          if (!Number.isFinite(nextQuantity) || nextQuantity <= 0) {
            throw new Error('Η ποσότητα κάθε υλικού πρέπει να είναι μεγαλύτερη από μηδέν.');
          }
          const difference = nextQuantity - Number(item.quantity);
          if (!difference) continue;
          if (item.share_id) {
            const balanceDelta = item.transaction_type === 'Χρέωση'
              ? difference
              : -difference;
            const share = repository.getShareById(item.share_id);
            if (!share || Number(share.accounting_balance) + balanceDelta < 0) {
              throw new Error(
                `Το διαθέσιμο υπόλοιπο της μερίδας ${item.share_number} δεν επαρκεί για την αλλαγή.`
              );
            }
            repository.adjustAccountingBalance(item.share_id, balanceDelta);
          }
          repository.updateAddyItemQuantity(item.id, item.share_transaction_id, nextQuantity);
        }
        repository.updateAddyDocumentNotes(id, notes);
      });

      return {
        document: this.getAddyDocument(id),
        message: `Το ΑΔΔΥ ${id} ενημερώθηκε.`
      };
    },

    deleteAddyDocument(idValue) {
      const id = requirePositiveId(idValue);
      const document = repository.getAddyDocument(id);
      if (!document) throw new Error('Το ΑΔΔΥ δεν βρέθηκε.');
      const items = repository.listAddyDocumentItems(id);
      const transactionIds = items
        .map((item) => Number(item.share_transaction_id))
        .filter(Number.isInteger);

      repository.transaction(() => {
        for (const item of items) {
          if (!item.share_id) continue;
          const balanceDelta = item.transaction_type === 'Χρέωση'
            ? -Number(item.quantity)
            : Number(item.quantity);
          const share = repository.getShareById(item.share_id);
          if (!share || Number(share.accounting_balance) + balanceDelta < 0) {
            throw new Error(
              `Η μερίδα ${item.share_number} έχει μεταγενέστερες κινήσεις και το ΑΔΔΥ δεν μπορεί να διαγραφεί.`
            );
          }
          repository.adjustAccountingBalance(item.share_id, balanceDelta);
        }
        repository.deleteAddyDocument(id);
        repository.deleteShareTransactions(transactionIds);
      });

      return {
        message: `Το ΑΔΔΥ ${id} διαγράφηκε από το Ευρετήριο και τις κινήσεις των μερίδων.`
      };
    },

    getAddyDocument(id) {
      const row = repository.getAddyDocument(id);
      if (!row) {
        throw new Error('Το ΑΔΔΥ δεν βρέθηκε.');
      }

      const settings = settingsService ? settingsService.getSettings() : null;
      const financialOfficers = settings
        ? settings.financialOfficers
        : { ped: '', manager: '' };
      const serviceName = repository.getServiceName();
      const items = repository.listAddyDocumentItems(id).map((item) => {
        let composition = [];
        try {
          composition = JSON.parse(item.composition_snapshot || '[]');
        } catch (_error) {
          composition = [];
        }
        const linkedTransaction = item.share_transaction_id
          ? { id: item.share_transaction_id }
          : repository.findAddyShareTransaction(
              item.share_id,
              row.id,
              row.document_date,
              item.transaction_type,
              item.quantity
            );
        const ledgerSerial = linkedTransaction
          ? repository.getShareTransactionSerialForYear(
              item.share_id,
              linkedTransaction.id,
              row.document_date
            )
          : '';
        return {
          id: item.id,
          shareNumber: item.share_number,
          nominalNumber: item.nominal_number,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: item.unit_price,
          measurementUnit: item.measurement_unit,
          transactionType: item.transaction_type,
          transactionUnit: row.transaction_unit,
          materialType: item.material_type,
          ledgerSerial,
          composition
        };
      });

      return {
        id: row.id,
        documentDate: row.document_date,
        transactionUnit: row.transaction_unit,
        serviceName,
        financialOfficers,
        notes: row.notes,
        items: items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          ...mapAddyDocumentItem({
            item,
            share: { share_number: item.shareNumber, description: item.description },
            ledgerSerial: item.ledgerSerial,
            transactionUnit: row.transaction_unit,
            serviceName
          }),
          composition: item.composition
        }))
      };
    }
  };
}

module.exports = { createAddyService };
