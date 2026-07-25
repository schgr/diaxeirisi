function createAdministrationRepository(db) {
  return {
    listOfficerTerms() {
      return db.prepare(`
        SELECT * FROM officer_terms
        ORDER BY CASE WHEN end_date IS NULL THEN 0 ELSE 1 END, start_date DESC, id DESC
      `).all();
    },

    listDepartmentManagers() {
      return db.prepare(`
        SELECT id, department_name, department_head
        FROM department_managers
        ORDER BY sort_order, id
      `).all();
    },

    createOfficerTerm(payload) {
      return db.prepare(`
        INSERT INTO officer_terms (
          role_type, full_identity, rank, corps, registry_number, start_date,
          order_reference, assignment_order, relief_order,
          differences_ledger_reference, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payload.roleType,
        payload.fullIdentity,
        payload.rank,
        payload.corps,
        payload.registryNumber,
        payload.startDate,
        payload.orderReference,
        payload.assignmentOrder,
        payload.reliefOrder,
        payload.differencesLedgerReference,
        payload.notes
      ).lastInsertRowid;
    },

    closeOfficerTerm(id, endDate) {
      return db.prepare(`
        UPDATE officer_terms SET end_date = ? WHERE id = ? AND end_date IS NULL
      `).run(endDate, id);
    },

    getNextHandoverSerial(fiscalYear) {
      const row = db.prepare(`
        SELECT COALESCE(MAX(serial_number), 0) + 1 AS next_serial
        FROM general_management_handovers WHERE fiscal_year = ?
      `).get(fiscalYear);
      return Number(row.next_serial);
    },

    createHandover(payload) {
      return db.prepare(`
        INSERT INTO general_management_handovers (
          fiscal_year, serial_number, order_reference, start_date,
          outgoing_officer, incoming_officer, inventory_session_id, pending_documents
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payload.fiscalYear,
        payload.serialNumber,
        payload.orderReference,
        payload.startDate,
        payload.outgoingOfficer,
        payload.incomingOfficer,
        payload.inventorySessionId,
        payload.pendingDocuments
      ).lastInsertRowid;
    },

    insertHandoverCheck(handoverId, check) {
      db.prepare(`
        INSERT INTO general_management_handover_checks (
          handover_id, check_key, label
        ) VALUES (?, ?, ?)
      `).run(handoverId, check.key, check.label);
    },

    listHandovers() {
      return db.prepare(`
        SELECT handover.*, inventory.serial_number AS inventory_serial,
               inventory.fiscal_year AS inventory_year,
               COUNT(checks.id) AS check_count,
               COALESCE(SUM(checks.completed), 0) AS completed_check_count
        FROM general_management_handovers handover
        LEFT JOIN inventory_sessions inventory ON inventory.id = handover.inventory_session_id
        LEFT JOIN general_management_handover_checks checks ON checks.handover_id = handover.id
        GROUP BY handover.id
        ORDER BY handover.start_date DESC, handover.serial_number DESC
      `).all();
    },

    getHandover(id) {
      return db.prepare(`
        SELECT handover.*, inventory.serial_number AS inventory_serial,
               inventory.fiscal_year AS inventory_year
        FROM general_management_handovers handover
        LEFT JOIN inventory_sessions inventory ON inventory.id = handover.inventory_session_id
        WHERE handover.id = ?
      `).get(id);
    },

    listHandoverChecks(handoverId) {
      return db.prepare(`
        SELECT * FROM general_management_handover_checks
        WHERE handover_id = ? ORDER BY id
      `).all(handoverId);
    },

    updateHandoverCheck(id, completed, notes) {
      return db.prepare(`
        UPDATE general_management_handover_checks
        SET completed = ?, notes = ?
        WHERE id = ?
      `).run(completed ? 1 : 0, notes, id);
    },

    updateHandoverProtocol(id, protocolData) {
      return db.prepare(`
        UPDATE general_management_handovers
        SET protocol_data = ?
        WHERE id = ?
      `).run(JSON.stringify(protocolData), id);
    },

    completeHandover(id, payload) {
      return db.prepare(`
        UPDATE general_management_handovers
        SET status = 'Ολοκληρωμένη',
            completion_date = ?,
            outgoing_observations = ?,
            incoming_observations = ?
        WHERE id = ? AND status = 'Σε εξέλιξη'
      `).run(
        payload.completionDate,
        payload.outgoingObservations,
        payload.incomingObservations,
        id
      );
    },

    listCompletedInventories() {
      return db.prepare(`
        SELECT id, fiscal_year, serial_number, inventory_date, title
        FROM inventory_sessions
        WHERE status = 'Ολοκληρωμένη'
        ORDER BY inventory_date DESC, serial_number DESC
      `).all();
    },

    listSharesByArchiveStatus(status) {
      return db.prepare(`
        SELECT id, share_number, nominal_number, description, measurement_unit,
               accounting_balance, charged_quantity, archive_status, archived_at, archive_reason
        FROM shares
        WHERE archive_status = ?
        ORDER BY CAST(share_number AS INTEGER), share_number COLLATE NOCASE
      `).all(status);
    },

    getManagementReport(year) {
      const totals = db.prepare(`
        SELECT
          COUNT(*) AS total_shares,
          SUM(CASE WHEN accounting_balance = 0 THEN 1 ELSE 0 END) AS zero_balance_shares,
          SUM(CASE WHEN accounting_balance <> 0 THEN 1 ELSE 0 END) AS shares_with_balance,
          SUM(CASE WHEN charged_quantity < accounting_balance THEN 1 ELSE 0 END) AS deficit_shares,
          SUM(CASE WHEN charged_quantity > accounting_balance THEN 1 ELSE 0 END) AS surplus_shares,
          SUM(CASE WHEN requires_composition = 1 THEN 1 ELSE 0 END) AS composition_shares,
          SUM(CASE WHEN requires_composition = 1 AND NOT EXISTS (
            SELECT 1 FROM share_composition_items composition
            WHERE composition.share_id = shares.id
          ) THEN 1 ELSE 0 END) AS missing_composition_shares
        FROM shares
        WHERE archive_status = 'Ενεργή'
      `).get();
      const moved = db.prepare(`
        SELECT COUNT(DISTINCT movement.share_id) AS count
        FROM share_transactions movement
        JOIN shares share ON share.id = movement.share_id
        WHERE share.archive_status = 'Ενεργή'
          AND movement.transaction_date >= ?
          AND movement.transaction_date <= ?
          AND movement.notes <> 'INITIAL_ANNUAL_INVENTORY'
      `).get(`${year}-01-01`, `${year}-12-31`);
      const duplicateGroups = db.prepare(`
        SELECT nominal_number, COUNT(*) AS share_count,
               GROUP_CONCAT(share_number, ', ') AS share_numbers
        FROM shares
        WHERE archive_status = 'Ενεργή'
          AND TRIM(nominal_number) <> ''
        GROUP BY nominal_number COLLATE NOCASE
        HAVING COUNT(*) > 1
        ORDER BY nominal_number COLLATE NOCASE
      `).all();
      return {
        ...totals,
        moved_shares: Number(moved.count || 0),
        duplicate_nominal_groups: duplicateGroups
      };
    },

    getShare(id) {
      return db.prepare('SELECT * FROM shares WHERE id = ?').get(id);
    },

    setShareArchiveStatus(id, status, date, reason) {
      db.prepare(`
        UPDATE shares
        SET archive_status = ?, archived_at = ?, archive_reason = ?
        WHERE id = ?
      `).run(status, status === 'Αρχειοθετημένη' ? date : null, reason, id);
    },

    setLatestAnnualInventoryArchiveMarker(shareId, archived) {
      const session = db.prepare(`
        SELECT id
        FROM inventory_sessions
        WHERE inventory_reason = 'Ετήσια απογραφή Διαχείρισης'
        ORDER BY fiscal_year DESC, inventory_date DESC, id DESC
        LIMIT 1
      `).get();
      if (!session) return;
      db.prepare(`
        UPDATE inventory_items
        SET settlement_reference = ?
        WHERE inventory_session_id = ? AND share_id = ?
      `).run(archived ? 'Αρχείο' : '', session.id, shareId);
    },

    createArchiveEvent(shareId, actionType, actionDate, reason) {
      db.prepare(`
        INSERT INTO share_archive_events (share_id, action_type, action_date, reason)
        VALUES (?, ?, ?, ?)
      `).run(shareId, actionType, actionDate, reason);
    },

    transaction(operation) {
      return db.transaction(operation)();
    }
  };
}

module.exports = { createAdministrationRepository };
