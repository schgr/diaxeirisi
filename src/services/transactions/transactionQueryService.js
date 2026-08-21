function createTransactionQueryService(dependencies) {
  const { repository, settingsService, transactionSections } = dependencies;
  const { mapExhpSupportTemplate, saveRegularExhpItem, saveToolCollectionTransfers, isToolCollectionReason, aggregateCompositionCharges, addChangeSheetCompositionCharges, compositionChargeKey, saveNominalNumberTransfer, buildCompositionSnapshot, readTransactionArchive, mapExhpDocumentSupport, collectMaterialTypes, addMaterialType, mapAddyDocumentItem, formatDate, normalize, isConsumableMaterial, isNonScalingCompositionMaterial, compareShareNumbers } = dependencies.shared;

  return {
    getStructure() {
      return transactionSections;
    },

    getAddyReferenceData() {
      const shares = repository.listShares();
      const compositionCharges = aggregateCompositionCharges(
        repository.listInternalCompositionMovements()
      );
      addChangeSheetCompositionCharges(
        compositionCharges,
        repository.listCompositionChangeSheetEntries()
      );
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
                chargedQuantity: Number(compositionCharges.get(
                  compositionChargeKey(share.id, item.component_nominal_number, item.component_description)
                ) || 0),
                notIssuedQuantity: Number(item.not_issued_quantity || 0),
                notes: item.notes || ''
              }))
            : []
        })),
        serviceName: settings ? settings.serviceInfo.serviceName : repository.getServiceName(),
        managementType: settings ? settings.serviceInfo.managementType : '',
        fiscalYear: settings ? settings.serviceInfo.activeFiscalYear : new Date().getFullYear(),
        financialOfficers: settings
          ? settings.financialOfficers
          : { commander: '', ped: '', manager: '' },
        exhpIssueReasons: settings ? settings.exhpIssueReasons : [],
        exhpSupportTemplates: repository.listExhpSupportTemplates().map(mapExhpSupportTemplate),
        materialTypes,
        commerceCompanies: repository.listCommerceCompanies(),
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

    createCommerceCompany(payload) {
      return repository.createCommerceCompany(payload);
    },

    updateCommerceCompany(id, payload) {
      return repository.updateCommerceCompany(id, payload);
    },

    deleteCommerceCompany(id) {
      return repository.deleteCommerceCompany(id);
    }
  };
}

module.exports = { createTransactionQueryService };
