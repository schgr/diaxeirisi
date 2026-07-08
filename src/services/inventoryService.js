const { AppError } = require('../core/errorHandler');
const { requirePositiveId } = require('../core/validation');
const { createInventoryRepository } = require('../db/inventoryRepository');
const {
  validateInventoryCommittee,
  validateInventoryCount,
  validateInventorySession
} = require('../inventory/inventoryValidation');

function createInventoryService(db) {
  const repository = createInventoryRepository(db);

  return {
    getReferenceData(asOfDate = new Date().toISOString().slice(0, 10)) {
      return {
        today: new Date().toISOString().slice(0, 10),
        shares: repository.listShares(asOfDate).map(mapShare),
        sessions: repository.listSessions().map(mapSession)
      };
    },

    createSession(payload) {
      const session = validateInventorySession(payload);
      let id;
      let serialNumber;
      repository.transaction(() => {
        serialNumber = repository.getNextSerial(session.fiscalYear);
        id = repository.createSession({ ...session, serialNumber });
      });
      return {
        id,
        serialNumber,
        message: `Η απογραφή ${serialNumber}/${session.fiscalYear} δημιουργήθηκε.`
      };
    },

    saveCount(payload) {
      const count = validateInventoryCount(payload);
      const session = repository.getSession(count.sessionId);
      const share = session
        ? repository.getShareAtDate(count.shareId, session.inventory_date)
        : null;

      if (!session) throw new AppError('Η απογραφή δεν βρέθηκε.', 'NOT_FOUND');
      if (session.status === 'Ολοκληρωμένη') {
        throw new AppError('Η ολοκληρωμένη απογραφή δεν μπορεί να τροποποιηθεί.', 'VALIDATION_ERROR');
      }
      if (!share) throw new AppError('Η μερίδα δεν βρέθηκε.', 'NOT_FOUND');

      const accountingBalance = Number(share.balance_at_date);
      const partialManagementQuantity = Number(share.charged_quantity);
      const expectedWarehouseQuantity = accountingBalance - partialManagementQuantity;
      if (count.firstCount !== expectedWarehouseQuantity && count.secondCount === null) {
        throw new AppError(
          'Η πρώτη καταμέτρηση διαφέρει από το αναμενόμενο υπόλοιπο. Απαιτείται δεύτερη καταμέτρηση.',
          'VALIDATION_ERROR'
        );
      }
      const finalCount = count.secondCount === null ? count.firstCount : count.secondCount;
      const difference = finalCount - expectedWarehouseQuantity;

      repository.upsertItem({
        ...count,
        shareNumber: share.share_number,
        nominalNumber: share.nominal_number,
        description: share.description,
        measurementUnit: share.measurement_unit,
        accountingBalance,
        partialManagementQuantity,
        expectedWarehouseQuantity,
        finalCount,
        difference,
        differenceStatus: difference > 0 ? 'Πλεόνασμα' : difference < 0 ? 'Έλλειμμα' : 'Ισοσκελισμένη'
      });

      return {
        difference,
        differenceStatus: difference > 0 ? 'Πλεόνασμα' : difference < 0 ? 'Έλλειμμα' : 'Ισοσκελισμένη',
        message: 'Η καταμέτρηση αποθηκεύτηκε.'
      };
    },

    getSession(id) {
      const sessionId = requirePositiveId(id);
      const session = repository.getSession(sessionId);
      if (!session) throw new AppError('Η απογραφή δεν βρέθηκε.', 'NOT_FOUND');
      return {
        ...mapSession(session),
        items: repository.listItems(sessionId).map(mapItem)
      };
    },

    completeSession(id) {
      const sessionId = requirePositiveId(id);
      const session = repository.getSession(sessionId);
      if (!session) throw new AppError('Η απογραφή δεν βρέθηκε.', 'NOT_FOUND');
      const items = repository.listItems(sessionId);
      if (!items.length) {
        throw new AppError('Δεν μπορεί να ολοκληρωθεί απογραφή χωρίς καταμετρήσεις.', 'VALIDATION_ERROR');
      }
      repository.completeSession(sessionId);
      return { message: 'Η απογραφή ολοκληρώθηκε και κλειδώθηκε.' };
    },

    saveCommittee(id, payload) {
      const sessionId = requirePositiveId(id);
      const session = repository.getSession(sessionId);
      if (!session) throw new AppError('Η απογραφή δεν βρέθηκε.', 'NOT_FOUND');
      if (session.status === 'Ολοκληρωμένη') {
        throw new AppError('Η ολοκληρωμένη απογραφή δεν μπορεί να τροποποιηθεί.', 'VALIDATION_ERROR');
      }
      repository.updateCommittee(sessionId, validateInventoryCommittee(payload));
      return { message: 'Η Επιτροπή Καταμέτρησης αποθηκεύτηκε.' };
    },

    listDifferences() {
      return repository.listDifferences().map(mapDifference);
    },

    settleDifference(id, reference) {
      const itemId = requirePositiveId(id);
      const value = String(reference || '').trim();
      if (!value) {
        throw new AppError('Συμπλήρωσε τον αριθμό ΕΧΠ ή άλλο δικαιολογητικό τακτοποίησης.', 'VALIDATION_ERROR');
      }
      repository.settleDifference(itemId, value);
      return { message: 'Η διαφορά σημειώθηκε ως τακτοποιημένη.' };
    }
  };
}

function mapShare(row) {
  return {
    id: row.id,
    shareNumber: row.share_number,
    nominalNumber: row.nominal_number,
    description: row.description,
    measurementUnit: row.measurement_unit,
    accountingBalance: Number(row.accounting_balance),
    partialManagementQuantity: Number(row.charged_quantity),
    expectedWarehouseQuantity: Number(row.accounting_balance) - Number(row.charged_quantity)
  };
}

function mapSession(row) {
  return {
    id: row.id,
    fiscalYear: row.fiscal_year,
    serialNumber: row.serial_number,
    inventoryDate: row.inventory_date,
    title: row.title,
    status: row.status,
    notes: row.notes,
    committeePresidentRank: row.committee_president_rank || '',
    committeePresidentName: row.committee_president_name || '',
    committeeMemberARank: row.committee_member_a_rank || '',
    committeeMemberAName: row.committee_member_a_name || '',
    committeeMemberBRank: row.committee_member_b_rank || '',
    committeeMemberBName: row.committee_member_b_name || '',
    itemCount: Number(row.item_count || 0),
    differenceCount: Number(row.difference_count || 0)
  };
}

function mapItem(row) {
  return {
    id: row.id,
    shareId: row.share_id,
    shareNumber: row.share_number,
    nominalNumber: row.nominal_number,
    description: row.description,
    measurementUnit: row.measurement_unit,
    accountingBalance: Number(row.accounting_balance),
    partialManagementQuantity: Number(row.partial_management_quantity),
    expectedWarehouseQuantity: Number(row.expected_warehouse_quantity),
    firstCount: Number(row.first_count),
    secondCount: row.second_count === null ? null : Number(row.second_count),
    finalCount: Number(row.final_count),
    difference: Number(row.difference),
    differenceStatus: row.difference_status,
    settlementStatus: row.settlement_status,
    settlementReference: row.settlement_reference,
    notes: row.notes
  };
}

function mapDifference(row) {
  return {
    ...mapItem(row),
    inventoryDate: row.inventory_date,
    inventorySerial: `${row.serial_number}/${row.fiscal_year}`
  };
}

module.exports = {
  createInventoryService
};
