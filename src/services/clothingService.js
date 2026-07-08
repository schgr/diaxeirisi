const { createClothingRepository } = require('../db/clothingRepository');
const { AppError } = require('../core/errorHandler');
const { optionalText, requirePositiveId, requireText } = require('../core/validation');

const CLOTHING_CATEGORIES = ['ιματισμός', 'υπόδηση', 'ατομικά'];
const DISTRIBUTION_TYPES = ['initial', 'replacement', 'return'];

function createClothingService(db) {
  const repository = createClothingRepository(db);

  return {
    getClothingItems() {
      return withErrors(() => repository.getClothingItems().map(mapClothingItem));
    },

    addClothingItem(data) {
      return withErrors(() => mapClothingItem(repository.addClothingItem(
        validateClothingItem(data)
      )));
    },

    updateClothingItem(id, data) {
      return withErrors(() => {
        const itemId = requirePositiveId(id, 'clothingItemId');
        if (!repository.getClothingItem(itemId)) {
          throw new AppError('Το είδος ιματισμού δεν βρέθηκε.', 'NOT_FOUND');
        }
        return mapClothingItem(repository.updateClothingItem(
          itemId,
          validateClothingItem(data)
        ));
      });
    },

    deleteClothingItem(id) {
      return withErrors(() => {
        const itemId = requirePositiveId(id, 'clothingItemId');
        if (!repository.getClothingItem(itemId)) {
          throw new AppError('Το είδος ιματισμού δεν βρέθηκε.', 'NOT_FOUND');
        }
        repository.deleteClothingItem(itemId);
        return { message: 'Το είδος ιματισμού διαγράφηκε.' };
      });
    },

    getDistributionsForExhp(exhpId) {
      return withErrors(() => {
        const documentId = requirePositiveId(exhpId, 'exhpId');
        if (!repository.getExhp(documentId)) {
          throw new AppError('Η ΕΧΠ δεν βρέθηκε.', 'NOT_FOUND');
        }
        return groupDistributionRows(repository.getDistributionsByExhp(documentId));
      });
    },

    saveDistribution(exhpId, distributionType, data) {
      return withErrors(() => {
        const documentId = requirePositiveId(exhpId, 'exhpId');
        if (!repository.getExhp(documentId)) {
          throw new AppError('Η ΕΧΠ δεν βρέθηκε.', 'NOT_FOUND');
        }
        const payload = validateDistribution(documentId, distributionType, data);
        const distributionId = data && data.id
          ? requirePositiveId(data.id, 'distributionId')
          : null;
        if (distributionId && !repository.getDistribution(distributionId)) {
          throw new AppError('Η χορήγηση ιματισμού δεν βρέθηκε.', 'NOT_FOUND');
        }
        const saved = distributionId
          ? repository.updateDistribution(distributionId, payload)
          : repository.createDistribution(payload);
        return {
          distribution: mapDistribution(saved),
          message: 'Η χορήγηση ιματισμού αποθηκεύτηκε.'
        };
      });
    },

    deleteDistribution(id) {
      return withErrors(() => {
        const distributionId = requirePositiveId(id, 'distributionId');
        if (!repository.getDistribution(distributionId)) {
          throw new AppError('Η χορήγηση ιματισμού δεν βρέθηκε.', 'NOT_FOUND');
        }
        repository.deleteDistribution(distributionId);
        return { message: 'Η χορήγηση ιματισμού διαγράφηκε.' };
      });
    },

    getSummary(month, year) {
      return withErrors(() => {
        const cleanMonth = Number(month);
        const cleanYear = Number(year);
        if (!Number.isInteger(cleanMonth) || cleanMonth < 1 || cleanMonth > 12) {
          throw new AppError('Ο μήνας πρέπει να είναι από 1 έως 12.', 'VALIDATION_ERROR');
        }
        if (!Number.isInteger(cleanYear) || cleanYear < 2000 || cleanYear > 9999) {
          throw new AppError('Το έτος δεν είναι έγκυρο.', 'VALIDATION_ERROR');
        }
        return repository.getDistributionSummary(cleanMonth, cleanYear).map((row) => ({
          subunit: row.subunit,
          distributionType: row.distribution_type,
          clothingItemId: Number(row.clothing_item_id),
          clothingItemName: row.clothing_item_name,
          clothingItemShortName: row.clothing_item_short_name || '',
          category: row.clothing_item_category,
          sortOrder: Number(row.clothing_item_sort_order || 0),
          totalQuantity: Number(row.total_quantity || 0),
          distributionCount: Number(row.distribution_count || 0)
        }));
      });
    }
  };
}

