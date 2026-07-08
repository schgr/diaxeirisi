const { optionalText, requireText } = require('../core/validation');

function validateServiceInfo(payload) {
  return {
    serviceName: requireText(payload && payload.serviceName, 'Υπηρεσία'),
    serviceLocation: optionalText(payload && payload.serviceLocation),
    managementType: optionalText(payload && payload.managementType)
  };
}

function validateFinancialOfficers(payload) {
  return {
    commander: optionalText(payload && payload.commander),
    ped: optionalText(payload && payload.ped),
    manager: optionalText(payload && payload.manager)
  };
}

function validateDepartmentManager(payload) {
  return {
    departmentName: requireText(payload && payload.departmentName, 'Τμήμα Μονάδος'),
    departmentHead: requireText(payload && payload.departmentHead, 'Επικεφαλής Τμήματος')
  };
}

function validateNamedSetting(payload, fieldName) {
  return requireText(payload && payload.name, fieldName);
}

function validateMeasurementUnit(payload) {
  return {
    name: requireText(payload && payload.name, 'Μονάδα μέτρησης'),
    code: requireText(payload && payload.code, 'Αγγλική ορολογία')
  };
}

module.exports = {
  validateDepartmentManager,
  validateFinancialOfficers,
  validateMeasurementUnit,
  validateNamedSetting,
  validateServiceInfo
};
