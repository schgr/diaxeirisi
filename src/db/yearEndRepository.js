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

    listInventoryShares() {
      return db.prepare(`
        SELECT id, share_number, nominal_number, description, measurement_unit,
               accounting_balance, charged_quantity, archive_status
        FROM shares
        ORDER BY CASE WHEN share_number GLOB '[0-9]*' THEN 0 ELSE 1 END,
                 CAST(share_number AS INTEGER), share_number COLLATE NOCASE, id
      `).all();
    },

    listAllShareIds() {
      return db.prepare('SELECT id FROM shares ORDER BY id').all().map((row) => Number(row.id));
    },

    getActiveFiscalYear() {
      const row = db.prepare('SELECT active_fiscal_year FROM service_settings WHERE id = 1').get();
      return Number(row?.active_fiscal_year || new Date().getFullYear());
    },

    listClosures() {
      return db.prepare(`
        SELECT fiscal_year, next_fiscal_year, closed_at
        FROM fiscal_year_closures
        ORDER BY fiscal_year DESC
      `).all();
    },

    getClosure(fiscalYear) {
      return db.prepare('SELECT * FROM fiscal_year_closures WHERE fiscal_year = ?').get(fiscalYear);
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

    createAnnualInventory(fiscalYear, shares, notes = 'Δημιουργήθηκε πριν από την αλλαγή αρίθμησης μερίδων.') {
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
        notes,
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
          share.archive_status === 'Αρχειοθετημένη' ? 'Αρχείο' : ''
        );
      });
      return { sessionId, serialNumber };
    },

    ensureClosingInventory(fiscalYear) {
      const existing = db.prepare(`
        SELECT id, serial_number
        FROM inventory_sessions
        WHERE fiscal_year = ?
          AND inventory_reason = 'Ετήσια απογραφή Διαχείρισης'
          AND status = 'Ολοκληρωμένη'
        ORDER BY inventory_date DESC, id DESC
        LIMIT 1
      `).get(fiscalYear);
      if (existing) {
        return { sessionId: Number(existing.id), serialNumber: Number(existing.serial_number) };
      }
      return this.createAnnualInventory(
        fiscalYear,
        this.listInventoryShares(),
        'Δημιουργήθηκε κατά το κλείσιμο του οικονομικού έτους.'
      );
    },

    listClosingBalances(inventorySessionId) {
      return db.prepare(`
        SELECT share_id, final_count
        FROM inventory_items
        WHERE inventory_session_id = ?
      `).all(inventorySessionId);
    },

    closeFiscalYear(fiscalYear, inventorySessionId, balances, archiveSnapshot) {
      const nextFiscalYear = fiscalYear + 1;
      db.transaction(() => {
        db.prepare(`
          INSERT INTO fiscal_year_closures (
            fiscal_year, next_fiscal_year, inventory_session_id, archive_snapshot
          ) VALUES (?, ?, ?, ?)
        `).run(fiscalYear, nextFiscalYear, inventorySessionId, JSON.stringify(archiveSnapshot));

        db.prepare(`
          DELETE FROM addy_documents
          WHERE document_date >= ? AND document_date <= ?
        `).run(`${fiscalYear}-01-01`, `${fiscalYear}-12-31`);
        db.prepare('DELETE FROM exhp_documents WHERE fiscal_year = ?').run(fiscalYear);
        db.prepare(`
          DELETE FROM share_transactions
          WHERE transaction_date <= ?
        `).run(`${fiscalYear}-12-31`);
        db.prepare('DELETE FROM share_change_sheet_entries').run();

        db.prepare(`
          UPDATE shares
          SET archive_status = 'Διαγραμμένη στο κλείσιμο',
              archive_reason = archive_reason || ' · Κλείσιμο Οικονομικού Έτους ' || ?
          WHERE archive_status = 'Αρχειοθετημένη'
        `).run(fiscalYear);

        const insertOpening = db.prepare(`
          INSERT INTO share_transactions (
            share_id, transaction_date, transaction_unit, transaction_type,
            document_reference, quantity, notes
          ) VALUES (?, ?, 'ΑΡΧΙΚΗ ΑΠΟΓΡΑΦΗ', 'Χρέωση', ?, ?, 'INITIAL_ANNUAL_INVENTORY')
        `);
        balances.forEach((item) => {
          const share = db.prepare(`
            SELECT id FROM shares WHERE id = ? AND archive_status = 'Ενεργή'
          `).get(item.share_id);
          if (!share) return;
          const quantity = Number(item.final_count || 0);
          db.prepare('UPDATE shares SET accounting_balance = ? WHERE id = ?')
            .run(quantity, item.share_id);
          insertOpening.run(
            item.share_id,
            `${fiscalYear}-12-31`,
            `ΤΕΛΕΥΤΑΙΑ ΕΤΗΣΙΑ ΑΠΟΓΡΑΦΗ ${fiscalYear}`,
            quantity
          );
        });
        db.prepare(`
          UPDATE service_settings
          SET active_fiscal_year = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = 1
        `).run(nextFiscalYear);
      })();
      return { fiscalYear, nextFiscalYear, inventorySessionId };
    },

    applyRenumbering(fiscalYear, effectiveDate, items) {
      let result;
      db.transaction(() => {
        const shares = this.listActiveShares();
        const inventory = this.createAnnualInventory(fiscalYear, this.listInventoryShares());
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
          audit.run(runId, share.id, share.share_number, item.newShareNumber, 0);
          db.prepare(`
            UPDATE shares
            SET share_number = ?, previous_share_number = ?
            WHERE id = ?
          `).run(`__RENUMBER_${runId}_${share.id}`, share.share_number, share.id);
        });

        items.forEach((item) => {
          const share = shares.find((candidate) => Number(candidate.id) === Number(item.shareId));
          db.prepare('UPDATE shares SET share_number = ? WHERE id = ?')
            .run(item.newShareNumber, share.id);
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
