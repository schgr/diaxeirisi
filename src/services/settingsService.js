const { createSettingsRepository } = require('../db/settingsRepository');
const { normalizeSettings } = require('../settings/settingsMapper');
const {
  validateDepartmentManager,
  validateFinancialOfficers,
  validateMeasurementUnit,
  validateNamedSetting,
  validateServiceInfo
} = require('../settings/settingsValidation');
const { requirePositiveId } = require('../core/validation');
const { optionalText } = require('../core/validation');

function createSettingsService(db) {
  const repository = createSettingsRepository(db);

  function getSettings() {
    return normalizeSettings({
      serviceSettings: repository.getServiceSettings(),
      departmentManagers: repository.listDepartmentManagers(),
      ranks: repository.listRanks(),
      measurementUnits: repository.listMeasurementUnits(),
      transactionUnits: repository.listTransactionUnits(),
      materialCategories: repository.listMaterialCategories(),
      requestJustificationCodes: repository.listRequestJustificationCodes(),
      requestIssuingUnits: repository.listRequestIssuingUnits(),
      exhpIssueReasons: repository.listExhpIssueReasons()
    });
  }

  return {
    getSettings,

    saveServiceInfo(payload) {
      const serviceInfo = validateServiceInfo(payload);
      repository.updateServiceInfo(serviceInfo);
      return getSettings();
    },

    saveFinancialOfficers(payload) {
      const officers = validateFinancialOfficers(payload);
      repository.updateFinancialOfficers(officers);
      return getSettings();
    },

    saveAuditSettings(payload) {
      repository.updateAuditSettings({
        auditServiceName: optionalText(payload && payload.auditServiceName),
        commanderRegistryNumber: optionalText(payload && payload.commanderRegistryNumber),
        commanderTaxNumber: optionalText(payload && payload.commanderTaxNumber),
        pedRegistryNumber: optionalText(payload && payload.pedRegistryNumber),
        pedTaxNumber: optionalText(payload && payload.pedTaxNumber),
        managerRegistryNumber: optionalText(payload && payload.managerRegistryNumber),
        managerTaxNumber: optionalText(payload && payload.managerTaxNumber)
      });
      return getSettings();
    },

    addDepartmentManager(payload) {
      repository.createDepartmentManager(validateDepartmentManager(payload));
      return getSettings();
    },

    updateDepartmentManager(id, payload) {
      repository.updateDepartmentManager(
        requirePositiveId(id),
        validateDepartmentManager(payload)
      );
      return getSettings();
    },

    deleteDepartmentManager(id) {
      repository.deleteDepartmentManager(requirePositiveId(id));
      return getSettings();
    },

    addRank(payload) {
      repository.createRank(validateNamedSetting(payload, 'Βαθμός'));
      return getSettings();
    },

    updateRank(id, payload) {
      repository.updateRank(requirePositiveId(id), validateNamedSetting(payload, 'Βαθμός'));
      return getSettings();
    },

    deleteRank(id) {
      repository.deleteRank(requirePositiveId(id));
      return getSettings();
    },

    addMeasurementUnit(payload) {
      repository.createMeasurementUnit(validateMeasurementUnit(payload));
      return getSettings();
    },

    updateMeasurementUnit(id, payload) {
      repository.updateMeasurementUnit(
        requirePositiveId(id),
        validateMeasurementUnit(payload)
      );
      return getSettings();
    },

    deleteMeasurementUnit(id) {
      repository.deleteMeasurementUnit(requirePositiveId(id));
      return getSettings();
    },

    addTransactionUnit(payload) {
      repository.createTransactionUnit(validateNamedSetting(payload, 'Μονάδα Δοσοληψιών'));
      return getSettings();
    },

    updateTransactionUnit(id, payload) {
      repository.updateTransactionUnit(
        requirePositiveId(id),
        validateNamedSetting(payload, 'Μονάδα Δοσοληψιών')
      );
      return getSettings();
    },

    deleteTransactionUnit(id) {
      repository.deleteTransactionUnit(requirePositiveId(id));
      return getSettings();
    },

    addMaterialCategory(payload) {
      repository.createMaterialCategory(validateNamedSetting(payload, 'Κατηγορία Υλικού'));
      return getSettings();
    },

    updateMaterialCategory(id, payload) {
      repository.updateMaterialCategory(
        requirePositiveId(id),
        validateNamedSetting(payload, 'Κατηγορία Υλικού')
      );
      return getSettings();
    },

    deleteMaterialCategory(id) {
      repository.deleteMaterialCategory(requirePositiveId(id));
      return getSettings();
    },

    addRequestIssuingUnit(payload) {
      repository.createRequestIssuingUnit(validateNamedSetting(payload, 'Μονάδα Χορήγησης Υλικών'));
      return getSettings();
    },

    updateRequestIssuingUnit(id, payload) {
      repository.updateRequestIssuingUnit(
        requirePositiveId(id),
        validateNamedSetting(payload, 'Μονάδα Χορήγησης Υλικών')
      );
      return getSettings();
    },

    deleteRequestIssuingUnit(id) {
      repository.deleteRequestIssuingUnit(requirePositiveId(id));
      return getSettings();
    },

    addExhpIssueReason(payload) {
      repository.createExhpIssueReason(toTitleCaseWords(
        validateNamedSetting(payload, 'Αιτιολογία Εκδόσεως')
      ));
      return getSettings();
    },

    updateExhpIssueReasonTexts(id, payload) {
      repository.updateExhpIssueReasonTexts(requirePositiveId(id), {
        recommendationText: optionalText(payload && payload.recommendationText),
        firstOpinionText: optionalText(payload && payload.firstOpinionText),
        secondOpinionText: optionalText(payload && payload.secondOpinionText)
      });
      return getSettings();
    },

    deleteExhpIssueReason(id) {
      repository.deleteExhpIssueReason(requirePositiveId(id));
      return getSettings();
    }
  };
}

function toTitleCaseWords(value) {
  return String(value || '').replace(
    /(^|[\s(/-])(\p{L})/gu,
    (_match, prefix, letter) => `${prefix}${letter.toLocaleUpperCase('el-GR')}`
  );
}

module.exports = {
  createSettingsService,
  toTitleCaseWords
};
