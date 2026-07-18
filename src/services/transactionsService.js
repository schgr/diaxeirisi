const { transactionSections } = require('../transactions/transactionSections');
const { createTransactionsRepository } = require('../db/transactionsRepository');
const { validateAddy } = require('../transactions/addyValidation');
const { validateExhp } = require('../transactions/exhpValidation');
const { requirePositiveId } = require('../core/validation');

function createTransactionsService(db, settingsService) {
  const repository = createTransactionsRepository(db);

  return {
    getStructure() {
      return transactionSections;
    },

    getAddyReferenceData() {
      const shares = repository.listShares();
      const measurementUnits = repository.listMeasurementUnits();
      const transactionUnits = repository.listTransactionUnits();
      const materialCategories = repository.listMaterialCategories();
      const materialTypes = collectMaterialTypes(materialCategories, shares);
      const settings = settingsService ? settingsService.getSettings() : null;

      return {
        shares: shares.map((share) => ({
          id: share.id,
          shareNumber: share.share_number,
          nominalNumber: share.nominal_number,
          description: share.description,
          materialType: share.material_type,
          materialCode: share.material_code || '',
          measurementUnit: share.measurement_unit || '',
          chargedQuantity: Number(share.charged_quantity || 0),
          accountingBalance: Number(share.accounting_balance || 0),
          requiresComposition: Boolean(share.requires_composition),
          requiresChangeSheet: Boolean(share.requires_change_sheet),
          composition: Boolean(share.requires_composition)
            ? repository.listCompositionItems(share.id).map((item) => ({
                componentNominalNumber: item.component_nominal_number,
                componentDescription: item.component_description,
                measurementUnit: item.measurement_unit,
                quantityPerMaterial: Number(item.quantity),
                notIssuedQuantity: Number(item.not_issued_quantity || 0),
                notes: item.notes || ''
              }))
            : []
        })),
        serviceName: settings ? settings.serviceInfo.serviceName : repository.getServiceName(),
        managementType: settings ? settings.serviceInfo.managementType : '',
        financialOfficers: settings
          ? settings.financialOfficers
          : { commander: '', ped: '', manager: '' },
        exhpIssueReasons: settings ? settings.exhpIssueReasons : [],
        exhpSupportTemplates: repository.listExhpSupportTemplates().map(mapExhpSupportTemplate),
        materialTypes,
        transactionUnits: transactionUnits.map((unit) => ({
          id: unit.id,
          name: unit.name
        })),
        measurementUnits: measurementUnits.map((unit) => ({
          id: unit.id,
          name: unit.name
        }))
      };
    },

    suggestShareNumber() {
      return {
        shareNumber: repository.getNextShareNumber()
      };
    },

    saveAddy(payload) {
      const addy = validateAddy(payload);
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
          repository.createAddyItem(documentId, item, share?.id || null, transactionId);
          documentItems.push(
            mapAddyDocumentItem({
              item,
              share: share || { share_number: item.shareNumber, description: item.description },
              ledgerSerial,
              transactionUnit: addy.transactionUnit,
              serviceName
            })
          );
          documentItems[documentItems.length - 1].composition = item.composition || [];
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

    saveExhp(payload) {
      const exhp = validateExhp(payload);
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

        for (const item of exhp.items) {
          const share = repository.findShareByNumber(item.shareNumber);
          if (!share) {
            throw new Error(`Η μερίδα ${item.shareNumber} δεν βρέθηκε.`);
          }

          if (item.transactionType === 'Πίστωση' && item.quantity > Number(share.accounting_balance || 0)) {
            throw new Error('Το υπόλοιπο δεν επαρκεί για την πραγματοποίηση της δοσοληψίας.');
          }

          const quantityDelta = item.transactionType === 'Χρέωση' ? item.quantity : -item.quantity;
          repository.adjustAccountingBalance(share.id, quantityDelta);
          const shareTransactionId = repository.createShareTransaction({
            shareId: share.id,
            transactionDate: exhp.documentDate,
            transactionUnit: exhp.serviceUnit,
            transactionType: item.transactionType,
            documentReference: `ΕΧΠ ${registryNumber}/${exhp.fiscalYear}`,
            quantity: item.quantity,
            notes: exhp.issueReason
          });
          const ledgerSerial = repository.getShareTransactionSerialForYear(
            share.id,
            shareTransactionId,
            exhp.documentDate
          );
          repository.createExhpItem(documentId, item, share.id, shareTransactionId);
          documentItems.push({ ...item, ledgerSerial });
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
            : '';
          return {
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

    updateExhpOtherSupportDocument(documentId, value) {
      const document = repository.getExhpDocument(documentId);
      if (!document) throw new Error('Η ΕΧΠ δεν βρέθηκε.');
      repository.updateExhpOtherSupportDocument(
        documentId,
        String(value || '').trim()
      );
      return { message: 'Το πρόσθετο δικαιολογητικό αποθηκεύτηκε.' };
    },

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
    },

    listExhpIndexRows(year = new Date().getFullYear()) {
      const fiscalYear = Number(year) || new Date().getFullYear();
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
          shareNumber: row.share_number,
          ledgerSerial: linkedTransaction
            ? repository.getShareTransactionSerialForYear(
                row.share_id,
                linkedTransaction.id,
                row.document_date
              )
            : '',
          transactionKind: row.transaction_type === 'Πίστωση' ? 'Π' : 'Χ',
          date: row.document_date,
          quantity: Number(row.quantity || 0),
          ...(normalizedSource === 'addy' ? { transactionUnit: row.transaction_unit } : {})
        };
      });
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
    },

    listExternalTransactionIndexRows(year = new Date().getFullYear()) {
      const fiscalYear = Number(year) || new Date().getFullYear();
      return repository.listExternalTransactionIndexRows(fiscalYear).map((row, index) => ({
        id: row.id,
        serial: index + 1,
        date: row.document_date,
        unit: row.transaction_unit,
        documentType: row.transaction_type === 'Χρέωση' ? 'Χ' : 'Π',
        nominalNumber: row.nominal_number || '',
        documentReference: row.transaction_type === 'Χρέωση'
          ? row.justification_reference || ''
          : `Π-${row.id} / ${formatDate(row.document_date)}`,
        movementDate: row.document_date,
        returnDate: '',
        indexField7: row.index_field_7,
        indexField8: row.index_field_8,
        indexField9: row.index_field_9,
        notes: row.description || row.notes || ''
      }));
    }
  };
}

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

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('el-GR');
}

function isConsumableMaterial(value) {
  const normalized = normalize(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return normalized === 'αναλωσιμα' || normalized === 'αναλωσιμο';
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
  createTransactionsService
};
