const { AppError } = require('../core/errorHandler');
const { createYearEndRepository } = require('../db/yearEndRepository');

function createYearEndService(db) {
  const repository = createYearEndRepository(db);

  return {
    getRenumberingData() {
      return {
        fiscalYear: new Date().getFullYear(),
        shares: repository.listActiveShares().map(mapShare)
      };
    },

    validateRenumbering(payload) {
      const validated = validatePayload(repository, payload);
      return {
        valid: true,
        activeCount: validated.items.length,
        archiveCount: 0,
        message: 'Ο έλεγχος ολοκληρώθηκε. Όλες οι μερίδες έχουν έγκυρο και μοναδικό νέο αριθμό.'
      };
    },

    applyRenumbering(payload) {
      const validated = validatePayload(repository, payload);
      if (repository.getRunForYear(validated.fiscalYear)) {
        throw new AppError(
          `Η αλλαγή αρίθμησης για το ${validated.fiscalYear} έχει ήδη πραγματοποιηθεί.`,
          'VALIDATION_ERROR'
        );
      }
      const result = repository.applyRenumbering(
        validated.fiscalYear,
        `${validated.fiscalYear}-12-31`,
        validated.items
      );
      return {
        ...result,
        message: `Η αλλαγή αρίθμησης ολοκληρώθηκε. Δημιουργήθηκε η απογραφή ${result.inventorySerial}/${validated.fiscalYear} με την παλιά αρίθμηση.`
      };
    }
  };
}

function validatePayload(repository, payload) {
  const fiscalYear = Number(payload?.fiscalYear || new Date().getFullYear());
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
    throw new AppError('Το οικονομικό έτος δεν είναι έγκυρο.', 'VALIDATION_ERROR');
  }
  const shares = repository.listActiveShares();
  const provided = Array.isArray(payload?.items) ? payload.items : [];
  const byId = new Map(provided.map((item) => [Number(item.shareId), item]));
  if (byId.size !== shares.length || shares.some((share) => !byId.has(Number(share.id)))) {
    throw new AppError('Πρέπει να περιλαμβάνονται όλες οι ενεργές μερίδες.', 'VALIDATION_ERROR');
  }

  const seen = new Map();
  const items = shares.map((share) => {
    const item = byId.get(Number(share.id));
    const newShareNumber = normalizeShareNumber(item.newShareNumber);
    if (!newShareNumber) {
      throw new AppError(`Δεν έχει δοθεί νέος αριθμός στη μερίδα ${share.share_number}.`, 'VALIDATION_ERROR');
    }
    const duplicateKey = newShareNumber.toLocaleLowerCase('el-GR');
    if (seen.has(duplicateKey)) {
      throw new AppError(
        `Ο νέος αριθμός ${newShareNumber} χρησιμοποιείται σε περισσότερες από μία μερίδες.`,
        'VALIDATION_ERROR'
      );
    }
    seen.set(duplicateKey, share.id);
    return { shareId: share.id, newShareNumber };
  });
  return { fiscalYear, items };
}

function normalizeShareNumber(value) {
  const text = String(value ?? '').trim();
  return /^\d+$/.test(text) ? String(Number(text)) : text;
}

function mapShare(row) {
  return {
    id: row.id,
    shareNumber: row.share_number,
    description: row.description,
    quantity: Number(row.accounting_balance || 0),
    chargedQuantity: Number(row.charged_quantity || 0),
    canArchive: Number(row.accounting_balance || 0) === 0 && Number(row.charged_quantity || 0) === 0
  };
}

module.exports = { createYearEndService };
