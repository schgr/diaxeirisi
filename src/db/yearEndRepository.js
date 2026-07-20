function createYearEndRepository(db) {
  return {
    listActiveShares() {
      return db.prepare(`
        SELECT id, share_number, nominal_number, description, measurement_unit,
               accounting_balance, charged_quantity
        FROM shares
        WHERE archive_status = 'Ενεργή'
        ORDER BY CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
                 CAST(share_number AS INTEGER), share_number COLLATE NOCASE, id
      `).all();
    },

    getRunForYear(fiscalYear) {
      return db.prepare('SELECT * FROM share_renumbering_runs WHERE fiscal_year = ?').get(fiscalYear);
    },

    getNextInventorySerial(fiscalYear) {
      const row = db.prepare(`
        SELECT COALESCE(MAX(serial_number), 0) + 1 AS next_serial
        FROM inventory_sessions
        WHERE fiscal_year = ?
      `).get(fiscalYear);
      return Number(row?.next_serial || 1);
    },

    createAnnualInventory(fiscalYear, shares) {
      const inventoryDate = `${fiscalYear}-12-31`;
      const serialNumber = this.getNextInventorySerial(fiscalYear);
      const sessionId = db.prepare(`
        INSERT INTO inventory_sessions (
          fiscal_year, serial_number, inventory_date, title, status, notes,
          inventory_reason, period_start, period_end
        ) VALUES (?, ?, ?, ?, 'Ολοκληρωμένη', ?, 'Ετήσια απογραφή Διαχείρισης', ?, ?)
      `).run(
        fiscalYear,
        serialNumber,
        inventoryDate,
        `Ετήσια απογραφή Διαχείρισης ${fiscalYear}`,
        'Δημιουργήθηκε πριν από την αλλαγή αρίθμησης μερίδων.',
        `${fiscalYear}-01-01`,
        inventoryDate
      ).lastInsertRowid;
      db.prepare('UPDATE inventory_sessions SET completed_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(sessionId);

      const insert = db.prepare(`
        INSERT INTO inventory_items (
          inventory_session_id, share_id, share_number, nominal_number,
          description, measurement_unit, accounting_balance,
          partial_management_quantity, expected_warehouse_quantity,
          first_count, second_count, final_count, difference,
          difference_status, settlement_status, settlement_reference, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, ?, 0, 'Ισοσκελισμένη', 'Τακτοποιήθηκε', ?, '')
      `);
      shares.forEach((share) => {
        const balance = Number(share.accounting_balance || 0);
        insert.run(
          sessionId,
          share.id,
          share.share_number,
          share.nominal_number,
          share.description,
          share.measurement_unit,
          balance,
          balance,
          balance,
          share.share_number
        );
      });
      return { sessionId, serialNumber };
    },

    applyRenumbering(fiscalYear, effectiveDate, items) {
      let result;
      db.transaction(() => {
        const shares = this.listActiveShares();
        const inventory = this.createAnnualInventory(fiscalYear, shares);
        const runId = db.prepare(`
          INSERT INTO share_renumbering_runs (fiscal_year, effective_date, inventory_session_id)
          VALUES (?, ?, ?)
        `).run(fiscalYear, effectiveDate, inventory.sessionId).lastInsertRowid;
        const audit = db.prepare(`
          INSERT INTO share_renumbering_items (
            run_id, share_id, old_share_number, new_share_number, archived
          ) VALUES (?, ?, ?, ?, ?)
        `);

        items.forEach((item) => {
          const share = shares.find((candidate) => Number(candidate.id) === Number(item.shareId));
          audit.run(runId, share.id, share.share_number, item.newShareNumber || '', item.archive ? 1 : 0);
          db.prepare(`
            UPDATE shares
            SET share_number = ?, previous_share_number = ?
            WHERE id = ?
          `).run(`__RENUMBER_${runId}_${share.id}`, share.share_number, share.id);
        });

        items.forEach((item) => {
          const share = shares.find((candidate) => Number(candidate.id) === Number(item.shareId));
          if (item.archive) {
            db.prepare(`
              UPDATE shares
              SET share_number = ?, archive_status = 'Αρχειοθετημένη',
                  archived_at = ?, archive_reason = 'Αλλαγή αρίθμησης μερίδων'
              WHERE id = ?
            `).run(share.share_number, effectiveDate, share.id);
            db.prepare(`
              INSERT INTO share_archive_events (share_id, action_type, action_date, reason)
              VALUES (?, 'Αρχειοθέτηση', ?, 'Αλλαγή αρίθμησης μερίδων')
            `).run(share.id, effectiveDate);
          } else {
            db.prepare('UPDATE shares SET share_number = ? WHERE id = ?')
              .run(item.newShareNumber, share.id);
          }
        });
        result = { runId, inventorySessionId: inventory.sessionId, inventorySerial: inventory.serialNumber };
      })();
      return result;
    },

    transaction(operation) {
      return db.transaction(operation)();
    }
  };
}

module.exports = { createYearEndRepository };
