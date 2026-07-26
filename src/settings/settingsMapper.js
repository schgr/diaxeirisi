function normalizeSettings({
  serviceSettings,
  departmentManagers,
  ranks,
  measurementUnits,
  transactionUnits,
  materialCategories,
  requestJustificationCodes = [],
  requestIssuingUnits = [],
  exhpIssueReasons = []
}) {
  return {
    serviceInfo: {
      serviceName: serviceSettings.service_name,
      serviceLocation: serviceSettings.service_location || '',
      managementType: serviceSettings.management_type || '',
      activeFiscalYear: Number(serviceSettings.active_fiscal_year || new Date().getFullYear())
    },
    financialOfficers: {
      commander: serviceSettings.commander,
      ped: serviceSettings.ped,
      manager: serviceSettings.manager
    },
    auditSettings: {
      auditServiceName: serviceSettings.audit_service_name || '',
      commanderRegistryNumber: serviceSettings.commander_registry_number || '',
      commanderTaxNumber: serviceSettings.commander_tax_number || '',
      pedRegistryNumber: serviceSettings.ped_registry_number || '',
      pedTaxNumber: serviceSettings.ped_tax_number || '',
      managerRegistryNumber: serviceSettings.manager_registry_number || '',
      managerTaxNumber: serviceSettings.manager_tax_number || ''
    },
    departmentManagers: departmentManagers.map((row) => ({
      id: row.id,
      departmentName: row.department_name,
      departmentHead: row.department_head,
      sortOrder: row.sort_order
    })),
    ranks: ranks.map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order
    })),
    measurementUnits: measurementUnits.map((row) => ({
      id: row.id,
      name: row.name,
      code: row.code || '',
      sortOrder: row.sort_order
    })),
    transactionUnits: transactionUnits.map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order
    })),
    materialCategories: materialCategories.map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order
    })),
    requestJustificationCodes: requestJustificationCodes.map((row) => ({
      id: row.id,
      code: row.code,
      description: row.description,
      autoDeleteOwed: Boolean(row.auto_delete_owed),
      sortOrder: row.sort_order
    })),
    requestIssuingUnits: requestIssuingUnits.map((row) => ({
      id: row.id,
      name: row.name,
      sortOrder: row.sort_order
    })),
    exhpIssueReasons: exhpIssueReasons.map((row) => ({
      id: row.id,
      name: row.name,
      recommendationText: row.recommendation_text || '',
      firstOpinionText: row.first_opinion_text || '',
      secondOpinionText: row.second_opinion_text || '',
      sortOrder: row.sort_order
    }))
  };
}

module.exports = {
  normalizeSettings
};
