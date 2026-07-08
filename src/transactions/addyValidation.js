const { AppError } = require('../core/errorHandler');
const { optionalText, requireText } = require('../core/validation');

function validateAddy(payload) {
  const items = Array.isArray(payload && payload.items) ? payload.items : [];

  if (!items.length) {
    throw new AppError('Πρέπει να προστεθεί τουλάχιστον ένα υλικό.', 'VALIDATION_ERROR');
  }

  if (items.length > 10) {
    throw new AppError('Οι καταχωρήσεις για τις μερίδες μπορούν να είναι μέχρι 10.', 'VALIDATION_ERROR');
  }

  const transactionUnit = requireText(payload && payload.transactionUnit, 'Μονάδα Δοσοληψιών');
  const validatedItems = items.map(validateAddyItem);
  if (validatedItems.some((item) => item.transactionType === 'Χρέωση' && normalize(item.materialType) === 'εμπόριο' && item.unitPrice === null)) {
    throw new AppError('Η τιμή είναι υποχρεωτική όταν το Είδος Υλικού είναι Εμπόριο.', 'VALIDATION_ERROR');
  }

  return {
    documentDate: optionalText(payload.documentDate) || new Date().toISOString().slice(0, 10),
    transactionUnit,
    justificationReference: optionalText(payload && payload.justificationReference),
    notes: optionalText(payload && payload.notes),
    items: validatedItems
  };
}

function validateAddyItem(item) {
  const quantity = Number(item && item.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new AppError('Η ποσότητα πρέπει να είναι θετικός αριθμός.', 'VALIDATION_ERROR');
  }

  const transactionType = requireText(item && item.transactionType, 'Είδος Δοσοληψίας');
  if (!['Χρέωση', 'Πίστωση'].includes(transactionType)) {
    throw new AppError('Το είδος δοσοληψίας πρέπει να είναι Χρέωση ή Πίστωση.', 'VALIDATION_ERROR');
  }

  const unitPriceText = optionalText(item && item.unitPrice);
  const unitPrice = unitPriceText ? Number(unitPriceText) : null;
  if (unitPriceText && (!Number.isFinite(unitPrice) || unitPrice < 0)) {
    throw new AppError('Η τιμή πρέπει να είναι θετικός αριθμός.', 'VALIDATION_ERROR');
  }

  const composition = (Array.isArray(item && item.composition) ? item.composition : []).map((component) => {
    const projectedQuantity = Number(component.projectedQuantity);
    const notIssuedQuantity = Number(component.notIssuedQuantity || 0);
    if (
      !String(component.componentDescription || '').trim() ||
      !Number.isFinite(projectedQuantity) ||
      projectedQuantity <= 0 ||
      !Number.isFinite(notIssuedQuantity) ||
      notIssuedQuantity < 0 ||
      notIssuedQuantity > projectedQuantity
    ) {
      throw new AppError(
        'Η σύνθεση χρειάζεται έγκυρες προβλεπόμενες και μη χορηγηθείσες ποσότητες.',
        'VALIDATION_ERROR'
      );
    }
    return {
      componentNominalNumber: optionalText(component.componentNominalNumber),
      componentDescription: requireText(component.componentDescription, 'Περιγραφή σύνθεσης'),
      measurementUnit: optionalText(component.measurementUnit),
      projectedQuantity,
      notIssuedQuantity,
      notes: optionalText(component.notes)
    };
  });

  return {
    shareNumber: requireText(item && item.shareNumber, 'Αριθμός Μερίδας'),
    nominalNumber: requireText(item && item.nominalNumber, 'Αριθμός Ονομαστικού'),
    description: requireText(item && item.description, 'Περιγραφή'),
    quantity,
    transactionType,
    measurementUnit: requireText(item && item.measurementUnit, 'Μονάδα Μέτρησης'),
    materialType: transactionType === 'Χρέωση' ? requireText(item && item.materialType, 'Είδος Υλικού') : optionalText(item && item.materialType),
    unitPrice,
    justificationReference: optionalText(item && item.justificationReference),
    composition
  };
}

module.exports = {
  validateAddy
};

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('el-GR');
}
