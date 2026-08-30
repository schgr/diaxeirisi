const { safeJsonParse } = require('../../utils/safeJson');

function buildBalanceDifferences(shareRows, compositionRows, movementRows) {
  const differences = shareRows.map((row) => mapBalanceDifference({
    sourceType: 'Μερίδα',
    shareId: row.id,
    shareNumber: row.share_number,
    parentNominalNumber: row.nominal_number,
    parentDescription: row.description,
    nominalNumber: row.nominal_number,
    description: row.description,
    measurementUnit: row.measurement_unit,
    existingQuantity: Number(row.accounting_balance || 0),
    chargedQuantity: Number(row.charged_quantity || 0)
  }));
  const chargedComposition = aggregateInternalComposition(movementRows);

  compositionRows.forEach((row) => {
    const existingQuantity = Math.max(
      0,
      (Number(row.quantity || 0) * Number(row.accounting_balance || 0)) -
        Number(row.not_issued_quantity || 0)
    );
    const chargedQuantity = chargedComposition.get(compositionKey(
      row.share_id,
      row.component_nominal_number,
      row.component_description,
      row.measurement_unit
    )) || 0;
    if (Math.abs(chargedQuantity - existingQuantity) <= 0.000001) return;
    differences.push(mapBalanceDifference({
      sourceType: 'Σύνθεση',
      shareId: row.share_id,
      shareNumber: row.share_number,
      parentNominalNumber: row.parent_nominal_number,
      parentDescription: row.parent_description,
      nominalNumber: row.component_nominal_number,
      description: row.component_description,
      measurementUnit: row.measurement_unit,
      existingQuantity,
      chargedQuantity
    }));
  });

  return differences;
}

function aggregateInternalComposition(rows) {
  const totals = new Map();
  rows.forEach((row) => {
    const snapshot = safeJsonParse(
      row.composition_snapshot || '[]',
      [],
      'σύνθεση εσωτερικής κίνησης διαχείρισης'
    );
    if (!Array.isArray(snapshot)) return;
    snapshot.forEach((item) => {
      const key = compositionKey(
        row.share_id,
        item.componentNominalNumber,
        item.componentDescription,
        item.measurementUnit
      );
      const direction = row.movement_type === 'Επιστροφή' ? -1 : 1;
      totals.set(key, (totals.get(key) || 0) + direction * Number(item.quantity || 0));
    });
  });
  return totals;
}

function compositionKey(shareId, nominalNumber, description, measurementUnit) {
  const nominal = normalizeCompositionValue(nominalNumber);
  return nominal
    ? [Number(shareId), 'AO', nominal].join('\u0000')
    : [
        Number(shareId),
        'DESC',
        normalizeCompositionValue(description),
        normalizeCompositionValue(measurementUnit)
      ].join('\u0000');
}

function normalizeCompositionValue(value) {
  return String(value || '').trim().toLocaleUpperCase('el-GR');
}

function mapBalanceDifference(item) {
  const differenceQuantity = Number(item.chargedQuantity) - Number(item.existingQuantity);
  return {
    ...item,
    existingQuantity: Number(item.existingQuantity),
    chargedQuantity: Number(item.chargedQuantity),
    differenceQuantity: Math.abs(differenceQuantity),
    status: differenceQuantity > 0 ? 'Πλεόνασμα' : 'Έλλειμμα'
  };
}

module.exports = { buildBalanceDifferences };
