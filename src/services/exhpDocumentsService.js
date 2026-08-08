const { createExhpDocumentsRepository, DOCUMENT_TYPES } = require('../db/exhpDocumentsRepository');
const { AppError } = require('../core/errorHandler');
const { optionalText, requirePositiveId } = require('../core/validation');
const { safeJsonParse } = require('../utils/safeJson');

const AMMO_ITEM_TYPES = ['consumed', 'empty'];

function createExhpDocumentsService(db) {
  const repository = createExhpDocumentsRepository(db);

  return {
    getDocumentsForExhp(exhpId) {
      return withErrors(() => {
        const id = requirePositiveId(exhpId, 'exhpId');
        if (!repository.getExhp(id)) {
          throw new AppError('Η ΕΧΠ δεν βρέθηκε.', 'NOT_FOUND');
        }
        return repository.getDocumentsByExhpId(id).map(mapDocument);
      });
    },

    createDocument(exhpId, documentType) {
      return withErrors(() => {
        const id = requirePositiveId(exhpId, 'exhpId');
        const type = requireDocumentType(documentType);
        if (!repository.getExhp(id)) {
          throw new AppError('Η ΕΧΠ δεν βρέθηκε.', 'NOT_FOUND');
        }
        return {
          document: mapDocument(repository.createDocument(id, type)),
          message: 'Το δικαιολογητικό ΕΧΠ δημιουργήθηκε.'
        };
      });
    },

    deleteDocument(documentId) {
      return withErrors(() => {
        const id = requireExistingDocument(repository, documentId).id;
        repository.deleteDocument(id);
        return { message: 'Το δικαιολογητικό ΕΧΠ διαγράφηκε.' };
      });
    },

    saveUselessA(documentId, data) {
      return withErrors(() => {
        requireDocumentOfType(repository, documentId, 'useless_material_a');
        return {
          data: mapUselessA(repository.saveUselessA(
            requirePositiveId(documentId, 'documentId'),
            normalizeUselessA(data)
          )),
          message: 'Το πρωτόκολλο πρωτοβάθμιας επιτροπής αποθηκεύτηκε.'
        };
      });
    },

    getUselessA(documentId) {
      return withErrors(() => {
        requireDocumentOfType(repository, documentId, 'useless_material_a');
        return mapUselessA(repository.getUselessA(requirePositiveId(documentId, 'documentId')));
      });
    },

    saveUselessB(documentId, data) {
      return withErrors(() => {
        requireDocumentOfType(repository, documentId, 'useless_material_b');
        return {
          data: mapUselessB(repository.saveUselessB(
            requirePositiveId(documentId, 'documentId'),
            normalizeUselessB(data)
          )),
          message: 'Το πρωτόκολλο δευτεροβάθμιας επιτροπής αποθηκεύτηκε.'
        };
      });
    },

    getUselessB(documentId) {
      return withErrors(() => {
        requireDocumentOfType(repository, documentId, 'useless_material_b');
        return mapUselessB(repository.getUselessB(requirePositiveId(documentId, 'documentId')));
      });
    },

    saveAmmo(documentId, data) {
      return withErrors(() => {
        requireDocumentOfType(repository, documentId, 'ammo_consumption');
        return {
          data: mapAmmo(repository.saveAmmo(
            requirePositiveId(documentId, 'documentId'),
            normalizeAmmo(data)
          )),
          message: 'Το πιστοποιητικό καταναλώσεως πυρομαχικών αποθηκεύτηκε.'
        };
      });
    },

    getAmmo(documentId) {
      return withErrors(() => {
        requireDocumentOfType(repository, documentId, 'ammo_consumption');
        return mapAmmo(repository.getAmmo(requirePositiveId(documentId, 'documentId')));
      });
    },

    saveGeneric(documentId, data) {
      return withErrors(() => {
        requireExistingDocument(repository, documentId);
        return {
          data: mapGeneric(repository.saveGeneric(
            requirePositiveId(documentId, 'documentId'),
            normalizeGeneric(data)
          )),
          message: 'Ξ¤ΞΏ Ξ΄ΞΉΞΊΞ±ΞΉΞΏΞ»ΞΏΞ³Ξ·Ο„ΞΉΞΊΟ Ξ•Ξ§Ξ  Ξ±Ο€ΞΏΞΈΞ·ΞΊΞµΟΟ„Ξ·ΞΊΞµ.'
        };
      });
    },

    getGeneric(documentId) {
      return withErrors(() => {
        requireExistingDocument(repository, documentId);
        return mapGeneric(repository.getGeneric(requirePositiveId(documentId, 'documentId')));
      });
    },

    getUselessStatements(exhpId) {
      return withErrors(() => {
        const id = requirePositiveId(exhpId, 'exhpId');
        if (!repository.getExhp(id)) throw new AppError('Η ΕΧΠ δεν βρέθηκε.', 'NOT_FOUND');
        return Object.fromEntries(repository.getUselessStatements(id).map((row) => [
          row.form_key,
          safeJsonParse(row.data_json || '{}', {}, 'δήλωση άχρηστου υλικού ΕΧΠ')
        ]));
      });
    },

    saveUselessStatement(exhpId, formKey, data) {
      return withErrors(() => {
        const id = requirePositiveId(exhpId, 'exhpId');
        if (!repository.getExhp(id)) throw new AppError('Η ΕΧΠ δεν βρέθηκε.', 'NOT_FOUND');
        const key = optionalText(formKey);
        if (!key) throw new AppError('Δεν ορίστηκε έντυπο.', 'VALIDATION_ERROR');
        repository.saveUselessStatement(id, key, data || {});
        return { data, message: 'Το έντυπο αποθηκεύτηκε.' };
      });
    }
  };
}

