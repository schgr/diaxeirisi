const { AppError } = require('../../core/errorHandler');

function createAddyService(dependencies) {
  const { repository, settingsService, validateAddy, requirePositiveId } = dependencies;
  const { mapExhpSupportTemplate, saveRegularExhpItem, saveToolCollectionTransfers, isToolCollectionReason, aggregateCompositionCharges, addChangeSheetCompositionCharges, compositionChargeKey, saveNominalNumberTransfer, buildCompositionSnapshot, readTransactionArchive, mapExhpDocumentSupport, collectMaterialTypes, addMaterialType, mapAddyDocumentItem, formatAddyDate, normalize, isConsumableMaterial, isNonScalingCompositionMaterial, compareShareNumbers } = dependencies.shared;

  return {
    saveAddy(payload) {
      const addy = validateAddy(payload);
      if (
        normalize(addy.transactionUnit) === 'εμποριο' &&
        (!addy.invoiceNumber || !addy.invoiceDate || !addy.commerceCompanyId)
      ) {
        throw new AppError(
          'Για ΑΔΔΥ Εμπορίου απαιτούνται Αριθμός Τιμολογίου, Ημερομηνία Τιμολογίου και Επιχείρηση.',
          'ADDY_COMMERCE_INVOICE_REQUIRED'
        );
      }
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
      const commerceCompany = addy.commerceCompanyId
        ? repository.listCommerceCompanies()
          .find((company) => Number(company.id) === Number(addy.commerceCompanyId)) || null
        : null;

      repository.transaction(() => {
        repository.ensureTransactionUnit(addy.transactionUnit);
        documentId = repository.createAddyDocument(addy);

        for (const item of addy.items) {
          let share = repository.findShareByNumber(item.shareNumber);

          if (!share) {
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
              chargedQuantity: 0,
              excludeFromInventory: isConsumableMaterial(item.materialType)
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
              documentReference: `ΑΔΔΥ ${documentId} / ${formatAddyDate(addy.documentDate)}`,
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
                  : buildCompositionSnapshot(repository, share.id, item.quantity, share.material_type)
              }
            : item;
          const addyItemId = repository.createAddyItem(documentId, savedItem, share?.id || null, transactionId);
          documentItems.push(
            mapAddyDocumentItem({
              item: savedItem,
              share: share || { share_number: item.shareNumber, description: item.description },
              ledgerSerial,
              transactionUnit: addy.transactionUnit,
              serviceName
            })
          );
          documentItems[documentItems.length - 1].addyItemId = Number(addyItemId);
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
          invoiceNumber: addy.invoiceNumber,
          invoiceDate: addy.invoiceDate,
          commerceCompanyId: addy.commerceCompanyId,
          commerceCompany,
          items: documentItems
        },
        message: `Το ΑΔΔΥ ${documentId} αποθηκεύτηκε.`
      };
    },

    saveAddyDepartmentAllocations(idValue, payload = {}) {
      const documentId = requirePositiveId(idValue);
      const document = repository.getAddyDocument(documentId);
      if (!document) throw new Error('Το ΑΔΔΥ δεν βρέθηκε.');
      const fiscalYear = Number(document.document_date.slice(0, 4));
      if (repository.isFiscalYearClosed(fiscalYear)) {
        throw new Error(`Το οικονομικό έτος ${fiscalYear} έχει κλείσει και δεν δέχεται νέες κινήσεις.`);
      }
      const savedItems = new Map(repository.listAddyDocumentItems(documentId)
        .map((item) => [Number(item.id), item]));
      const entries = Array.isArray(payload.entries) ? payload.entries : [];

      repository.transaction(() => {
        for (const entry of entries) {
          const item = savedItems.get(requirePositiveId(entry.addyItemId));
          if (!item) throw new Error('Το υλικό του ΑΔΔΥ δεν βρέθηκε.');
          const allocations = Array.isArray(entry.allocations) ? entry.allocations : [];
          const total = allocations.reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0);
          if (!allocations.length || Math.abs(total - Number(item.quantity)) >= 0.000001) {
            throw new Error('Η κατανομή στα τμήματα δεν συμφωνεί με την ποσότητα του ΑΔΔΥ.');
          }
          const share = repository.findShareByNumber(item.current_share_number || item.share_number);
          if (!share) throw new Error('Η μερίδα του ΑΔΔΥ δεν βρέθηκε.');
          const movementType = item.transaction_type === 'Χρέωση' ? 'Χορήγηση' : 'Επιστροφή';

          for (const allocation of allocations) {
            const departmentId = requirePositiveId(allocation.departmentManagerId);
            const quantity = Number(allocation.quantity);
            if (!Number.isFinite(quantity) || quantity <= 0) {
              throw new Error('Η κατανομή στα τμήματα περιέχει μη έγκυρη ποσότητα.');
            }
            const department = repository.listDepartmentManagers()
              .find((candidate) => Number(candidate.id) === departmentId);
            if (!department) throw new Error('Το επιλεγμένο τμήμα δεν βρέθηκε.');
            const departmentBalance = repository.getDepartmentShareBalance(department.id, share.id);
            if (movementType === 'Επιστροφή' && quantity - departmentBalance > 0.000001) {
              throw new Error(`Το τμήμα ${department.department_name} δεν έχει επαρκή χρεωμένη ποσότητα.`);
            }
            const internalDocumentId = repository.createInternalDocument({
              fiscalYear,
              serialNumber: repository.getNextInternalSerial(fiscalYear),
              documentDate: document.document_date,
              departmentManagerId: department.id,
              departmentName: department.department_name,
              departmentHead: department.department_head,
              movementType,
              notes: `ΑΔΔΥ ${documentId}`
            });
            repository.createInternalItem(internalDocumentId, {
              shareId: share.id,
              shareNumber: share.share_number,
              nominalNumber: share.nominal_number,
              description: share.description,
              measurementUnit: share.measurement_unit,
              quantity,
              composition: buildCompositionSnapshot(repository, share.id, quantity, share.material_type)
                .map((component) => ({
                  componentNominalNumber: component.componentNominalNumber,
                  componentDescription: component.componentDescription,
                  measurementUnit: component.measurementUnit,
                  quantity: component.projectedQuantity - component.notIssuedQuantity
                }))
            });
            repository.adjustChargedQuantity(share.id, movementType === 'Χορήγηση' ? quantity : -quantity);
          }
        }
      });
      return { message: 'Οι χρεώσεις και πιστώσεις των τμημάτων αποθηκεύτηκαν.' };
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
        invoiceNumber: row.invoice_number || '',
        invoiceDate: row.invoice_date || '',
        commerceCompanyId: row.commerce_company_id == null ? null : Number(row.commerce_company_id),
        commerceCompany: row.commerce_company_id == null ? null : {
          id: Number(row.commerce_company_id),
          name: row.commerce_company_name || '',
          taxNumber: row.commerce_company_tax_number || '',
          address: row.commerce_company_address || ''
        },
        canPrint: row.transaction_type === 'Πίστωση' || (row.transaction_type === 'Χρέωση' && normalize(row.transaction_unit) === 'εμποριο')
      }));
    },

    updateAddyDocument(idValue, payload = {}) {
      const id = requirePositiveId(idValue);
      const document = repository.getAddyDocument(id);
      if (!document) throw new Error('Το ΑΔΔΥ δεν βρέθηκε.');
      const currentFiscalYear = Number(document.document_date.slice(0, 4));
      if (repository.isFiscalYearClosed(currentFiscalYear)) {
        throw new Error(`Το οικονομικό έτος ${currentFiscalYear} έχει κλείσει και το ΑΔΔΥ δεν μπορεί να τροποποιηθεί.`);
      }
      const items = repository.listAddyDocumentItems(id);
      const quantities = Array.isArray(payload.items) ? payload.items : [];
      const quantityById = new Map(
        quantities.map((item) => [Number(item.id), Number(item.quantity)])
      );
      const removedItemIds = new Set(
        (Array.isArray(payload.removedItemIds) ? payload.removedItemIds : []).map(Number)
      );
      if (removedItemIds.size >= items.length) {
        throw new Error('Το ΑΔΔΥ πρέπει να περιέχει τουλάχιστον ένα υλικό.');
      }
      const notes = String(payload.notes || '').trim();
      const newId = payload.id ? requirePositiveId(payload.id) : id;
      const newDate = payload.documentDate || document.document_date;

      repository.transaction(() => {
        for (const item of items) {
          if (removedItemIds.has(Number(item.id))) {
            const balanceDelta = item.transaction_type === 'Χρέωση'
              ? -Number(item.quantity)
              : Number(item.quantity);
            if (item.share_id) {
              const share = repository.getShareById(item.share_id);
              if (!share || Number(share.accounting_balance) + balanceDelta < 0) {
                throw new Error(`Η μερίδα ${item.share_number} έχει μεταγενέστερες κινήσεις και το υλικό δεν μπορεί να διαγραφεί.`);
              }
              repository.adjustAccountingBalance(item.share_id, balanceDelta);
            }
            repository.deleteAddyItem(item.id);
            if (item.share_transaction_id) repository.deleteShareTransactions([item.share_transaction_id]);
            continue;
          }
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
        if (newId !== id || newDate !== document.document_date) {
          repository.updateAddyDocumentIdAndDate(id, newId, newDate);
        }
      });

      return {
        document: this.getAddyDocument(newId),
        message: `Το ΑΔΔΥ ${newId} ενημερώθηκε.`
      };
    },

    deleteAddyDocument(idValue) {
      const id = requirePositiveId(idValue);
      const document = repository.getAddyDocument(id);
      if (!document) throw new Error('Το ΑΔΔΥ δεν βρέθηκε.');
      const currentFiscalYear = Number(document.document_date.slice(0, 4));
      if (repository.isFiscalYearClosed(currentFiscalYear)) {
        throw new Error(`Το οικονομικό έτος ${currentFiscalYear} έχει κλείσει και το ΑΔΔΥ δεν μπορεί να διαγραφεί.`);
      }
      const items = repository.listAddyDocumentItems(id);
      const transactionIds = items
        .map((item) => item.existing_share_transaction_id)
        .filter((transactionId) => transactionId != null)
        .map(Number)
        .filter(Number.isInteger);

      repository.transaction(() => {
        for (const item of items) {
          if (!item.share_id || item.existing_share_transaction_id == null) continue;
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

      const affectedShares = [...new Set(
        items.filter((item) => item.share_id).map((item) => Number(item.share_id))
      )].map((shareId) => repository.getShareById(shareId)).filter(Boolean);

      return {
        affectedShares: affectedShares.map((share) => ({
          id: Number(share.id),
          accountingBalance: Number(share.accounting_balance || 0),
          chargedQuantity: Number(share.charged_quantity || 0)
        })),
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
        invoiceNumber: row.invoice_number || '',
        invoiceDate: row.invoice_date || '',
        commerceCompanyId: row.commerce_company_id == null ? null : Number(row.commerce_company_id),
        commerceCompany: row.commerce_company_id == null ? null : {
          id: Number(row.commerce_company_id),
          name: row.commerce_company_name || '',
          taxNumber: row.commerce_company_tax_number || '',
          address: row.commerce_company_address || ''
        },
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
