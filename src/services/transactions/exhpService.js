function createExhpService(dependencies) {
  const { repository, settingsService, validateExhp, isNominalNumberTransferReason, requirePositiveId } = dependencies;
  const { mapExhpSupportTemplate, saveRegularExhpItem, saveToolCollectionTransfers, isToolCollectionReason, aggregateCompositionCharges, addChangeSheetCompositionCharges, compositionChargeKey, saveNominalNumberTransfer, buildCompositionSnapshot, readTransactionArchive, mapExhpDocumentSupport, collectMaterialTypes, addMaterialType, mapAddyDocumentItem, formatDate, normalize, isConsumableMaterial, isNonScalingCompositionMaterial, compareShareNumbers } = dependencies.shared;

  return {
    saveExhp(payload) {
      const exhp = validateExhp(payload);
      if (repository.isFiscalYearClosed(exhp.fiscalYear)) {
        throw new Error(`Το οικονομικό έτος ${exhp.fiscalYear} έχει κλείσει και δεν δέχεται νέες κινήσεις.`);
      }
      exhp.items.sort(compareShareNumbers);
      let documentId;
      let registryNumber;
      const documentItems = [];

      repository.transaction(() => {
        registryNumber = repository.getNextExhpRegistryNumber(exhp.fiscalYear);
        documentId = repository.createExhpDocument({
          ...exhp,
          registryNumber
        });

        if (isNominalNumberTransferReason(exhp.issueReason)) {
          saveNominalNumberTransfer(repository, exhp, documentId, registryNumber, documentItems);
        } else if (isToolCollectionReason(exhp.issueReason)) {
          saveToolCollectionTransfers(repository, exhp, documentId, registryNumber, documentItems);
        } else {
          for (const item of exhp.items) {
            saveRegularExhpItem(repository, exhp, documentId, registryNumber, item, documentItems);
          }
        }
        repository.createExhpDocumentSupports(documentId, exhp.issueReason, exhp.supports);
        repository.refreshExhpSupportStatus(documentId);
      });

      return {
        documentId,
        registryNumber,
        document: {
          id: documentId,
          registryNumber,
          date: exhp.documentDate,
          unit: exhp.serviceUnit,
          reason: exhp.issueReason,
          approvalReference: exhp.approvalReference,
          otherSupportDocument: exhp.otherSupportDocument,
          notes: exhp.notes,
          managementType: settingsService
            ? settingsService.getSettings().serviceInfo.managementType
            : '',
          financialOfficers: settingsService
            ? settingsService.getSettings().financialOfficers
            : { commander: '', ped: '', manager: '' },
          reasonTexts: (() => {
            const settings = settingsService ? settingsService.getSettings() : null;
            const reason = settings
              ? settings.exhpIssueReasons.find((item) => item.name === exhp.issueReason)
              : null;
            return reason
              ? {
                  recommendation: reason.recommendationText,
                  firstOpinion: reason.firstOpinionText,
                  secondOpinion: reason.secondOpinionText
                }
              : { recommendation: '', firstOpinion: '', secondOpinion: '' };
          })(),
          supports: repository.listExhpDocumentSupports(documentId).map(mapExhpDocumentSupport),
          items: documentItems
        },
        message: `Η ΕΧΠ ${registryNumber}/${exhp.fiscalYear} αποθηκεύτηκε.`
      };
    },

    saveExhpDepartmentAllocations(idValue, payload = {}) {
      const documentId = requirePositiveId(idValue);
      const document = repository.getExhpDocument(documentId);
      if (!document) throw new Error('Η ΕΧΠ δεν βρέθηκε.');
      const fiscalYear = Number(document.document_date.slice(0, 4));
      if (repository.isFiscalYearClosed(fiscalYear)) {
        throw new Error(`Το οικονομικό έτος ${fiscalYear} έχει κλείσει και δεν δέχεται νέες κινήσεις.`);
      }
      const items = new Map(repository.listExhpDocumentItems(documentId)
        .map((item) => [Number(item.id), item]));
      const entries = Array.isArray(payload.entries) ? payload.entries : [];

      repository.transaction(() => {
        for (const entry of entries) {
          const item = items.get(requirePositiveId(entry.exhpItemId));
          if (!item) throw new Error('Το υλικό της ΕΧΠ δεν βρέθηκε.');
          const allocations = Array.isArray(entry.allocations) ? entry.allocations : [];
          const total = allocations.reduce((sum, allocation) => sum + Number(allocation.quantity || 0), 0);
          if (!allocations.length || Math.abs(total - Number(item.quantity)) >= 0.000001) {
            throw new Error('Η κατανομή στα τμήματα δεν συμφωνεί με την ποσότητα της ΕΧΠ.');
          }
          const share = repository.getShareById(item.share_id);
          if (!share) throw new Error('Η μερίδα της ΕΧΠ δεν βρέθηκε.');
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
            if (movementType === 'Επιστροφή'
              && quantity - repository.getDepartmentShareBalance(department.id, share.id) > 0.000001) {
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
              notes: `ΕΧΠ ${document.registry_number}/${fiscalYear}`
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
      return { message: 'Οι χρεώσεις και επιστροφές των τμημάτων αποθηκεύτηκαν.' };
    },

    listExhpDocuments() {
      return repository.listExhpDocuments().map((row) => ({
        id: row.id,
        fiscalYear: row.fiscal_year,
        registryNumber: row.registry_number,
        documentDate: row.document_date,
        serviceUnit: row.service_unit,
        issueReason: row.issue_reason,
        approvalReference: row.approval_reference,
        status: row.status,
        supportStatus: row.support_status
      }));
    },

    getExhpDocument(id) {
      const row = repository.getExhpDocument(id);
      if (!row) {
        throw new Error('Η ΕΧΠ δεν βρέθηκε.');
      }

      const attachments = repository.listExhpMaterialAttachments(id);
      const isToolCollection = normalize(row.issue_reason).startsWith(
        normalize('Συλλογές Εργαλείων')
      );
      const settings = settingsService ? settingsService.getSettings() : null;
      const reasonSettings = settings
        ? settings.exhpIssueReasons.find((item) => item.name === row.issue_reason)
        : null;
      return {
        id: row.id,
        registryNumber: row.registry_number,
        date: row.document_date,
        unit: row.service_unit,
        reason: row.issue_reason,
        approvalReference: row.approval_reference,
        notes: row.notes,
        managementType: settings ? settings.serviceInfo.managementType : '',
        supportStatus: row.support_status,
        otherSupportDocument: row.other_support_document || '',
        financialOfficers: settings
          ? settings.financialOfficers
          : { commander: '', ped: '', manager: '' },
        reasonTexts: reasonSettings
          ? {
              recommendation: reasonSettings.recommendationText,
              firstOpinion: reasonSettings.firstOpinionText,
              secondOpinion: reasonSettings.secondOpinionText
            }
          : { recommendation: '', firstOpinion: '', secondOpinion: '' },
        supports: repository.listExhpDocumentSupports(id).map(mapExhpDocumentSupport),
        officialSupportDocuments: repository.listExhpOfficialSupportDocuments(id).map((document) => ({
          id: document.id,
          documentType: document.document_type
        })),
        materialAttachments: {
          composition: (isToolCollection ? attachments.composition : []).map((item) => ({
            shareNumber: item.share_number,
            parentDescription: item.parent_description,
            componentNominalNumber: item.component_nominal_number,
            componentDescription: item.component_description,
            measurementUnit: item.measurement_unit,
            quantity: Number(item.quantity),
            notes: item.notes
          })),
          changes: (isToolCollection ? attachments.changes : []).map((item) => ({
            shareNumber: item.share_number,
            parentDescription: item.parent_description,
            changeDate: item.change_date,
            orderReference: item.order_reference,
            previousValue: item.previous_value,
            newValue: item.new_value,
            changeReason: item.change_reason,
            notes: item.notes,
            componentLineNumber: Number(item.component_line_number || 1),
            movementType: item.movement_type || 'ΧΡΕΩΣΗ',
            quantity: Number(item.quantity || 0)
          }))
        },
        items: repository.listExhpDocumentItems(id).map((item) => {
          const ledgerSerial = item.share_transaction_id
            ? repository.getShareTransactionSerialForYear(
                item.share_id,
                item.share_transaction_id,
                row.document_date
              )
            : (isToolCollectionReason(row.issue_reason) && (
              Number(item.quantity) === 0 || item.transaction_type === 'Πίστωση'
            ) ? 'Φ.Μ.' : '');
          return {
            id: item.id,
            shareNumber: item.share_number,
            nominalNumber: item.nominal_number,
            description: item.description,
            measurementUnit: item.measurement_unit,
            materialType: item.material_type,
            materialCode: item.material_code,
            transactionType: item.transaction_type,
            quantity: Number(item.quantity),
            supportingDocuments: item.supporting_documents,
            ledgerSerial
          };
        })
      };
    },

    updateExhpMetadata(documentId, payload) {
      const id = requirePositiveId(documentId);
      const document = repository.getExhpDocument(id);
      if (!document) throw new Error('Η ΕΧΠ δεν βρέθηκε.');
      const registryNumber = Number(payload && payload.registryNumber);
      if (!Number.isInteger(registryNumber) || registryNumber <= 0) {
        throw new Error('Ο αριθμός ΕΧΠ πρέπει να είναι θετικός ακέραιος.');
      }
      const documentDate = String((payload && payload.documentDate) || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(documentDate)) {
        throw new Error('Η ημερομηνία ΕΧΠ δεν είναι έγκυρη.');
      }
      const fiscalYear = Number(documentDate.slice(0, 4));
      const requestedItems = Array.isArray(payload && payload.items) ? payload.items : [];
      const storedItems = repository.listExhpDocumentItems(id);
      const storedItemsById = new Map(storedItems.map((item) => [Number(item.id), item]));
      const requestedItemIds = new Set();
      const quantityUpdates = requestedItems.map((item) => {
        const itemId = Number(item.id);
        if (requestedItemIds.has(itemId)) throw new Error('Το ίδιο υλικό εμφανίζεται περισσότερες από μία φορές.');
        requestedItemIds.add(itemId);
        const stored = storedItemsById.get(itemId);
        if (!stored) throw new Error('Ένα από τα υλικά της ΕΧΠ δεν βρέθηκε.');
        const quantity = Number(item.quantity);
        const minimum = stored.share_transaction_id ? Number.EPSILON : 0;
        if (!Number.isFinite(quantity) || quantity < minimum) {
          throw new Error('Οι ποσότητες της ΕΧΠ πρέπει να είναι έγκυροι θετικοί αριθμοί.');
        }
        return { stored, quantity };
      });
      repository.transaction(() => {
        quantityUpdates.forEach(({ stored, quantity }) => {
          const previousQuantity = Number(stored.quantity);
          const difference = quantity - previousQuantity;
          if (stored.share_transaction_id && Math.abs(difference) > 0.000001) {
            const share = repository.getShareById(stored.share_id);
            const direction = stored.transaction_type === 'Χρέωση' ? 1 : -1;
            const balanceChange = direction * difference;
            const nextBalance = Number(share.accounting_balance || 0) + balanceChange;
            if (nextBalance < -0.000001) {
              throw new Error(`Το υπόλοιπο της μερίδας ${stored.share_number} δεν επαρκεί για τη νέα ποσότητα.`);
            }
            repository.adjustAccountingBalance(stored.share_id, balanceChange);
          }
          repository.updateExhpItemQuantity(
            stored.id,
            stored.share_transaction_id,
            quantity
          );
        });
        repository.updateExhpMetadata(id, {
          fiscalYear,
          registryNumber,
          documentDate
        });
      });
      return {
        message: `Η ΕΧΠ ${registryNumber}/${fiscalYear}, τα υλικά και οι συνδεδεμένες κινήσεις ενημερώθηκαν.`,
        document: this.getExhpDocument(id)
      };
    },

    deleteExhpDocument(documentId) {
      const id = requirePositiveId(documentId);
      const document = repository.getExhpDocument(id);
      if (!document) throw new Error('Η ΕΧΠ δεν βρέθηκε.');
      const items = repository.listExhpDocumentItems(id);
      const transactionIds = items
        .map((item) => Number(item.share_transaction_id))
        .filter(Number.isInteger);
      const documentReference = `ΕΧΠ ${document.registry_number}/${document.fiscal_year}`;
      const nominalTransfer = normalize(document.issue_reason).startsWith(
        normalize('Μεταβολή Υλικών Λόγω Αλλαγής Του Αριθμού Ονομαστικού')
      );

      repository.transaction(() => {
        const credits = nominalTransfer
          ? items.filter((item) => item.transaction_type === 'Πίστωση')
          : [];
        const charges = nominalTransfer
          ? items.filter((item) => item.transaction_type === 'Χρέωση')
          : [];
        if (nominalTransfer && credits.length !== charges.length) {
          throw new Error('Η ΕΧΠ μεταβολής αριθμού δεν μπορεί να επαναφερθεί με ασφάλεια.');
        }
        charges.forEach((charge) => {
          if (repository.countShareTransactionsExcluding(charge.share_id, transactionIds) > 0) {
            throw new Error(
              `Η νέα μερίδα ${charge.share_number} έχει μεταγενέστερες κινήσεις και η ΕΧΠ δεν μπορεί να διαγραφεί.`
            );
          }
        });

        items.filter((item) => item.share_transaction_id).forEach((item) => {
          const reverseDelta = item.transaction_type === 'Χρέωση'
            ? -Number(item.quantity)
            : Number(item.quantity);
          repository.adjustAccountingBalance(item.share_id, reverseDelta);
        });
        repository.deleteExhpDocument(id);
        repository.deleteShareTransactions(transactionIds);
        if (nominalTransfer) {
          credits.forEach((credit, index) => {
            repository.rollbackTransferredShare(
              credit.share_id,
              charges[index].share_id,
              Number(credit.quantity),
              documentReference
            );
          });
        }
      });

      return {
        message: `Η ${documentReference} διαγράφηκε από το Ευρετήριο και τις κινήσεις των μερίδων.`
      };
    },

    updateExhpOtherSupportDocument(documentId, value) {
      const document = repository.getExhpDocument(documentId);
      if (!document) throw new Error('Η ΕΧΠ δεν βρέθηκε.');
      repository.updateExhpOtherSupportDocument(
        documentId,
        String(value || '').trim()
      );
      return { message: 'Το πρόσθετο δικαιολογητικό αποθηκεύτηκε.' };
    },

    updateExhpSupport(documentId, supportId, payload) {
      const document = repository.getExhpDocument(documentId);
      if (!document) throw new Error('Η ΕΧΠ δεν βρέθηκε.');
      repository.updateExhpDocumentSupport(
        supportId,
        Boolean(payload && payload.completed),
        String((payload && payload.documentReference) || '').trim(),
        String((payload && payload.notes) || '').trim()
      );
      const supportStatus = repository.refreshExhpSupportStatus(documentId);
      return { supportStatus, message: 'Ο φάκελος δικαιολογητικών ενημερώθηκε.' };
    },

    saveExhpSupportForm(documentId, supportId, payload) {
      const document = repository.getExhpDocument(documentId);
      if (!document) throw new Error('Η ΕΧΠ δεν βρέθηκε.');
      const reference = String((payload && payload.documentReference) || '').trim();
      const formData = payload && typeof payload.formData === 'object' ? payload.formData : {};
      repository.saveExhpDocumentSupportForm(
        supportId,
        formData,
        reference,
        Boolean(payload && payload.completed)
      );
      const supportStatus = repository.refreshExhpSupportStatus(documentId);
      return {
        supportStatus,
        support: repository.listExhpDocumentSupports(documentId)
          .map(mapExhpDocumentSupport)
          .find((item) => item.id === Number(supportId)),
        message: 'Το έντυπο αποθηκεύτηκε.'
      };
    }
  };
}

module.exports = { createExhpService };