function withErrors(operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError(
      error && error.message ? error.message : 'Δεν ήταν δυνατή η επεξεργασία του δικαιολογητικού ΕΧΠ.',
      'UNEXPECTED_ERROR'
    );
  }
}

function requireDocumentType(value) {
  const documentType = optionalText(value);
  if (!DOCUMENT_TYPES.includes(documentType)) {
    throw new AppError('Μη έγκυρος τύπος δικαιολογητικού ΕΧΠ.', 'VALIDATION_ERROR');
  }
  return documentType;
}

function requireExistingDocument(repository, documentId) {
  const id = requirePositiveId(documentId, 'documentId');
  const document = repository.getDocument(id);
  if (!document) {
    throw new AppError('Το δικαιολογητικό ΕΧΠ δεν βρέθηκε.', 'NOT_FOUND');
  }
  return document;
}

function requireDocumentOfType(repository, documentId, documentType) {
  const document = requireExistingDocument(repository, documentId);
  if (document.document_type !== documentType) {
    throw new AppError('Ο τύπος δικαιολογητικού δεν συμφωνεί με την ενέργεια.', 'VALIDATION_ERROR');
  }
  return document;
}

function normalizeUselessA(data = {}) {
  return {
    location: optionalText(data.location),
    date: optionalText(data.date),
    hdmNumber: optionalText(data.hdmNumber),
    president: optionalText(data.president),
    memberA: optionalText(data.memberA),
    memberB: optionalText(data.memberB),
    periodFrom: optionalText(data.periodFrom),
    periodTo: optionalText(data.periodTo),
    items: normalizeArray(data.items).map((item) => ({
      aa: optionalInteger(item.aa),
      shareNumber: optionalText(item.shareNumber),
      nomenclatureNumber: optionalText(item.nomenclatureNumber),
      description: optionalText(item.description),
      unit: optionalText(item.unit),
      quantity: optionalNumber(item.quantity),
      acquisitionPrice: optionalText(item.acquisitionPrice),
      acquisitionDate: optionalText(item.acquisitionDate),
      remarks: optionalText(item.remarks)
    }))
  };
}

function normalizeUselessB(data = {}) {
  return {
    president: optionalText(data.president),
    memberA: optionalText(data.memberA),
    memberB: optionalText(data.memberB),
    commander: optionalText(data.commander),
    generalManager: optionalText(data.generalManager),
    uselessManager: optionalText(data.uselessManager),
    items: normalizeArray(data.items).map((item) => ({
      aa: optionalInteger(item.aa),
      shareNumber: optionalText(item.shareNumber),
      nomenclatureNumber: optionalText(item.nomenclatureNumber),
      description: optionalText(item.description),
      unit: optionalText(item.unit),
      qtyPrimary: optionalNumber(item.qtyPrimary),
      qtySecondary: optionalNumber(item.qtySecondary),
      diffPlus: optionalNumber(item.diffPlus),
      diffMinus: optionalNumber(item.diffMinus)
    }))
  };
}

