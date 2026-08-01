const { listActiveShares } = require('./shareQueries');

function createInventoryRepository(db) {
  return {
    getNextSerial(fiscalYear) {
      const row = db
        .prepare(
          `
            SELECT COALESCE(MAX(serial_number), 0) + 1 AS next_serial
            FROM inventory_sessions
            WHERE fiscal_year = ?
          `
        )
        .get(fiscalYear);
      return Number(row ? row.next_serial : 1);
    },

    createSession(payload) {
      return db
        .prepare(
          `
            INSERT INTO inventory_sessions (
              fiscal_year, serial_number, inventory_date, title, notes,
              committee_president_rank, committee_president_name,
              committee_member_a_rank, committee_member_a_name,
              committee_member_b_rank, committee_member_b_name,
              inventory_reason, period_start, period_end
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `
        )
        .run(
          payload.fiscalYear,
          payload.serialNumber,
          payload.inventoryDate,
          payload.title,
          payload.notes,
          payload.committeePresidentRank,
          payload.committeePresidentName,
          payload.committeeMemberARank,
          payload.committeeMemberAName,
          payload.committeeMemberBRank,
          payload.committeeMemberBName,
          payload.inventoryReason,
          payload.periodStart || payload.inventoryDate,
          payload.periodEnd || payload.inventoryDate
        ).lastInsertRowid;
    },

    populateAnnualSession(sessionId, asOfDate) {
      const shares = this.listShares(asOfDate);
      shares.forEach((share) => this.upsertItem({
        sessionId,
        shareId: share.id,
        shareNumber: share.share_number,
        nominalNumber: share.nominal_number,
        description: share.description,
        measurementUnit: share.measurement_unit,
        accountingBalance: Number(share.accounting_balance || 0),
        partialManagementQuantity: 0,
        expectedWarehouseQuantity: 0,
        firstCount: Number(share.accounting_balance || 0),
        secondCount: null,
        finalCount: Number(share.accounting_balance || 0),
        difference: 0,
        differenceStatus: 'Ισοσκελισμένη',
        notes: ''
      }));
      return shares.length;
    },

    listSessions() {
      return db
        .prepare(
          `
            SELECT session.*,
                   COUNT(item.id) AS item_count,
                   COALESCE(SUM(CASE WHEN item.difference <> 0 THEN 1 ELSE 0 END), 0) AS difference_count
            FROM inventory_sessions session
            LEFT JOIN inventory_items item ON item.inventory_session_id = session.id
            GROUP BY session.id
            ORDER BY session.inventory_date DESC, session.serial_number DESC
          `
        )
        .all();
    },

    getSession(id) {
      return db.prepare('SELECT * FROM inventory_sessions WHERE id = ?').get(id);
    },

    completeSession(id) {
      db.prepare(
        `
          UPDATE inventory_sessions
          SET status = 'Ολοκληρωμένη',
              completed_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `
      ).run(id);
    },

    updateCommittee(id, payload) {
      db.prepare(`
        UPDATE inventory_sessions
        SET committee_president_rank = ?,
            committee_president_name = ?,
            committee_member_a_rank = ?,
            committee_member_a_name = ?,
            committee_member_b_rank = ?,
            committee_member_b_name = ?
        WHERE id = ?
      `).run(
        payload.committeePresidentRank,
        payload.committeePresidentName,
        payload.committeeMemberARank,
        payload.committeeMemberAName,
        payload.committeeMemberBRank,
        payload.committeeMemberBName,
        id
      );
    },

    listShares(asOfDate) {
      const futureMovements = db
        .prepare(
          `
            SELECT movement.share_id,
                   COALESCE(SUM(
                     CASE
                       WHEN movement.transaction_type = 'Χρέωση' THEN movement.quantity
                       WHEN movement.transaction_type = 'Πίστωση' THEN -movement.quantity
                       ELSE 0
                     END
                   ), 0) AS balance_change
            FROM share_transactions movement
            WHERE movement.transaction_date > ?
            GROUP BY movement.share_id
          `
        )
        .all(asOfDate);
      const futureChangeByShareId = new Map(
        futureMovements.map((row) => [Number(row.share_id), Number(row.balance_change || 0)])
      );
      return listActiveShares(db).map((share) => ({
        id: share.id,
        share_number: share.share_number,
        nominal_number: share.nominal_number,
        description: share.description,
        measurement_unit: share.measurement_unit,
        accounting_balance: Number(share.accounting_balance || 0)
          - (futureChangeByShareId.get(Number(share.id)) || 0),
        charged_quantity: share.charged_quantity
      }));
    },

    getShare(id) {
      return db.prepare('SELECT * FROM shares WHERE id = ?').get(id);
    },

    getShareAtDate(id, asOfDate) {
      return db.prepare(`
        SELECT share.*,
               COALESCE(SUM(
                 CASE
                   WHEN movement.transaction_type = 'Χρέωση' THEN movement.quantity
                   WHEN movement.transaction_type = 'Πίστωση' THEN -movement.quantity
                   ELSE 0
                 END
               ), 0) AS balance_at_date
        FROM shares share
        LEFT JOIN share_transactions movement
          ON movement.share_id = share.id
         AND movement.transaction_date <= ?
        WHERE share.id = ?
        GROUP BY share.id
      `).get(asOfDate, id);
    },

    upsertItem(payload) {
      db.prepare(
        `
          INSERT INTO inventory_items (
            inventory_session_id, share_id, share_number, nominal_number,
            description, measurement_unit, accounting_balance,
            partial_management_quantity, expected_warehouse_quantity,
            first_count, second_count, final_count, difference,
            difference_status, notes
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(inventory_session_id, share_id) DO UPDATE SET
            accounting_balance = excluded.accounting_balance,
            partial_management_quantity = excluded.partial_management_quantity,
            expected_warehouse_quantity = excluded.expected_warehouse_quantity,
            first_count = excluded.first_count,
            second_count = excluded.second_count,
            final_count = excluded.final_count,
            difference = excluded.difference,
            difference_status = excluded.difference_status,
            notes = excluded.notes
        `
      ).run(
        payload.sessionId,
        payload.shareId,
        payload.shareNumber,
        payload.nominalNumber,
        payload.description,
        payload.measurementUnit,
        payload.accountingBalance,
        payload.partialManagementQuantity,
        payload.expectedWarehouseQuantity,
        payload.firstCount,
        payload.secondCount,
        payload.finalCount,
        payload.difference,
        payload.differenceStatus,
        payload.notes
      );
    },

    listItems(sessionId) {
      return db
        .prepare(
          `
            SELECT *
            FROM inventory_items
            WHERE inventory_session_id = ?
            ORDER BY CAST(share_number AS INTEGER), share_number COLLATE NOCASE
          `
        )
        .all(sessionId);
    },

    listDifferences() {
      return db
        .prepare(
          `
            SELECT item.*, session.inventory_date, session.serial_number, session.fiscal_year
            FROM inventory_items item
            JOIN inventory_sessions session ON session.id = item.inventory_session_id
            WHERE item.difference <> 0
            ORDER BY session.inventory_date DESC, item.id DESC
          `
        )
        .all();
    },

    settleDifference(itemId, reference) {
      db.prepare(
        `
          UPDATE inventory_items
          SET settlement_status = 'Τακτοποιήθηκε',
              settlement_reference = ?
          WHERE id = ?
        `
      ).run(reference, itemId);
    },

    transaction(operation) {
      return db.transaction(operation)();
    }
  };
}

module.exports = {
  createInventoryRepository
};
