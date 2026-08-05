const { calculateShareBalance } = require('../core/shareBalance');

function mapShare(row) {
  const balance = calculateShareBalance(row.accounting_balance, row.charged_quantity);

  return {
    id: row.id,
    shareNumber: row.share_number,
    nominalNumber: row.nominal_number,
    description: row.description,
    materialType: row.material_type,
    materialCode: row.material_code || '',
    mainMaterialNumber: row.main_material_number || '',
    measurementUnit: row.measurement_unit || '',
    projectedQuantity: row.projected_quantity || 0,
    accountingBalance: row.accounting_balance,
    chargedQuantity: row.charged_quantity,
    availableQuantity: balance.availableQuantity,
    differenceQuantity: balance.differenceQuantity,
    unitPrice: row.unit_price,
    photoPath: row.photo_path || '',
    requiresComposition: Boolean(row.requires_composition),
    requiresSerialNumber: Boolean(row.requires_serial_number),
    requiresWeaponRegistry: Boolean(row.requires_weapon_registry),
    requiresAmmunitionBatchBook: Boolean(row.requires_ammunition_batch_book),
    requiresTrainingAmmunitionBatchBook: Boolean(row.requires_training_ammunition_batch_book),
    requiresChangeSheet: Boolean(row.requires_change_sheet),
    status: balance.status,
    statusTone: balance.statusTone
  };
}

module.exports = {
  mapShare
};