function normalizeAmmo(data = {}) {
  return {
    officerRank: optionalText(data.officerRank),
    officerName: optionalText(data.officerName),
    unit: optionalText(data.unit),
    firingDate: optionalText(data.firingDate),
    dayOfWeek: optionalText(data.dayOfWeek),
    copiesCount: optionalInteger(data.copiesCount),
    items: normalizeArray(data.items).map((item) => {
      const itemType = optionalText(item.itemType);
      if (itemType && !AMMO_ITEM_TYPES.includes(itemType)) {
        throw new AppError('Μη έγκυρος τύπος γραμμής πυρομαχικών.', 'VALIDATION_ERROR');
      }
      return {
        itemType: itemType || null,
        shareNumber: optionalText(item.shareNumber),
        nomenclatureNumber: optionalText(item.nomenclatureNumber),
        description: optionalText(item.description),
        unit: optionalText(item.unit),
        quantity: optionalNumber(item.quantity)
      };
    })
  };
}

function normalizeGeneric(data = {}) {
  const normalized = data && typeof data === 'object' ? data : {};
  return JSON.parse(JSON.stringify(normalized));
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function optionalNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new AppError('Η ποσότητα πρέπει να είναι αριθμός.', 'VALIDATION_ERROR');
  }
  return number;
}

function optionalInteger(value) {
  if (value === null || value === undefined || String(value).trim() === '') {
    return null;
  }
  const number = Number(value);
  if (!Number.isInteger(number)) {
    throw new AppError('Η αριθμητική τιμή πρέπει να είναι ακέραιος.', 'VALIDATION_ERROR');
  }
  return number;
}

function mapDocument(row) {
  return {
    id: row.id,
    exhpId: row.exhp_id,
    documentType: row.document_type,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapUselessA(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.document_id,
    location: row.location || '',
    date: row.date || '',
    hdmNumber: row.hdm_number || '',
    president: row.president || '',
    memberA: row.member_a || '',
    memberB: row.member_b || '',
    periodFrom: row.period_from || '',
    periodTo: row.period_to || '',
    items: row.items.map((item) => ({
      id: item.id,
      documentId: item.document_id,
      aa: item.aa,
      shareNumber: item.share_number || '',
      nomenclatureNumber: item.nomenclature_number || '',
      description: item.description || '',
      unit: item.unit || '',
      quantity: item.quantity,
      acquisitionPrice: item.acquisition_price || '',
      acquisitionDate: item.acquisition_date || '',
      remarks: item.remarks || ''
    }))
  };
}

function mapUselessB(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.document_id,
    president: row.president || '',
    memberA: row.member_a || '',
    memberB: row.member_b || '',
    commander: row.commander || '',
    generalManager: row.general_manager || '',
    uselessManager: row.useless_manager || '',
    items: row.items.map((item) => ({
      id: item.id,
      documentId: item.document_id,
      aa: item.aa,
      shareNumber: item.share_number || '',
      nomenclatureNumber: item.nomenclature_number || '',
      description: item.description || '',
      unit: item.unit || '',
      qtyPrimary: item.qty_primary,
      qtySecondary: item.qty_secondary,
      diffPlus: item.diff_plus,
      diffMinus: item.diff_minus
    }))
  };
}

function mapAmmo(row) {
  if (!row) return null;
  return {
    id: row.id,
    documentId: row.document_id,
    officerRank: row.officer_rank || '',
    officerName: row.officer_name || '',
    unit: row.unit || '',
    firingDate: row.firing_date || '',
    dayOfWeek: row.day_of_week || '',
    copiesCount: row.copies_count,
    items: row.items.map((item) => ({
      id: item.id,
      documentId: item.document_id,
      itemType: item.item_type || '',
      shareNumber: item.share_number || '',
      nomenclatureNumber: item.nomenclature_number || '',
      description: item.description || '',
      unit: item.unit || '',
      quantity: item.quantity
    }))
  };
}

function mapGeneric(row) {
  if (!row) return null;
  return {
    documentId: row.documentId,
    data: row.data || {},
    updatedAt: row.updatedAt
  };
}

module.exports = {
  createExhpDocumentsService
};