function validateClothingItem(data = {}) {
  const category = requireText(data.category, 'category');
  const sortOrder = data.sort_order !== undefined ? Number(data.sort_order) : Number(data.sortOrder || 0);
  if (!CLOTHING_CATEGORIES.includes(category)) {
    throw new AppError('Μη έγκυρη κατηγορία είδους ιματισμού.', 'VALIDATION_ERROR');
  }
  if (!Number.isInteger(sortOrder)) {
    throw new AppError('Η σειρά ταξινόμησης πρέπει να είναι ακέραιος αριθμός.', 'VALIDATION_ERROR');
  }
  return {
    name: requireText(data.name, 'name'),
    short_name: optionalText(data.short_name !== undefined ? data.short_name : data.shortName),
    category,
    sort_order: sortOrder
  };
}

function validateDistribution(exhpId, distributionType, data = {}) {
  const cleanType = requireText(distributionType, 'distributionType');
  if (!DISTRIBUTION_TYPES.includes(cleanType)) {
    throw new AppError('Μη έγκυρος τύπος χορήγησης ιματισμού.', 'VALIDATION_ERROR');
  }
  const items = (Array.isArray(data.items) ? data.items : [])
    .map((item) => {
      const quantity = Number(item.quantity || 0);
      if (!Number.isInteger(quantity) || quantity < 0) {
        throw new AppError('Η ποσότητα ιματισμού πρέπει να είναι μη αρνητικός ακέραιος.', 'VALIDATION_ERROR');
      }
      return {
        clothing_item_id: requirePositiveId(
          item.clothing_item_id !== undefined ? item.clothing_item_id : item.clothingItemId,
          'clothingItemId'
        ),
        quantity
      };
    })
    .filter((item) => item.quantity > 0);

  return {
    exhp_id: exhpId,
    distribution_type: cleanType,
    subunit: requireText(data.subunit, 'subunit'),
    soldier_rank: requireText(
      data.soldier_rank !== undefined ? data.soldier_rank : data.soldierRank,
      'soldierRank'
    ),
    soldier_name: requireText(
      data.soldier_name !== undefined ? data.soldier_name : data.soldierName,
      'soldierName'
    ),
    soldier_sg_sm_sk: optionalText(
      data.soldier_sg_sm_sk !== undefined ? data.soldier_sg_sm_sk : data.soldierSgSmSk
    ),
    esso: optionalText(data.esso),
    release_date: cleanType === 'return'
      ? optionalText(data.release_date !== undefined ? data.release_date : data.releaseDate)
      : '',
    signature: data.signature ? 1 : 0,
    items
  };
}

function groupDistributionRows(rows) {
  const distributions = new Map();
  rows.forEach((row) => {
    if (!distributions.has(row.id)) {
      distributions.set(row.id, mapDistribution({ ...row, items: [] }));
    }
    if (row.distribution_item_id) {
      distributions.get(row.id).items.push(mapDistributionItem(row));
    }
  });
  return Array.from(distributions.values());
}

function mapClothingItem(row) {
  return {
    id: Number(row.id),
    name: row.name,
    shortName: row.short_name || '',
    category: row.category,
    sortOrder: Number(row.sort_order || 0),
    active: Boolean(row.active),
    createdAt: row.created_at
  };
}

function mapDistribution(row) {
  return {
    id: Number(row.id),
    exhpId: Number(row.exhp_id),
    distributionType: row.distribution_type,
    subunit: row.subunit,
    soldierRank: row.soldier_rank,
    soldierName: row.soldier_name,
    soldierSgSmSk: row.soldier_sg_sm_sk || '',
    esso: row.esso || '',
    releaseDate: row.release_date || '',
    signature: Boolean(row.signature),
    createdAt: row.created_at,
    items: (row.items || []).map(mapDistributionItem)
  };
}

function mapDistributionItem(row) {
  return {
    id: Number(row.distribution_item_id !== undefined ? row.distribution_item_id : row.id),
    clothingItemId: Number(row.clothing_item_id),
    name: row.clothing_item_name,
    shortName: row.clothing_item_short_name || '',
    category: row.clothing_item_category,
    sortOrder: Number(row.clothing_item_sort_order || 0),
    quantity: Number(row.quantity || 0)
  };
}

function withErrors(operation) {
  try {
    return operation();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      error && error.message ? error.message : 'Δεν ήταν δυνατή η επεξεργασία των ειδών ιματισμού.',
      'UNEXPECTED_ERROR'
    );
  }
}

module.exports = {
  createClothingService
};
